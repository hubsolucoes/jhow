"""Reclassifica endpoints de um sistema após mudança na taxonomia.

Uso (a partir da raiz do catálogo):
    .venv\\Scripts\\python scripts\\reclassificar.py mapeamentos\\<arquivo>.json [--aplicar]

Sem --aplicar, só mostra o que mudaria.

Formato do mapeamento:
{
  "sistema": "<slug>",
  "detalhados": [ {"de": "<id antigo>", "para": "<id novo>", "entidade": "X", "acao": "y"} ],
  "secundarios": [ {"metodo": "GET", "path": "/x", "entidade": "X", "acao": "y"} ]
}

Detalhados: troca o id em todos os arquivos do sistema (formas com '.' e com '__'), atualiza
entidade/ação em endpoints.json, chunks.jsonl (metadata e menção "Entidade.acao" / "Entidade/acao"),
openapi.yaml (x-entidade-canonica / x-acao-canonica), tools.json (annotations) e ficha.md.
Secundários: só atualiza entidade/ação em endpoints.json.
"""
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from validar import ACOES, ENTIDADES  # noqa: E402

EXTENSOES_TEXTO = {".json", ".jsonl", ".yaml", ".yml", ".md", ".pq", ".py", ".ts", ".txt"}


def trocar_ids(texto: str, de: str, para: str) -> tuple[str, int]:
    total = 0
    for a, b in ((de, para), (de.replace(".", "__"), para.replace(".", "__"))):
        padrao = re.compile(rf"(?<![\w.-]){re.escape(a)}(?![\w-]|\.[\w])")
        texto, n = padrao.subn(b, texto)
        total += n
    return texto, total


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    mapa = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    aplicar = "--aplicar" in sys.argv
    pasta = RAIZ / "sistemas" / mapa["sistema"]
    det = mapa.get("detalhados", [])
    sec = mapa.get("secundarios", [])

    for m in det + sec:
        assert m["entidade"] in ENTIDADES, f"entidade inexistente: {m['entidade']}"
        assert m["acao"] in ACOES, f"ação inexistente: {m['acao']}"

    ep_doc = json.loads((pasta / "endpoints.json").read_text(encoding="utf-8"))
    antigos = {e["id"]: (e["entidade_canonica"], e["acao_canonica"]) for e in ep_doc["endpoints"]}
    for m in det:
        assert m["de"] in antigos, f"id não encontrado: {m['de']}"
        assert m["para"] not in antigos, f"id novo já existe: {m['para']}"

    # 1) troca textual de ids em todos os arquivos
    arquivos = {}
    for arq in pasta.rglob("*"):
        if not arq.is_file() or arq.suffix not in EXTENSOES_TEXTO and arq.name != ".env.example":
            continue
        texto = arq.read_text(encoding="utf-8")
        novo = texto
        for m in det:
            novo, n = trocar_ids(novo, m["de"], m["para"])
            if n:
                print(f"  {arq.relative_to(pasta)}: {m['de']} -> {m['para']} ({n}x)")
        if novo != texto:
            arquivos[arq] = novo

    def texto_atual(arq: Path) -> str:
        return arquivos.get(arq) or arq.read_text(encoding="utf-8")

    por_id = {m["para"]: m for m in det}

    # 2) endpoints.json
    ep_doc = json.loads(texto_atual(pasta / "endpoints.json"))
    for e in ep_doc["endpoints"]:
        if e["id"] in por_id:
            e["entidade_canonica"] = por_id[e["id"]]["entidade"]
            e["acao_canonica"] = por_id[e["id"]]["acao"]
    for m in sec:
        achou = [e for e in ep_doc.get("endpoints_secundarios", [])
                 if e["metodo"].upper() == m["metodo"].upper() and e["path"] == m["path"]]
        if not achou:
            print(f"  AVISO secundário não encontrado: {m['metodo']} {m['path']}")
        for e in achou:
            print(f"  secundário {m['metodo']} {m['path']}: {e['entidade_canonica']}.{e['acao_canonica']} -> {m['entidade']}.{m['acao']}")
            e["entidade_canonica"], e["acao_canonica"] = m["entidade"], m["acao"]
    arquivos[pasta / "endpoints.json"] = json.dumps(ep_doc, ensure_ascii=False, indent=2) + "\n"

    # 3) chunks.jsonl
    linhas = []
    for linha in texto_atual(pasta / "chunks.jsonl").splitlines():
        if not linha.strip():
            continue
        c = json.loads(linha)
        cid = c["metadata"]["id"]
        if cid in por_id:
            m = por_id[cid]
            ent_a, acao_a = antigos[m["de"]]
            c["metadata"]["entidade_canonica"], c["metadata"]["acao_canonica"] = m["entidade"], m["acao"]
            for sep in (".", "/", " / "):
                c["texto"] = c["texto"].replace(f"{ent_a}{sep}{acao_a}", f"{m['entidade']}{sep}{m['acao']}")
        linhas.append(json.dumps(c, ensure_ascii=False))
    arquivos[pasta / "chunks.jsonl"] = "\n".join(linhas) + "\n"

    # 4) openapi.yaml (edição por linha para preservar a formatação)
    saida, atual = [], None
    for linha in texto_atual(pasta / "openapi.yaml").splitlines():
        mo = re.match(r"\s*operationId:\s*(\S+)", linha)
        if mo:
            atual = mo.group(1).replace("__", ".")
        if atual in por_id:
            m = por_id[atual]
            linha = re.sub(r"(x-entidade-canonica:\s*)\S+", rf"\g<1>{m['entidade']}", linha)
            linha = re.sub(r"(x-acao-canonica:\s*)\S+", rf"\g<1>{m['acao']}", linha)
        saida.append(linha)
    arquivos[pasta / "openapi.yaml"] = "\n".join(saida) + "\n"

    # 5) tools.json
    tools = json.loads(texto_atual(pasta / "tools.json"))
    for t in tools["tools"]:
        m = por_id.get(t["name"].replace("__", "."))
        if m:
            ann = t.setdefault("annotations", {})
            ann["readOnlyHint"] = ACOES[m["acao"]]["readOnlyHint"]
            ann["destructiveHint"] = ACOES[m["acao"]]["destructiveHint"]
    arquivos[pasta / "tools.json"] = json.dumps(tools, ensure_ascii=False, indent=2) + "\n"

    # 6) ficha.md: corrige "Entidade/acao" nas linhas que citam o id novo
    ficha = texto_atual(pasta / "ficha.md").splitlines()
    for i, linha in enumerate(ficha):
        for novo_id, m in por_id.items():
            if novo_id in linha:
                ent_a, acao_a = antigos[m["de"]]
                for sep in ("/", ".", " / "):
                    linha = linha.replace(f"{ent_a}{sep}{acao_a}", f"{m['entidade']}{sep}{m['acao']}")
                ficha[i] = linha
    arquivos[pasta / "ficha.md"] = "\n".join(ficha) + "\n"

    if aplicar:
        for arq, conteudo in arquivos.items():
            arq.write_text(conteudo, encoding="utf-8")
        print(f"APLICADO: {len(arquivos)} arquivos gravados")
    else:
        print("(simulação — use --aplicar para gravar)")


if __name__ == "__main__":
    main()
