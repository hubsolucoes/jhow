import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Send, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Consulta } from "@/lib/catalogo-demo";
import {
  BOAS_VINDAS,
  CHAVE_BACKEND,
  executarConsulta,
  mensagem,
  responderLocalmente,
  responderPeloBackend,
  type Mensagem,
} from "@/lib/assistente";
import { baixarPlanilha } from "@/lib/planilha";

const SUGESTOES = [
  "Cobranças pagas no último mês",
  "Pedidos de venda em aberto",
  "Movimentos de estoque da matriz",
  "Notas fiscais recebidas",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Assistente de integrações — consulte seu sistema e receba a planilha" },
      {
        name: "description",
        content:
          "Pergunte em português o que precisa do seu ERP ou meio de pagamento. O assistente encontra a consulta certa, executa e devolve a planilha pronta.",
      },
      { property: "og:title", content: "Assistente de integrações" },
      {
        property: "og:description",
        content: "Pergunte, aprove e receba os dados do seu sistema em planilha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

/** Negrito simples (**texto**) e quebras de linha, sem trazer um renderizador de markdown. */
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
                <code key={j} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
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

function Index() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([BOAS_VINDAS]);
  const [pergunta, setPergunta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [urlBackend, setUrlBackend] = useState("");
  const [rascunhoUrl, setRascunhoUrl] = useState("");
  const [configAberta, setConfigAberta] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const salva = window.localStorage.getItem(CHAVE_BACKEND) ?? "";
    setUrlBackend(salva);
    setRascunhoUrl(salva);
  }, []);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens, ocupado]);

  async function enviar(texto: string) {
    const limpo = texto.trim();
    if (!limpo || ocupado) return;

    const daVez = mensagem("cliente", limpo);
    setMensagens((atual) => [...atual, daVez]);
    setPergunta("");
    setOcupado(true);

    try {
      if (urlBackend) {
        const resposta = await responderPeloBackend(urlBackend, mensagens, limpo);
        setMensagens((atual) => [...atual, resposta]);
      } else {
        await new Promise((r) => setTimeout(r, 450));
        setMensagens((atual) => [...atual, responderLocalmente(limpo)]);
      }
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : "falha desconhecida";
      toast.error("Não consegui falar com o backend", { description: motivo });
      setMensagens((atual) => [
        ...atual,
        mensagem(
          "assistente",
          `Não consegui falar com o backend configurado (${motivo}). Verifique o endereço em Configurar, ou remova-o para usar o modo demonstração.`,
        ),
      ]);
    } finally {
      setOcupado(false);
    }
  }

  function aprovar(consulta: Consulta) {
    setOcupado(true);
    setMensagens((atual) => [...atual, mensagem("cliente", `Pode executar: ${consulta.titulo}`)]);
    setTimeout(() => {
      setMensagens((atual) => [...atual, executarConsulta(consulta)]);
      setOcupado(false);
    }, 600);
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

  function salvarConfig() {
    const valor = rascunhoUrl.trim();
    setUrlBackend(valor);
    window.localStorage.setItem(CHAVE_BACKEND, valor);
    setConfigAberta(false);
    toast.success(valor ? "Backend conectado" : "Modo demonstração ativo");
  }

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-foreground">
              Assistente de integrações
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              Pergunte o que precisa do seu sistema e receba a planilha pronta
            </p>
          </div>
          <Badge variant={urlBackend ? "default" : "secondary"} className="hidden sm:inline-flex">
            {urlBackend ? "Backend conectado" : "Demonstração"}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Configurar"
            onClick={() => setConfigAberta(true)}
          >
            <Settings2 className="size-4" />
          </Button>
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
                          <Badge variant="outline">{consulta.sistema}</Badge>
                          <span className="text-sm font-medium">{consulta.titulo}</span>
                          <code className="text-xs text-muted-foreground">
                            {consulta.metodo} {consulta.caminho}
                          </code>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Filtros: {consulta.filtros.map((f) => f.parametro).join(" · ")}
                        </p>
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
              Consultando…
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
              placeholder="O que você precisa? Ex.: cobranças pagas em agosto"
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
            O assistente só executa consultas de leitura e pede aprovação antes de cada uma.
          </p>
        </div>
      </div>

      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar ao backend</DialogTitle>
            <DialogDescription>
              Sem endereço, o chat roda em demonstração, com dados fictícios no formato real das
              APIs. Com o backend conectado, ele consulta os sistemas da empresa — as credenciais e
              a chave da IA ficam lá, nunca no navegador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="url-backend">Endereço do backend</Label>
            <Input
              id="url-backend"
              value={rascunhoUrl}
              onChange={(e) => setRascunhoUrl(e.target.value)}
              placeholder="https://seu-backend.exemplo.com/chat"
              inputMode="url"
            />
            <p className="text-xs text-muted-foreground">
              Ele deve aceitar POST com <code>{"{ pergunta, historico }"}</code> e responder{" "}
              <code>{"{ resposta, planilha? }"}</code>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfigAberta(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarConfig}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
