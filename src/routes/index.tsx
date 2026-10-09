import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

import { FluxoPlanilhas } from "@/components/fluxo-planilhas";
import { Button } from "@/components/ui/button";
import { linkWhatsApp } from "@/lib/contato";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stagium — não exporte, só peça" },
      {
        name: "description",
        content:
          "Pergunte em português o que precisa do ERP da sua empresa (hoje Sagi e Nomus). O Stagium encontra a consulta certa, pede sua aprovação, lê os dados pela API e devolve a planilha .xlsx.",
      },
      { property: "og:title", content: "Stagium" },
      {
        property: "og:description",
        content: "Não exporte, só peça. A IA que transforma perguntas em planilhas do seu ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const ETAPAS: { voce: string; stagium: string }[] = [
  {
    voce: "Pergunta o que precisa, do jeito que pediria a um analista.",
    stagium: "Procura, na documentação da API do seu ERP, a consulta que responde.",
  },
  {
    voce: "Confere a proposta: o que será buscado e quais colunas virão.",
    stagium: "Mostra a consulta e já preenche o período citado na pergunta.",
  },
  {
    voce: "Aprova e informa o acesso de integração do seu ERP, num formulário à parte.",
    stagium: "Consulta a API do seu ERP, só para leitura, e percorre todas as páginas.",
  },
  {
    voce: "Baixa a planilha.",
    stagium: "Entrega o .xlsx com uma aba que registra filtros, data e origem.",
  },
];

type GrupoExemplos = { area: string; perguntas: string[] };

/** Exemplos por sistema: cada um abre o chat já no sistema certo, com a pergunta escrita. */
const EXEMPLOS: { sistema: string; nome: string; grupos: GrupoExemplos[] }[] = [
  {
    sistema: "sygecom",
    nome: "Sagi (SyGeCom)",
    grupos: [
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
        perguntas: [
          "Pedidos de compra deste mês",
          "Pedidos de venda de agosto",
          "Contratos comerciais",
        ],
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
        perguntas: [
          "Clientes cadastrados",
          "Fornecedores cadastrados",
          "Filiais que eu posso acessar",
        ],
      },
    ],
  },
  {
    sistema: "nomus",
    nome: "Nomus",
    grupos: [
      {
        area: "Financeiro",
        perguntas: [
          "Contas a receber em aberto deste mês",
          "Contas a pagar desta semana",
          "Recebimentos do mês passado",
        ],
      },
      {
        area: "Vendas e compras",
        perguntas: [
          "Pedidos de venda de setembro",
          "Pedidos de compra deste mês",
          "Propostas deste mês",
        ],
      },
      {
        area: "Produção e estoque",
        perguntas: [
          "Ordens de produção desta semana",
          "Movimentações de estoque do mês passado",
          "Produtos cadastrados",
        ],
      },
      {
        area: "Fiscal",
        perguntas: [
          "Notas fiscais emitidas em setembro",
          "NF-e recebidas de fornecedores no mês passado",
        ],
      },
    ],
  },
];

const GARANTIAS: { titulo: string; texto: string }[] = [
  {
    titulo: "Não altera nada no seu ERP",
    texto: "Não emite, não cria e não cancela. O Stagium só usa consultas de leitura.",
  },
  {
    titulo: "Nada roda sem você",
    texto: "Cada consulta aparece na tela antes e só é executada quando você aprova.",
  },
  {
    titulo: "A senha não passa pela IA",
    texto:
      "As credenciais vão num formulário separado e nunca chegam à IA. Se você quiser, ficam salvas só no seu navegador, protegidas por um PIN.",
  },
  {
    titulo: "Toda planilha diz de onde veio",
    texto: "Uma aba registra o sistema, a consulta, os filtros, o total de registros e a data.",
  },
];

function BotoesContato({
  invertido = false,
  centro = false,
}: {
  invertido?: boolean;
  centro?: boolean;
}) {
  const whatsapp = linkWhatsApp();
  return (
    <div className={`flex flex-wrap items-center gap-3 ${centro ? "justify-center" : ""}`}>
      <Button
        asChild
        size="lg"
        className={
          invertido
            ? "bg-marca text-foreground hover:bg-marca/85"
            : centro
              ? "border-[1.5px] border-foreground bg-marca text-foreground hover:bg-marca/80"
              : ""
        }
      >
        <Link to="/chat">Testar agora</Link>
      </Button>
      {whatsapp && (
        <Button
          asChild
          size="lg"
          variant="outline"
          className={
            invertido
              ? "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              : "bg-card"
          }
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
        {/* Topo: perguntas entram, planilhas saem */}
        <section className="overflow-hidden">
          <div className="mx-auto w-full max-w-4xl px-4 pt-14 text-center sm:px-6 sm:pt-16">
            <h1 className="titulo-hero">
              Não exporte,
              <br />
              <em>só peça.</em>
            </h1>
            <p className="mx-auto mt-9 max-w-[34ch] text-lg leading-relaxed sm:text-xl">
              A IA que lê o seu ERP e transforma perguntas em planilhas prontas.
            </p>
            <div className="mt-8">
              <BotoesContato centro />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Hoje com Sagi (SyGeCom) e Nomus. Só leitura, sempre com a sua aprovação.
            </p>
          </div>
          <FluxoPlanilhas />
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
              Escolha um exemplo do sistema da sua empresa para abrir a conversa com a pergunta já
              escrita. Mude o período ou a empresa como quiser.
            </p>
            {EXEMPLOS.map((sis) => (
              <div key={sis.sistema} className="mt-12">
                <h3 className="border-b pb-2 text-lg font-semibold">{sis.nome}</h3>
                <div className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                  {sis.grupos.map((grupo) => (
                    <div key={grupo.area}>
                      <h4 className="text-sm font-semibold text-muted-foreground">{grupo.area}</h4>
                      <ul className="mt-3 space-y-2">
                        {grupo.perguntas.map((p) => (
                          <li key={p}>
                            <Link
                              to="/chat"
                              search={{ pergunta: p, sistema: sis.sistema }}
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
            ))}
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
              trabalha com o Sagi (SyGeCom) e o Nomus; se a sua empresa usa outro sistema, conte
              qual.
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
