# LOTE 1 — Asaas, Focus NFe, Bling

Concluído em 2026-09-17.

## Resumo

| Sistema | Status | Endpoints (detalhados + catalogados) | FAQ | Índice | Validador |
|---|---|---|---|---|---|
| asaas | documentado | 62 + 151 | 18 (2 BI) | **78** | 0 erros, 0 avisos |
| focus-nfe | documentado | 62 + 66 | 17 (2 BI) | **67** | 0 erros, 0 avisos |
| bling | documentado | 75 + 185 | 18 (3 BI) | **64** | 0 erros, 0 avisos |

**Total:** 199 endpoints detalhados, 402 catalogados e 53 perguntas de FAQ. Cada sistema tem kit Power Query/Python/TypeScript e planilha em `saida/`.

## Índice de integrabilidade

- **Asaas (78):** tem spec OpenAPI pública, sandbox gratuito e self-service e webhooks com fila e reenvio. Perde pela chave estática sem escopos, pelo webhook sem HMAC e por ter só SDK Java.
- **Focus NFe (67):** documentação boa e sandbox self-service. Perde pelo token estático em HTTP Basic, pelo webhook sem HMAC, pelos exemplos oficiais de 2019 e por não ter política de depreciação.
- **Bling (64):** API ampla, com OAuth2/JWT e webhooks HMAC. Perde por não ter sandbox, pelo limite de 3 req/s por conta, por não ter client credentials e por não permitir cancelar NF-e pela API.

## Conferência do orquestrador

- Rodei o validador de novo nos três sistemas: 0 erros.
- Sorteei 5 endpoints por sistema e conferi os paths.
- Checagens diretas na fonte oficial:
  - Asaas: `DELETE /v3/installments/{id}`.
  - Focus NFe: `POST /v2/nfe/danfe`, com o `/v2` na URL base conferido.
  - Bling: spec OpenAPI oficial baixada (257 operações, 162 paths). Confirma que não há cancelamento, CC-e nem inutilização de NF-e/NFC-e. `DELETE /nfe` está corretamente classificado como exclusão, não como cancelamento fiscal.
- As planilhas não contêm credenciais, só placeholders.

## Lacunas relevantes

- **Nenhuma planilha foi atualizada com credencial válida.** Os três kits foram testados com credencial inválida e/ou mock local. O caminho de sucesso só foi comprovado no protótipo IBGE.
- **Asaas:**
  - nenhum mecanismo de idempotência documentado;
  - não há catálogo completo de erros de negócio;
  - termos de uso bloqueiam acesso automatizado.
- **Focus NFe:**
  - rate limit e download por `caminho_*` só aparecem na doc legada oficial;
  - webhooks sem schema de payload;
  - CT-e e MDF-e rasos, porque a spec oficial também é rasa.
- **Bling:**
  - sem sandbox;
  - escopos OAuth não são públicos;
  - data de desligamento da v2 não confirmada em fonte oficial;
  - URLs de token e revogação inconsistentes na própria doc.
- **Todos:** nenhum menciona o CNPJ alfanumérico. A spec de NFS-e da Focus valida CNPJ só com números.

## Incidentes

- **Bloqueio de IP na Focus NFe:** o agente fez várias autenticações com token falso e a API bloqueou o IP (429).
  - Correção: regra nova 2.1 na especificação (máximo de 3 chamadas com credencial inválida, preferência por mock, encerrar processos).
- **Excel deixado aberto:** o agente do Asaas deixou um Excel em segundo plano. Foi encerrado pelo orquestrador.
- **Formula.Firewall e status nulo:** com credencial recusada, o Excel devolve `Response.Status` nulo e o `fnApi` original quebrava. Os três kits e o protótipo foram corrigidos.

## Menor confiança

- **Bling:** a revogação de token e a criação de remessa estão marcadas como inferidas.
- **Asaas:**
  - atualização de assinatura marcada como inferida;
  - paginação de transferências e de cobranças por assinatura assumida.
- **Focus NFe:**
  - FAQ de rejeições da SEFAZ marcada como inferida;
  - paginação por versão de CT-e e NFS-e recebidas presumida.

## Sugestões de taxonomia (pendente de decisão)

| Tipo | Proposta | Hoje mapeado como | Origem |
|---|---|---|---|
| ação | `encerrar` | `atualizar` + destrutivo | encerramento de MDF-e (Focus NFe) |
| ação | `manifestar` | `emitir` | manifestação do destinatário (Focus NFe) |
| ação | `restaurar` | vários | restore de cliente/cobrança (Asaas) |
| ação | `liquidar` | `Pagamento.criar` | baixa de título (Bling) |
| entidade | `Recebivel` | secundários | antecipação e registro de recebíveis (Asaas) |
| entidade | `Deposito` | `Estoque` | depósitos (Bling) |
| entidade | `OrdemProducao` | `Pedido` | ordens de produção (Bling) |
| entidade | `Anuncio` | `Produto` | anúncios em marketplace (Bling; será comum no Lote 5) |
| subtipo | `nfcom`, `dce`, `nfgas`, `cte_os` | secundários | Focus NFe |

## Achados úteis para o produto

- Asaas e Bling publicam servidores MCP oficiais de documentação/API: `https://docs.asaas.com/mcp` e `https://mcp.bling.com.br/mcp`. O Asaas também publica `llms.txt`. Isso pode apoiar o monitoramento de mudanças.
- No Bling, toda chamada, inclusive a de token, exige o header `enable-jwt: 1`. XML/DANFE vêm em GZIP + base64.
- O Power Query do Excel não expõe cabeçalhos de paginação (`X-Total-Count` etc.). Os kits paginam pelo tamanho da página.

## Próximo lote sugerido

Lote 2: `pix-bacen`, `pagarme`, `mercado-pago`. Antes, aplicar a decisão de taxonomia.
