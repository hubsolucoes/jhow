"""Cliente Focus NFe (API v2) — kit do catálogo.

Uso:
    pip install requests
    cp .env.example .env   # preencha FOCUS_AMBIENTE, FOCUS_TOKEN e FOCUS_CNPJ
    python cliente.py                  # só leituras (seguro)
    python cliente.py --emitir-teste   # emite uma NF-e de TESTE (pede confirmação; recusa em produção)

Documentação: https://doc.focusnfe.com.br/reference/introducao
"""
import os
import sys
import time
from pathlib import Path

import requests

BASES = {
    "sandbox": "https://homologacao.focusnfe.com.br",
    "producao": "https://api.focusnfe.com.br",
}


def carregar_env(caminho=Path(__file__).with_name(".env")):
    """Lê um .env simples (CHAVE=valor) sem dependências extras."""
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip())


class ErroFocus(Exception):
    def __init__(self, status, corpo):
        self.status, self.corpo = status, corpo
        super().__init__(f"Focus NFe HTTP {status}: {corpo}")


class FocusNFe:
    def __init__(self, token=None, ambiente=None, timeout=60):
        carregar_env()
        self.ambiente = (ambiente or os.environ.get("FOCUS_AMBIENTE", "sandbox")).strip()
        if self.ambiente not in BASES:
            raise ValueError("FOCUS_AMBIENTE deve ser 'sandbox' ou 'producao'")
        self.base = BASES[self.ambiente]
        self.token = token or os.environ.get("FOCUS_TOKEN", "")
        if not self.token or self.token.startswith("<<"):
            raise ValueError("Preencha FOCUS_TOKEN no arquivo .env")
        self.timeout = timeout
        self.sessao = requests.Session()
        self.sessao.auth = (self.token, "")  # HTTP Basic: token como usuário, senha vazia

    # ---------------------------------------------------------------- núcleo
    def chamar(self, metodo, caminho, *, params=None, json=None, aceitos=(200,), tentativas=4):
        """Faz a chamada com retry em 429 (Rate-Limit-Reset) e em 5xx/erros de rede."""
        for tentativa in range(tentativas):
            try:
                r = self.sessao.request(metodo, self.base + caminho, params=params, json=json, timeout=self.timeout)
            except requests.RequestException:
                if tentativa == tentativas - 1:
                    raise
                time.sleep(2 ** tentativa)
                continue
            if r.status_code == 429 and tentativa < tentativas - 1:
                time.sleep(int(r.headers.get("Rate-Limit-Reset") or r.headers.get("Retry-After") or 60))
                continue
            if r.status_code >= 500 and tentativa < tentativas - 1:
                time.sleep(2 ** tentativa)
                continue
            if r.status_code not in aceitos:
                corpo = r.json() if "json" in r.headers.get("Content-Type", "") else r.text
                raise ErroFocus(r.status_code, corpo)
            return r
        raise ErroFocus(r.status_code, r.text)

    def _confirmar(self, acao, confirmar):
        if confirmar:
            return
        resp = input(f"[{self.ambiente.upper()} - {self.base}] Confirma {acao}? Digite SIM: ")
        if resp.strip().upper() != "SIM":
            raise RuntimeError("Operação cancelada pelo usuário")

    # ---------------------------------------------------------------- paginação
    def listar_offset(self, caminho, filtros=None):
        """Tabelas auxiliares e empresas: até 50 itens por chamada, total em X-Total-Count."""
        itens, offset = [], 0
        while True:
            r = self.chamar("GET", caminho, params={**(filtros or {}), "offset": offset})
            pagina = r.json()
            if not pagina:
                return itens
            itens.extend(pagina)
            offset += len(pagina)
            total = int(r.headers.get("X-Total-Count", "0") or 0)
            if total and offset >= total:
                return itens

    def listar_versao(self, caminho, filtros, versao=0):
        """Documentos recebidos: versao > X, até 100 por chamada; próximo X em X-Max-Version.
        Retorna (documentos, ultima_versao) — guarde a última versão por CNPJ."""
        docs = []
        while True:
            r = self.chamar("GET", caminho, params={**filtros, "versao": versao})
            pagina = r.json()
            if not pagina:
                return docs, versao
            docs.extend(pagina)
            maxv = r.headers.get("X-Max-Version") or max(int(d.get("versao") or 0) for d in pagina)
            if not maxv or int(maxv) <= versao:
                return docs, versao
            versao = int(maxv)

    # ---------------------------------------------------------------- NF-e
    def emitir_nfe(self, ref, nota, confirmar=False, aguardar=True):
        """POST /v2/nfe?ref=... e, se aguardar, polling até sair de processando_autorizacao."""
        self._confirmar(f"a EMISSÃO da NF-e ref={ref}", confirmar)
        r = self.chamar("POST", "/v2/nfe", params={"ref": ref}, json=nota, aceitos=(201, 202))
        resultado = r.json()
        return self.aguardar("nfe", ref, resultado) if aguardar else resultado

    def aguardar(self, documento, ref, resultado=None, tentativas=10):
        """Consulta GET /v2/<documento>/{ref} com espera crescente (2 s a 60 s)."""
        espera = 2
        resultado = resultado or {"status": "processando_autorizacao"}
        for _ in range(tentativas):
            if resultado.get("status") != "processando_autorizacao":
                break
            time.sleep(espera)
            espera = min(espera * 2, 60)
            resultado = self.chamar("GET", f"/v2/{documento}/{ref}").json()
        return resultado

    def consultar_nfe(self, ref, completa=False):
        return self.chamar("GET", f"/v2/nfe/{ref}", params={"completa": 1 if completa else 0}).json()

    def cancelar_nfe(self, ref, justificativa, confirmar=False):
        if not 15 <= len(justificativa) <= 255:
            raise ValueError("A justificativa deve ter entre 15 e 255 caracteres")
        self._confirmar(f"o CANCELAMENTO (irreversível) da NF-e ref={ref}", confirmar)
        return self.chamar("DELETE", f"/v2/nfe/{ref}", json={"justificativa": justificativa}).json()

    def carta_correcao_nfe(self, ref, correcao, confirmar=False):
        self._confirmar(f"a CARTA DE CORREÇÃO da NF-e ref={ref}", confirmar)
        return self.chamar("POST", f"/v2/nfe/{ref}/carta_correcao", json={"correcao": correcao}).json()

    def inutilizar_nfe(self, cnpj, serie, numero_inicial, numero_final, justificativa, confirmar=False):
        self._confirmar(f"a INUTILIZAÇÃO (irreversível) dos números {numero_inicial}-{numero_final} série {serie}", confirmar)
        corpo = {"cnpj": cnpj, "serie": str(serie), "numero_inicial": str(numero_inicial),
                 "numero_final": str(numero_final), "justificativa": justificativa}
        return self.chamar("POST", "/v2/nfe/inutilizacao", json=corpo).json()

    def baixar_arquivo(self, caminho_relativo, destino):
        """Baixa XML/DANFE a partir de caminho_xml_nota_fiscal, caminho_danfe etc."""
        r = self.chamar("GET", caminho_relativo)
        Path(destino).write_bytes(r.content)
        return destino

    # ---------------------------------------------------------------- NFC-e (síncrona)
    def emitir_nfce(self, ref, nota, confirmar=False):
        self._confirmar(f"a EMISSÃO da NFC-e ref={ref}", confirmar)
        return self.chamar("POST", "/v2/nfce", params={"ref": ref}, json=nota, aceitos=(201,)).json()

    # ---------------------------------------------------------------- NFS-e
    def emitir_nfse(self, ref, nota, confirmar=False, nacional=False, aguardar=True):
        doc = "nfsen" if nacional else "nfse"
        self._confirmar(f"a EMISSÃO da {doc.upper()} ref={ref}", confirmar)
        r = self.chamar("POST", f"/v2/{doc}", params={"ref": ref}, json=nota, aceitos=(201, 202))
        return self.aguardar(doc, ref, r.json()) if aguardar else r.json()

    # ---------------------------------------------------------------- recebidas e auxiliares
    def nfes_recebidas(self, cnpj, versao=0):
        return self.listar_versao("/v2/nfes_recebidas", {"cnpj": cnpj}, versao)

    def manifestar(self, chave, tipo, justificativa=None, confirmar=False):
        self._confirmar(f"a MANIFESTAÇÃO '{tipo}' da NF-e {chave}", confirmar)
        corpo = {"tipo": tipo, **({"justificativa": justificativa} if justificativa else {})}
        return self.chamar("POST", f"/v2/nfes_recebidas/{chave}/manifesto", json=corpo).json()

    def cadastrar_webhook(self, cnpj, evento, url, segredo=None, cabecalho=None, confirmar=False):
        self._confirmar(f"o cadastro do webhook '{evento}' para {url}", confirmar)
        corpo = {"cnpj": cnpj, "event": evento, "url": url}
        if segredo:
            corpo.update({"authorization": segredo, "authorization_header": cabecalho or "Authorization"})
        return self.chamar("POST", "/v2/hooks", json=corpo).json()

    def cep(self, cep):
        return self.chamar("GET", f"/v2/ceps/{cep}").json()

    def ncm(self, codigo):
        return self.chamar("GET", f"/v2/ncms/{codigo}").json()

    def municipio(self, codigo_ibge):
        return self.chamar("GET", f"/v2/municipios/{codigo_ibge}").json()


