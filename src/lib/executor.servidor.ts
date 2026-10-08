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
    /** 1 quando o deslocamento começa em 1 (ex.: movimentos do Sagi). */
    offset_base?: number;
  };
  filtros: { parametro: string; descricao: string }[];
  campos_filtro?: CampoFiltro[];
  /** Parâmetros obrigatórios enviados sempre com o padrão documentado (ex.: codfor=0). */
  padroes_fixos?: Record<string, string | number | boolean>;
  colunas: Coluna[];
  titulo: string;
};

export type CampoFiltro = {
  nome: string;
  rotulo: string;
  tipo: "data" | "texto" | "opcao";
  papel: "periodo_inicio" | "periodo_fim" | "data" | "filial" | "opcao" | "caminho";
  obrigatorio: boolean;
  padrao?: string;
  opcoes?: string[];
  dica?: string;
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

/** Nomes usuais do campo de token, normalizados (minúsculas, sem _ ou -). */
const NOMES_DE_TOKEN = new Set([
  "token",
  "accesstoken",
  "jwt",
  "idtoken",
  "bearer",
  "authorization",
]);
const normalizarChave = (chave: string) => chave.toLowerCase().replace(/[_-]/g, "");

/**
 * Procura o token na resposta do login.
 * Tenta o caminho do catálogo e, se não achar, varre a resposta atrás dos nomes usuais —
 * sistemas brasileiros variam muito aqui (token na raiz, dentro de `data`, dentro de `user[0]`).
 */
function procurarToken(
  corpo: unknown,
  caminhoPreferido: string | null,
  profundidade = 0,
): string | null {
  if (profundidade === 0 && caminhoPreferido) {
    const direto = valor(corpo, caminhoPreferido);
    if (typeof direto === "string" && direto.length > 10) return direto;
  }
  if (profundidade > 4 || corpo === null || typeof corpo !== "object") return null;

  if (Array.isArray(corpo)) {
    for (const item of corpo.slice(0, 5)) {
      const achado = procurarToken(item, null, profundidade + 1);
      if (achado) return achado;
    }
    return null;
  }

  const registro = corpo as Record<string, unknown>;
  for (const [chave, v] of Object.entries(registro)) {
    if (typeof v === "string" && v.length > 10 && NOMES_DE_TOKEN.has(normalizarChave(chave))) {
      return v;
    }
  }
  for (const v of Object.values(registro)) {
    const achado = procurarToken(v, null, profundidade + 1);
    if (achado) return achado;
  }
  return null;
}

type Registro = Record<string, unknown>;

const ehRegistro = (v: unknown): v is Registro =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Encontra a lista de registros na resposta.
 * Usa o caminho do catálogo; se ele apontar para um "envelope" (ex.: { data: [...] })
 * em vez da lista, procura dentro dele o primeiro array de objetos.
 */
function extrairLista(corpo: unknown, listaEm: string | null): Registro[] {
  const alvo = valor(corpo, listaEm);
  const candidatos = [alvo, corpo];
  for (const c of candidatos) {
    if (Array.isArray(c)) return c.filter(ehRegistro);
    if (ehRegistro(c)) {
      const interno = Object.values(c).find(
        (v) => Array.isArray(v) && v.length > 0 && v.every(ehRegistro),
      );
      if (Array.isArray(interno)) return interno as Registro[];
    }
  }
  return ehRegistro(alvo) ? [alvo] : [];
}

const normalizarCampo = (nome: string) => nome.toLowerCase().replace(/[_\-\s]/g, "");

/** Lê o campo pelo caminho exato; se não existir, tenta ignorando maiúsculas e separadores. */
function valorFlexivel(registro: Registro, caminho: string): unknown {
  const exato = valor(registro, caminho);
  if (exato !== undefined || caminho.includes(".")) return exato;
  const alvo = normalizarCampo(caminho);
  const chave = Object.keys(registro).find((k) => normalizarCampo(k) === alvo);
  return chave === undefined ? undefined : registro[chave];
}

type ColunaSaida = { titulo: string; caminho: string };

/**
 * Decide as colunas da planilha sem nunca descartar dado:
 * mantém as colunas do catálogo que trouxeram valor e acrescenta os campos reais
 * da resposta que nenhuma coluna cobriu. Devolve um aviso quando o catálogo não bateu.
 */
function resolverColunas(
  documentadas: ColunaSaida[],
  registros: Registro[],
): { colunas: ColunaSaida[]; aviso: string | null } {
  if (registros.length === 0) return { colunas: documentadas, aviso: null };

  const amostra = registros.slice(0, 50);
  const temValor = (caminho: string) =>
    amostra.some((r) => {
      const v = valorFlexivel(r, caminho);
      return v !== undefined && v !== null && v !== "";
    });

  const usadas = documentadas.filter((c) => temValor(c.caminho));
  const faltantes = documentadas.filter((c) => !usadas.includes(c)).map((c) => c.caminho);

  const reais = Array.from(new Set(amostra.flatMap((r) => Object.keys(r))));
  const cobertos = new Set(
    usadas.map((c) => normalizarCampo(c.caminho.split(".")[0] ?? c.caminho)),
  );
  const extras = reais
    .filter((k) => !cobertos.has(normalizarCampo(k)))
    .map((k) => ({ titulo: k, caminho: k }));

  const colunas = [...usadas, ...extras];
  let aviso: string | null = null;
  if (usadas.length === 0) {
    aviso =
      `Nenhuma coluna do catálogo bateu com a resposta; usei os campos reais (${reais.join(", ")}). ` +
      "Envie esta lista para ajustar o catálogo.";
  } else if (faltantes.length > 0) {
    aviso = `Colunas do catálogo sem valor na resposta: ${faltantes.join(", ")}.`;
  }
  return { colunas, aviso };
}

/** Nomes dos campos da resposta, para diagnóstico — sem os valores. */
function camposDe(corpo: unknown): string {
  if (Array.isArray(corpo)) return `lista com ${corpo.length} item(ns)`;
  if (corpo && typeof corpo === "object")
    return Object.keys(corpo as object).join(", ") || "nenhum";
  return typeof corpo;
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
    const texto = await resposta.text();
    let dadosLogin: unknown = null;
    try {
      dadosLogin = JSON.parse(texto);
    } catch {
      throw new Error(
        `O login respondeu HTTP ${resposta.status}, mas o conteúdo não é JSON (começa com "${texto.slice(0, 60)}"). ` +
          "Confira o endereço da API: um endereço errado costuma devolver página HTML.",
      );
    }

    // alguns sistemas devolvem o token em cabeçalho, não no corpo
    const doCabecalho = resposta.headers.get("authorization") ?? resposta.headers.get("x-token");
    const token = procurarToken(dadosLogin, auth.login.campo_token) ?? doCabecalho;

    if (!token) {
      throw new Error(
        `O login funcionou (HTTP ${resposta.status}), mas não encontrei o token na resposta. ` +
          `Campos recebidos: ${camposDe(dadosLogin)}. ` +
          "Mande essa lista para quem cuida do catálogo: é só ajustar o nome do campo do token.",
      );
    }
    cabecalhos["Authorization"] =
      (auth.login.prefixo ?? "Bearer ") + String(token).replace(/^Bearer\s+/i, "");
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

    // filtros: valida obrigatórios antes de autenticar, para não gastar login à toa
    const campos = receita.campos_filtro ?? [];
    const informados = Object.fromEntries(
      Object.entries(data.filtros ?? {}).filter(([, v]) => String(v ?? "").trim() !== ""),
    );
    const faltando = campos
      .filter((c) => c.obrigatorio && !informados[c.nome])
      .map((c) => c.rotulo);
    if (faltando.length > 0) {
      throw new Error(`Preencha os filtros obrigatórios: ${faltando.join(", ")}.`);
    }
    const inicio = campos.find((c) => c.papel === "periodo_inicio");
    const fim = campos.find((c) => c.papel === "periodo_fim");
    if (inicio && fim && informados[inicio.nome] && informados[fim.nome]) {
      if (String(informados[inicio.nome]) > String(informados[fim.nome])) {
        throw new Error("A data inicial é posterior à data final.");
      }
    }

    // parâmetros de caminho (ex.: /saldo/fornecedores/{id}) saem da query e entram no endereço
    let caminho = receita.path;
    for (const c of campos.filter((c) => c.papel === "caminho")) {
      caminho = caminho.replace(`{${c.nome}}`, encodeURIComponent(String(informados[c.nome])));
      delete informados[c.nome];
    }
    const consultaBase: Record<string, string> = {};
    for (const [k, v] of Object.entries(receita.padroes_fixos ?? {})) consultaBase[k] = String(v);
    for (const [k, v] of Object.entries(informados)) consultaBase[k] = String(v);

    const cabecalhos = await autenticar(sistema.auth, data.credenciais, base);

    const maximo = Math.min(data.maximo ?? 1000, 5000);
    const pag = receita.paginacao ?? { tipo: "nenhuma" };
    const tamanho = Math.min(pag.tamanho_max ?? 100, maximo);
    const linhas: Record<string, unknown>[] = [];
    let pagina = 0;
    let cursor: string | number | null = null;

    while (pagina < MAXIMO_PAGINAS) {
      const parametros = new URLSearchParams(consultaBase);
      if (pag.tipo === "offset" && pag.param_pagina && pag.param_tamanho) {
        parametros.set(pag.param_pagina, String(linhas.length + (pag.offset_base ?? 0)));
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
      const resposta = await comLimite(base + caminho + (consulta ? `?${consulta}` : ""), {
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
      const itens = extrairLista(corpo, receita.lista_em);
      linhas.push(...itens);

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

    const registros = linhas.slice(0, maximo);
    const { colunas, aviso } = resolverColunas(receita.colunas, registros);

    return {
      titulo: receita.titulo,
      metodo: receita.metodo,
      path: receita.path,
      aviso,
      colunas: colunas.map((c) => ({ titulo: c.titulo, chave: c.caminho })),
      linhas: registros.map((linha) => {
        const saida: Record<string, string | number> = {};
        for (const c of colunas) {
          const v = valorFlexivel(linha, c.caminho);
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
