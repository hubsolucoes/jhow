"""Gera relatorios/indice-sistemas.md: visão única de todos os sistemas documentados.

Uso (a partir da raiz do catálogo):
    .venv\\Scripts\\python scripts\\gerar_indice.py
"""
import json
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

NOMES_CATEGORIA = {
    "erp_nacional": "ERP",
    "pagamentos_psp": "Pagamentos",
    "pagamentos_padrao": "Pagamentos (padrão)",
    "fiscal_gateway": "Fiscal (emissor)",
    "fiscal_governo": "Fiscal (governo)",
}


def curto(texto, limite=150):
    texto = " ".join(str(texto or "").split())
    return texto if len(texto) <= limite else texto[: limite - 1].rstrip() + "…"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    manifesto = json.loads((RAIZ / "manifest.json").read_text(encoding="utf-8"))
    resumo = {s["slug"]: s for s in manifesto["sistemas"]}

    linhas_tabela, detalhes = [], []
    totais = {"det": 0, "cat": 0, "exec": 0, "faq": 0}

    for pasta in sorted((RAIZ / "sistemas").iterdir()):
        arq = pasta / "system.json"
        if not arq.is_file():
            continue
        s = json.loads(arq.read_text(encoding="utf-8"))
        eps = json.loads((pasta / "endpoints.json").read_text(encoding="utf-8"))
        detalhados = eps.get("endpoints", [])
        catalogados = eps.get("endpoints_secundarios", [])
        executaveis = sum(1 for e in detalhados if (e.get("execucao") or {}).get("seguro_para_executar"))
        faq = sum(1 for l in (pasta / "faq.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()) \
            if (pasta / "faq.jsonl").is_file() else 0
        indice = (s.get("indice_integrabilidade") or {}).get("score")
        auth = (s.get("execucao_auth") or {}).get("tipo", "—")
        categoria = NOMES_CATEGORIA.get(s.get("categoria"), s.get("categoria"))
        concluido = resumo.get(s["slug"], {}).get("concluido_em", "—")

        totais["det"] += len(detalhados)
        totais["cat"] += len(catalogados)
        totais["exec"] += executaveis
        totais["faq"] += faq

        linhas_tabela.append(
            f"| [{s['nome']}](../sistemas/{s['slug']}/ficha.md) | {categoria} | {indice} | "
            f"{len(detalhados)} + {len(catalogados)} | {executaveis} | `{auth}` | {concluido} |"
        )

        base = (s.get("api") or {}).get("base_urls") or {}
        lacunas = [curto(l.get("descricao")) for l in (s.get("lacunas") or []) if l.get("impacto") == "alto"][:3]
        if not lacunas:
            lacunas = [curto(l.get("descricao")) for l in (s.get("lacunas") or [])[:2]]
        armadilhas = [curto(a) for a in (s.get("esforco_integracao") or {}).get("principais_armadilhas", [])[:3]]

        bloco = [
            f"### {s['nome']}",
            "",
            f"{curto(s.get('descricao_curta'), 300)}",
            "",
            f"- **Pasta:** `catalogo/sistemas/{s['slug']}/` — ficha humana em `ficha.md`",
            f"- **API:** {(s.get('api') or {}).get('estilo', '—')} · produção `{base.get('producao') or '—'}` · sandbox `{base.get('sandbox') or 'não há'}`",
            f"- **Autenticação para o executor:** `{auth}`",
            f"- **Índice de integrabilidade:** {indice}",
            f"- **Endpoints:** {len(detalhados)} detalhados, {len(catalogados)} catalogados, {executaveis} executáveis, {faq} perguntas de FAQ",
        ]
        if armadilhas:
            bloco += ["- **Armadilhas:**"] + [f"  - {a}" for a in armadilhas]
        if lacunas:
            bloco += ["- **Lacunas principais:**"] + [f"  - {l}" for l in lacunas]
        detalhes.append("\n".join(bloco))

    saida = [
        "# Índice dos sistemas documentados",
        "",
        f"Gerado em {date.today().isoformat()} por `scripts/gerar_indice.py` a partir das fichas. Não edite à mão: rode o script de novo.",
        "",
        f"**Totais:** {len(linhas_tabela)} sistemas · {totais['det']} endpoints detalhados · "
        f"{totais['cat']} catalogados · {totais['exec']} executáveis pelo assistente · {totais['faq']} perguntas de FAQ.",
        "",
        "| Sistema | Categoria | Índice | Endpoints (det. + cat.) | Executáveis | Autenticação | Concluído |",
        "|---|---|---|---|---|---|---|",
        *linhas_tabela,
        "",
        "## Detalhe por sistema",
        "",
        "\n\n".join(detalhes),
        "",
    ]
    destino = RAIZ / "relatorios" / "indice-sistemas.md"
    destino.write_text("\n".join(saida), encoding="utf-8")
    print(f"{destino}: {len(linhas_tabela)} sistemas")


if __name__ == "__main__":
    main()
