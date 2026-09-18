import { createServerFn } from "@tanstack/react-start";

import conhecimento from "./conhecimento.json";

/**
 * Cérebro do assistente — roda SOMENTE no servidor.
 *
 * A chave da IA vem de variável de ambiente e nunca chega ao navegador:
 *   ANTHROPIC_API_KEY  (Claude)  ou  OPENAI_API_KEY
 *   MODELO_IA          (opcional) para trocar o modelo
 *
 * O conhecimento vem de src/lib/conhecimento.json, gerado do catálogo real
 * (catalogo/scripts/gerar_conhecimento.py). Só o recorte relevante para a
 * pergunta é enviado ao modelo, para manter o custo baixo e a resposta precisa.
 */

type Consulta = {
  id: string;
  sistema: string;
  slug: string;
  entidade: string;
  acao: string;
  metodo: string;
  path: string;
  descricao: string;
  fonte?: string;
  quando_usar?: string;
  filtros?: string[];
  colunas?: string[];
  paginacao?: string;
};

type Escrita = Omit<Consulta, "filtros" | "colunas" | "paginacao" | "quando_usar"> & {
  motivo_nao_executa?: string;
};

type Sistema = {
  slug: string;
  nome: string;
  categoria: string;
  descricao: string;
  estilo: string;
  autenticacao: string;
  credenciais: string[];
  sandbox: boolean;
  indice_integrabilidade: number;
  armadilhas: string[];
  lacunas: string[];
};

const BASE = conhecimento as unknown as {
  gerado_em: string;
  sistemas: Sistema[];
  consultas: Consulta[];
  escritas: Escrita[];
};

const PARADAS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "com",
  "que",
  "quero",
  "queria",
  "preciso",
  "gostaria",
  "meu",
  "minha",
  "meus",
  "minhas",
  "todos",
  "todas",
  "lista",
  "listar",
  "quais",
  "como",
  "qual",
  "faz",
  "fazer",
  "uma",
  "dos",
  "pelo",
  "pela",
]);

function termos(texto: string): Set<string> {
  const limpo = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return new Set(limpo.split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !PARADAS.has(p)));
}

/** Seleciona o recorte do catálogo que interessa à pergunta. */
function selecionar(pergunta: string) {
  const palavras = termos(pergunta);
  const pontuar = (texto: string) => {
    const alvo = termos(texto);
    let pontos = 0;
    palavras.forEach((p) => {
      if (alvo.has(p)) pontos += 1;
    });
    return pontos;
  };

  const consultas = BASE.consultas
    .map((c) => ({
      item: c,
      pontos:
        pontuar(`${c.sistema} ${c.entidade} ${c.descricao} ${c.quando_usar ?? ""} ${c.path}`) +
        pontuar((c.colunas ?? []).join(" ")) * 0.5,
    }))
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 14)
    .map((r) => r.item);

  const escritas = BASE.escritas
    .map((e) => ({
      item: e,
      pontos: pontuar(`${e.sistema} ${e.entidade} ${e.descricao} ${e.path}`),
    }))
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 6)
    .map((r) => r.item);

  const slugs = new Set([...consultas, ...escritas].map((i) => i.slug));
  const sistemas = BASE.sistemas.filter((s) => slugs.has(s.slug));

  return { consultas, escritas, sistemas };
}

function instrucoes(pergunta: string) {
  const { consultas, escritas, sistemas } = selecionar(pergunta);
  const catalogo =
    sistemas.length > 0 ? { sistemas, consultas, escritas } : { sistemas: BASE.sistemas };

  return `Você é o assistente de integrações de um produto brasileiro. Você conhece as APIs dos sistemas abaixo porque elas foram documentadas a partir da documentação oficial de cada fornecedor.

O QUE VOCÊ FAZ
- Explica o que dá para integrar, como autenticar, quais limites e armadilhas existem.
- Quando o cliente quer dados, indica a CONSULTA certa e explica o que virá na planilha.
- Quando o cliente quer criar, emitir ou cancelar algo, explica como se faz e deixa claro que você não executa: operações de escrita ficam com o cliente.

REGRAS
- Responda em português do Brasil, direto, sem enrolação.
- Use SOMENTE o que está no catálogo abaixo. Se a informação não estiver lá, diga que não foi documentada — nunca invente endpoint, campo, limite ou preço.
- Cite o id da consulta (ex.: asaas.cobranca.listar) e o método com o caminho quando indicar uma operação.
- Se a pergunta for ambígua, ofereça no máximo três opções e pergunte qual serve.
- Se o assunto não tiver relação com os sistemas documentados, diga com franqueza quais sistemas você cobre.
- Seja honesto sobre lacunas: se o catálogo registra que algo não é publicado pelo fornecedor (preço, limite de requisições), diga isso.

CATÁLOGO (recorte relevante para esta pergunta)
${JSON.stringify(catalogo)}

SISTEMAS COBERTOS NO TOTAL: ${BASE.sistemas.map((s) => s.nome).join(", ")}.
Catálogo gerado em ${BASE.gerado_em}.`;
}

type Entrada = { pergunta: string; historico: { autor: string; texto: string }[] };

async function chamarAnthropic(chave: string, sistema: string, entrada: Entrada) {
  const modelo = process.env["MODELO_IA"] || "claude-sonnet-5";
  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 1200,
      system: sistema,
      messages: [
        ...entrada.historico.slice(-6).map((m) => ({
          role: m.autor === "cliente" ? "user" : "assistant",
          content: m.texto,
        })),
        { role: "user", content: entrada.pergunta },
      ],
    }),
  });

  if (!resposta.ok) {
    throw new Error(
      `Claude respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`,
    );
  }
  const dados = (await resposta.json()) as { content: { type: string; text?: string }[] };
  return dados.content
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();
}

async function chamarOpenAI(chave: string, sistema: string, entrada: Entrada) {
  const modelo = process.env["MODELO_IA"] || "gpt-4o-mini";
  const resposta = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${chave}` },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 1200,
      messages: [
        { role: "system", content: sistema },
        ...entrada.historico.slice(-6).map((m) => ({
          role: m.autor === "cliente" ? "user" : "assistant",
          content: m.texto,
        })),
        { role: "user", content: entrada.pergunta },
      ],
    }),
  });

  if (!resposta.ok) {
    throw new Error(
      `OpenAI respondeu ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`,
    );
  }
  const dados = (await resposta.json()) as { choices: { message: { content: string } }[] };
  return (dados.choices[0]?.message.content ?? "").trim();
}

export const perguntarAoAssistente = createServerFn({ method: "POST" })
  .validator((dados: Entrada) => dados)
  .handler(async ({ data }) => {
    const anthropic = process.env["ANTHROPIC_API_KEY"];
    const openai = process.env["OPENAI_API_KEY"];

    if (!anthropic && !openai) {
      return {
        origem: "sem_chave" as const,
        resposta:
          "A IA ainda não está ligada neste ambiente. Configure a variável ANTHROPIC_API_KEY (ou OPENAI_API_KEY) no servidor e recarregue a página.",
        candidatos: selecionar(data.pergunta)
          .consultas.slice(0, 3)
          .map((c) => c.id),
      };
    }

    const sistema = instrucoes(data.pergunta);
    const texto = anthropic
      ? await chamarAnthropic(anthropic, sistema, data)
      : await chamarOpenAI(openai as string, sistema, data);

    return {
      origem: "ia" as const,
      resposta: texto,
      candidatos: selecionar(data.pergunta)
        .consultas.slice(0, 3)
        .map((c) => c.id),
    };
  });
