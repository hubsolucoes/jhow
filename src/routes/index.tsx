import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, KeyRound, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BOAS_VINDAS,
  mensagem,
  planilhaDaConsulta,
  type Consulta,
  type Mensagem,
} from "@/lib/assistente";
import { perguntarAoAssistente } from "@/lib/assistente.servidor";
import { executarConsultaReal } from "@/lib/executor.servidor";
import conhecimento from "@/lib/conhecimento.json";
import { baixarPlanilha } from "@/lib/planilha";

const CONSULTAS = conhecimento.consultas as Consulta[];
const CREDENCIAIS = (
  conhecimento as unknown as {
    execucao: Record<
      string,
      {
        auth: {
          credenciais_necessarias: {
            nome: string;
            rotulo: string;
            segredo: boolean;
            onde_obter: string;
            default?: string;
          }[];
        };
      }
    >;
  }
).execucao["sygecom"]!.auth.credenciais_necessarias;

const SUGESTOES = [
  "Produtos cadastrados",
  "Movimentos de estoque",
  "Pedidos de compra",
  "Clientes",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assistente Sagi — consulte seu ERP e receba a planilha" },
      {
        name: "description",
        content:
          "Pergunte em português o que precisa do Sagi (SyGeCom). O assistente encontra a consulta certa, executa na API e devolve a planilha pronta.",
      },
      { property: "og:title", content: "Assistente Sagi" },
      { property: "og:description", content: "Pergunte, aprove e receba os dados em planilha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/** Negrito simples (**texto**), código (`texto`) e quebras de linha. */
function Texto({ conteudo }: { conteudo: string }) {
  return (
    <>
      {conteudo.split("\n").map((linha, i) => (
        <p key={i} className={linha ? "" : "h-2"}>
          {linha.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((parte, j) => {
            if (parte.startsWith("**") && parte.endsWith("**")) {
              return (
                <strong key={j} className="font-semibold">
                  {parte.slice(2, -2)}
                </strong>
              );
            }
            if (parte.startsWith("`") && parte.endsWith("`")) {
              return (
                <code
                  key={j}
                  className="rounded bg-background/60 px-1.5 py-0.5 font-mono text-[0.85em]"
                >
                  {parte.slice(1, -1)}
                </code>
              );
            }
            return <span key={j}>{parte}</span>;
          })}
        </p>
      ))}
    </>
  );
}

function FormularioCredenciais({
  consulta,
  valores,
  aoConfirmar,
  ocupado,
}: {
  consulta: Consulta;
  valores: Record<string, string>;
  aoConfirmar: (credenciais: Record<string, string>, consulta: Consulta) => void;
  ocupado: boolean;
}) {
  const [campos, setCampos] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    for (const c of CREDENCIAIS) inicial[c.nome] = valores[c.nome] ?? c.default ?? "";
    return inicial;
  });

  const faltando = CREDENCIAIS.some((c) => !campos[c.nome]?.trim());

  return (
    <Card className="mt-3 gap-0 border-border/60 p-3">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">Credenciais do seu usuário de integração</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ficam só neste navegador, são usadas apenas nesta consulta e não são enviadas à IA.
      </p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          aoConfirmar(campos, consulta);
        }}
      >
        {CREDENCIAIS.map((c) => (
          <div key={c.nome} className="space-y-1">
            <Label htmlFor={`cred-${c.nome}`} className="text-xs">
              {c.rotulo}
            </Label>
            <Input
              id={`cred-${c.nome}`}
              type={c.segredo ? "password" : "text"}
              autoComplete={c.segredo ? "current-password" : "off"}
              value={campos[c.nome] ?? ""}
              onChange={(e) => setCampos((atual) => ({ ...atual, [c.nome]: e.target.value }))}
              placeholder={c.default ?? ""}
            />
            <p className="text-[11px] leading-snug text-muted-foreground">{c.onde_obter}</p>
          </div>
        ))}
        <Button type="submit" size="sm" disabled={faltando || ocupado}>
          Consultar o Sagi
        </Button>
      </form>
    </Card>
  );
}

