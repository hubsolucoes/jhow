/**
 * Recorte do catálogo para a demonstração do chat.
 *
 * Os endpoints, filtros e colunas abaixo vêm do catálogo real (pasta `catalogo/`),
 * documentado a partir das APIs oficiais. As LINHAS são fictícias: servem só para
 * mostrar o formato da planilha enquanto não há credencial do cliente conectada.
 */

export type Coluna = { titulo: string; chave: string };

export type Consulta = {
  id: string;
  sistema: string;
  titulo: string;
  descricao: string;
  metodo: string;
  caminho: string;
  termos: string[];
  filtros: { parametro: string; descricao: string }[];
  colunas: Coluna[];
  amostra: (indice: number) => Record<string, string | number>;
};

const dia = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("pt-BR");
};

const dinheiro = (v: number) => Number(v.toFixed(2));

/** Índice circular com retorno garantido (o TS aqui trata índice como possivelmente indefinido). */
const escolher = <T>(lista: readonly T[], indice: number): T => lista[indice % lista.length] as T;

export const CONSULTAS: Consulta[] = [
  {
    id: "asaas.cobranca.listar",
    sistema: "Asaas",
    titulo: "Cobranças",
    descricao: "Boletos, Pix e cartão emitidos, com situação, vencimento e pagamento.",
    metodo: "GET",
    caminho: "/v3/payments",
    termos: [
      "cobranca",
      "cobrancas",
      "boleto",
      "boletos",
      "pix",
      "recebimento",
      "recebimentos",
      "pagamento",
      "pagamentos",
      "faturamento",
      "receita",
      "asaas",
      "inadimplencia",
      "vencidas",
      "pagas",
    ],
    filtros: [
      { parametro: "dateCreated[ge] / dateCreated[le]", descricao: "período de emissão" },
      { parametro: "status", descricao: "situação (RECEIVED, PENDING, OVERDUE)" },
      { parametro: "customer", descricao: "cliente específico" },
    ],
    colunas: [
      { titulo: "ID", chave: "id" },
      { titulo: "Cliente", chave: "cliente" },
      { titulo: "Valor", chave: "valor" },
      { titulo: "Vencimento", chave: "vencimento" },
      { titulo: "Pagamento", chave: "pagamento" },
      { titulo: "Forma", chave: "forma" },
      { titulo: "Situação", chave: "situacao" },
    ],
    amostra: (i) => ({
      id: `pay_${String(1000 + i)}`,
      cliente: escolher(
        ["Metalúrgica Andrade", "Comércio Vieira", "Transportes Luz", "Padaria Rosa"],
        i,
      ),
      valor: dinheiro(380 + i * 47.3),
      vencimento: dia(30 - i),
      pagamento: i % 5 === 0 ? "" : dia(28 - i),
      forma: escolher(["PIX", "BOLETO", "CREDIT_CARD"], i),
      situacao: i % 5 === 0 ? "OVERDUE" : "RECEIVED",
    }),
  },
  {
    id: "bling.pedido.listar.venda",
    sistema: "Bling",
    titulo: "Pedidos de venda",
    descricao: "Pedidos do ERP com cliente, situação, totais e data.",
    metodo: "GET",
    caminho: "/pedidos/vendas",
    termos: ["pedido", "pedidos", "venda", "vendas", "bling", "erp", "faturamento", "clientes"],
    filtros: [
      { parametro: "dataInicial / dataFinal", descricao: "período do pedido" },
      { parametro: "idSituacao", descricao: "situação do pedido" },
      { parametro: "idContato", descricao: "cliente" },
    ],
    colunas: [
      { titulo: "Número", chave: "numero" },
      { titulo: "Data", chave: "data" },
      { titulo: "Cliente", chave: "cliente" },
      { titulo: "Total", chave: "total" },
      { titulo: "Situação", chave: "situacao" },
    ],
    amostra: (i) => ({
      numero: 5200 + i,
      data: dia(20 - (i % 20)),
      cliente: escolher(
        ["Ferro Velho Santa Rita", "Recicla Sul", "Indústria Bonfim", "Mercado Aurora"],
        i,
      ),
      total: dinheiro(1250 + i * 133.7),
      situacao: escolher(["Em aberto", "Atendido", "Faturado"], i),
    }),
  },
  {
    id: "sygecom.estoque.listar.movimentos",
    sistema: "SyGeCom (Sagi)",
    titulo: "Movimentos de estoque",
    descricao: "Entradas e saídas por produto e filial, base das pesagens.",
    metodo: "GET",
    caminho: "/movimentos",
    termos: [
      "estoque",
      "movimento",
      "movimentos",
      "pesagem",
      "pesagens",
      "balanca",
      "entrada",
      "entradas",
      "saida",
      "saidas",
      "sygecom",
      "sagi",
      "residuo",
      "sucata",
      "material",
    ],
    filtros: [
      { parametro: "filial", descricao: "filial (TODAS consolida)" },
      { parametro: "data", descricao: "data de referência" },
      { parametro: "produto", descricao: "produto específico" },
    ],
    colunas: [
      { titulo: "Data", chave: "data" },
      { titulo: "Filial", chave: "filial" },
      { titulo: "Produto", chave: "produto" },
      { titulo: "Tipo", chave: "tipo" },
      { titulo: "Quantidade (kg)", chave: "quantidade" },
      { titulo: "Valor", chave: "valor" },
    ],
    amostra: (i) => ({
      data: dia(15 - (i % 15)),
      filial: escolher(["MATRIZ", "FILIAL 02"], i),
      produto: escolher(["Sucata ferrosa", "Alumínio latinha", "Papelão", "PET cristal"], i),
      tipo: i % 3 === 0 ? "SAÍDA" : "ENTRADA",
      quantidade: dinheiro(820 + i * 63.4),
      valor: dinheiro(1400 + i * 91.2),
    }),
  },
  {
    id: "mercado-pago.cobranca.listar.pagamentos",
    sistema: "Mercado Pago",
    titulo: "Pagamentos recebidos",
    descricao: "Pagamentos aprovados, pendentes e recusados, com taxa e valor líquido.",
    metodo: "GET",
    caminho: "/v1/payments/search",
    termos: [
      "mercado",
      "pago",
      "mercadopago",
      "pagamento",
      "pagamentos",
      "aprovado",
      "aprovados",
      "taxa",
      "taxas",
      "liquido",
      "vendas",
      "cartao",
    ],
    filtros: [
      { parametro: "begin_date / end_date", descricao: "período" },
      { parametro: "status", descricao: "situação do pagamento" },
      { parametro: "payment_method_id", descricao: "meio de pagamento" },
    ],
    colunas: [
      { titulo: "ID", chave: "id" },
      { titulo: "Data", chave: "data" },
      { titulo: "Pagador", chave: "pagador" },
      { titulo: "Meio", chave: "meio" },
      { titulo: "Valor", chave: "valor" },
      { titulo: "Taxa", chave: "taxa" },
      { titulo: "Líquido", chave: "liquido" },
      { titulo: "Situação", chave: "situacao" },
    ],
    amostra: (i) => {
      const valor = dinheiro(210 + i * 37.9);
      const taxa = dinheiro(valor * 0.0499);
      return {
        id: 4180000000 + i,
        data: dia(10 - (i % 10)),
        pagador: escolher(["joao@example.com", "maria@example.com", "loja@example.com"], i),
        meio: escolher(["pix", "credit_card", "bolbradesco"], i),
        valor,
        taxa,
        liquido: dinheiro(valor - taxa),
        situacao: i % 7 === 0 ? "pending" : "approved",
      };
    },
  },
  {
    id: "focus-nfe.nota_fiscal.listar.nfe_recebida",
    sistema: "Focus NFe",
    titulo: "Notas fiscais recebidas",
    descricao: "NF-e emitidas contra o CNPJ da empresa, para conferência de compras.",
    metodo: "GET",
    caminho: "/v2/nfes_recebidas",
    termos: [
      "nota",
      "notas",
      "nfe",
      "fiscal",
      "fiscais",
      "recebida",
      "recebidas",
      "compra",
      "compras",
      "fornecedor",
      "fornecedores",
      "xml",
      "focus",
    ],
    filtros: [
      { parametro: "cnpj", descricao: "CNPJ do destinatário" },
      { parametro: "versao", descricao: "paginação por versão" },
    ],
    colunas: [
      { titulo: "Chave de acesso", chave: "chave" },
      { titulo: "Emitente", chave: "emitente" },
      { titulo: "CNPJ emitente", chave: "cnpj" },
      { titulo: "Emissão", chave: "emissao" },
      { titulo: "Valor total", chave: "valor" },
      { titulo: "Situação", chave: "situacao" },
    ],
    amostra: (i) => ({
      chave: `3526${String(i + 1).padStart(40, "0")}`,
      emitente: escolher(["Distribuidora Norte", "Insumos Caravelas", "Peças União"], i),
      cnpj: "00000000000191",
      emissao: dia(25 - (i % 25)),
      valor: dinheiro(2300 + i * 210.5),
      situacao: "autorizada",
    }),
  },
];

export const SISTEMAS = Array.from(new Set(CONSULTAS.map((c) => c.sistema)));

/** Pontua as consultas do catálogo contra a pergunta do cliente. */
export function buscarConsultas(pergunta: string, limite = 3): Consulta[] {
  const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const palavras = new Set(
    normalizar(pergunta)
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length > 2),
  );

  return CONSULTAS.map((consulta) => {
    const alvo = new Set([
      ...consulta.termos,
      ...normalizar(`${consulta.sistema} ${consulta.titulo} ${consulta.descricao}`).split(
        /[^a-z0-9]+/,
      ),
    ]);
    let pontos = 0;
    palavras.forEach((p) => {
      if (alvo.has(p)) pontos += 1;
    });
    return { consulta, pontos };
  })
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite)
    .map((r) => r.consulta);
}

export function gerarLinhas(consulta: Consulta, quantidade: number) {
  return Array.from({ length: quantidade }, (_, i) => consulta.amostra(i));
}
