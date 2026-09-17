# LOTE 2 — Pix (Bacen), Pagar.me, Mercado Pago

Concluído em 2026-09-17.

## Resumo

| Sistema | Status | Endpoints (detalhados + catalogados) | Executáveis | FAQ | Índice | Validador |
|---|---|---|---|---|---|---|
| pix-bacen | documentado | 49 + 3 | 22 | 18 | **64** | 0 erros |
| pagarme | documentado | 62 + 63 | 28 | 19 | **66** | 0 erros, 8 avisos (e-mails institucionais da doc oficial) |
| mercado-pago | documentado | 41 + 83 | 25 | 17 | **82** | 0 erros |

**Catálogo acumulado:** 6 sistemas, 351 endpoints detalhados, 166 executáveis pelo assistente.

## Índice de integrabilidade

- **Mercado Pago (82):** documentação excelente (versão Markdown por página, servidor MCP oficial, 11 SDKs) e OAuth completo. Perde por não publicar limite de requisições, não ter OpenAPI oficial e não ter endereço de sandbox.
- **Pagar.me (66):** API v5 madura, com idempotência real e limites publicados por rota. Perde pela chave estática, pelo webhook sem assinatura, pela spec sem download e pelo acesso à produção sob contrato.
- **Pix Bacen (64):** especificação oficial versionada e autenticação moderna (OAuth2 + mTLS, escopos granulares). Perde porque o padrão não define host, não tem sandbox nem SDK, e tudo operacional depende do contrato com cada PSP.

## Conferência do orquestrador

- Validador reexecutado nos três: 0 erros.
- Amostra de 4 endpoints por sistema: caminhos conferidos.
- Pagar.me: verificada a integridade após dois agentes terem trabalhado no mesmo sistema (62 endpoints sem repetição, 62 chunks, 62 ferramentas, 19 FAQ).
- Pix: confirmado que o Pix Automático entrou por inteiro (spec 2.10.0) e que o único endpoint inferido é o de obtenção de token.

## Achados que afetam o produto

1. **Ambiente definido pelo prefixo da credencial.** Pagar.me e Mercado Pago **não têm endereço de sandbox**: teste e produção usam a mesma URL e o que separa é o prefixo do token (`sk_test_` x `sk_`, `TEST-` x `APP_USR-`). O cofre precisa guardar o ambiente junto da credencial, e o executor deve conferir o prefixo (e o campo `live_mode` na resposta do Mercado Pago) antes de devolver a planilha.
2. **Pix sem host.** O padrão não define base URL nem sandbox: o endereço do PSP entra como dado de configuração junto das credenciais. Já refletido no `execucao_auth`.
3. **Mercado Pago recomenda a Orders API** para integrações novas de Checkout Transparente; a Payments API segue funcionando, mas só recebe correções de segurança e estabilidade, sem data de encerramento anunciada. As duas estão documentadas, com a recomendação explícita.
4. **Pagar.me com mudanças que quebram integrações já em vigor desde 28/08/2026:** dois endpoints descontinuados, recebíveis paginam só por cursor, histórico de pagos limitado a 24 meses e identificadores em novo formato.
5. **Gerar relatório é escrita.** No Mercado Pago, o relatório de liberação de dinheiro — o mais útil para planilha — é criado por POST, portanto não executável. O fluxo seguro adotado: o assistente lista e baixa relatórios já existentes, e entrega o código da geração para o cliente executar.
6. **Documentação em Markdown.** Pagar.me e Mercado Pago servem versão em texto puro de cada página da referência. Mais fiel e mais barato que ler o HTML — vale como prática para os próximos lotes.

## Lacunas relevantes

- **Pix:** sem base URL, sem sandbox oficial, sem limite de requisições, sem tarifa; webhook sem assinatura (a proteção é o canal mTLS); URL e formato do token não padronizados.
- **Pagar.me:** webhook sem assinatura documentada; sem tabela de preços pública; sem spec para download; listagem de liquidações com exemplo vazio.
- **Mercado Pago:** limite de requisições sem valor publicado; tamanho máximo de página não publicado nas buscas; a referência marca como obrigatórios filtros que são opcionais; relatórios de conta de teste vêm vazios.

## Menor confiança

- **Pix:** obtenção do token (único endpoint inferido) — caminho, forma de autenticação e validade não são padronizados.
- **Pagar.me:** três endpoints inferidos (liquidações, links de pagamento e simulação de antecipação, esta com GET e POST convivendo na doc).
- **Mercado Pago:** dois endpoints inferidos (estornos de um pagamento e exportação de assinaturas).

## Incidente

Dois agentes trabalharam no Pagar.me ao mesmo tempo: o primeiro havia caído por limite de uso e voltou a rodar ao receber mensagens de ajuste. O segundo detectou, conferiu a estabilidade dos arquivos e só fez acréscimos. Resultado íntegro. **Regra nova:** antes de relançar um sistema, confirmar na lista de agentes que o anterior não está ativo.

## Sugestões de taxonomia (v1.2, pendente de decisão)

| Tipo | Proposta | Hoje | Origem |
|---|---|---|---|
| entidade | `Relatorio` | `Transacao` | relatórios financeiros (Mercado Pago) |
| entidade | `Contestacao` | `Cobranca` | chargebacks e disputas (Mercado Pago, Pagar.me) |
| entidade | `MeioPagamento`/`Cartao` | `Cliente` | cartões e tokens (Pagar.me) |
| entidade | `Plano` | `Produto` | planos de recorrência (Pagar.me) |
| entidade | `LocationPagamento` | `Cobranca`/`Assinatura` | /loc e /locrec (Pix) |
| ação | `desvincular` | `excluir` | remove vínculo sem apagar o recurso (Pix) |
| ajuste | ampliar `Endereco` | — | hoje descreve só consulta por CEP; é usado para endereço cadastrado de cliente |

## Próximo lote sugerido

Lote 3: `sefaz-nfe`, `nfe-io`, `plugnotas`.
