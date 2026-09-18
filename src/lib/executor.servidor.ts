import { createServerFn } from "@tanstack/react-start";

import conhecimento from "./conhecimento.json";

/**
 * Executa uma consulta de LEITURA na API do cliente — só no servidor.
 *
 * As credenciais vêm do navegador a cada chamada e são usadas e descartadas:
 * não são gravadas em disco, não entram em log e nunca vão para o modelo de IA.
 *
 * A receita de cada endpoint (caminho, paginação, colunas) e a de autenticação
 * vêm de conhecimento.json, gerado do catálogo real.
 */

type Coluna = { titulo: string; caminho: string; tipo?: string };

type ReceitaEndpoint = {
  metodo: string;
  path: string;
  lista_em: string | null;
  campo_total: string | null;
  paginacao: {
    tipo: string;
    param_pagina?: string | null;
    param_tamanho?: string | null;
    tamanho_max?: number | null;
    param_cursor?: string | null;
    campo_proximo?: string | null;
    fim?: string | null;
  };
  filtros: { parametro: string; descricao: string }[];
  colunas: Coluna[];
  titulo: string;
};

type ReceitaAuth = {
  tipo: string;
  header?: string;
  prefixo?: string;
  headers_fixos?: Record<string, string>;
  credenciais_necessarias: { nome: string; rotulo: string; segredo: boolean; onde_obter: string }[];
  base_url_por_ambiente?: Record<string, string | null>;
  login?: {
    metodo: string;
    caminho: string;
    corpo: Record<string, string>;
    campo_token: string;
    prefixo?: string;
  };
};

const EXECUCAO = (
  conhecimento as unknown as {
    execucao: Record<string, { auth: ReceitaAuth; endpoints: Record<string, ReceitaEndpoint> }>;
  }
).execucao;

const TEMPO_LIMITE = 45_000;
const MAXIMO_PAGINAS = 50;

function valor(dado: unknown, expr: string | null): unknown {
  if (!expr || expr === "[]") return dado;
  let atual: unknown = dado;
  for (const parte of expr.split(".")) {
    if (atual && typeof atual === "object" && !Array.isArray(atual)) {
      atual = (atual as Record<string, unknown>)[parte];
    } else {
      return undefined;
    }
  }
  return atual;
}

async function comLimite(url: string, init: RequestInit) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TEMPO_LIMITE);
  try {
    return await fetch(url, { ...init, signal: controle.signal });
  } finally {
    clearTimeout(relogio);
  }
}