NOTA_TESTE = {
    "natureza_operacao": "Venda de mercadoria",
    "data_emissao": time.strftime("%Y-%m-%dT%H:%M:%S-03:00"),
    "tipo_documento": 1, "finalidade_emissao": 1, "local_destino": 1,
    "consumidor_final": 1, "presenca_comprador": 2,
    # texto que a SEFAZ costuma exigir no destinatário em homologação
    "nome_destinatario": "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
    "cpf_destinatario": "00000000000", "indicador_inscricao_estadual_destinatario": 9,
    "logradouro_destinatario": "Rua Exemplo", "numero_destinatario": "100", "bairro_destinatario": "Centro",
    "municipio_destinatario": "São Paulo", "uf_destinatario": "SP", "cep_destinatario": "01001000",
    "modalidade_frete": 9, "valor_produtos": 10.0, "valor_total": 10.0,
    "items": [{
        "numero_item": 1, "codigo_produto": "TESTE-1", "descricao": "Produto de teste", "cfop": "5102",
        "codigo_ncm": "61091000", "unidade_comercial": "UN", "quantidade_comercial": 1,
        "valor_unitario_comercial": 10.0, "unidade_tributavel": "UN", "quantidade_tributavel": 1,
        "valor_unitario_tributavel": 10.0, "valor_bruto": 10.0, "icms_origem": 0,
        "icms_situacao_tributaria": "102", "pis_situacao_tributaria": "07", "cofins_situacao_tributaria": "07",
    }],
    "formas_pagamento": [{"forma_pagamento": "01", "valor_pagamento": 10.0}],
}


