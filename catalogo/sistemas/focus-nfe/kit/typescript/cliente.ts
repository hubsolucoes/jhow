/**
 * Cliente Focus NFe (API v2) — kit do catálogo. Node 18+ (fetch nativo).
 *
 *   cp .env.example .env    # preencha FOCUS_AMBIENTE, FOCUS_TOKEN e FOCUS_CNPJ
 *   node --env-file=.env --experimental-strip-types cliente.ts     # Node 22.6+
 *   npx tsx --env-file=.env cliente.ts                             # alternativa
 *   ... cliente.ts --emitir-teste   # emite NF-e de TESTE (só sandbox, pede confirmação)
 *
 * Documentação: https://doc.focusnfe.com.br/reference/introducao
 */
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";

type Ambiente = "sandbox" | "producao";
type Json = Record<string, any>;

const BASES: Record<Ambiente, string> = {
  sandbox: "https://homologacao.focusnfe.com.br",
  producao: "https://api.focusnfe.com.br",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class ErroFocus extends Error {
  constructor(public status: number, public corpo: unknown) {
    super(`Focus NFe HTTP ${status}: ${typeof corpo === "string" ? corpo : JSON.stringify(corpo)}`);
  }
}

export class FocusNFe {
  readonly ambiente: Ambiente;
  readonly base: string;
  private readonly auth: string;

  constructor(token = process.env.FOCUS_TOKEN ?? "", ambiente = (process.env.FOCUS_AMBIENTE ?? "sandbox") as Ambiente) {
    if (!(ambiente in BASES)) throw new Error("FOCUS_AMBIENTE deve ser 'sandbox' ou 'producao'");
    if (!token || token.startsWith("<<")) throw new Error("Preencha FOCUS_TOKEN no arquivo .env");
    this.ambiente = ambiente;
    this.base = BASES[ambiente];
    // HTTP Basic: token como usuário, senha vazia
    this.auth = "Basic " + Buffer.from(`${token}:`).toString("base64");
  }

  /** Chamada com retry em 429 (Rate-Limit-Reset) e 5xx. */
  async chamar(metodo: string, caminho: string, opts: { query?: Record<string, string | number>; corpo?: unknown; aceitos?: number[] } = {}): Promise<Response> {
    const aceitos = opts.aceitos ?? [200];
    const qs = opts.query ? "?" + new URLSearchParams(Object.entries(opts.query).map(([k, v]) => [k, String(v)])) : "";
    for (let tentativa = 0; ; tentativa++) {
      const resp = await fetch(this.base + caminho + qs, {
        method: metodo,
        headers: { Authorization: this.auth, "Content-Type": "application/json", Accept: "application/json" },
        body: opts.corpo === undefined ? undefined : JSON.stringify(opts.corpo),
      });
      if (resp.status === 429 && tentativa < 3) {
        await sleep(Number(resp.headers.get("Rate-Limit-Reset") ?? resp.headers.get("Retry-After") ?? "60") * 1000);
        continue;
      }
      if (resp.status >= 500 && tentativa < 3) {
        await sleep(2 ** tentativa * 1000);
        continue;
      }
      if (!aceitos.includes(resp.status)) {
        const texto = await resp.text();
        let corpo: unknown = texto;
        try { corpo = JSON.parse(texto); } catch { /* 401 vem em text/html */ }
        throw new ErroFocus(resp.status, corpo);
      }
      return resp;
    }
  }

  private async confirmar(acao: string, confirmado: boolean): Promise<void> {
    if (confirmado) return;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const r = await rl.question(`[${this.ambiente.toUpperCase()} - ${this.base}] Confirma ${acao}? Digite SIM: `);
    rl.close();
    if (r.trim().toUpperCase() !== "SIM") throw new Error("Operação cancelada pelo usuário");
  }

  /** Tabelas auxiliares e empresas: 50 por página, total em X-Total-Count. */
  async listarOffset(caminho: string, filtros: Record<string, string> = {}): Promise<Json[]> {
    const itens: Json[] = [];
    let offset = 0;
    while (true) {
      const resp = await this.chamar("GET", caminho, { query: { ...filtros, offset } });
      const pagina = (await resp.json()) as Json[];
      if (pagina.length === 0) return itens;
      itens.push(...pagina);
      offset += pagina.length;
      const total = Number(resp.headers.get("X-Total-Count") ?? 0);
      if (total && offset >= total) return itens;
    }
  }

  /** Documentos recebidos: versao > X (até 100 por chamada); próximo X em X-Max-Version. */
  async listarVersao(caminho: string, filtros: Record<string, string>, versao = 0): Promise<{ docs: Json[]; versao: number }> {
    const docs: Json[] = [];
    while (true) {
      const resp = await this.chamar("GET", caminho, { query: { ...filtros, versao } });
      const pagina = (await resp.json()) as Json[];
      if (pagina.length === 0) return { docs, versao };
      docs.push(...pagina);
      const maxV = Number(resp.headers.get("X-Max-Version") ?? Math.max(...pagina.map((d) => Number(d.versao ?? 0))));
      if (!maxV || maxV <= versao) return { docs, versao };
      versao = maxV;
    }
  }

  /** Polling de GET /v2/<documento>/{ref} com espera crescente (2 s a 60 s). */
  async aguardar(documento: string, ref: string, resultado: Json = { status: "processando_autorizacao" }, tentativas = 10): Promise<Json> {
    let espera = 2000;
    for (let i = 0; i < tentativas && resultado.status === "processando_autorizacao"; i++) {
      await sleep(espera);
      espera = Math.min(espera * 2, 60000);
      resultado = (await (await this.chamar("GET", `/v2/${documento}/${ref}`)).json()) as Json;
    }
    return resultado;
  }

  async emitirNfe(ref: string, nota: Json, confirmado = false, aguardar = true): Promise<Json> {
    await this.confirmar(`a EMISSÃO da NF-e ref=${ref}`, confirmado);
    const resp = await this.chamar("POST", "/v2/nfe", { query: { ref }, corpo: nota, aceitos: [201, 202] });
    const r = (await resp.json()) as Json;
    return aguardar ? this.aguardar("nfe", ref, r) : r;
  }

  async consultarNfe(ref: string, completa = false): Promise<Json> {
    return (await this.chamar("GET", `/v2/nfe/${ref}`, { query: { completa: completa ? 1 : 0 } })).json();
  }

  async cancelarNfe(ref: string, justificativa: string, confirmado = false): Promise<Json> {
    if (justificativa.length < 15 || justificativa.length > 255) throw new Error("Justificativa deve ter 15 a 255 caracteres");
    await this.confirmar(`o CANCELAMENTO (irreversível) da NF-e ref=${ref}`, confirmado);
    return (await this.chamar("DELETE", `/v2/nfe/${ref}`, { corpo: { justificativa } })).json();
  }

  async cartaCorrecaoNfe(ref: string, correcao: string, confirmado = false): Promise<Json> {
    await this.confirmar(`a CARTA DE CORREÇÃO da NF-e ref=${ref}`, confirmado);
    return (await this.chamar("POST", `/v2/nfe/${ref}/carta_correcao`, { corpo: { correcao } })).json();
  }

  async inutilizarNfe(cnpj: string, serie: string, numeroInicial: string, numeroFinal: string, justificativa: string, confirmado = false): Promise<Json> {
    await this.confirmar(`a INUTILIZAÇÃO (irreversível) de ${numeroInicial}-${numeroFinal} série ${serie}`, confirmado);
    const corpo = { cnpj, serie, numero_inicial: numeroInicial, numero_final: numeroFinal, justificativa };
    return (await this.chamar("POST", "/v2/nfe/inutilizacao", { corpo })).json();
  }

  async emitirNfce(ref: string, nota: Json, confirmado = false): Promise<Json> {
    await this.confirmar(`a EMISSÃO da NFC-e ref=${ref}`, confirmado);
    return (await this.chamar("POST", "/v2/nfce", { query: { ref }, corpo: nota, aceitos: [201] })).json();
  }

  async emitirNfse(ref: string, nota: Json, nacional = false, confirmado = false): Promise<Json> {
    const doc = nacional ? "nfsen" : "nfse";
    await this.confirmar(`a EMISSÃO da ${doc.toUpperCase()} ref=${ref}`, confirmado);
    const r = (await (await this.chamar("POST", `/v2/${doc}`, { query: { ref }, corpo: nota, aceitos: [201, 202] })).json()) as Json;
    return this.aguardar(doc, ref, r);
  }

  /** Baixa XML/DANFE a partir de caminho_xml_nota_fiscal, caminho_danfe etc. */
  async baixarArquivo(caminhoRelativo: string, destino: string): Promise<string> {
    const resp = await this.chamar("GET", caminhoRelativo);
    await writeFile(destino, Buffer.from(await resp.arrayBuffer()));
    return destino;
  }

  nfesRecebidas(cnpj: string, versao = 0) {
    return this.listarVersao("/v2/nfes_recebidas", { cnpj }, versao);
  }

  async manifestar(chave: string, tipo: "ciencia" | "confirmacao" | "desconhecimento" | "nao_realizada", justificativa?: string, confirmado = false): Promise<Json> {
    await this.confirmar(`a MANIFESTAÇÃO '${tipo}' da NF-e ${chave}`, confirmado);
    return (await this.chamar("POST", `/v2/nfes_recebidas/${chave}/manifesto`, { corpo: { tipo, ...(justificativa ? { justificativa } : {}) } })).json();
  }

  async cep(cep: string): Promise<Json> {
    return (await this.chamar("GET", `/v2/ceps/${cep}`)).json();
  }
}

const NOTA_TESTE: Json = {
  natureza_operacao: "Venda de mercadoria",
  tipo_documento: 1, finalidade_emissao: 1, local_destino: 1, consumidor_final: 1, presenca_comprador: 2,
  // Texto que a SEFAZ costuma exigir no destinatário em homologação
  nome_destinatario: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
  cpf_destinatario: "00000000000", indicador_inscricao_estadual_destinatario: 9,
  logradouro_destinatario: "Rua Exemplo", numero_destinatario: "100", bairro_destinatario: "Centro",
  municipio_destinatario: "São Paulo", uf_destinatario: "SP", cep_destinatario: "01001000",
  modalidade_frete: 9, valor_produtos: 10, valor_total: 10,
  items: [{
    numero_item: 1, codigo_produto: "TESTE-1", descricao: "Produto de teste", cfop: "5102", codigo_ncm: "61091000",
    unidade_comercial: "UN", quantidade_comercial: 1, valor_unitario_comercial: 10, unidade_tributavel: "UN",
    quantidade_tributavel: 1, valor_unitario_tributavel: 10, valor_bruto: 10, icms_origem: 0,
    icms_situacao_tributaria: "102", pis_situacao_tributaria: "07", cofins_situacao_tributaria: "07",
  }],
  formas_pagamento: [{ forma_pagamento: "01", valor_pagamento: 10 }],
};

async function main() {
  const api = new FocusNFe();
  const cnpj = process.env.FOCUS_CNPJ ?? "";
  console.log(`Ambiente: ${api.ambiente} (${api.base})`);
  console.log("CEP 01001000:", await api.cep("01001000"));
  if (cnpj && !cnpj.startsWith("<<")) {
    const { docs, versao } = await api.nfesRecebidas(cnpj);
    console.log(`${docs.length} NF-e recebidas; guarde a versão ${versao}`);
  }
  if (process.argv.includes("--emitir-teste")) {
    if (api.ambiente !== "sandbox") throw new Error("A emissão de teste só roda com FOCUS_AMBIENTE=sandbox");
    const ref = "teste" + Date.now();
    const nota = { ...NOTA_TESTE, cnpj_emitente: cnpj, data_emissao: new Date().toISOString() };
    const r = await api.emitirNfe(ref, nota);
    console.log("Resultado:", r.status, r.mensagem_sefaz ?? "", r.erros ?? "");
    if (r.status === "autorizado") console.log("XML salvo em", await api.baixarArquivo(r.caminho_xml_nota_fiscal, `${ref}.xml`));
  }
}

main().catch((e) => {
  console.error(e instanceof ErroFocus ? `Erro da API: ${e.status} ${JSON.stringify(e.corpo)}` : e);
  process.exit(1);
});