/** Troca usuário e senha pelo token, conforme a receita do catálogo. */
async function autenticar(auth: ReceitaAuth, credenciais: Record<string, string>, base: string) {
  const cabecalhos: Record<string, string> = {
    Accept: "application/json",
    ...(auth.headers_fixos ?? {}),
  };

  if (auth.tipo === "login_credenciais" && auth.login) {
    const corpo: Record<string, string> = {};
    for (const [campo, modelo] of Object.entries(auth.login.corpo)) {
      corpo[campo] = modelo.replace(
        /\{([a-z0-9_]+)\}/g,
        (_, chave: string) => credenciais[chave] ?? "",
      );
    }
    const resposta = await comLimite(base + auth.login.caminho, {
      method: auth.login.metodo,
      headers: { ...cabecalhos, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error(
        "Credenciais recusadas pelo sistema. Confira e-mail e senha do usuário de integração e se a opção 'Bloquear Acesso ao SAGI Mobile' está desmarcada no cadastro dele.",
      );
    }
    if (!resposta.ok) {
      throw new Error(`O login respondeu HTTP ${resposta.status}.`);
    }
    const token = valor(await resposta.json(), auth.login.campo_token);
    if (!token) throw new Error("O login não devolveu token.");
    cabecalhos["Authorization"] = (auth.login.prefixo ?? "Bearer ") + String(token);
    return cabecalhos;
  }

  if (auth.tipo === "header_api_key" && auth.header) {
    const nome = auth.credenciais_necessarias[0]?.nome ?? "api_key";
    cabecalhos[auth.header] = (auth.prefixo ?? "") + (credenciais[nome] ?? "");
    return cabecalhos;
  }

  throw new Error(`Autenticação '${auth.tipo}' ainda não é executada pelo assistente.`);
}

type Entrada = {
  endpointId: string;
  credenciais: Record<string, string>;
  filtros?: Record<string, string>;
  maximo?: number;
};

/** Núcleo da execução, isolado da camada de servidor para poder ser testado. */
export async function consultarSistema(data: Entrada) {
  {
    const slug = Object.keys(EXECUCAO).find((s) => data.endpointId.startsWith(s + "."));
    const sistema = slug ? EXECUCAO[slug] : undefined;
    const receita = sistema?.endpoints[data.endpointId];

    if (!sistema || !receita) {
      throw new Error(`Consulta não disponível para execução: ${data.endpointId}`);
    }

    const base = (
      data.credenciais["base_url"] ||
      sistema.auth.base_url_por_ambiente?.["producao"] ||
      ""
    ).replace(/\/$/, "");
    if (!base) throw new Error("Endereço da API não informado.");

    const cabecalhos = await autenticar(sistema.auth, data.credenciais, base);

    const maximo = Math.min(data.maximo ?? 1000, 5000);
    const pag = receita.paginacao ?? { tipo: "nenhuma" };
    const tamanho = Math.min(pag.tamanho_max ?? 100, maximo);
    const linhas: Record<string, unknown>[] = [];
    let pagina = 0;
    let cursor: string | number | null = null;

    while (pagina < MAXIMO_PAGINAS) {
      const parametros = new URLSearchParams(data.filtros ?? {});
      if (pag.tipo === "offset" && pag.param_pagina && pag.param_tamanho) {
        parametros.set(pag.param_pagina, String(linhas.length));
        parametros.set(pag.param_tamanho, String(tamanho));
      } else if (pag.tipo === "page" && pag.param_pagina && pag.param_tamanho) {
        parametros.set(pag.param_pagina, String(pagina + 1));
        parametros.set(pag.param_tamanho, String(tamanho));
      } else if (
        (pag.tipo === "cursor" || pag.tipo === "versao") &&
        cursor !== null &&
        pag.param_cursor
      ) {
        parametros.set(pag.param_cursor, String(cursor));
      }

      const consulta = parametros.toString();
      const resposta = await comLimite(base + receita.path + (consulta ? `?${consulta}` : ""), {
        method: receita.metodo,
        headers: cabecalhos,
      });

      if (resposta.status === 401 || resposta.status === 403) {
        throw new Error("O sistema recusou a credencial nesta consulta (401/403).");
      }
      if (resposta.status === 429) {
        throw new Error("O sistema pediu para aguardar (limite de requisições atingido).");
      }
      if (!resposta.ok) {
        throw new Error(`A API respondeu HTTP ${resposta.status}.`);
      }
      if (resposta.status === 204) break;

      const corpo = await resposta.json();
      const lote = valor(corpo, receita.lista_em);
      const itens = Array.isArray(lote) ? lote : lote ? [lote] : [];
      linhas.push(...(itens as Record<string, unknown>[]));

      if (pag.tipo === "nenhuma" || itens.length === 0 || linhas.length >= maximo) break;
      if (pag.fim === "pagina_incompleta" && itens.length < tamanho) break;
      if (pag.fim === "hasMore_false" && !valor(corpo, "hasMore")) break;
      if (pag.tipo === "versao" || pag.tipo === "cursor") {
        const campo = pag.campo_proximo ?? "versao";
        const valores = itens
          .map((i) => valor(i, campo))
          .filter((v): v is number | string => v !== undefined && v !== null);
        if (valores.length === 0) break;
        cursor = valores.reduce((a, b) => (Number(a) > Number(b) ? a : b));
      }
      pagina += 1;
      await new Promise((r) => setTimeout(r, 350));
    }

    const colunas = receita.colunas.length
      ? receita.colunas
      : Object.keys(linhas[0] ?? {}).map((k) => ({ titulo: k, caminho: k }));

    return {
      titulo: receita.titulo,
      metodo: receita.metodo,
      path: receita.path,
      colunas: colunas.map((c) => ({ titulo: c.titulo, chave: c.caminho })),
      linhas: linhas.slice(0, maximo).map((linha) => {
        const saida: Record<string, string | number> = {};
        for (const c of colunas) {
          const v = valor(linha, c.caminho);
          saida[c.caminho] =
            v === null || v === undefined
              ? ""
              : typeof v === "object"
                ? JSON.stringify(v)
                : (v as string | number);
        }
        return saida;
      }),
    };
  }
}

export const executarConsultaReal = createServerFn({ method: "POST" })
  .validator((dados: Entrada) => dados)
  .handler(async ({ data }) => consultarSistema(data));

/** Credenciais que o cliente precisa entregar para uma consulta (sem valores). */
export function credenciaisNecessarias(slug: string) {
  return EXECUCAO[slug]?.auth.credenciais_necessarias ?? [];
}
