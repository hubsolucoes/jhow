import { useEffect, useRef } from "react";

/**
 * Faixa animada do topo da landing: perguntas correm por uma linha curva até a grade
 * do Stagium e saem do outro lado como planilhas .xlsx.
 * Roda sempre, por decisão do cliente (sem botão de pausa).
 */

const PERGUNTAS = [
  "vendas de setembro",
  "estoque da matriz",
  "clientes cadastrados",
  "pedidos de compra deste mês",
  "cargas dos fornecedores em setembro",
  "pagamentos a fornecedores",
  "ordens de coleta da semana",
  "MTRs emitidos em agosto",
];

const PLANILHAS = [
  "pedidos_venda_setembro.xlsx",
  "estoque_matriz.xlsx",
  "clientes.xlsx",
  "pedidos_compra_outubro.xlsx",
  "cargas_fornecedores_setembro.xlsx",
  "pagamentos_fornecedores.xlsx",
  "ordens_coleta_semana.xlsx",
  "mtr_agosto.xlsx",
];

// Espaço entre os itens (preservado com white-space: pre).
const VAO = "        ";
const REPETICOES = 3;
const VELOCIDADE = 55; // unidades do SVG por segundo

// Entrada: vem da esquerda, dá uma volta e chega à grade. Saída: da grade para a direita, em onda.
const CAMINHO_ENTRADA =
  "M -80 168 C 90 172 230 196 318 150 C 404 104 392 18 316 16 C 236 14 214 98 262 158 C 312 222 480 252 662 250";
const CAMINHO_SAIDA = "M 778 250 C 900 250 1000 236 1110 196 C 1220 156 1330 116 1520 106";

const COLUNAS_GRADE = 5;
const LINHAS_GRADE = 3;

export function FluxoPlanilhas() {
  const entrada = useRef<SVGTextPathElement>(null);
  const saida = useRef<SVGTextPathElement>(null);

  useEffect(() => {
    const trilhas = [entrada.current, saida.current].filter(
      (t): t is SVGTextPathElement => t !== null,
    );
    // Comprimento de uma repetição do texto, para o laço não dar salto.
    const ciclos = trilhas.map(
      (t) => (t.parentNode as SVGTextElement).getComputedTextLength() / REPETICOES,
    );
    const posicionar = (segundos: number) =>
      trilhas.forEach((t, i) => {
        const ciclo = ciclos[i] || 1;
        t.setAttribute("startOffset", String(((segundos * VELOCIDADE) % ciclo) - ciclo));
      });

    let quadro = 0;
    const inicio = performance.now() - 8000; // começa com a faixa já preenchida
    const passo = (agora: number) => {
      posicionar((agora - inicio) / 1000);
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, []);

  const textoEntrada = Array(REPETICOES).fill(PERGUNTAS.join(VAO) + VAO).join("");

  return (
    <div className="fluxo" aria-hidden>
      <svg viewBox="0 0 1440 320" preserveAspectRatio="xMidYMid slice">
        <defs>
          <path id="fluxo-entrada" d={CAMINHO_ENTRADA} />
          <path id="fluxo-saida" d={CAMINHO_SAIDA} />
        </defs>

        <text className="fluxo-pergunta">
          <textPath ref={entrada} href="#fluxo-entrada" startOffset="0">
            {textoEntrada}
          </textPath>
        </text>

        <use href="#fluxo-saida" className="fluxo-faixa" />
        <text className="fluxo-arquivo" dy="5.5">
          <textPath ref={saida} href="#fluxo-saida" startOffset="0">
            {Array.from({ length: REPETICOES }).flatMap((_, r) =>
              PLANILHAS.map((nome) => (
                <tspan key={`${r}-${nome}`}>
                  <tspan className="fluxo-icone">▦ </tspan>
                  {nome}
                  {VAO}
                </tspan>
              )),
            )}
          </textPath>
        </text>

        {/* A grade do Stagium: as colunas acendem em sequência, como uma planilha sendo preenchida. */}
        <g transform="translate(660 220)">
          <rect width="120" height="60" rx="30" className="fluxo-capsula" />
          {Array.from({ length: COLUNAS_GRADE }).flatMap((_, c) =>
            Array.from({ length: LINHAS_GRADE }).map((__, l) => (
              <rect
                key={`${c}-${l}`}
                x={31 + c * 12}
                y={16 + l * 10}
                width="10"
                height="8"
                rx="1"
                className="fluxo-celula"
                style={{ animationDelay: `${c * 0.18 + l * 0.06}s` }}
              />
            )),
          )}
        </g>
      </svg>
    </div>
  );
}