function Index() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([BOAS_VINDAS]);
  const [pergunta, setPergunta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [iaLigada, setIaLigada] = useState(true);
  const [credenciais, setCredenciais] = useState<Record<string, string>>({});
  const fim = useRef<HTMLDivElement>(null);

  const temCredenciais = CREDENCIAIS.every((c) => credenciais[c.nome]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, ocupado]);

  async function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || ocupado) return;

    setMensagens((atual) => [...atual, mensagem("cliente", limpo)]);
    setPergunta("");
    setOcupado(true);

    try {
      const resposta = await perguntarAoAssistente({
        data: {
          pergunta: limpo,
          historico: mensagens.map(({ autor, texto: t }) => ({ autor, texto: t })),
        },
      });

      setIaLigada(resposta.origem === "ia");
      const propostas = CONSULTAS.filter((c) => resposta.resposta.includes(c.id));
      setMensagens((atual) => [
        ...atual,
        mensagem("assistente", resposta.resposta, propostas.length > 0 ? { propostas } : {}),
      ]);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "falha desconhecida";
      toast.error("A IA não respondeu", { description: motivo });
      setMensagens((atual) => [
        ...atual,
        mensagem("assistente", `Não consegui responder agora: ${motivo}`),
      ]);
    } finally {
      setOcupado(false);
    }
  }

  function aprovar(consulta: Consulta) {
    setMensagens((atual) => [
      ...atual,
      mensagem("cliente", `Pode executar: ${consulta.descricao.slice(0, 60)}`),
    ]);
    if (temCredenciais) {
      void executar(credenciais, consulta);
    } else {
      setMensagens((atual) => [
        ...atual,
        mensagem(
          "assistente",
          "Para consultar o Sagi eu preciso das credenciais do usuário de integração. Preencha abaixo — elas ficam só no seu navegador.",
          { pedirCredenciais: consulta },
        ),
      ]);
    }
  }

  async function executar(cred: Record<string, string>, consulta: Consulta) {
    setCredenciais(cred);
    setOcupado(true);
    try {
      const resultado = await executarConsultaReal({
        data: { endpointId: consulta.id, credenciais: cred, maximo: 1000 },
      });
      const planilha = planilhaDaConsulta(consulta, resultado);
      setMensagens((atual) => [
        ...atual,
        mensagem(
          "assistente",
          resultado.linhas.length > 0
            ? `Pronto. ${resultado.linhas.length} registros de **${resultado.titulo}**.`
            : `A consulta funcionou, mas o Sagi não devolveu nenhum registro para **${resultado.titulo}**. Talvez falte um filtro (filial, data) ou o usuário não tenha acesso a esses dados.`,
          resultado.linhas.length > 0 ? { planilha } : {},
        ),
      ]);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "falha desconhecida";
      toast.error("Não consegui consultar o Sagi", { description: motivo });
      setMensagens((atual) => [...atual, mensagem("assistente", `Não deu certo: ${motivo}`)]);
    } finally {
      setOcupado(false);
    }
  }

  async function baixar(m: Mensagem) {
    if (!m.planilha) return;
    try {
      await baixarPlanilha(m.planilha);
      toast.success("Planilha gerada", { description: m.planilha.nomeArquivo });
    } catch (erro) {
      toast.error("Não consegui gerar a planilha", {
        description: erro instanceof Error ? erro.message : "falha desconhecida",
      });
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground">Assistente Sagi</h1>
            <p className="truncate text-sm text-muted-foreground">
              Pergunte o que precisa do seu ERP e receba a planilha pronta
            </p>
          </div>
          {temCredenciais && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCredenciais({});
                toast.success("Credenciais esquecidas");
              }}
            >
              <Trash2 className="mr-1 size-4" />
              Esquecer credenciais
            </Button>
          )}
          <Badge variant={iaLigada ? "default" : "secondary"} className="hidden sm:inline-flex">
            {iaLigada ? "IA + catálogo" : "IA desligada"}
          </Badge>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="flex flex-col gap-4">
          {mensagens.map((m) => (
            <div
              key={m.id}
              className={m.autor === "cliente" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.autor === "cliente"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground"
                    : "max-w-[92%] rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm text-foreground"
                }
              >
                <div className="space-y-1 leading-relaxed">
                  <Texto conteudo={m.texto} />
                </div>

                {m.propostas && m.propostas.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2">
                    {m.propostas.map((consulta, indice) => (
                      <Card key={consulta.id} className="gap-0 border-border/60 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{consulta.entidade}</Badge>
                          <code className="text-xs text-muted-foreground">
                            {consulta.metodo} {consulta.path}
                          </code>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{consulta.descricao}</p>
                        {consulta.colunas && consulta.colunas.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Colunas: {consulta.colunas.join(", ")}
                          </p>
                        )}
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant={indice === 0 ? "default" : "secondary"}
                            disabled={ocupado}
                            onClick={() => aprovar(consulta)}
                          >
                            Executar esta consulta
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {m.pedirCredenciais && (
                  <FormularioCredenciais
                    consulta={m.pedirCredenciais}
                    valores={credenciais}
                    ocupado={ocupado}
                    aoConfirmar={(cred, consulta) => void executar(cred, consulta)}
                  />
                )}

                {m.planilha && (
                  <Card className="mt-3 gap-0 border-border/60 p-3">
                    <p className="text-sm font-medium">{m.planilha.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.planilha.linhas.length} linhas · {m.planilha.colunas.length} colunas
                    </p>
                    <div className="mt-3">
                      <Button size="sm" onClick={() => void baixar(m)}>
                        <Download className="mr-2 size-4" />
                        Baixar planilha (.xlsx)
                      </Button>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          ))}

          {ocupado && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Trabalhando…
            </div>
          )}
          <div ref={fim} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-card/80 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          {mensagens.length <= 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => void enviar(s)}
                  disabled={ocupado}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(pergunta);
            }}
          >
            <Textarea
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(pergunta);
                }
              }}
              placeholder="O que você precisa do Sagi? Ex.: movimentos de estoque da matriz"
              aria-label="Sua pergunta"
              rows={1}
              className="max-h-40 min-h-11 resize-none"
            />
            <Button
              type="submit"
              size="icon"
              className="size-11 shrink-0"
              disabled={ocupado || !pergunta.trim()}
            >
              <Send className="size-4" />
              <span className="sr-only">Enviar</span>
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            O assistente só executa consultas de leitura e pede aprovação antes de cada uma. Nunca
            digite senha no campo de conversa.
          </p>
        </div>
      </div>
    </main>
  );
}
