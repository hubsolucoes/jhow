/**
 * Credenciais salvas no navegador, criptografadas com um PIN do cliente — um pacote por sistema.
 *
 * AES-GCM com chave derivada do PIN por PBKDF2. O pacote fica no localStorage deste
 * navegador e nunca vai ao servidor nem à IA; o PIN não é guardado em lugar nenhum.
 * Depois de MAX_ERROS PINs errados seguidos, o pacote é apagado.
 * Proteção para o uso do dia a dia (computador compartilhado, curiosos); não substitui
 * o cofre no servidor com login, previsto para quando houver vários clientes.
 */

const chave = (slug: string) => `stagium.credenciais.v1:${slug}`;
const chaveErros = (slug: string) => `stagium.credenciais.erros:${slug}`;
/** Antes de haver vários sistemas, o pacote do Sagi ficava sem o slug na chave. */
const CHAVE_ANTIGA_SAGI = "stagium.credenciais.v1";
const MAX_ERROS = 5;
const ITERACOES = 310_000;
export const PIN_MINIMO = 4;

type Pacote = { v: 1; sal: string; iv: string; dados: string; salvoEm: string };

const paraBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const deBase64 = (texto: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

function lerPacote(slug: string): Pacote | null {
  try {
    const texto =
      localStorage.getItem(chave(slug)) ??
      (slug === "sygecom" ? localStorage.getItem(CHAVE_ANTIGA_SAGI) : null);
    return texto ? (JSON.parse(texto) as Pacote) : null;
  } catch {
    return null;
  }
}

async function chaveDoPin(pin: string, sal: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: sal, iterations: ITERACOES, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function temCredenciaisSalvas(slug: string): boolean {
  return lerPacote(slug) !== null;
}

export function apagarCredenciaisSalvas(slug: string) {
  try {
    localStorage.removeItem(chave(slug));
    localStorage.removeItem(chaveErros(slug));
    if (slug === "sygecom") localStorage.removeItem(CHAVE_ANTIGA_SAGI);
  } catch {
    // armazenamento bloqueado: não há o que apagar
  }
}

export async function salvarCredenciais(
  slug: string,
  credenciais: Record<string, string>,
  pin: string,
) {
  if (pin.length < PIN_MINIMO)
    throw new Error(`O PIN precisa ter pelo menos ${PIN_MINIMO} caracteres.`);
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const segredo = await chaveDoPin(pin, sal);
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    segredo,
    new TextEncoder().encode(JSON.stringify(credenciais)),
  );
  const pacote: Pacote = {
    v: 1,
    sal: paraBase64(sal),
    iv: paraBase64(iv),
    dados: paraBase64(new Uint8Array(cifrado)),
    salvoEm: new Date().toISOString(),
  };
  try {
    localStorage.setItem(chave(slug), JSON.stringify(pacote));
    localStorage.removeItem(chaveErros(slug));
    if (slug === "sygecom") localStorage.removeItem(CHAVE_ANTIGA_SAGI);
  } catch {
    throw new Error(
      "Este navegador não permite salvar dados (janela anônima ou bloqueio de cookies).",
    );
  }
}

export async function abrirCredenciais(slug: string, pin: string): Promise<Record<string, string>> {
  const pacote = lerPacote(slug);
  if (!pacote) throw new Error("Não há credenciais salvas neste navegador.");
  try {
    const segredo = await chaveDoPin(pin, deBase64(pacote.sal));
    const aberto = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deBase64(pacote.iv) },
      segredo,
      deBase64(pacote.dados),
    );
    localStorage.removeItem(chaveErros(slug));
    return JSON.parse(new TextDecoder().decode(aberto)) as Record<string, string>;
  } catch {
    let erros = 1;
    try {
      erros = Number(localStorage.getItem(chaveErros(slug)) ?? "0") + 1;
      localStorage.setItem(chaveErros(slug), String(erros));
    } catch {
      // segue com a contagem local
    }
    if (erros >= MAX_ERROS) {
      apagarCredenciaisSalvas(slug);
      throw new Error(
        `PIN errado ${MAX_ERROS} vezes. As credenciais salvas foram apagadas; informe-as de novo.`,
      );
    }
    const restam = MAX_ERROS - erros;
    throw new Error(
      `PIN incorreto. ${restam === 1 ? "Resta 1 tentativa" : `Restam ${restam} tentativas`}.`,
    );
  }
}
