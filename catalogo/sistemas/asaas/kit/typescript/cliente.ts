/**
 * Kit Asaas — cliente TypeScript (Node 18+, fetch nativo).
 *
 * Não requer edição: credenciais e ambiente vêm do .env (veja .env.example).
 *   Node 20.6+:  npx tsx --env-file=.env cliente.ts
 *   Node 18:     npm i dotenv  e rode com  npx tsx -r dotenv/config cliente.ts
 *
 * Endpoints usados (mesmos paths de endpoints.json): /v3/customers, /v3/payments, /v3/payments/{id}/pixQrCode,
 * /v3/payments/{id}/identificationField, /v3/payments/{id}/refund, /v3/subscriptions, /v3/financialTransactions,
 * /v3/finance/balance, /v3/transfers, /v3/webhooks, /v3/invoices.
 */
import { timingSafeEqual } from "node:crypto";

const URLS = { sandbox: "https://api-sandbox.asaas.com", producao: "https://api.asaas.com" } as const;
type Ambiente = keyof typeof URLS;
type Json = Record<string, any>;
type Pagina<T> = { hasMore?: boolean; totalCount?: number; data: T[] };

export class AsaasErro extends Error {
  constructor(public status: number, public erros: unknown, metodo: string, caminho: string) {
    super(`Asaas HTTP ${status} em ${metodo} ${caminho}: ${JSON.stringify(erros)}`);
  }
  get codigos(): string[] {
    return Array.isArray(this.erros) ? this.erros.map((e: any) => e?.code ?? "") : [];
  }
}

