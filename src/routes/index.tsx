import { Link, createFileRoute } from "@tanstack/react-router";
import { FileSpreadsheet, MessageCircle } from "lucide-react";

import { Grade } from "@/components/grade-planilha";
import { Button } from "@/components/ui/button";
import { linkWhatsApp } from "@/lib/contato";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stagium — pergunte ao Sagi e receba a planilha" },
      {
        name: "description",
        content:
          "Pergunte em português o que precisa do Sagi (SyGeCom). O Stagium encontra a consulta certa, pede sua aprovação, lê os dados pela API e devolve a planilha .xlsx.",
      },
      { property: "og:title", content: "Stagium" },
      {
        property: "og:description",
        content: "Pergunte em português. Receba a planilha do Sagi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

/** Exemplo do topo da página. Dados fictícios, só para mostrar o formato. */
const EXEMPLO_COLUNAS = ["Data", "Fornecedor", "Produto", "Peso (kg)"];
const EXEMPLO_LINHAS: Record<string, string | number>[] = [
  ["02/09/2026", "Cooperativa Recicla Sul", "Sucata de alumínio", 1840],
  ["02/09/2026", "Aparas Bom Jesus", "Papelão ondulado", 3125],
  ["03/09/2026", "Metais Andrade", "Sucata de cobre", 412],
  ["04/09/2026", "Cooperativa Recicla Sul", "PET cristal", 1290],
  ["05/09/2026", "Aparas Bom Jesus", "Papel branco", 2675],
  ["05/09/2026", "Ferro Velho São Jorge", "Sucata mista", 5960],
].map((linha) => Object.fromEntries(EXEMPLO_COLUNAS.map((c, i) => [c, linha[i]!])));

const ETAPAS: { voce: string; stagium: string }[] = [
  {
    voce: "Pergunta o que precisa, do jeito que pediria a um analista.",
    stagium: "Procura, na documentação da API do Sagi, a consulta que responde.",
  },
  {
    voce: "Confere a proposta: o que será buscado e quais colunas virão.",
    stagium: "Mostra a consulta e já preenche o período citado na pergunta.",
  },
  {
    voce: "Aprova e informa o usuário de integração, num formulário à parte.",
    stagium: "Consulta a API do Sagi, só para leitura, e percorre todas as páginas.",
  },
  {
    voce: "Baixa a planilha.",
    stagium: "Entrega o .xlsx com uma aba que registra filtros, data e origem.",
  },
];

const EXEMPLOS: { area: string; perguntas: string[] }[] = [
  {
    area: "Estoque e cargas",
    perguntas: [
      "Movimentos de estoque de setembro",
      "Cargas entregues pelos fornecedores no mês passado",
      "Produtos com saldo em estoque",
    ],
  },
  {
    area: "Compras, vendas e contratos",
    perguntas: ["Pedidos de compra deste mês", "Pedidos de venda de agosto", "Contratos comerciais"],
  },
  {
    area: "Financeiro",
    perguntas: ["Pagamentos a fornecedores no mês passado", "Saldo de um fornecedor"],
  },
  {
    area: "Coleta e documentos",
    perguntas: ["Ordens de coleta da semana passada", "MTRs emitidos em setembro"],
  },
  {
    area: "Cadastros",
    perguntas: ["Clientes cadastrados", "Fornecedores cadastrados", "Filiais que eu posso acessar"],
  },
];

const GARANTIAS: { titulo: string; texto: string }[] = [
  {
    titulo: "Não altera nada no Sagi",
    texto: "Não emite, não cria e não cancela. O Stagium só usa consultas de leitura.",
  },
  {
    titulo: "Nada roda sem você",
    texto: "Cada consulta aparece na tela antes e só é executada quando você aprova.",
  },
  {
    titulo: "A senha não passa pela IA",
    texto:
      "As credenciais vão num formulário separado, não ficam gravadas e valem só enquanto a conversa está aberta.",
  },
  {
    titulo: "Toda planilha diz de onde veio",
    texto: "Uma aba registra o sistema, a consulta, os filtros, o total de registros e a data.",
  },
];

function BotoesContato({ invertido = false }: { invertido?: boolean }) {
  const whatsapp = linkWhatsApp();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild size="lg" className={invertido ? "bg-marca text-foreground hover:bg-marca/85" : ""}>
        <Link to="/chat">Testar agora</Link>
      </Button>
      {whatsapp && (
        <Button
          asChild
          size="lg"
          variant="outline"
          className={invertido ? "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" : "bg-card"}
        >
          <a href={whatsapp} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-2 size-4" />
            Falar no WhatsApp
          </a>
        </Button>
      )}
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <span className="marca-celula">Stagium</span>
          <Button asChild variant="ghost" size="sm">
            <Link to="/chat">Abrir o Stagium</Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Topo: a pergunta virando planilha */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-20 lg:pb-28">
          <div className="max-w-xl">
            <h1 className="titulo-hero">Pergunte em português. Receba a planilha do Sagi.</h1>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
              O Stagium conhece a API do Sagi (SyGeCom). Você diz o que precisa, confere o que ele
              vai buscar, aprova e baixa o .xlsx com todas as linhas, sem exportar nada na mão.
            </p>
            <div className="mt-8">
              <BotoesContato />
            </div>
          </div>

          <figure className="min-w-0">
            <div className="rounded-md border bg-card">
              <div className="flex justify-end px-4 pt-4">
                <p className="max-w-[85%] rounded-md bg-primary px-4 py-2.5 text-[0.9375rem] text-primary-foreground">
                  Cargas entregues pelos fornecedores em setembro
                </p>
              </div>
              <p className="px-4 pt-4 pb-3 text-sm text-muted-foreground">
                Consulta aprovada. Primeiras linhas:
              </p>
              <Grade
                descricao="Exemplo de planilha de cargas entregues por fornecedores"
                titulos={EXEMPLO_COLUNAS}
                chaves={EXEMPLO_COLUNAS}
                linhas={EXEMPLO_LINHAS}
              />
              <p className="flex items-center gap-2 px-4 py-3 text-sm font-medium">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                cargas_fornecedores_setembro.xlsx
              </p>
            </div>
            <figcaption className="mt-2 text-xs text-muted-foreground">
              Exemplo com dados fictícios.
            </figcaption>
          </figure>
        </section>

        {/* Como funciona: a divisão de tarefas, etapa por etapa */}
        <section className="border-t bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao">Como funciona</h2>
            <p className="mt-3 max-w-[60ch] text-muted-foreground">
              Quatro etapas na mesma conversa. Você decide; o Stagium faz o trabalho de ir buscar.
            </p>
            <div className="grade-rolagem mt-8 rounded-md border">
              <table className="grade grade-texto w-full">
                <caption className="sr-only">Etapas, o que você faz e o que o Stagium faz</caption>
                <thead>
                  <tr>
                    <th className="grade-linha" aria-hidden />
                    <th scope="col" className="grade-titulo">
                      Você
                    </th>
                    <th scope="col" className="grade-titulo">
                      O Stagium
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ETAPAS.map((e, i) => (
                    <tr key={i}>
                      <th scope="row" className="grade-linha mono">
                        {i + 1}
                      </th>
                      <td>{e.voce}</td>
                      <td>{e.stagium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* O que pedir: cada exemplo abre a conversa com a pergunta escrita */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao">O que você pode pedir</h2>
            <p className="mt-3 max-w-[60ch] text-muted-foreground">
              Escolha um exemplo para abrir a conversa com a pergunta já escrita. Mude o período ou
              a filial como quiser.
            </p>
            <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {EXEMPLOS.map((grupo) => (
                <div key={grupo.area}>
                  <h3 className="text-sm font-semibold">{grupo.area}</h3>
                  <ul className="mt-3 space-y-2">
                    {grupo.perguntas.map((p) => (
                      <li key={p}>
                        <Link
                          to="/chat"
                          search={{ pergunta: p }}
                          className="link-pergunta text-[0.9375rem]"
                        >
                          {p}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Garantias */}
        <section className="border-t bg-card/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao">Só leitura, sempre com a sua aprovação</h2>
            <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2">
              {GARANTIAS.map((g) => (
                <div key={g.titulo} className="max-w-[46ch]">
                  <dt className="font-semibold">{g.titulo}</dt>
                  <dd className="mt-1.5 leading-relaxed text-muted-foreground">{g.texto}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Fechamento */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="titulo-secao max-w-[22ch]">
              Comece pelo relatório que mais dá trabalho hoje.
            </h2>
            <p className="mt-4 max-w-[58ch] leading-relaxed text-primary-foreground/75">
              Escolha uma informação que a sua equipe pede toda semana e peça ao Stagium. Hoje ele
              trabalha com o Sagi (SyGeCom); se a sua empresa usa outro sistema, conte qual.
            </p>
            <div className="mt-8">
              <BotoesContato invertido />
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
        Stagium é um produto da HUBx Soluções.
      </footer>
    </div>
  );
}
