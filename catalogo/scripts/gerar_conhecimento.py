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


ENUMS_VISIVEIS = {"tipo", "status", "status_pedido"}


def rotulo_condicao(descricao):
    """'Só títulos ainda não baixados. O campo...' -> 'Só títulos ainda não baixados'."""
    import re
    primeira = re.split(r"[.:;]", str(descricao or ""), maxsplit=1)[0]
    return curto(re.sub(r"\s*\([^)]*\)", "", primeira).strip(), 70)


def planejar_query_composta(endpoint):
    """Filtros que a API recebe dentro de um único parâmetro (ex.: Nomus: query=campo>=valor;...).

    O catálogo descreve cada filtro em execucao.filtros_recomendados com uma `expressao` e os
    marcadores {data_inicial}, {data_final} e {id_empresa}. O formulário pergunta o período
    (obrigatório: sem recorte a extração varre a base inteira), por qual data filtrar, a empresa,
    as condições fixas que começam com "Só" e um filtro adicional livre.
    """
    filtros = [f for f in ((endpoint.get("execucao") or {}).get("filtros_recomendados") or [])
               if f.get("expressao")]
    if not filtros:
        return [], None
    parametro = filtros[0].get("parametro") or "query"
    periodos = {}
    for f in filtros:
        if f.get("papel") == "periodo" and "{data_inicial}" in f["expressao"]:
            campo = f.get("campo") or f["expressao"].split(">=")[0]
            rotulo = curto(str(f.get("descricao") or campo).split(":")[0].replace("Recorte por ", ""), 40)
            periodos[rotulo[:1].upper() + rotulo[1:]] = f["expressao"]
    filial = next((f["expressao"] for f in filtros
                   if f.get("papel") == "filial" and "{id_empresa}" in f["expressao"]), None)
    condicoes = {}
    for i, f in enumerate(filtros):
        if f.get("papel") == "opcao" and "<" not in f["expressao"].replace("<=", "")                 and str(f.get("descricao") or "").startswith("Só "):
            condicoes[f"condicao_{i}"] = {"rotulo": rotulo_condicao(f.get("descricao")), "expressao": f["expressao"]}

    campos = []
    if periodos:
        campos.append({"nome": "data_inicial", "rotulo": "Data inicial", "tipo": "data",
                       "papel": "periodo_inicio", "obrigatorio": True})
        campos.append({"nome": "data_final", "rotulo": "Data final", "tipo": "data",
                       "papel": "periodo_fim", "obrigatorio": True})
        if len(periodos) > 1:
            campos.append({"nome": "periodo_por", "rotulo": "Filtrar o período por", "tipo": "opcao",
                           "papel": "opcao", "obrigatorio": True, "opcoes": list(periodos),
                           "padrao": next(iter(periodos))})
    if filial:
        campos.append({"nome": "id_empresa", "rotulo": "Empresa (id)", "tipo": "texto", "papel": "filial",
                       "obrigatorio": False, "padrao": "",
                       "dica": "Id da empresa no ERP (consulta Empresas). Vazio traz todas."})
    for nome, cond in condicoes.items():
        campos.append({"nome": nome, "rotulo": cond["rotulo"], "tipo": "condicao", "papel": "condicao",
                       "obrigatorio": False})
    campos.append({"nome": "filtro_adicional", "rotulo": "Filtro adicional (opcional)", "tipo": "texto",
                   "papel": "avancado", "obrigatorio": False, "padrao": "",
                   "dica": "Na sintaxe do sistema, ex.: idPessoa==123. Junta-se aos filtros acima."})
    receita = {"parametro": parametro, "periodos": periodos, "filial": filial,
               "condicoes": {n: c["expressao"] for n, c in condicoes.items()}}
    return campos, receita


