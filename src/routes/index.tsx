import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Download, KeyRound, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { baixarPlanilha, type DadosPlanilha } from "@/lib/planilha";

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
      { title: "Stagium — consulte seu ERP e receba a planilha" },
      {
        name: "description",
        content:
          "Pergunte em português o que precisa do Sagi (SyGeCom). O assistente encontra a consulta certa, executa na API e devolve a planilha pronta.",
      },
      { property: "og:title", content: "Stagium" },
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
                  className="mono rounded-sm bg-muted px-1 py-0.5 text-[0.85em]"
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

/** Letra da coluna como no Excel: A, B, …, Z, AA, AB… */
function letraDaColuna(indice: number): string {
  let letra = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  }
  return letra;
}

/**
 * Pedaço de planilha: letras das colunas, números das linhas e a linha de títulos.
 * Sem linhas de dados, mostra uma linha vazia (é a proposta, antes de consultar).
 */
function Grade({
  descricao,
  titulos,
  chaves = [],
  linhas = [],
}: {
  descricao: string;
  titulos: string[];
  chaves?: string[];
  linhas?: Record<string, string | number>[];
}) {
  return (
    <div className="grade-rolagem">
      <table className={linhas.length > 0 ? "grade grade-preenche" : "grade"}>
        <caption className="sr-only">{descricao}</caption>
        <thead>
          <tr>
            <th className="grade-linha" aria-hidden />
            {titulos.map((_, c) => (
              <th key={c} className="grade-letra" aria-hidden>
                {letraDaColuna(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th className="grade-linha mono">1</th>
            {titulos.map((t) => (
              <th key={t} scope="col" className="grade-titulo">
                {t}
              </th>
            ))}
          </tr>
          {linhas.length === 0 ? (
            <tr>
              <th className="grade-linha mono">2</th>
              {titulos.map((t) => (
                <td key={t} className="grade-vazia" />
              ))}
            </tr>
          ) : (
            linhas.map((linha, l) => (
              <tr key={l} style={{ "--i": l } as React.CSSProperties}>
                <th className="grade-linha mono">{l + 2}</th>
                {chaves.map((k) => {
                  const valor = linha[k];
                  return (
                    <td
                      key={k}
                      title={valor === undefined ? "" : String(valor)}
                      className={typeof valor === "number" ? "mono grade-numero" : "mono"}
                    >
                      {typeof valor === "number" ? valor.toLocaleString("pt-BR") : (valor ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const LINHAS_NA_PREVIA = 6;

function PreviaPlanilha({ planilha, aoBaixar }: { planilha: DadosPlanilha; aoBaixar: () => void }) {
  const restantes = planilha.linhas.length - LINHAS_NA_PREVIA;
  return (
    <div className="mt-4 overflow-hidden rounded-md border bg-card">
      <p className="px-4 pt-3 pb-2 text-sm font-semibold">{planilha.titulo}</p>
      <Grade
        descricao={`Primeiras linhas de ${planilha.titulo}`}
        titulos={planilha.colunas.map((c) => c.titulo)}
        chaves={planilha.colunas.map((c) => c.chave)}
        linhas={planilha.linhas.slice(0, LINHAS_NA_PREVIA)}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Button size="sm" onClick={aoBaixar}>
          <Download className="mr-2 size-4" />
          Baixar planilha (.xlsx)
        </Button>
        <p className="text-xs text-muted-foreground">
          {restantes > 0
            ? `Mostrando ${LINHAS_NA_PREVIA} de ${planilha.linhas.length.toLocaleString("pt-BR")} linhas. A planilha traz todas.`
            : `${planilha.linhas.length} ${planilha.linhas.length === 1 ? "linha" : "linhas"}, ${planilha.colunas.length} colunas.`}
        </p>
      </div>
    </div>
  );
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
    <div className="mt-4 rounded-md border bg-card p-4">
      <form
        className="space-y-5"
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
                      className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
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
    </div>
  );
}

function Index() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([BOAS_VINDAS]);
  const [pergunta, setPergunta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [etapa, setEtapa] = useState("");
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
    setEtapa("Procurando a consulta certa no catálogo do Sagi…");
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
    setEtapa("Consultando o Sagi e montando a planilha…");
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
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-5 gap-y-3 px-4 py-5">
          <h1 className="marca-celula">Stagium</h1>
          <p className="order-last w-full text-sm text-muted-foreground sm:order-none sm:w-auto sm:flex-1">
            Pergunte o que precisa do Sagi e receba a planilha pronta.
          </p>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {temCredenciais && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setCredenciais({});
                  toast.success("Credenciais esquecidas");
                }}
              >
                Esquecer credenciais
              </Button>
            )}
            <span className="flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${iaLigada ? "bg-emerald-600" : "bg-muted-foreground/50"}`}
                aria-hidden
              />
              {iaLigada ? "IA conectada" : "IA desligada"}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="flex flex-col gap-7">
          {mensagens.map((m) =>
            m.autor === "cliente" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-md bg-primary px-4 py-2.5 text-[0.9375rem] leading-relaxed text-primary-foreground">
                  <Texto conteudo={m.texto} />
                </div>
              </div>
            ) : (
              <div key={m.id} className="max-w-full">
                <div className="max-w-[65ch] space-y-1 text-[0.9375rem] leading-relaxed">
                  <Texto conteudo={m.texto} />
                </div>

                {m.propostas && m.propostas.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3">
                    {m.propostas.map((consulta, indice) => (
                      <div key={consulta.id} className="overflow-hidden rounded-md border bg-card">
                        <div className="px-4 pt-3 pb-3">
                          <p className="text-sm leading-snug font-medium">{consulta.descricao}</p>
                          <p className="mono mt-1 text-xs text-muted-foreground">
                            {consulta.metodo} {consulta.path}
                          </p>
                        </div>
                        {consulta.colunas && consulta.colunas.length > 0 && (
                          <Grade
                            descricao={`Colunas que a planilha vai trazer: ${consulta.colunas.join(", ")}`}
                            titulos={consulta.colunas}
                          />
                        )}
                        <div className="px-4 py-3">
                          <Button
                            size="sm"
                            variant={indice === 0 ? "default" : "outline"}
                            disabled={ocupado}
                            onClick={() => aprovar(consulta, m.periodo)}
                          >
                            Executar esta consulta
                          </Button>
                        </div>
                      </div>
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

                {m.planilha && <PreviaPlanilha planilha={m.planilha} aoBaixar={() => void baixar(m)} />}
              </div>
            ),
          )}

          {ocupado && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" />
              {etapa}
            </p>
          )}
          <div ref={fim} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-4">
          {mensagens.length <= 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGESTOES.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="bg-card"
                  onClick={() => void enviar(s)}
                  disabled={ocupado}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2 rounded-md border border-input bg-card p-1.5 focus-within:border-foreground"
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
              placeholder="O que você precisa do Sagi?"
              aria-label="Sua pergunta"
              rows={1}
              className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-2.5 py-2 text-[0.9375rem] shadow-none focus-visible:ring-0 focus-visible:shadow-none focus-visible:outline-none"
            />
            <Button
              type="submit"
              size="icon"
              className="size-10 shrink-0"
              disabled={ocupado || !pergunta.trim()}
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">Enviar pergunta</span>
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Só consultas de leitura, sempre com a sua aprovação. Nunca digite senha aqui na
            conversa: as credenciais vão no formulário.
          </p>
        </div>
      </div>
    </main>
  );
}
