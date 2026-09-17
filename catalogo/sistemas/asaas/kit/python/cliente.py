"""Kit Asaas — cliente Python (requests).

Não requer edição: credenciais e ambiente vêm do arquivo .env (veja .env.example).
    pip install requests python-dotenv
    python cliente.py          # roda o exemplo no ambiente configurado (padrão: sandbox)

Endpoints usados (mesmos paths de endpoints.json): /v3/customers, /v3/payments, /v3/payments/{id}/pixQrCode,
/v3/payments/{id}/identificationField, /v3/payments/{id}/refund, /v3/subscriptions, /v3/financialTransactions,
/v3/finance/balance, /v3/transfers, /v3/webhooks, /v3/invoices.
"""
from __future__ import annotations

import hmac
import os
import time
from typing import Any, Iterator

import requests

try:  # carrega .env se python-dotenv estiver instalado
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

URLS = {"sandbox": "https://api-sandbox.asaas.com", "producao": "https://api.asaas.com"}


class AsaasErro(Exception):
    """Erro da API com status HTTP e a lista errors[] devolvida pelo Asaas."""

    def __init__(self, status: int, erros: Any, metodo: str, caminho: str):
        self.status, self.erros = status, erros
        super().__init__(f"Asaas HTTP {status} em {metodo} {caminho}: {erros}")

    @property
    def codigos(self) -> list[str]:
        if isinstance(self.erros, list):
            return [e.get("code", "") for e in self.erros if isinstance(e, dict)]
        return []


