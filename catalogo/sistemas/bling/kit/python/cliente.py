"""Cliente Python para a API v3 do Bling (kit do catálogo).

Requisitos: Python 3.9+ e `pip install requests`.
Opcional (Windows, para gravar o token na planilha do kit): `pip install pywin32` e Excel instalado.

Configuração: copie `.env.example` para `.env` e preencha. Nada precisa ser editado neste arquivo.

Comandos:
    python cliente.py autorizar              # abre o fluxo OAuth e guarda os tokens (1ª vez)
    python cliente.py renovar                # renova o access_token com o refresh_token
    python cliente.py renovar --excel C:\\caminho\\Bling.xlsx   # renova e grava na tabela tbConfig
    python cliente.py token                  # imprime um access_token válido (renova se precisar)
    python cliente.py exemplo                # leituras de exemplo (empresa, pedidos, produtos, estoque)

Agende "renovar --excel" (Agendador de Tarefas / cron) a cada 1-2 horas para manter o Power Query funcionando.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import json
import os
import secrets
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import parse_qs, urlencode, urlparse

import requests

AQUI = Path(__file__).resolve().parent
URL_API = "https://api.bling.com.br/Api/v3"          # mesma URL para "sandbox" (conta de teste) e produção
URL_AUTORIZAR = "https://www.bling.com.br/Api/v3/oauth/authorize"
URL_TOKEN = URL_API + "/oauth/token"
URL_REVOGAR = "https://api.bling.com.br/oauth/revoke"
INTERVALO_MINIMO = 0.35                               # limite do Bling: 3 requisições/s por conta


def carregar_env(caminho: Path = AQUI / ".env") -> dict[str, str]:
    """Lê um .env simples (CHAVE=valor). Variáveis de ambiente do sistema têm prioridade."""
    valores: dict[str, str] = {}
    if caminho.exists():
        for linha in caminho.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            chave, valor = linha.split("=", 1)
            valores[chave.strip()] = valor.strip().strip('"').strip("'")
    for chave in list(valores) + [k for k in os.environ if k.startswith("BLING_")]:
        if chave in os.environ:
            valores[chave] = os.environ[chave]
    return valores


class BlingErro(Exception):
    def __init__(self, status: int, corpo: Any):
        erro = corpo.get("error", {}) if isinstance(corpo, dict) else {}
        self.status = status
        self.tipo = erro.get("type")
        self.descricao = erro.get("description") or erro.get("message") or str(corpo)[:300]
        self.campos = erro.get("fields") or []
        self.periodo = erro.get("period")
        detalhes = "; ".join(f"{c.get('element')}: {c.get('msg')}" for c in self.campos if isinstance(c, dict))
        super().__init__(f"Bling HTTP {status} {self.tipo}: {self.descricao}" + (f" [{detalhes}]" if detalhes else ""))


class BlingCliente:
    def __init__(self, env: dict[str, str] | None = None):
        env = env or carregar_env()
        self.ambiente = env.get("BLING_AMBIENTE", "sandbox").lower()
        if self.ambiente not in ("sandbox", "producao"):
            raise ValueError("BLING_AMBIENTE deve ser 'sandbox' ou 'producao'")
        self.client_id = env.get("BLING_CLIENT_ID", "")
        self.client_secret = env.get("BLING_CLIENT_SECRET", "")
        if not self.client_id or not self.client_secret or self.client_id.startswith("<<"):
            raise ValueError("Preencha BLING_CLIENT_ID e BLING_CLIENT_SECRET no arquivo .env")
        arquivo = env.get("BLING_TOKENS_ARQUIVO") or f"bling_tokens_{self.ambiente}.json"
        self.arquivo_tokens = Path(arquivo) if Path(arquivo).is_absolute() else AQUI / arquivo
        self.planilha = env.get("BLING_EXCEL_PLANILHA") or None
        self.timeout = int(env.get("BLING_TIMEOUT") or 60)
        self._ultima = 0.0
        self.sessao = requests.Session()

    # ------------------------------------------------------------------ OAuth
    def link_autorizacao(self) -> tuple[str, str]:
        state = secrets.token_urlsafe(24)
        url = URL_AUTORIZAR + "?" + urlencode({"response_type": "code", "client_id": self.client_id, "state": state})
        return url, state

    def _post_token(self, dados: dict[str, str]) -> dict[str, Any]:
        r = self.sessao.post(URL_TOKEN, data=dados, auth=(self.client_id, self.client_secret),
                             headers={"Accept": "1.0", "enable-jwt": "1"}, timeout=self.timeout)
        corpo = r.json() if r.content else {}
        if r.status_code >= 400:
            raise BlingErro(r.status_code, corpo)
        corpo["expira_em"] = time.time() + int(corpo.get("expires_in", 0)) - 120
        corpo["ambiente"] = self.ambiente
        self.arquivo_tokens.write_text(json.dumps(corpo, indent=2), encoding="utf-8")
        try:
            os.chmod(self.arquivo_tokens, 0o600)
        except OSError:
            pass
        return corpo

    def trocar_code(self, code: str) -> dict[str, Any]:
        """Troca o authorization code (vale 1 minuto e só pode ser usado UMA vez)."""
        return self._post_token({"grant_type": "authorization_code", "code": code})

    def _tokens(self) -> dict[str, Any]:
        if not self.arquivo_tokens.exists():
            raise RuntimeError(f"Tokens não encontrados em {self.arquivo_tokens}. Rode: python cliente.py autorizar")
        return json.loads(self.arquivo_tokens.read_text(encoding="utf-8"))

    def renovar(self) -> dict[str, Any]:
        """Renova com o refresh_token (validade de 30 dias) e grava o novo par de tokens."""
        return self._post_token({"grant_type": "refresh_token", "refresh_token": self._tokens()["refresh_token"]})

    def access_token(self) -> str:
        tokens = self._tokens()
        if time.time() >= tokens.get("expira_em", 0):
            tokens = self.renovar()
        return tokens["access_token"]

    def revogar(self, acao: str | None = None, alvo: str | None = None) -> None:
        """Revoga o refresh_token guardado (acao: logout|uninstall; alvo: user|company)."""
        dados = {"token": self._tokens()["refresh_token"], "token_type_hint": "refresh_token"}
        if acao:
            dados["revoke_action"] = acao
        if alvo:
            dados["revoke_target"] = alvo
        r = self.sessao.post(URL_REVOGAR, data=dados, auth=(self.client_id, self.client_secret), timeout=self.timeout)
        if r.status_code >= 400:
            raise BlingErro(r.status_code, r.json() if r.content else {})

    # ------------------------------------------------------------------ HTTP
    def requisicao(self, metodo: str, caminho: str, params: dict | None = None, json_corpo: Any = None) -> Any:
        metodo = metodo.upper()
        renovado = False
        for tentativa in range(6):
            espera = INTERVALO_MINIMO - (time.time() - self._ultima)
            if espera > 0:
                time.sleep(espera)
            self._ultima = time.time()
            headers = {"Authorization": f"Bearer {self.access_token()}", "Accept": "application/json", "enable-jwt": "1"}
            try:
                r = self.sessao.request(metodo, URL_API + caminho, params=params, json=json_corpo,
                                        headers=headers, timeout=self.timeout)
            except requests.ConnectionError:
                if metodo == "GET" and tentativa < 5:
                    time.sleep(2 ** tentativa)
                    continue
                raise  # escrita: não repetir às cegas (a API não tem idempotência)
            corpo = r.json() if r.content and "json" in r.headers.get("Content-Type", "json") else (r.text or None)
            if r.status_code == 401 and not renovado:
                self.renovar()
                renovado = True
                continue
            if r.status_code == 429:
                erro = BlingErro(429, corpo)
                if erro.periodo == "day":
                    raise erro  # cota diária de 120 mil esgotada
                time.sleep(min(2 ** tentativa, 30))
                continue
            if r.status_code >= 500 and metodo == "GET" and tentativa < 5:
                time.sleep(2 ** tentativa)
                continue
            if r.status_code >= 400:
                raise BlingErro(r.status_code, corpo)
            return corpo
        raise RuntimeError(f"Bling: tentativas esgotadas em {metodo} {caminho}")

    def listar(self, caminho: str, filtros: dict | None = None, limite: int = 100) -> Iterator[dict]:
        """Percorre pagina=1,2,... até vir uma página com menos de `limite` itens."""
        pagina = 1
        while True:
            corpo = self.requisicao("GET", caminho, params={**(filtros or {}), "pagina": pagina, "limite": limite})
            dados = (corpo or {}).get("data", [])
            yield from dados
            if len(dados) < limite:
                return
            pagina += 1

    def _confirmar_escrita(self, descricao: str) -> None:
        if self.ambiente == "producao" and os.environ.get("BLING_CONFIRMAR", "1") != "0":
            resposta = input(f"[PRODUÇÃO] {descricao}. Confirmar? (s/N) ").strip().lower()
            if resposta != "s":
                raise RuntimeError("Operação cancelada pelo usuário")

    # ------------------------------------------------------------------ leituras
    def empresa(self) -> dict:
        return self.requisicao("GET", "/empresas/me/dados-basicos")["data"]

    def pedidos_venda(self, data_inicial: str | None = None, data_final: str | None = None, **filtros) -> list[dict]:
        f = {k: v for k, v in {"dataInicial": data_inicial, "dataFinal": data_final, **filtros}.items() if v}
        return list(self.listar("/pedidos/vendas", f))

    def pedido_venda(self, id_pedido: int) -> dict:
        return self.requisicao("GET", f"/pedidos/vendas/{id_pedido}")["data"]

    def produtos(self, criterio: int = 5, **filtros) -> list[dict]:
        return list(self.listar("/produtos", {"criterio": criterio, **filtros}))

    def saldos_estoque(self, ids_produtos: list[int], lote: int = 50) -> list[dict]:
        saida: list[dict] = []
        for i in range(0, len(ids_produtos), lote):
            corpo = self.requisicao("GET", "/estoques/saldos", params={"idsProdutos[]": ids_produtos[i:i + lote]})
            saida.extend(corpo.get("data", []))
        return saida

    def contatos(self, **filtros) -> list[dict]:
        return list(self.listar("/contatos", {"criterio": 1, **filtros}))

    def contas_receber(self, data_inicial: str | None = None, data_final: str | None = None,
                       tipo_filtro_data: str = "V", situacoes: list[int] | None = None) -> list[dict]:
        f: dict[str, Any] = {"tipoFiltroData": tipo_filtro_data}
        if data_inicial:
            f["dataInicial"] = data_inicial
        if data_final:
            f["dataFinal"] = data_final
        if situacoes:
            f["situacoes[]"] = situacoes
        return list(self.listar("/contas/receber", f))

    def contas_pagar(self, vencimento_inicial: str | None = None, vencimento_final: str | None = None,
                     situacao: int | None = None) -> list[dict]:
        f = {k: v for k, v in {"dataVencimentoInicial": vencimento_inicial, "dataVencimentoFinal": vencimento_final,
                               "situacao": situacao}.items() if v}
        return list(self.listar("/contas/pagar", f))

    def notas_fiscais(self, data_inicial: str | None = None, data_final: str | None = None, **filtros) -> list[dict]:
        f = {k: v for k, v in {"dataEmissaoInicial": data_inicial, "dataEmissaoFinal": data_final, **filtros}.items() if v}
        return list(self.listar("/nfe", f))

    def nota_fiscal(self, id_nota: int) -> dict:
        return self.requisicao("GET", f"/nfe/{id_nota}")["data"]

    def baixar_documento_nfe(self, chave: str, formato: str = "xml", pasta: Path = AQUI) -> list[Path]:
        """Baixa XML (formato=xml) ou DANFE (formato=pdf); o conteúdo vem em GZIP + base64."""
        corpo = self.requisicao("GET", f"/nfe/documento/{chave}", params={"formato": formato})
        arquivos = []
        for doc in corpo.get("data", []):
            destino = Path(pasta) / (doc.get("nome") or f"{chave}.{formato}")
            destino.write_bytes(gzip.decompress(base64.b64decode(doc["conteudo"])))
            arquivos.append(destino)
        return arquivos

    def categorias_financeiras(self) -> list[dict]:
        return list(self.listar("/categorias/receitas-despesas", {"tipo": 0, "situacao": 0}))

    def formas_pagamento(self) -> list[dict]:
        return list(self.listar("/formas-pagamentos", {"situacao": 1}))

    # ------------------------------------------------------------------ escritas (sem idempotência na API)
    def buscar_contato_por_documento(self, documento: str) -> dict | None:
        dados = self.requisicao("GET", "/contatos", params={"numeroDocumento": documento, "criterio": 1}).get("data", [])
        return dados[0] if dados else None

    def criar_contato(self, dados: dict) -> int:
        existente = self.buscar_contato_por_documento(dados.get("numeroDocumento", ""))
        if existente:
            return existente["id"]
        self._confirmar_escrita(f"Criar contato {dados.get('nome')}")
        return self.requisicao("POST", "/contatos", json_corpo=dados)["data"]["id"]

    def buscar_pedido_por_numero_loja(self, numero_loja: str) -> dict | None:
        dados = self.requisicao("GET", "/pedidos/vendas", params={"numerosLojas[]": [numero_loja]}).get("data", [])
        return dados[0] if dados else None

    def criar_pedido_venda(self, dados: dict) -> int:
        """Cria o pedido; se `numeroLoja` já existir, devolve o id existente em vez de duplicar."""
        if dados.get("numeroLoja"):
            existente = self.buscar_pedido_por_numero_loja(dados["numeroLoja"])
            if existente:
                return existente["id"]
        self._confirmar_escrita(f"Criar pedido de venda {dados.get('numeroLoja', '')}")
        return self.requisicao("POST", "/pedidos/vendas", json_corpo=dados)["data"]["id"]

    def alterar_situacao_pedido(self, id_pedido: int, id_situacao: int) -> None:
        self._confirmar_escrita(f"Mudar situação do pedido {id_pedido} para {id_situacao}")
        self.requisicao("PATCH", f"/pedidos/vendas/{id_pedido}/situacoes/{id_situacao}")

    def gerar_e_enviar_nfe(self, id_pedido: int, enviar_email: bool = False) -> dict:
        """Gera a NF-e a partir do pedido e transmite à SEFAZ. Devolve a nota (confira `situacao`: 5 = autorizada)."""
        self._confirmar_escrita(f"Gerar e ENVIAR À SEFAZ a NF-e do pedido {id_pedido}")
        id_nota = self.requisicao("POST", f"/pedidos/vendas/{id_pedido}/gerar-nfe")["idNotaFiscal"]
        self.requisicao("POST", f"/nfe/{id_nota}/enviar", params={"enviarEmail": str(enviar_email).lower()})
        return self.nota_fiscal(id_nota)

    def baixar_conta_receber(self, id_conta: int, dados: dict) -> dict:
        """Registra o recebimento. Confira o saldo antes: repetir gera baixa em duplicidade."""
        self._confirmar_escrita(f"Baixar conta a receber {id_conta}")
        return self.requisicao("POST", f"/contas/receber/{id_conta}/baixar", json_corpo=dados)

    def criar_conta_pagar(self, dados: dict) -> Any:
        self._confirmar_escrita(f"Criar conta a pagar {dados.get('numeroDocumento', '')}")
        return self.requisicao("POST", "/contas/pagar", json_corpo=dados)

    def lancar_estoque(self, id_produto: int, id_deposito: int, operacao: str, quantidade: float,
                       observacoes: str = "") -> int:
        """operacao: B (balanço), E (entrada) ou S (saída)."""
        self._confirmar_escrita(f"Lançar estoque {operacao} {quantidade} do produto {id_produto}")
        corpo = {"produto": {"id": id_produto}, "deposito": {"id": id_deposito}, "operacao": operacao,
                 "quantidade": quantidade, "observacoes": observacoes}
        return self.requisicao("POST", "/estoques", json_corpo=corpo)["data"]["id"]

    # ------------------------------------------------------------------ Excel (Power Query)
    def gravar_token_excel(self, planilha: str) -> None:
        """Grava AccessToken e TokenAtualizadoEm na tabela tbConfig da planilha do kit (Windows + Excel + pywin32)."""
        try:
            import win32com.client  # type: ignore
        except ImportError as exc:
            raise RuntimeError("Instale pywin32 (pip install pywin32) para gravar na planilha") from exc
        caminho = str(Path(planilha).resolve())
        token = self.access_token()
        excel = win32com.client.DispatchEx("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False
        try:
            wb = excel.Workbooks.Open(caminho)
            tabela = wb.Worksheets("Config").ListObjects("tbConfig")
            valores = {"AccessToken": token, "TokenAtualizadoEm": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
            for linha in tabela.ListRows:
                chave = linha.Range.Cells(1, 1).Value
                if chave in valores:
                    linha.Range.Cells(1, 2).NumberFormat = "@"
                    linha.Range.Cells(1, 2).Value = valores[chave]
            wb.Save()
            wb.Close(False)
        finally:
            excel.Quit()


def _ler_code(texto: str) -> str:
    texto = texto.strip()
    if texto.startswith("http"):
        q = parse_qs(urlparse(texto).query)
        if "error" in q:
            raise RuntimeError(f"Autorização negada: {q['error'][0]} {q.get('error_description', [''])[0]}")
        return q["code"][0]
    return texto


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Cliente do kit Bling")
    sub = ap.add_subparsers(dest="comando", required=True)
    a = sub.add_parser("autorizar", help="primeira autorização (gera e troca o code)")
    a.add_argument("--excel", help="planilha do kit para gravar o AccessToken")
    r = sub.add_parser("renovar", help="renova o access_token")
    r.add_argument("--excel", help="planilha do kit para gravar o AccessToken")
    sub.add_parser("token", help="imprime um access_token válido")
    sub.add_parser("exemplo", help="executa leituras de exemplo")
    args = ap.parse_args()

    cli = BlingCliente()
    if args.comando == "autorizar":
        url, state = cli.link_autorizacao()
        print("1) Abra no navegador, entre na conta Bling e autorize:\n  ", url)
        print(f"2) Confira que a URL de retorno tem state={state}")
        retorno = input("3) Cole aqui a URL completa de retorno (ou só o code) em até 1 minuto: ")
        if retorno.startswith("http") and parse_qs(urlparse(retorno).query).get("state", [None])[0] != state:
            raise RuntimeError("state diferente do enviado: descarte esta resposta")
        cli.trocar_code(_ler_code(retorno))
        print(f"Tokens gravados em {cli.arquivo_tokens} (ambiente: {cli.ambiente})")
        planilha = args.excel or cli.planilha
        if planilha:
            cli.gravar_token_excel(planilha)
            print("AccessToken gravado na planilha", planilha)
    elif args.comando == "renovar":
        cli.renovar()
        print(f"Token renovado ({cli.ambiente}) em {datetime.now():%Y-%m-%d %H:%M:%S}")
        planilha = args.excel or cli.planilha
        if planilha:
            cli.gravar_token_excel(planilha)
            print("AccessToken gravado na planilha", planilha)
    elif args.comando == "token":
        print(cli.access_token())
    elif args.comando == "exemplo":
        print("Empresa:", cli.empresa().get("nome"))
        hoje = datetime.now()
        pedidos = cli.pedidos_venda(f"{hoje:%Y-%m}-01", f"{hoje:%Y-%m-%d}")
        print("Pedidos no mês:", len(pedidos), "| total:", round(sum(p.get("total") or 0 for p in pedidos), 2))
        produtos = cli.produtos(criterio=2)
        print("Produtos ativos:", len(produtos))
        ids = [p["id"] for p in produtos if p.get("tipo") == "P"][:50]
        if ids:
            zerados = [s for s in cli.saldos_estoque(ids) if (s.get("saldoVirtualTotal") or 0) <= 0]
            print("Produtos sem saldo (amostra de 50):", len(zerados))
        abertas = cli.contas_receber(f"{hoje:%Y-%m}-01", f"{hoje:%Y-%m-%d}", situacoes=[1])
        print("Contas a receber em aberto vencidas no mês:", len(abertas))


if __name__ == "__main__":
    try:
        main()
    except (BlingErro, RuntimeError, ValueError) as erro:
        print("ERRO:", erro, file=sys.stderr)
        sys.exit(1)
