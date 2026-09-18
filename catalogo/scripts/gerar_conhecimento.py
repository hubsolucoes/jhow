"""Gera o conhecimento do assistente do site a partir do catálogo.

Lê `sistemas/*/system.json` e `endpoints.json` e escreve `src/lib/conhecimento.json`
na raiz do projeto: um recorte enxuto, suficiente para o modelo responder com precisão
sem carregar o catálogo inteiro no prompt.

Uso (a partir da raiz do catálogo):
    .venv\\Scripts\\python scripts\\gerar_conhecimento.py
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ.parent / "src" / "lib" / "conhecimento.json"
LIMITE_DESCRICAO = 240


def curto(texto, limite=LIMITE_DESCRICAO):
    texto = " ".join(str(texto or "").split())
    return texto if len(texto) <= limite else texto[: limite - 1].rstrip() + "…"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    # --sistemas slug1,slug2 limita o conhecimento (útil para pilotos)
    filtro = None
    if "--sistemas" in sys.argv:
        filtro = set(sys.argv[sys.argv.index("--sistemas") + 1].split(","))
    sistemas, consultas, escritas, execucao = [], [], [], {}

    for pasta in sorted((RAIZ / "sistemas").iterdir()):
        arq_sistema, arq_endpoints = pasta / "system.json", pasta / "endpoints.json"
        if not (arq_sistema.is_file() and arq_endpoints.is_file()):
            continue
        s = json.loads(arq_sistema.read_text(encoding="utf-8"))
        if s.get("status") != "documentado" or (filtro and s["slug"] not in filtro):
            continue
        execucao[s["slug"]] = {"auth": s.get("execucao_auth"), "endpoints": {}}
        auth = s.get("execucao_auth") or {}
        sistemas.append({
            "slug": s["slug"],
            "nome": s["nome"],
            "categoria": s["categoria"],
            "descricao": curto(s.get("descricao_curta")),
            "estilo": (s.get("api") or {}).get("estilo"),
            "autenticacao": auth.get("tipo"),
            "credenciais": [c.get("nome") for c in auth.get("credenciais_necessarias") or []],
            "sandbox": bool((s.get("ambiente_testes") or {}).get("sandbox")),
            "indice_integrabilidade": (s.get("indice_integrabilidade") or {}).get("score"),
            "armadilhas": [curto(a, 160) for a in (s.get("esforco_integracao") or {}).get("principais_armadilhas", [])[:4]],
            "lacunas": [curto(l.get("descricao"), 160) for l in (s.get("lacunas") or [])[:4]],
        })

        doc = json.loads(arq_endpoints.read_text(encoding="utf-8"))
        for e in doc.get("endpoints", []):
            ex = e.get("execucao") or {}
            base = {
                "id": e["id"],
                "sistema": s["nome"],
                "slug": s["slug"],
                "entidade": e["entidade_canonica"],
                "acao": e["acao_canonica"],
                "metodo": e["metodo"],
                "path": e["path"],
                "descricao": curto(e.get("descricao")),
                "fonte": e.get("fonte_url"),
            }
            if ex.get("seguro_para_executar"):
                base["quando_usar"] = curto(e.get("quando_usar"), 180)
                base["filtros"] = [f.get("parametro") for f in (ex.get("filtros_recomendados") or [])][:8]
                base["colunas"] = [c.get("titulo") for c in (ex.get("colunas_sugeridas") or [])][:15]
                base["paginacao"] = (ex.get("paginacao") or {}).get("tipo")
                consultas.append(base)
                # receita completa para o executor do servidor
                execucao[s["slug"]]["endpoints"][e["id"]] = {
                    "metodo": e["metodo"], "path": e["path"],
                    "lista_em": ex.get("lista_em"), "campo_total": ex.get("campo_total"),
                    "paginacao": ex.get("paginacao"),
                    "filtros": ex.get("filtros_recomendados") or [],
                    "colunas": ex.get("colunas_sugeridas") or [],
                    "titulo": curto(e.get("nome_fornecedor") or e.get("descricao"), 80),
                }
            else:
                base["motivo_nao_executa"] = curto(ex.get("motivo_inseguro"), 160)
                escritas.append(base)

    conhecimento = {
        "gerado_em": __import__("datetime").date.today().isoformat(),
        "origem": "catalogo/ — documentado a partir das APIs oficiais",
        "sistemas": sistemas,
        "consultas": consultas,
        "escritas": escritas,
        "execucao": execucao,
    }
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(json.dumps(conhecimento, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tamanho = DESTINO.stat().st_size / 1024
    print(f"{DESTINO}: {len(sistemas)} sistemas, {len(consultas)} consultas, "
          f"{len(escritas)} operações de escrita — {tamanho:.0f} KB")
    if filtro:
        print("filtrado para:", ", ".join(sorted(filtro)))


if __name__ == "__main__":
    main()
