# Relatório do agente — Nomus ERP (lote P2, 2026-10-09)

```
SISTEMA: nomus
STATUS: documentado
ENDPOINTS: 35 detalhados + 159 catalogados
FAQ: 17 perguntas
INDICE: 29 — documentação aberta e extensa (coleção Postman com 191 requisições), mas chave estática sem escopo, sem sandbox, sem webhooks e limite de 1 requisição a cada 20 s com páginas fixas de 50
VALIDADOR: 0 erros, 0 avisos
LACUNAS RELEVANTES: formato da chave no header (como está ou em Base64); URL base por cliente sem regra fechada; escopo do rate limit (por chave, base ou IP) e rajada; respostas de 401/403/404 não documentadas; ordenação da paginação; grafia de booleanos e campos aninhados no filtro query; base de testes sem procedimento; sem termos de uso de API (uso em produto de terceiro indefinido); a chave única permite escrita
MENOR CONFIANÇA: nomus.pedido.obter.compra (exemplo oficial com lorem ipsum) e nomus.produto.criar (obrigatoriedade inferida), ambos marcados inferido; regra geral do filtro query não conferida campo a campo; nenhuma chamada real feita (sem credencial)
SURPRESAS / AJUSTES SUGERIDOS À TAXONOMIA: entidade Recebimento (hoje Pagamento.listar.recebimentos e ContaReceber.liquidar); DocumentoEstoque/MovimentoEstoque (documentos e itens de saída; serviria também ao SyGeCom); Apontamento e InspecaoQualidade para chão de fábrica (hoje OrdemProducao com qualificador); NotaCredito (hoje em ContaReceber/ContaPagar)
```

## Notas para o orquestrador

- **Autenticação:** `execucao_auth.tipo = header_api_key`, header `Authorization`, prefixo `Basic `, credenciais `api_key` e `base_url`. Não é o Basic usuário:senha; o tipo `basic` do executor geraria o valor errado.
- **URL base:** por cliente, modelo `https://<empresa>.nomus.com.br/<empresa>/rest`; `base_url_por_ambiente` fica nulo e o endereço vem da credencial.
- **Paginação:** tipo `page`, `param_pagina = "pagina"`, `param_tamanho = null`, `tamanho_max = 50`, fim por página incompleta. O executor do site (`src/lib/executor.servidor.ts`) só envia o número da página quando `param_tamanho` existe; sem ajuste, ele repetiria a página 1.
- **Limite:** 1 requisição a cada 20 s (artigo comparativo oficial). O executor do site espera 350 ms entre páginas e lança erro no 429; o Nomus devolve `{"tempoAteLiberar": <segundos>}` no corpo, sem `Retry-After` documentado.
- **Filtros:** período e empresa são expressões dentro do parâmetro `query`. Cada item de `filtros_recomendados` traz `expressao` com marcadores `{data_inicial}`, `{data_final}` e `{id_empresa}`; o `planejar_filtros` do `gerar_conhecimento.py` não monta esses campos hoje.
- **Colunas:** cada coluna sugerida traz `formato_origem` quando o valor chega como texto (pt-BR, ponto decimal ou data dd/mm/aaaa).
- **Fontes lidas:** coleção Postman inteira (JSON público, 191 itens) e os 17 artigos da seção API REST da Central de Ajuda, além do comparativo Start x ERP Industrial e da política de privacidade. Nenhuma chamada foi feita à API do Nomus.

Arquivos: `sistemas/nomus/` (system.json, endpoints.json, openapi.yaml, tools.json, chunks.jsonl, faq.jsonl, ficha.md, perguntas-ao-fornecedor.md).
