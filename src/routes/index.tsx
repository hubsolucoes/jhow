import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  KeyRound,
  Loader2,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import type { CampoFiltro } from "@/lib/executor.servidor";
import { perguntarAoAssistente } from "@/lib/assistente.servidor";
import { executarConsultaReal } from "@/lib/executor.servidor";
import conhecimento from "@/lib/conhecimento.json";
import { interpretarPeriodo, type PeriodoInterpretado } from "@/lib/periodo";
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

const doisDigitos = (n: number) => String(n).padStart(2, "0");
/** Data local em AAAA-MM-DD (toISOString usaria UTC e viraria o dia à noite no Brasil). */
const dataLocal = (d: Date) =>
  `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

function padraoDoCampo(c: CampoFiltro, sugerido?: PeriodoInterpretado): string {
  if (sugerido) {
    if (c.papel === "periodo_inicio") return sugerido.inicio;
    if (c.papel === "periodo_fim" || c.papel === "data") return sugerido.fim;
  }
  const hoje = new Date();
  if (c.papel === "periodo_inicio") {
    return dataLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  }
  if (c.papel === "periodo_fim") return dataLocal(hoje);
  return c.padrao ?? "";
}

/** Resumo legível dos filtros, para o chat e para a aba Informações da planilha. */
function resumirFiltros(consulta: Consulta, filtros: Record<string, string>): string {
  return (consulta.campos_filtro ?? [])
    .filter((c) => filtros[c.nome])
    .map((c) => {
      const v = filtros[c.nome] ?? "";
      return `${c.rotulo}: ${c.tipo === "data" ? v.split("-").reverse().join("/") : v}`;
    })
    .join(" · ");
}

function FormularioConsulta({
  consulta,
  credenciais,
  pedirCredenciais,
  periodoSugerido,
  aoConfirmar,
  ocupado,
}: {
  consulta: Consulta;
  credenciais: Record<string, string>;
  pedirCredenciais: boolean;
  periodoSugerido?: PeriodoInterpretado;
  aoConfirmar: (
    cred: Record<string, string>,
    filtros: Record<string, string>,
    consulta: Consulta,
  ) => void;
  ocupado: boolean;
}) {
  const camposFiltro = consulta.campos_filtro ?? [];
  const [filtros, setFiltros] = useState<Record<string, string>>(() =>
    Object.fromEntries(camposFiltro.map((c) => [c.nome, padraoDoCampo(c, periodoSugerido)])),
  );
  const [cred, setCred] = useState<Record<string, string>>(() =>
    Object.fromEntries(CREDENCIAIS.map((c) => [c.nome, credenciais[c.nome] ?? c.default ?? ""])),
  );

  const inicio = camposFiltro.find((c) => c.papel === "periodo_inicio");
  const fim = camposFiltro.find((c) => c.papel === "periodo_fim");
  const dataInicio = inicio ? (filtros[inicio.nome] ?? "") : "";
  const dataFim = fim ? (filtros[fim.nome] ?? "") : "";
  const periodoInvertido = dataInicio !== "" && dataFim !== "" && dataInicio > dataFim;
  const faltaFiltro = camposFiltro.some((c) => c.obrigatorio && !filtros[c.nome]?.trim());
  const faltaCredencial = pedirCredenciais && CREDENCIAIS.some((c) => !cred[c.nome]?.trim());

  return (
    <Card className="mt-3 gap-0 border-border/60 p-3">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          aoConfirmar(pedirCredenciais ? cred : credenciais, filtros, consulta);
        }}
      >
        {camposFiltro.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Filtros da consulta
            </legend>
            {periodoSugerido && camposFiltro.some((c) => c.tipo === "data") && (
              <p className="text-xs text-muted-foreground">
                Período preenchido a partir da sua pergunta: <b>{periodoSugerido.descricao}</b>.
                Ajuste se precisar.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {camposFiltro.map((c) => (
                <div key={c.nome} className="space-y-1">
                  <Label htmlFor={`filtro-${c.nome}`} className="text-xs">
                    {c.rotulo}
                    {c.obrigatorio ? " *" : ""}
                  </Label>
                  {c.tipo === "opcao" ? (
                    <select
                      id={`filtro-${c.nome}`}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={filtros[c.nome] ?? ""}
                      onChange={(e) => setFiltros((f) => ({ ...f, [c.nome]: e.target.value }))}
                    >
                      {!c.obrigatorio && <option value="">Todas</option>}
                      {(c.opcoes ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`filtro-${c.nome}`}
                      type={c.tipo === "data" ? "date" : "text"}
                      value={filtros[c.nome] ?? ""}
                      onChange={(e) => setFiltros((f) => ({ ...f, [c.nome]: e.target.value }))}
                      placeholder={c.papel === "filial" ? "TODAS ou o código da filial" : ""}
                    />
                  )}
                  {c.dica && c.tipo !== "data" && (
                    <p className="text-[11px] leading-snug text-muted-foreground">{c.dica}</p>
                  )}
                </div>
              ))}
            </div>
            {periodoInvertido && (
              <p className="text-xs text-destructive">A data inicial é posterior à data final.</p>
            )}
          </fieldset>
        )}

        {pedirCredenciais && (
          <fieldset className="space-y-3">
            <legend className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-muted-foreground" />
              Credenciais do seu usuário de integração
            </legend>
            <p className="text-xs text-muted-foreground">
              Ficam só neste navegador, são usadas apenas na consulta e não são enviadas à IA.
            </p>
            {CREDENCIAIS.map((c) => (
              <div key={c.nome} className="space-y-1">
                <Label htmlFor={`cred-${c.nome}`} className="text-xs">
                  {c.rotulo}
                </Label>
                <Input
                  id={`cred-${c.nome}`}
                  type={c.segredo ? "password" : "text"}
                  autoComplete={c.segredo ? "current-password" : "off"}
                  value={cred[c.nome] ?? ""}
                  onChange={(e) => setCred((atual) => ({ ...atual, [c.nome]: e.target.value }))}
                  placeholder={c.default ?? ""}
                />
                <p className="text-[11px] leading-snug text-muted-foreground">{c.onde_obter}</p>
              </div>
            ))}
          </fieldset>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={faltaFiltro || faltaCredencial || periodoInvertido || ocupado}
        >
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
      const periodo = interpretarPeriodo(limpo);
      setMensagens((atual) => [
        ...atual,
        mensagem(
          "assistente",
          resposta.resposta,
          propostas.length > 0 ? { propostas, ...(periodo ? { periodo } : {}) } : {},
        ),
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

  function aprovar(consulta: Consulta, periodo?: PeriodoInterpretado) {
    setMensagens((atual) => [
      ...atual,
      mensagem("cliente", `Pode executar: ${consulta.descricao.slice(0, 60)}`),
    ]);
    const temFiltros = (consulta.campos_filtro ?? []).length > 0;
    if (temCredenciais && !temFiltros) {
      void executar(credenciais, {}, consulta);
      return;
    }
    const partes = [
      temFiltros ? "escolha os filtros" : "",
      temCredenciais
        ? ""
        : "informe as credenciais do usuário de integração (ficam só no seu navegador)",
    ].filter(Boolean);
    const frase = partes.join(" e ");
    setMensagens((atual) => [
      ...atual,
      mensagem("assistente", frase.charAt(0).toUpperCase() + frase.slice(1) + ".", {
        formulario: consulta,
        ...(periodo ? { periodo } : {}),
      }),
    ]);
  }

  async function executar(
    cred: Record<string, string>,
    filtros: Record<string, string>,
    consulta: Consulta,
  ) {
    setCredenciais(cred);
    setOcupado(true);
    const resumo = resumirFiltros(consulta, filtros);
    try {
      const resultado = await executarConsultaReal({
        data: { endpointId: consulta.id, credenciais: cred, filtros, maximo: 1000 },
      });
      const planilha = planilhaDaConsulta(consulta, resultado, resumo);
      setMensagens((atual) => [
        ...atual,
        mensagem(
          "assistente",
          resultado.linhas.length > 0
            ? `Pronto. ${resultado.linhas.length} registros de **${resultado.titulo}**.` +
                (resumo ? `\nFiltros: ${resumo}.` : "") +
                (resultado.aviso
                  ? `

Observação: ${resultado.aviso}`
                  : "")
            : `A consulta funcionou, mas o Sagi não devolveu nenhum registro para **${resultado.titulo}**` +
                (resumo ? ` com os filtros ${resumo}` : "") +
                ". Tente ampliar o período ou trocar a filial — ou o usuário de integração não tem acesso a esses dados.",
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
                            onClick={() => aprovar(consulta, m.periodo)}
                          >
                            Executar esta consulta
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {m.formulario && (
                  <FormularioConsulta
                    consulta={m.formulario}
                    credenciais={credenciais}
                    pedirCredenciais={!temCredenciais}
                    {...(m.periodo ? { periodoSugerido: m.periodo } : {})}
                    ocupado={ocupado}
                    aoConfirmar={(cred, filtros, consulta) =>
                      void executar(cred, filtros, consulta)
                    }
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
