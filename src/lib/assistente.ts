import { buscarConsultas, gerarLinhas, SISTEMAS, type Consulta } from "./catalogo-demo";
import type { DadosPlanilha } from "./planilha";

export type Mensagem = {
  id: string;
  autor: "cliente" | "assistente";
  texto: string;
  propostas?: Consulta[];
  planilha?: DadosPlanilha;
};

export const CHAVE_BACKEND = "assistente:url-backend";

const identificador = () => Math.random().toString(36).slice(2, 10);

export function mensagem(
  autor: Mensagem["autor"],
  texto: string,
  extra: Partial<Mensagem> = {},
): Mensagem {
  return { id: identificador(), autor, texto, ...extra };
}

export const BOAS_VINDAS = mensagem(
  "assistente",
  `Olá. Eu consulto a API do sistema que a sua empresa usa e devolvo os dados em planilha.

Me diga o que você precisa, em português mesmo. Por exemplo: "cobranças pagas no último mês", "movimentos de estoque da matriz" ou "notas fiscais recebidas".

Sistemas conectados nesta demonstração: ${SISTEMAS.join(", ")}.`,
);

/** Resposta do assistente em modo demonstração (sem backend configurado). */
export function responderLocalmente(pergunta: string): Mensagem {
  const candidatos = buscarConsultas(pergunta);

  if (candidatos.length === 0) {
    return mensagem(
      "assistente",
      `Não encontrei no catálogo uma consulta que atenda a isso.

Nesta demonstração eu cubro ${SISTEMAS.join(", ")}. Tente, por exemplo, "cobranças do mês", "pedidos de venda", "movimentos de estoque", "pagamentos recebidos" ou "notas fiscais recebidas".`,
    );
  }

  const [principal] = candidatos as [Consulta, ...Consulta[]];
  const outros = candidatos.slice(1);

  const texto = [
    `Encontrei no **${principal.sistema}** uma consulta que atende: **${principal.titulo}**.`,
    principal.descricao,
    "",
    `Vou chamar \`${principal.metodo} ${principal.caminho}\` e montar a planilha com: ${principal.colunas
      .map((c) => c.titulo)
      .join(", ")}.`,
    outros.length > 0
      ? `\nSe não for essa, também servem: ${outros.map((c) => `${c.titulo} (${c.sistema})`).join(" · ")}.`
      : "",
    "\nPosso executar?",
  ]
    .filter(Boolean)
    .join("\n");

  return mensagem("assistente", texto, { propostas: candidatos });
}

/** Executa a consulta aprovada. Em demonstração, devolve dados fictícios no formato real. */
export function executarConsulta(consulta: Consulta, quantidade = 24): Mensagem {
  const linhas = gerarLinhas(consulta, quantidade);
  const planilha: DadosPlanilha = {
    nomeArquivo: `${consulta.id.replace(/\./g, "_")}.xlsx`,
    titulo: `${consulta.titulo} — ${consulta.sistema}`,
    colunas: consulta.colunas,
    linhas,
    informacoes: [
      { rotulo: "Sistema", valor: consulta.sistema },
      { rotulo: "Consulta", valor: consulta.id },
      { rotulo: "Chamada", valor: `${consulta.metodo} ${consulta.caminho}` },
      { rotulo: "Registros", valor: String(linhas.length) },
      { rotulo: "Gerado em", valor: new Date().toLocaleString("pt-BR") },
      {
        rotulo: "Observação",
        valor:
          "Demonstração: dados fictícios no formato real da API. Conecte a credencial para trazer os dados da empresa.",
      },
    ],
  };

  return mensagem(
    "assistente",
    `Pronto. ${linhas.length} registros de **${consulta.titulo}** (${consulta.sistema}).

Os dados desta demonstração são fictícios; a estrutura é a mesma que a API devolve.`,
    { planilha },
  );
}

type RespostaBackend = {
  resposta: string;
  planilha?: {
    nomeArquivo?: string;
    titulo?: string;
    colunas: { titulo: string; chave: string }[];
    linhas: Record<string, string | number>[];
  };
};

/**
 * Conversa com um backend próprio, quando configurado.
 * O backend guarda as credenciais e a chave da IA — nada disso fica no navegador.
 */
export async function responderPeloBackend(
  url: string,
  historico: Mensagem[],
  pergunta: string,
): Promise<Mensagem> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pergunta,
      historico: historico.map(({ autor, texto }) => ({ autor, texto })),
    }),
  });

  if (!resposta.ok) {
    throw new Error(`O servidor respondeu ${resposta.status}.`);
  }

  const dados = (await resposta.json()) as RespostaBackend;
  const planilha = dados.planilha
    ? {
        nomeArquivo: dados.planilha.nomeArquivo ?? "consulta.xlsx",
        titulo: dados.planilha.titulo ?? "Consulta",
        colunas: dados.planilha.colunas,
        linhas: dados.planilha.linhas,
        informacoes: [
          { rotulo: "Origem", valor: "Backend conectado" },
          { rotulo: "Registros", valor: String(dados.planilha.linhas.length) },
          { rotulo: "Gerado em", valor: new Date().toLocaleString("pt-BR") },
        ],
      }
    : undefined;

  return mensagem("assistente", dados.resposta, planilha ? { planilha } : {});
}
