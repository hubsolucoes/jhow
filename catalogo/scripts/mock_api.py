"""Servidor de teste do executor: paginação offset/limit com envelope data + hasMore."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

TOTAL = 23


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        url = urlparse(self.path)
        q = parse_qs(url.query)
        if url.path == "/v2/nfes_recebidas":
            return self.recebidas(q)
        if self.headers.get("access_token") != "chave-de-teste":
            self.responder(401, {"errors": [{"code": "invalid_token", "description": "credencial invalida"}]})
            return
        offset = int(q.get("offset", ["0"])[0])
        limit = int(q.get("limit", ["10"])[0])
        itens = [{"id": f"pay_{i:03d}", "customer": {"name": f"Cliente {i}"}, "value": 100 + i,
                  "status": q.get("status", ["RECEIVED"])[0]}
                 for i in range(offset, min(offset + limit, TOTAL))]
        self.responder(200, {"data": itens, "hasMore": offset + limit < TOTAL, "totalCount": TOTAL})

    def recebidas(self, q):
        """Array na raiz, paginacao por 'versao' (exclusiva), pagina de 10."""
        import base64
        cab = self.headers.get("Authorization", "")
        esperado = "Basic " + base64.b64encode(b"token-de-teste:").decode()
        if cab != esperado:
            self.responder(401, {"codigo": "permissao_negada", "mensagem": "token invalido"})
            return
        desde = int(q.get("versao", ["0"])[0])
        itens = [{"versao": v, "chave_nfe": f"3526{v:040d}", "valor_total": 10 * v}
                 for v in range(desde + 1, min(desde + 11, 26))]
        self.responder(200, itens)

    def responder(self, status, corpo):
        dados = json.dumps(corpo).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8799), Handler).serve_forever()