def planejar_filtros(endpoint, paginacao):
    """Decide, a partir dos parâmetros documentados, o que o site pergunta e o que envia sozinho.

    - Período (par de datas inicial/final), data de referência e filial viram campos do formulário.
    - Enums de tipo e situação viram listas de opções.
    - Parâmetros OBRIGATÓRIOS com padrão documentado são enviados sozinhos (ex.: codfor=0, "todos").
      Padrões de parâmetros opcionais NÃO são enviados: alguns restringem o resultado
      (ex.: ecommerce=true em produtos).
    """
    params_pag = {paginacao.get("param_pagina"), paginacao.get("param_tamanho"), paginacao.get("param_cursor")}
    campos, fixos, offset_base = [], {}, 0

    for p in endpoint.get("parametros", []):
        nome, local = p.get("nome", ""), p.get("local")
        descricao = str(p.get("descricao") or "").lower()
        if local == "path":
            # parâmetro no próprio endereço (ex.: /saldo/fornecedores/{id}): sempre perguntado
            campos.append({"nome": nome, "rotulo": curto(p.get("descricao"), 60) or nome, "tipo": "texto",
                           "papel": "caminho", "obrigatorio": True, "padrao": "",
                           "dica": "Obrigatório: faz parte do endereço da consulta."})
            continue
        if local != "query":
            continue
        if any(f.get("expressao") and f.get("parametro") == nome
               for f in ((endpoint.get("execucao") or {}).get("filtros_recomendados") or [])):
            continue  # tratado por planejar_query_composta
        if nome in params_pag:
            if paginacao.get("tipo") == "offset" and nome == paginacao.get("param_pagina") and "base 1" in descricao:
                offset_base = 1
            continue
        baixo = nome.lower()
        obrigatorio = bool(p.get("obrigatorio"))
        padrao = p.get("default")

        if p.get("tipo") == "date" and any(t in baixo for t in ("inicial", "inicio")):
            campos.append({"nome": nome, "rotulo": "Data inicial", "tipo": "data", "papel": "periodo_inicio",
                           "obrigatorio": obrigatorio})
        elif p.get("tipo") == "date" and any(t in baixo for t in ("final", "fim")):
            campos.append({"nome": nome, "rotulo": "Data final", "tipo": "data", "papel": "periodo_fim",
                           "obrigatorio": obrigatorio})
        elif p.get("tipo") == "date":
            campo = {"nome": nome, "rotulo": "Data de referência", "tipo": "data", "papel": "data",
                     "obrigatorio": obrigatorio}
            if "dd/mm" in str(p.get("formato") or ""):
                campo["formato"] = "dd/mm/aaaa"
            campos.append(campo)
        elif baixo == "filial":
            campos.append({"nome": nome, "rotulo": "Filial", "tipo": "texto", "papel": "filial",
                           "obrigatorio": obrigatorio, "padrao": padrao if padrao not in (None, "") else "",
                           "dica": curto(p.get("descricao"), 90)})
        elif p.get("enum") and (baixo in ENUMS_VISIVEIS or (obrigatorio and padrao in (None, ""))):
            campos.append({"nome": nome, "rotulo": "Tipo" if baixo == "tipo" else "Situação", "tipo": "opcao",
                           "papel": "opcao", "obrigatorio": obrigatorio,
                           "opcoes": [str(o) for o in p["enum"]],
                           "padrao": str(padrao) if padrao not in (None, "") else "",
                           "dica": curto(p.get("descricao"), 90)})
        elif obrigatorio and padrao not in (None, ""):
            fixos[nome] = padrao

    return campos, fixos, offset_base


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
                paginacao = ex.get("paginacao") or {}
                campos_filtro, padroes_fixos, offset_base = planejar_filtros(e, paginacao)
                if offset_base:
                    paginacao = {**paginacao, "offset_base": offset_base}
                campos_query, query_composta = planejar_query_composta(e)
                campos_filtro = campos_filtro + campos_query
                base["campos_filtro"] = campos_filtro
                limite = ex.get("limite_requisicoes") or {}
                execucao[s["slug"]]["endpoints"][e["id"]] = {
                    "metodo": e["metodo"], "path": e["path"],
                    "lista_em": ex.get("lista_em"), "campo_total": ex.get("campo_total"),
                    "paginacao": paginacao,
                    "filtros": ex.get("filtros_recomendados") or [],
                    "campos_filtro": campos_filtro,
                    "padroes_fixos": padroes_fixos,
                    "colunas": ex.get("colunas_sugeridas") or [],
                    "titulo": curto(e.get("nome_fornecedor") or e.get("descricao"), 80),
                    **({"query_composta": query_composta} if query_composta else {}),
                    **({"intervalo_minimo_s": limite["intervalo_minimo_s"]}
                       if limite.get("intervalo_minimo_s") else {}),
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