class AsaasCliente:
    def __init__(self, api_key: str | None = None, ambiente: str | None = None,
                 user_agent: str | None = None, timeout: int = 30, tentativas: int = 3):
        self.ambiente = (ambiente or os.getenv("ASAAS_AMBIENTE") or "sandbox").strip().lower()
        if self.ambiente not in URLS:
            self.ambiente = "sandbox"  # padrão seguro
        self.api_key = (api_key or os.getenv("ASAAS_API_KEY") or "").strip().strip("'\"")
        if not self.api_key or self.api_key.startswith("<<"):
            raise RuntimeError("Defina ASAAS_API_KEY no .env (chave do mesmo ambiente de ASAAS_AMBIENTE).")
        self.base_url = URLS[self.ambiente] + "/v3"
        self.timeout, self.tentativas = timeout, tentativas
        self.sessao = requests.Session()
        self.sessao.headers.update({
            "access_token": self.api_key,
            "User-Agent": user_agent or os.getenv("ASAAS_USER_AGENT") or "kit-catalogo-python/1.0",
            "Content-Type": "application/json",
        })

    # ------------------------------------------------------------------ base
    def requisicao(self, metodo: str, caminho: str, *, params: dict | None = None, corpo: Any = None) -> Any:
        """Repete em 429 (sempre: a chamada foi recusada) e em 5xx/erros de rede só para GET.
        Escritas não são repetidas: a API não documenta idempotência."""
        for tentativa in range(1, self.tentativas + 1):
            ultima = tentativa == self.tentativas
            try:
                r = self.sessao.request(metodo, self.base_url + caminho, params=params, json=corpo, timeout=self.timeout)
            except requests.RequestException:
                if metodo == "GET" and not ultima:
                    time.sleep(2 ** tentativa)
                    continue
                raise
            if r.status_code == 429 and not ultima:
                time.sleep(int(r.headers.get("RateLimit-Reset") or 5) + 1)
                continue
            if r.status_code >= 500 and metodo == "GET" and not ultima:
                time.sleep(2 ** tentativa)
                continue
            if r.status_code >= 400:
                try:
                    erros = r.json().get("errors", r.text)
                except ValueError:
                    erros = r.text
                raise AsaasErro(r.status_code, erros, metodo, caminho)
            return r.json() if r.content else None
        raise RuntimeError("tentativas esgotadas")

    def paginar(self, caminho: str, **filtros: Any) -> Iterator[dict]:
        """Percorre offset/limit (100 por página) até hasMore=False."""
        offset = 0
        while True:
            pagina = self.requisicao("GET", caminho, params={**filtros, "limit": 100, "offset": offset})
            yield from pagina.get("data", [])
            if not pagina.get("hasMore"):
                return
            offset += 100

    # -------------------------------------------------------------- clientes
    def buscar_cliente_por_documento(self, cpf_cnpj: str) -> dict | None:
        return next(iter(self.paginar("/customers", cpfCnpj=cpf_cnpj)), None)

    def criar_cliente(self, nome: str, cpf_cnpj: str, **extras: Any) -> dict:
        return self.requisicao("POST", "/customers", corpo={"name": nome, "cpfCnpj": cpf_cnpj, **extras})

    def obter_ou_criar_cliente(self, nome: str, cpf_cnpj: str, **extras: Any) -> dict:
        return self.buscar_cliente_por_documento(cpf_cnpj) or self.criar_cliente(nome, cpf_cnpj, **extras)

    # ------------------------------------------------------------- cobranças
    def criar_cobranca(self, customer: str, billing_type: str, valor: float, vencimento: str, **extras: Any) -> dict:
        """billing_type: BOLETO, PIX, CREDIT_CARD ou UNDEFINED. vencimento: AAAA-MM-DD.
        Informe externalReference para poder conferir duplicidade antes de repetir após timeout."""
        corpo = {"customer": customer, "billingType": billing_type, "value": valor, "dueDate": vencimento, **extras}
        return self.requisicao("POST", "/payments", corpo=corpo)

    def buscar_cobrancas_por_referencia(self, external_reference: str) -> list[dict]:
        return list(self.paginar("/payments", externalReference=external_reference))

    def obter_cobranca(self, payment_id: str) -> dict:
        return self.requisicao("GET", f"/payments/{payment_id}")

    def status_cobranca(self, payment_id: str) -> str:
        return self.requisicao("GET", f"/payments/{payment_id}/status")["status"]

    def pix_qrcode(self, payment_id: str) -> dict:
        """Retorna encodedImage (PNG Base64), payload (copia-e-cola) e expirationDate."""
        return self.requisicao("GET", f"/payments/{payment_id}/pixQrCode")

    def linha_digitavel(self, payment_id: str) -> dict:
        """Retorna identificationField, nossoNumero e barCode."""
        return self.requisicao("GET", f"/payments/{payment_id}/identificationField")

    def excluir_cobranca(self, payment_id: str) -> dict:
        return self.requisicao("DELETE", f"/payments/{payment_id}")

    def estornar_cobranca(self, payment_id: str, valor: float | None = None, motivo: str | None = None) -> dict:
        corpo: dict[str, Any] = {}
        if valor is not None:
            corpo["value"] = valor
        if motivo:
            corpo["description"] = motivo
        return self.requisicao("POST", f"/payments/{payment_id}/refund", corpo=corpo)

    def listar_cobrancas(self, **filtros: Any) -> list[dict]:
        """Ex.: listar_cobrancas(status="RECEIVED", **{"paymentDate[ge]": "2026-09-01"})"""
        return list(self.paginar("/payments", **filtros))

    # ------------------------------------------------------------ assinaturas
    def criar_assinatura(self, customer: str, billing_type: str, valor: float, proximo_vencimento: str,
                         ciclo: str = "MONTHLY", **extras: Any) -> dict:
        corpo = {"customer": customer, "billingType": billing_type, "value": valor,
                 "nextDueDate": proximo_vencimento, "cycle": ciclo, **extras}
        return self.requisicao("POST", "/subscriptions", corpo=corpo)

    def atualizar_assinatura(self, subscription_id: str, **campos: Any) -> dict:
        return self.requisicao("PUT", f"/subscriptions/{subscription_id}", corpo=campos)

    def cancelar_assinatura(self, subscription_id: str) -> dict:
        return self.requisicao("DELETE", f"/subscriptions/{subscription_id}")

    def cobrancas_da_assinatura(self, subscription_id: str) -> list[dict]:
        return list(self.paginar(f"/subscriptions/{subscription_id}/payments"))

    # ------------------------------------------------------------ financeiro
    def saldo(self) -> float:
        return self.requisicao("GET", "/finance/balance")["balance"]

    def extrato(self, inicio: str, fim: str) -> list[dict]:
        return list(self.paginar("/financialTransactions", startDate=inicio, finishDate=fim))

    def transferir_pix(self, valor: float, chave: str, tipo_chave: str, descricao: str | None = None,
                       external_reference: str | None = None) -> dict:
        """Movimenta dinheiro. tipo_chave: CPF, CNPJ, EMAIL, PHONE ou EVP. Pode exigir autorização crítica
        (erro invalid_action) se a conta não tiver whitelist de IPs ou webhook de validação de saque."""
        corpo: dict[str, Any] = {"value": valor, "operationType": "PIX", "pixAddressKey": chave, "pixAddressKeyType": tipo_chave}
        if descricao:
            corpo["description"] = descricao
        if external_reference:
            corpo["externalReference"] = external_reference
        return self.requisicao("POST", "/transfers", corpo=corpo)

    def listar_transferencias(self, **filtros: Any) -> list[dict]:
        return list(self.paginar("/transfers", **filtros))

    # ---------------------------------------------------------- notas fiscais
    def listar_notas(self, **filtros: Any) -> list[dict]:
        return list(self.paginar("/invoices", **filtros))

    # --------------------------------------------------------------- webhooks
    def criar_webhook(self, nome: str, url: str, email: str, auth_token: str, eventos: list[str],
                      sequencial: bool = True) -> dict:
        corpo = {"name": nome, "url": url, "email": email, "enabled": True, "interrupted": False,
                 "apiVersion": 3, "authToken": auth_token, "events": eventos,
                 "sendType": "SEQUENTIALLY" if sequencial else "NON_SEQUENTIALLY"}
        return self.requisicao("POST", "/webhooks", corpo=corpo)

    def listar_webhooks(self) -> list[dict]:
        return list(self.paginar("/webhooks"))

    def reativar_webhook(self, webhook_id: str) -> dict:
        """Use só depois de corrigir o endpoint: reativa uma fila interrompida."""
        return self.requisicao("PUT", f"/webhooks/{webhook_id}", corpo={"interrupted": False})

    @staticmethod
    def webhook_autentico(headers: dict, token: str | None = None) -> bool:
        """Compara o header asaas-access-token com o token cadastrado (sem HMAC no Asaas)."""
        esperado = token or os.getenv("ASAAS_WEBHOOK_TOKEN", "").strip("'\"")
        recebido = {k.lower(): v for k, v in headers.items()}.get("asaas-access-token", "")
        return bool(esperado) and hmac.compare_digest(recebido, esperado)


if __name__ == "__main__":
    api = AsaasCliente()
    print(f"Ambiente: {api.ambiente} ({api.base_url})")
    if api.ambiente == "producao":
        raise SystemExit("O exemplo cria registros de teste; rode-o apenas com ASAAS_AMBIENTE=sandbox.")
    try:
        print("Saldo:", api.saldo())
        cliente = api.obter_ou_criar_cliente("Cliente Exemplo Ltda", "00000000000191",
                                             email="financeiro@example.com", notificationDisabled=True)
        ref = "KIT-EXEMPLO-001"
        existentes = api.buscar_cobrancas_por_referencia(ref)
        cobranca = existentes[0] if existentes else api.criar_cobranca(
            cliente["id"], "PIX", 10.0, time.strftime("%Y-%m-%d"), externalReference=ref, description="Teste do kit")
        qr = api.pix_qrcode(cobranca["id"])
        print("Cobrança:", cobranca["id"], cobranca["status"], "| Pix copia-e-cola:", qr["payload"][:30], "...")
        print("Cobranças no ambiente:", len(api.listar_cobrancas()))
    except AsaasErro as erro:
        print("Falha:", erro, "| códigos:", erro.codigos)
        raise SystemExit(1)
