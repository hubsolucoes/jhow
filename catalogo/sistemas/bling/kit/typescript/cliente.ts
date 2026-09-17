/**
 * Cliente TypeScript para a API v3 do Bling (kit do catálogo). Node 18+ (fetch nativo), sem dependências.
 *
 * Configuração: copie .env.example para .env e preencha. Nada precisa ser editado aqui.
 * Execução (exemplos):
 *   npx tsx cliente.ts autorizar      # primeira autorização: mostra o link e troca o code
 *   npx tsx cliente.ts renovar        # renova o access_token com o refresh_token
 *   npx tsx cliente.ts token          # imprime um access_token válido
 *   npx tsx cliente.ts exemplo        # leituras de exemplo
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createInterface } from "node:readline/promises";

const AQUI = dirname(fileURLToPath(import.meta.url));
const URL_API = "https://api.bling.com.br/Api/v3"; // mesma URL para "sandbox" (conta de teste) e produção
const URL_AUTORIZAR = "https://www.bling.com.br/Api/v3/oauth/authorize";
const URL_TOKEN = `${URL_API}/oauth/token`;
const URL_REVOGAR = "https://api.bling.com.br/oauth/revoke";
const INTERVALO_MS = 350; // limite do Bling: 3 requisições/s por conta

type Json = any;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function carregarEnv(caminho = join(AQUI, ".env")): Record<string, string> {
  const valores: Record<string, string> = {};
  if (existsSync(caminho)) {
    for (const bruta of readFileSync(caminho, "utf8").split(/\r?\n/)) {
      const linha = bruta.trim();
      if (!linha || linha.startsWith("#") || !linha.includes("=")) continue;
      const i = linha.indexOf("=");
      valores[linha.slice(0, i).trim()] = linha.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith("BLING_") && v !== undefined) valores[k] = v;
  return valores;
}

export class BlingErro extends Error {
  constructor(public status: number, public corpo: Json) {
    const e = corpo?.error ?? {};
    const campos = (e.fields ?? []).map((c: Json) => `${c.element}: ${c.msg}`).join("; ");
    super(`Bling HTTP ${status} ${e.type ?? ""}: ${e.description ?? e.message ?? JSON.stringify(corpo).slice(0, 300)}${campos ? ` [${campos}]` : ""}`);
  }
  get periodo(): string | undefined { return this.corpo?.error?.period; }
}

export class BlingCliente {
  readonly ambiente: "sandbox" | "producao";
  private clientId: string;
  private clientSecret: string;
  private arquivoTokens: string;
  private timeoutMs: number;
  private ultima = 0;

  constructor(env: Record<string, string> = carregarEnv()) {
    const amb = (env.BLING_AMBIENTE ?? "sandbox").toLowerCase();
    if (amb !== "sandbox" && amb !== "producao") throw new Error("BLING_AMBIENTE deve ser 'sandbox' ou 'producao'");
    this.ambiente = amb as "sandbox" | "producao";
    this.clientId = env.BLING_CLIENT_ID ?? "";
    this.clientSecret = env.BLING_CLIENT_SECRET ?? "";
    if (!this.clientId || !this.clientSecret || this.clientId.startsWith("<<")) {
      throw new Error("Preencha BLING_CLIENT_ID e BLING_CLIENT_SECRET no arquivo .env");
    }
    const arq = env.BLING_TOKENS_ARQUIVO || `bling_tokens_${amb}.json`;
    this.arquivoTokens = isAbsolute(arq) ? arq : join(AQUI, arq);
    this.timeoutMs = Number(env.BLING_TIMEOUT_MS || 60000);
  }

  // ------------------------------------------------------------ OAuth
  linkAutorizacao(): { url: string; state: string } {
    const state = randomBytes(24).toString("hex");
    const qs = new URLSearchParams({ response_type: "code", client_id: this.clientId, state });
    return { url: `${URL_AUTORIZAR}?${qs}`, state };
  }

  private basic(): string {
    return "Basic " + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
  }

  private async postToken(dados: Record<string, string>): Promise<Json> {
    const r = await fetch(URL_TOKEN, {
      method: "POST",
      headers: { Authorization: this.basic(), Accept: "1.0", "enable-jwt": "1",
                 "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(dados),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const texto = await r.text();
    const corpo = texto ? JSON.parse(texto) : {};
    if (!r.ok) throw new BlingErro(r.status, corpo);
    corpo.expira_em = Date.now() + (Number(corpo.expires_in ?? 0) - 120) * 1000;
    corpo.ambiente = this.ambiente;
    writeFileSync(this.arquivoTokens, JSON.stringify(corpo, null, 2));
    try { chmodSync(this.arquivoTokens, 0o600); } catch { /* Windows */ }
    return corpo;
  }

  /** Troca o authorization code (vale 1 minuto, uso único: não repita automaticamente). */
  trocarCode(code: string): Promise<Json> {
    return this.postToken({ grant_type: "authorization_code", code });
  }

  private tokens(): Json {
    if (!existsSync(this.arquivoTokens)) throw new Error(`Tokens não encontrados em ${this.arquivoTokens}. Rode: npx tsx cliente.ts autorizar`);
    return JSON.parse(readFileSync(this.arquivoTokens, "utf8"));
  }

  /** Renova com o refresh_token (30 dias) e grava o novo par. */
  renovar(): Promise<Json> {
    return this.postToken({ grant_type: "refresh_token", refresh_token: this.tokens().refresh_token });
  }

  async accessToken(): Promise<string> {
    let t = this.tokens();
    if (Date.now() >= (t.expira_em ?? 0)) t = await this.renovar();
    return t.access_token;
  }

  async revogar(acao?: "logout" | "uninstall", alvo?: "user" | "company"): Promise<void> {
    const dados: Record<string, string> = { token: this.tokens().refresh_token, token_type_hint: "refresh_token" };
    if (acao) dados.revoke_action = acao;
    if (alvo) dados.revoke_target = alvo;
    const r = await fetch(URL_REVOGAR, {
      method: "POST",
      headers: { Authorization: this.basic(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(dados),
    });
    if (!r.ok) throw new BlingErro(r.status, await r.text());
  }

  // ------------------------------------------------------------ HTTP
  async requisicao(metodo: string, caminho: string, params?: Record<string, string | number | (string | number)[]>, corpo?: unknown): Promise<Json> {
    metodo = metodo.toUpperCase();
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) {
      if (v === undefined || v === null || v === "") continue;
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
      else qs.append(k, String(v));
    }
    const url = URL_API + caminho + (qs.toString() ? `?${qs}` : "");
    let renovado = false;
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const espera = INTERVALO_MS - (Date.now() - this.ultima);
      if (espera > 0) await sleep(espera);
      this.ultima = Date.now();
      let r: Response;
      try {
        r = await fetch(url, {
          method: metodo,
          headers: { Authorization: `Bearer ${await this.accessToken()}`, Accept: "application/json",
                     "Content-Type": "application/json", "enable-jwt": "1" },
          body: corpo === undefined ? undefined : JSON.stringify(corpo),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (e) {
        if (metodo === "GET" && tentativa < 5) { await sleep(2 ** tentativa * 1000); continue; }
        throw e; // escrita: sem idempotência na API, não repetir às cegas
      }
      const texto = await r.text();
      const dados = texto ? (() => { try { return JSON.parse(texto); } catch { return texto; } })() : null;
      if (r.status === 401 && !renovado) { await this.renovar(); renovado = true; continue; }
      if (r.status === 429) {
        const erro = new BlingErro(429, dados);
        if (erro.periodo === "day") throw erro;
        await sleep(Math.min(2 ** tentativa, 30) * 1000);
        continue;
      }
      if (r.status >= 500 && metodo === "GET" && tentativa < 5) { await sleep(2 ** tentativa * 1000); continue; }
      if (!r.ok) throw new BlingErro(r.status, dados);
      return dados;
    }
    throw new Error(`Bling: tentativas esgotadas em ${metodo} ${caminho}`);
  }

  /** Percorre pagina=1,2,... até vir uma página incompleta. */
  async *listar(caminho: string, filtros: Record<string, string | number | (string | number)[]> = {}, limite = 100): AsyncGenerator<Json> {
    for (let pagina = 1; ; pagina++) {
      const dados: Json[] = (await this.requisicao("GET", caminho, { ...filtros, pagina, limite }))?.data ?? [];
      yield* dados;
      if (dados.length < limite) return;
    }
  }

  async todos(caminho: string, filtros: Record<string, string | number | (string | number)[]> = {}): Promise<Json[]> {
    const saida: Json[] = [];
    for await (const item of this.listar(caminho, filtros)) saida.push(item);
    return saida;
  }

  private async confirmarEscrita(descricao: string): Promise<void> {
    if (this.ambiente !== "producao" || process.env.BLING_CONFIRMAR === "0") return;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const resp = (await rl.question(`[PRODUÇÃO] ${descricao}. Confirmar? (s/N) `)).trim().toLowerCase();
    rl.close();
    if (resp !== "s") throw new Error("Operação cancelada pelo usuário");
  }

  // ------------------------------------------------------------ leituras
  async empresa(): Promise<Json> { return (await this.requisicao("GET", "/empresas/me/dados-basicos")).data; }
  pedidosVenda(dataInicial?: string, dataFinal?: string) {
    return this.todos("/pedidos/vendas", { dataInicial: dataInicial ?? "", dataFinal: dataFinal ?? "" });
  }
  async pedidoVenda(id: number): Promise<Json> { return (await this.requisicao("GET", `/pedidos/vendas/${id}`)).data; }
  produtos(criterio = 5) { return this.todos("/produtos", { criterio }); }
  async saldosEstoque(ids: number[], lote = 50): Promise<Json[]> {
    const saida: Json[] = [];
    for (let i = 0; i < ids.length; i += lote) {
      saida.push(...((await this.requisicao("GET", "/estoques/saldos", { "idsProdutos[]": ids.slice(i, i + lote) }))?.data ?? []));
    }
    return saida;
  }
  contatos() { return this.todos("/contatos", { criterio: 1 }); }
  contasReceber(dataInicial?: string, dataFinal?: string, situacoes: number[] = []) {
    return this.todos("/contas/receber", { tipoFiltroData: "V", dataInicial: dataInicial ?? "", dataFinal: dataFinal ?? "", "situacoes[]": situacoes });
  }
  contasPagar(vencimentoInicial?: string, vencimentoFinal?: string) {
    return this.todos("/contas/pagar", { dataVencimentoInicial: vencimentoInicial ?? "", dataVencimentoFinal: vencimentoFinal ?? "" });
  }
  notasFiscais(dataInicial?: string, dataFinal?: string) {
    return this.todos("/nfe", { dataEmissaoInicial: dataInicial ?? "", dataEmissaoFinal: dataFinal ?? "" });
  }
  async notaFiscal(id: number): Promise<Json> { return (await this.requisicao("GET", `/nfe/${id}`)).data; }
  async baixarDocumentoNfe(chave: string, formato: "xml" | "pdf" = "xml", pasta = AQUI): Promise<string[]> {
    const corpo = await this.requisicao("GET", `/nfe/documento/${chave}`, { formato });
    return (corpo?.data ?? []).map((doc: Json) => {
      const destino = join(pasta, doc.nome || `${chave}.${formato}`);
      writeFileSync(destino, gunzipSync(Buffer.from(doc.conteudo, "base64")));
      return destino;
    });
  }

  // ------------------------------------------------------------ escritas
  async criarContato(dados: Json): Promise<number> {
    const achado = (await this.requisicao("GET", "/contatos", { numeroDocumento: dados.numeroDocumento ?? "", criterio: 1 }))?.data ?? [];
    if (achado.length) return achado[0].id;
    await this.confirmarEscrita(`Criar contato ${dados.nome}`);
    return (await this.requisicao("POST", "/contatos", undefined, dados)).data.id;
  }

  /** Cria o pedido; se numeroLoja já existir, devolve o id existente. */
  async criarPedidoVenda(dados: Json): Promise<number> {
    if (dados.numeroLoja) {
      const achado = (await this.requisicao("GET", "/pedidos/vendas", { "numerosLojas[]": [dados.numeroLoja] }))?.data ?? [];
      if (achado.length) return achado[0].id;
    }
    await this.confirmarEscrita(`Criar pedido de venda ${dados.numeroLoja ?? ""}`);
    return (await this.requisicao("POST", "/pedidos/vendas", undefined, dados)).data.id;
  }

  async alterarSituacaoPedido(idPedido: number, idSituacao: number): Promise<void> {
    await this.confirmarEscrita(`Mudar situação do pedido ${idPedido} para ${idSituacao}`);
    await this.requisicao("PATCH", `/pedidos/vendas/${idPedido}/situacoes/${idSituacao}`);
  }

  /** Gera a NF-e do pedido e transmite à SEFAZ; devolve a nota (situacao 5 = autorizada). */
  async gerarEEnviarNfe(idPedido: number, enviarEmail = false): Promise<Json> {
    await this.confirmarEscrita(`Gerar e ENVIAR À SEFAZ a NF-e do pedido ${idPedido}`);
    const { idNotaFiscal } = await this.requisicao("POST", `/pedidos/vendas/${idPedido}/gerar-nfe`);
    await this.requisicao("POST", `/nfe/${idNotaFiscal}/enviar`, { enviarEmail: String(enviarEmail) });
    return this.notaFiscal(idNotaFiscal);
  }

  async baixarContaReceber(idConta: number, dados: Json): Promise<Json> {
    await this.confirmarEscrita(`Baixar conta a receber ${idConta}`);
    return this.requisicao("POST", `/contas/receber/${idConta}/baixar`, undefined, dados);
  }

  async lancarEstoque(idProduto: number, idDeposito: number, operacao: "B" | "E" | "S", quantidade: number, observacoes = ""): Promise<number> {
    await this.confirmarEscrita(`Lançar estoque ${operacao} ${quantidade} do produto ${idProduto}`);
    const corpo = { produto: { id: idProduto }, deposito: { id: idDeposito }, operacao, quantidade, observacoes };
    return (await this.requisicao("POST", "/estoques", undefined, corpo)).data.id;
  }
}

async function main(): Promise<void> {
  const comando = process.argv[2];
  const cli = new BlingCliente();
  if (comando === "autorizar") {
    const { url, state } = cli.linkAutorizacao();
    console.log("1) Abra no navegador, entre na conta Bling e autorize:\n  ", url);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const retorno = (await rl.question(`2) Cole a URL de retorno (state=${state}) ou só o code, em até 1 minuto: `)).trim();
    rl.close();
    let code = retorno;
    if (retorno.startsWith("http")) {
      const q = new URL(retorno).searchParams;
      if (q.get("error")) throw new Error(`Autorização negada: ${q.get("error")} ${q.get("error_description") ?? ""}`);
      if (q.get("state") !== state) throw new Error("state diferente do enviado: descarte esta resposta");
      code = q.get("code") ?? "";
    }
    await cli.trocarCode(code);
    console.log(`Tokens gravados (ambiente ${cli.ambiente}).`);
  } else if (comando === "renovar") {
    await cli.renovar();
    console.log(`Token renovado (${cli.ambiente}) em ${new Date().toISOString()}`);
  } else if (comando === "token") {
    console.log(await cli.accessToken());
  } else if (comando === "exemplo") {
    console.log("Empresa:", (await cli.empresa()).nome);
    const hoje = new Date().toISOString().slice(0, 10);
    const pedidos = await cli.pedidosVenda(`${hoje.slice(0, 7)}-01`, hoje);
    console.log("Pedidos no mês:", pedidos.length);
    const produtos = await cli.produtos(2);
    console.log("Produtos ativos:", produtos.length);
    const ids = produtos.filter((p: Json) => p.tipo === "P").slice(0, 50).map((p: Json) => p.id);
    if (ids.length) console.log("Sem saldo (amostra):", (await cli.saldosEstoque(ids)).filter((s: Json) => (s.saldoVirtualTotal ?? 0) <= 0).length);
  } else {
    console.log("Uso: npx tsx cliente.ts <autorizar|renovar|token|exemplo>");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error("ERRO:", e.message ?? e); process.exit(1); });
}
