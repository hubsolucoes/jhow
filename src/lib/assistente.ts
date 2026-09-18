import type { DadosPlanilha } from "./planilha";

export type Consulta = {
  id: string;
  sistema: string;
  slug: string;
  entidade: string;
  acao: string;
  metodo: string;
  path: string;
  descricao: string;
  quando_usar?: string;
  filtros?: string[];
  colunas?: string[];
  paginacao?: string;
  fonte?: string;
};

export type Mensagem = {
  id: string;
  autor: "cliente" | "assistente";
  texto: string;
  propostas?: Consulta[];
  planilha?: DadosPlanilha;
  pedirCredenciais?: Consulta;
};

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
  `Olá. Eu conheço a API do **Sagi (SyGeCom)** e posso trazer os dados da sua operação em planilha.

Me diga o que você precisa, em português. Por exemplo: "produtos cadastrados", "movimentos de estoque da matriz", "pedidos de compra" ou "notas recebidas".

Quando você aprovar a consulta, eu peço as credenciais do seu usuário de integração — elas ficam só no seu navegador e são usadas apenas naquela consulta.`,
);

/** Monta os dados da planilha a partir do que a API devolveu. */
export function planilhaDaConsulta(
  consulta: Consulta,
  resultado: {
    titulo: string;
    metodo: string;
    path: string;
    colunas: { titulo: string; chave: string }[];
    linhas: Record<string, string | number>[];
  },
): DadosPlanilha {
  return {
    nomeArquivo: `${consulta.id.replace(/\./g, "_")}.xlsx`,
    titulo: `${resultado.titulo} — ${consulta.sistema}`,
    colunas: resultado.colunas,
    linhas: resultado.linhas,
    informacoes: [
      { rotulo: "Sistema", valor: consulta.sistema },
      { rotulo: "Consulta", valor: consulta.id },
      { rotulo: "Chamada", valor: `${resultado.metodo} ${resultado.path}` },
      { rotulo: "Registros", valor: String(resultado.linhas.length) },
      { rotulo: "Consultado em", valor: new Date().toLocaleString("pt-BR") },
      { rotulo: "Documentação", valor: consulta.fonte ?? "" },
      {
        rotulo: "Observação",
        valor:
          "Dados lidos da API do próprio cliente. Nenhuma credencial fica gravada neste arquivo.",
      },
    ],
  };
}