if __name__ == "__main__":
    api = FocusNFe()
    cnpj = os.environ.get("FOCUS_CNPJ", "")
    print(f"Ambiente: {api.ambiente} ({api.base})")

    # Leituras (seguras)
    print("CEP 01001000:", api.cep("01001000"))
    if cnpj and not cnpj.startswith("<<"):
        docs, versao = api.nfes_recebidas(cnpj)
        print(f"{len(docs)} NF-e recebidas; guarde a versão {versao} para a próxima carga")

    # Escrita de teste (somente sandbox e com confirmação)
    if "--emitir-teste" in sys.argv:
        if api.ambiente != "sandbox":
            sys.exit("A emissão de teste só roda com FOCUS_AMBIENTE=sandbox")
        nota = dict(NOTA_TESTE, cnpj_emitente=cnpj)
        ref = "teste" + time.strftime("%Y%m%d%H%M%S")
        try:
            resultado = api.emitir_nfe(ref, nota)
            print("Resultado:", resultado.get("status"), resultado.get("mensagem_sefaz"), resultado.get("erros"))
            if resultado.get("status") == "autorizado":
                arq = api.baixar_arquivo(resultado["caminho_xml_nota_fiscal"], f"{ref}.xml")
                print("XML salvo em", arq)
        except ErroFocus as e:
            print("Erro da API:", e.status, e.corpo)