const limpar = (v?: string) => (v ?? "").trim().replace(/^['"]|['"]$/g, "");
const esperar = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

export class AsaasCliente {
  readonly ambiente: Ambiente;
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly userAgent: string;
  private readonly tentativas: number;
  private readonly timeoutMs: number;

  constructor(opts: { apiKey?: string; ambiente?: string; userAgent?: string; tentativas?: number; timeoutMs?: number } = {}) {
    this.tentativas = opts.tentativas ?? 3;
    this.timeoutMs = opts.timeoutMs ?? 30000;
    const amb = limpar(opts.ambiente ?? process.env.ASAAS_AMBIENTE).toLowerCase();
    this.ambiente = amb === "producao" ? "producao" : "sandbox"; // padrão seguro
    this.apiKey = limpar(opts.apiKey ?? process.env.ASAAS_API_KEY);
    if (!this.apiKey || this.apiKey.startsWith("<<")) {
      throw new Error("Defina ASAAS_API_KEY no .env (chave do mesmo ambiente de ASAAS_AMBIENTE).");
    }
    this.userAgent = limpar(opts.userAgent ?? process.env.ASAAS_USER_AGENT) || "kit-catalogo-typescript/1.0";
    this.baseUrl = `${URLS[this.ambiente]}/v3`;
  }

  /** Repete em 429 (sempre) e em 5xx/erro de rede só para GET. Escritas não são repetidas (sem idempotência na API). */
  async requisicao<T = Json>(metodo: string, caminho: string, opts: { params?: Json; corpo?: unknown } = {}): Promise<T> {
    const qs = opts.params
      ? "?" + new URLSearchParams(Object.entries(opts.params).filter(([, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => [k, String(v)])).toString()
      : "";
    for (let tentativa = 1; tentativa <= this.tentativas; tentativa++) {
      const ultima = tentativa === this.tentativas;
      let res: Response;
      try {
        res = await fetch(this.baseUrl + caminho + qs, {
          method: metodo,
          headers: { access_token: this.apiKey, "User-Agent": this.userAgent, "Content-Type": "application/json" },
          body: opts.corpo === undefined ? undefined : JSON.stringify(opts.corpo),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        if (metodo === "GET" && !ultima) { await esperar(2 ** tentativa); continue; }
        throw err;
      }
      if (res.status === 429 && !ultima) { await esperar(Number(res.headers.get("RateLimit-Reset") ?? 5) + 1); continue; }
      if (res.status >= 500 && metodo === "GET" && !ultima) { await esperar(2 ** tentativa); continue; }
      const texto = await res.text();
      if (!res.ok) {
        let erros: unknown = texto;
        try { erros = JSON.parse(texto).errors ?? texto; } catch { /* corpo não-JSON */ }
        throw new AsaasErro(res.status, erros, metodo, caminho);
      }
      return (texto ? JSON.parse(texto) : null) as T;
    }
    throw new Error("tentativas esgotadas");
  }

  /** Percorre offset/limit (100 por página) até hasMore=false. */
  async *paginar<T = Json>(caminho: string, filtros: Json = {}): AsyncGenerator<T> {
    for (let offset = 0; ; offset += 100) {
      const pagina = await this.requisicao<Pagina<T>>("GET", caminho, { params: { ...filtros, limit: 100, offset } });
      yield* (pagina.data ?? []);
      if (!pagina.hasMore) return;
    }
  }

  async listarTodos<T = Json>(caminho: string, filtros: Json = {}): Promise<T[]> {
    const itens: T[] = [];
    for await (const item of this.paginar<T>(caminho, filtros)) itens.push(item);
    return itens;
  }

  // ---------------------------------------------------------------- clientes
  async buscarClientePorDocumento(cpfCnpj: string): Promise<Json | undefined> {
    for await (const c of this.paginar("/customers", { cpfCnpj })) return c;
    return undefined;
  }
  criarCliente(nome: string, cpfCnpj: string, extras: Json = {}) {
    return this.requisicao("POST", "/customers", { corpo: { name: nome, cpfCnpj, ...extras } });
  }
  async obterOuCriarCliente(nome: string, cpfCnpj: string, extras: Json = {}) {
    return (await this.buscarClientePorDocumento(cpfCnpj)) ?? this.criarCliente(nome, cpfCnpj, extras);
  }

  // --------------------------------------------------------------- cobranças
  /** billingType: BOLETO | PIX | CREDIT_CARD | UNDEFINED; vencimento AAAA-MM-DD. Use externalReference. */
  criarCobranca(customer: string, billingType: string, valor: number, vencimento: string, extras: Json = {}) {
    return this.requisicao("POST", "/payments", { corpo: { customer, billingType, value: valor, dueDate: vencimento, ...extras } });
  }
  buscarCobrancasPorReferencia(externalReference: string) {
    return this.listarTodos("/payments", { externalReference });
  }
  obterCobranca(id: string) { return this.requisicao("GET", `/payments/${id}`); }
  async statusCobranca(id: string): Promise<string> { return (await this.requisicao("GET", `/payments/${id}/status`)).status; }
  /** encodedImage (PNG Base64), payload (copia-e-cola), expirationDate */
  pixQrCode(id: string) { return this.requisicao("GET", `/payments/${id}/pixQrCode`); }
  /** identificationField, nossoNumero, barCode */
  linhaDigitavel(id: string) { return this.requisicao("GET", `/payments/${id}/identificationField`); }
  excluirCobranca(id: string) { return this.requisicao("DELETE", `/payments/${id}`); }
  estornarCobranca(id: string, valor?: number, motivo?: string) {
    const corpo: Json = {};
    if (valor !== undefined) corpo.value = valor;
    if (motivo) corpo.description = motivo;
    return this.requisicao("POST", `/payments/${id}/refund`, { corpo });
  }
  listarCobrancas(filtros: Json = {}) { return this.listarTodos("/payments", filtros); }

  // ------------------------------------------------------------- assinaturas
  criarAssinatura(customer: string, billingType: string, valor: number, proximoVencimento: string, ciclo = "MONTHLY", extras: Json = {}) {
    return this.requisicao("POST", "/subscriptions", {
      corpo: { customer, billingType, value: valor, nextDueDate: proximoVencimento, cycle: ciclo, ...extras },
    });
  }
  atualizarAssinatura(id: string, campos: Json) { return this.requisicao("PUT", `/subscriptions/${id}`, { corpo: campos }); }
  cancelarAssinatura(id: string) { return this.requisicao("DELETE", `/subscriptions/${id}`); }
  cobrancasDaAssinatura(id: string) { return this.listarTodos(`/subscriptions/${id}/payments`); }

  // -------------------------------------------------------------- financeiro
  async saldo(): Promise<number> { return (await this.requisicao("GET", "/finance/balance")).balance; }
  extrato(inicio: string, fim: string) { return this.listarTodos("/financialTransactions", { startDate: inicio, finishDate: fim }); }
  /** Movimenta dinheiro; pode retornar invalid_action (autorização crítica pendente). tipoChave: CPF|CNPJ|EMAIL|PHONE|EVP */
  transferirPix(valor: number, chave: string, tipoChave: string, descricao?: string, externalReference?: string) {
    return this.requisicao("POST", "/transfers", {
      corpo: { value: valor, operationType: "PIX", pixAddressKey: chave, pixAddressKeyType: tipoChave, description: descricao, externalReference },
    });
  }
  listarTransferencias(filtros: Json = {}) { return this.listarTodos("/transfers", filtros); }
  listarNotas(filtros: Json = {}) { return this.listarTodos("/invoices", filtros); }

  // ---------------------------------------------------------------- webhooks
  criarWebhook(nome: string, url: string, email: string, authToken: string, eventos: string[], sequencial = true) {
    return this.requisicao("POST", "/webhooks", {
      corpo: { name: nome, url, email, enabled: true, interrupted: false, apiVersion: 3, authToken, events: eventos,
               sendType: sequencial ? "SEQUENTIALLY" : "NON_SEQUENTIALLY" },
    });
  }
  listarWebhooks() { return this.listarTodos("/webhooks"); }
  /** Use depois de corrigir o endpoint: reativa fila interrompida. */
  reativarWebhook(id: string) { return this.requisicao("PUT", `/webhooks/${id}`, { corpo: { interrupted: false } }); }

  /** Compara o header asaas-access-token com o token cadastrado (o Asaas não usa HMAC). */
  static webhookAutentico(headers: Record<string, string | string[] | undefined>, token = limpar(process.env.ASAAS_WEBHOOK_TOKEN)): boolean {
    const bruto = Object.entries(headers).find(([k]) => k.toLowerCase() === "asaas-access-token")?.[1];
    const recebido = Buffer.from(String(Array.isArray(bruto) ? bruto[0] : bruto ?? ""));
    const esperado = Buffer.from(token);
    return esperado.length > 0 && recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
  }
}

async function exemplo() {
  const api = new AsaasCliente();
  console.log(`Ambiente: ${api.ambiente} (${api.baseUrl})`);
  if (api.ambiente === "producao") throw new Error("O exemplo cria registros de teste; use ASAAS_AMBIENTE=sandbox.");
  console.log("Saldo:", await api.saldo());
  const cliente = await api.obterOuCriarCliente("Cliente Exemplo Ltda", "00000000000191", {
    email: "financeiro@example.com", notificationDisabled: true,
  });
  const ref = "KIT-EXEMPLO-001";
  const existentes = await api.buscarCobrancasPorReferencia(ref);
  const hoje = new Date().toISOString().slice(0, 10);
  const cobranca = existentes[0] ?? (await api.criarCobranca(cliente.id, "PIX", 10, hoje, { externalReference: ref, description: "Teste do kit" }));
  const qr = await api.pixQrCode(cobranca.id);
  console.log("Cobrança:", cobranca.id, cobranca.status, "| Pix copia-e-cola:", String(qr.payload).slice(0, 30), "...");
  console.log("Cobranças no ambiente:", (await api.listarCobrancas()).length);
}

// executa o exemplo só quando o arquivo é chamado diretamente (funciona em CJS e ESM)
if (/cliente\.(ts|js|mjs|cjs)$/.test(process.argv[1] ?? "")) {
  exemplo().catch((err) => {
    console.error("Falha:", err instanceof AsaasErro ? `${err.message} | códigos: ${err.codigos.join(", ")}` : err);
    process.exit(1);
  });
}
