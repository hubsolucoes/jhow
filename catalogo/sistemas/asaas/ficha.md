# Asaas — ficha de integração

> Categoria: pagamentos_psp · Status: documentado · Consulta: 2026-09-17 · API REST v3 · Índice de integrabilidade: **78/100**

## 1. Resumo comercial

**O que é.** Instituição de pagamento (autorizada pelo Banco Central, segundo o próprio Asaas) com conta digital e API completa para receber e movimentar dinheiro: boleto, Pix (dinâmico, estático, recorrente e Pix Automático), cartão de crédito/débito, assinaturas, parcelamentos, link de pagamento/checkout, split, antecipação, negativação, transferências Pix/TED, pagamento de contas, NFS-e e subcontas (BaaS).

**O que dá para fazer com a API (principais casos):**
- **Cobrança automática do ERP com baixa por webhook** — Emissão manual de boletos/Pix e baixa manual de recebimentos. → Reduz inadimplência e tempo de conciliação; baixa em tempo real.
- **Recorrência de SaaS/mensalidades** — Controle manual de mensalidades e cobranças atrasadas. → Receita recorrente previsível com geração automática de cobranças.
- **Marketplace com subcontas e split** — Repasse manual a sellers/parceiros. → Divisão automática de valores e saldo segregado por parceiro.
- **Contas a pagar via Pix a partir do saldo** — Pagamentos a fornecedores feitos um a um no internet banking. → Automação de saídas com trilha de auditoria (E2E, comprovantes).
- **Painel financeiro em Excel/Power BI** — Relatórios de recebíveis e extrato montados à mão. → Visão diária de recebido, a receber, inadimplência e MRR sem digitação.
- **NFS-e automática dos serviços cobrados** — Emissão de nota separada do faturamento. → Nota vinculada à cobrança, sem segundo fornecedor fiscal.

**Quanto custa.** Não há mensalidade nem cobrança pelo uso da API; paga-se por transação (valores voláteis, tabela padrão de 17/09/2026): Pix e boleto recebidos R$ 1,99 (R$ 0,99 nos 3 primeiros meses); cartão à vista R$ 0,49 + 2,99% (parcelado até R$ 0,49 + 4,29%); débito R$ 0,35 + 1,89%; NFS-e R$ 0,49; Pix de saída PJ 30 grátis/mês e depois R$ 2,00; TED R$ 5,00. Contratos podem ter condições diferentes. Fonte: https://www.asaas.com/precos-e-taxas

**Quanto demora.** Complexidade baixa; MVP estimado em ~40 h (Julgamento do arquiteto: MVP de cliente + cobrança boleto/Pix + webhook idempotente + baixa no ERP, com dev pleno já familiarizado com REST, incluindo homologação no sandbox. Split, subcontas BaaS, cartão transparente (PCI) ou NFS-e somam de 20 a 80 h cada.) Sandbox liberado na hora; conta de produção depende de análise cadastral (prazo não publicado).

**Índice de integrabilidade: 78/100**

| Componente | Pontos | Justificativa |
|---|---|---|
| documentacao | 18/20 | Portal oficial com guias e referência completos, spec OpenAPI 3 pública (213 operações), llms.txt, versão .md de cada página e MCP Server de documentação. Perde pontos por pequenas inconsistências (apiKey x accessToken na criação de subconta; paths com barra final para variantes de cartão; paginação omitida em algumas rotas) e por não haver catálogo completo de códigos de erro. |
| sandbox | 15/15 | Sandbox gratuito e self-service (sandbox.asaas.com), com aprovação automática de conta, cartões de teste e endpoints exclusivos para confirmar pagamento e forçar vencimento. |
| autenticacao | 7/15 | Chave de API estática no header access_token, sem OAuth2 nem escopos documentados para a conta principal; compensa parcialmente com expiração configurável, desativação por inatividade, whitelist de IPs e gestão de chaves de subcontas via API. |
| webhooks | 12/15 | Mais de 100 eventos, token no header asaas-access-token, entrega at least once, 15 retentativas com backoff progressivo, retenção de 14 dias, envio sequencial opcional, reativação de fila e remoção de penalização por API. Não há assinatura HMAC do payload. |
| limites_paginacao | 8/10 | Limites publicados (cota de 25.000 req/12h por conta, 50 GETs concorrentes, rate limit por endpoint com headers RateLimit-*) e paginação offset/limit até 100 com hasMore. A cota fixa pode apertar cargas históricas grandes. |
| sdks_comunidade | 5/10 | SDK oficial apenas para Java/Kotlin (com.asaas:api-sdk 1.0.3); nó oficial n8n, plugins (WooCommerce, Magento, Nuvemshop, Shopify), comunidade no Discord e MCP Server de documentação. |
| acesso_sem_barreira | 9/10 | Conta gratuita e chave gerada pelo próprio painel, sem contrato. Subcontas exigem conta-pai PJ e passam por período de avaliação regulatória. |
| versionamento | 4/5 | API v3 estável no path, changelog público e página de breaking changes com data de obrigatoriedade e aviso por e-mail/Discord; não há política formal de suporte a versões antigas. |

## 2. Técnica

### Autenticação
- Tipo: chave de API estática (`api_key`). Um administrador gera a chave em Integrações > Chaves de API no painel web (não pelo app); ela é exibida uma única vez. Toda requisição envia os headers access_token (a chave), User-Agent (obrigatório para contas raiz criadas desde 13/06/2024) e Content-Type: application/json. Chaves de produção começam com $aact_prod_ e de sandbox com $aact_hmlg_; não há Authorization: Bearer.
- Expiração: Data de expiração opcional definida na criação. Sem uso: desabilitada após 3 meses (exceto subcontas BaaS) e expirada definitivamente após 6 meses; eventos ACCESS_TOKEN_DISABLED, ACCESS_TOKEN_EXPIRING_SOON, ACCESS_TOKEN_EXPIRED.
- Renovação: Criar nova chave no painel (conta principal) ou via POST /v3/accounts/{id}/accessTokens para subcontas. Até 10 chaves por conta; chave excluída não pode ser restaurada.
- Segurança adicional: Whitelist de IPs opcional (IP único ou faixas de até 50 endereços); IP não autorizado recebe 403. Transferências e outras saídas exigem token SMS/app, whitelist com evento crítico desativado ou webhook de validação de saque.
- TLS 1.2 ou 1.3.

```http
GET /v3/customers?limit=10 HTTP/1.1
Host: api-sandbox.asaas.com
access_token: <<SUA_API_KEY>>
User-Agent: minha-integracao/1.0
```

### Ambientes
| Ambiente | URL base | Como obter |
|---|---|---|
| Sandbox | https://api-sandbox.asaas.com/v3 | Conta gratuita e separada em https://sandbox.asaas.com + chave própria ($aact_hmlg_) |
| Produção | https://api.asaas.com/v3 | Conta aprovada em https://www.asaas.com + chave de produção ($aact_prod_) |

Recursos só de sandbox: POST /v3/sandbox/payment/{id}/confirm (confirmar pagamento), POST /v3/sandbox/payment/{id}/overdue (forçar vencimento), POST /v3/sandbox/myAccount/approve (aprovar conta), cartões de teste, adição de saldo para testes. Notificações por e-mail/SMS podem ser enviadas de verdade no sandbox; limite de 20 subcontas por dia; webhooks do sandbox podem vir de IPs adicionais aos de produção.

### Limites e paginação
- Cota de 25.000 requisições por conta a cada 12 horas; até 50 requisições GET concorrentes; alguns endpoints têm rate limit próprio informado nos headers RateLimit-Limit, RateLimit-Remaining e RateLimit-Reset.
- Janela: 12 horas contadas a partir da primeira requisição (cota); RateLimit-Reset em segundos (rate limit por endpoint).
- Paginação: `offset` (desde 0) + `limit` (1–100, padrão 10); a resposta traz `totalCount` e `hasMore`.
- Retry: Em 429, aguardar RateLimit-Reset (rate limit) ou a renovação da cota; não repetir imediatamente. A cota pode ser ampliada quando o volume for legítimo, mas não para contas que fazem polling.
- Idempotência: **não documentada**. Nenhum header de idempotência documentado para a API; o guia de Pague Contas cita boas práticas de idempotência do lado do cliente. Use externalReference e consulta prévia antes de repetir escritas.
- Outros: Até 10 chaves de API por conta; Até 10 webhooks por conta; Sandbox: 20 subcontas por dia; Descrição de cobrança/assinatura até 500 caracteres.

### Formato de erro
JSON {"errors": [{"code": "<codigo>", "description": "<mensagem>"}]}; validações podem trazer vários itens. 403/404 podem vir sem corpo.

| HTTP | code | Significado |
|---|---|---|
| 400 | invalid_customer | Cliente inválido ou não informado |
| 400 | invalid_value | Valor ausente/inválido |
| 400 | invalid_dueDate | Vencimento anterior a hoje |
| 400 | invalid_object | Objeto incompleto (ex.: parcelamento sem número de parcelas) |
| 400 | invalid_action | Ação bloqueada, ex.: autorização crítica pendente em transferências |
| 401 | access_token_not_found | Header access_token ausente |
| 401 | invalid_access_token_format | Valor não tem formato de chave Asaas |
| 401 | invalid_access_token | Chave inválida, desabilitada, expirada ou excluída |
| 401 | invalid_environment | Chave de outro ambiente |
| 403 | — | IP fora da whitelist ('Acesso negado. Code: ...') ou GET com body |
| 404 | — | Recurso inexistente ou de outra conta |
| 429 | — | Rate limit, cota de 12 h ou concorrência |
| 500 | — | Falha interna do Asaas |

### Webhooks
- Eventos: 112 tipos (PAYMENT_*, SUBSCRIPTION_*, INVOICE_*, TRANSFER_*, BILL_*, RECEIVABLE_ANTICIPATION_*, MOBILE_PHONE_RECHARGE_*, ACCOUNT_STATUS_*, CHECKOUT_*, BALANCE_VALUE_*, INTERNAL_TRANSFER_*, ACCESS_TOKEN_*, PIX_AUTOMATIC_*). Lista completa em system.json.
- Autenticação: Sem HMAC. Token estático (authToken, 32–255 caracteres, sem espaços, não pode ser API Key) enviado no header asaas-access-token em todas as notificações; opcionalmente restringir por IPs de origem (produção: 52.67.12.206, 18.230.8.159, 54.94.136.112, 54.94.183.101).
- Reentrega: Somente HTTP 200 confirma a entrega. Falhas (outros códigos, redirecionamentos, timeouts) seguem 15 tentativas com intervalo crescente (0 s, 30 s, 1 min, 3,5 min, 5 min, 15 min, 25 min, 1 h ×5, 2 h ×2, 3 h), com e-mails de alerta; na 15ª falha consecutiva a fila daquela configuração é interrompida. Eventos ficam guardados por 14 dias e depois são apagados. Reativação via PUT /v3/webhooks/{id} com interrupted=false; POST /v3/webhooks/{id}/removeBackoff antecipa o reenvio de itens penalizados.
- Entrega: at least once; deduplicar pelo campo id do evento; modos: SEQUENTIALLY (preserva ordem; um evento com falha segura os seguintes); NON_SEQUENTIALLY (paralelo, sem ordem).
- Payload: `{id, event, dateCreated, <objeto do recurso: payment|transfer|subscription|invoice|...>}`. Webhooks de cobrança referem-se às cobranças: ao remover uma assinatura/parcelamento chegam PAYMENT_DELETED das cobranças. Configurações de sandbox e produção são independentes; subcontas têm seus próprios webhooks (podem ser criados no POST /v3/accounts).

### SDKs e ferramentas
- SDK oficial: Java/Kotlin `com.asaas:api-sdk` 1.0.3 (Maven Central).
- MCP Server da documentação (https://docs.asaas.com/mcp), llms.txt, coleção Postman/Insomnia, nó n8n e plugins de e-commerce.
- Spec OpenAPI oficial: https://www.asaas.com/openApi/document?version=3&languageCode=pt-BR

### Endpoints canônicos detalhados (62)

| id | Método | Path | Operação (Asaas) | Confiança |
|---|---|---|---|---|
| `asaas.cliente.criar` | POST | `/v3/customers` | Criar novo cliente | verificado |
| `asaas.cliente.listar` | GET | `/v3/customers` | Listar clientes | verificado |
| `asaas.cliente.obter` | GET | `/v3/customers/{id}` | Recuperar um único cliente | verificado |
| `asaas.cliente.atualizar` | PUT | `/v3/customers/{id}` | Atualizar cliente existente | verificado |
| `asaas.cliente.excluir` | DELETE | `/v3/customers/{id}` | Remover cliente | verificado |
| `asaas.cobranca.criar` | POST | `/v3/payments` | Criar nova cobrança | verificado |
| `asaas.cobranca.criar.cartao_credito` | POST | `/v3/payments/` | Criar cobrança com cartão de crédito | verificado |
| `asaas.cobranca.listar` | GET | `/v3/payments` | Listar cobranças | verificado |
| `asaas.cobranca.obter` | GET | `/v3/payments/{id}` | Recuperar uma única cobrança | verificado |
| `asaas.cobranca.atualizar` | PUT | `/v3/payments/{id}` | Atualizar cobrança existente | verificado |
| `asaas.cobranca.cancelar` | DELETE | `/v3/payments/{id}` | Excluir cobrança | verificado |
| `asaas.cobranca.consultar_status` | GET | `/v3/payments/{id}/status` | Recuperar status de uma cobrança | verificado |
| `asaas.cobranca.obter.pix_qrcode` | GET | `/v3/payments/{id}/pixQrCode` | Obter QR Code para pagamentos via Pix | verificado |
| `asaas.cobranca.obter.linha_digitavel` | GET | `/v3/payments/{id}/identificationField` | Obter linha digitável do boleto | verificado |
| `asaas.cobranca.autorizar.captura` | POST | `/v3/payments/{id}/captureAuthorizedPayment` | Capturar cobrança com Pré-Autorização | verificado |
| `asaas.cobranca.estornar` | POST | `/v3/payments/{id}/refund` | Estornar cobrança | verificado |
| `asaas.cobranca.estornar.boleto` | POST | `/v3/payments/{id}/bankSlip/refund` | Estornar boleto | verificado |
| `asaas.cobranca.listar.estornos` | GET | `/v3/payments/{id}/refunds` | Listar estornos de uma cobrança | verificado |
| `asaas.cobranca.criar.parcelamento` | POST | `/v3/installments` | Criar parcelamento | verificado |
| `asaas.cobranca.obter.parcelamento` | GET | `/v3/installments/{id}` | Recuperar um único parcelamento | verificado |
| `asaas.cobranca.cancelar.parcelamento` | DELETE | `/v3/installments/{id}` | Remover parcelamento | verificado |
| `asaas.cobranca.estornar.parcelamento` | POST | `/v3/installments/{id}/refund` | Estornar parcelamento | verificado |
| `asaas.assinatura.criar` | POST | `/v3/subscriptions` | Criar nova assinatura | verificado |
| `asaas.assinatura.criar.cartao_credito` | POST | `/v3/subscriptions/` | Criar assinatura com cartão de crédito | verificado |
| `asaas.assinatura.listar` | GET | `/v3/subscriptions` | Listar assinaturas | verificado |
| `asaas.assinatura.obter` | GET | `/v3/subscriptions/{id}` | Recuperar uma única assinatura | verificado |
| `asaas.assinatura.atualizar` | PUT | `/v3/subscriptions/{id}` | Atualizar assinatura existente | inferido |
| `asaas.assinatura.cancelar` | DELETE | `/v3/subscriptions/{id}` | Remover assinatura | verificado |
| `asaas.cobranca.listar.assinatura` | GET | `/v3/subscriptions/{id}/payments` | Listar cobranças de uma assinatura | verificado |
| `asaas.empresa.criar.chave_pix` | POST | `/v3/pix/addressKeys` | Criar uma chave | verificado |
| `asaas.empresa.listar.chave_pix` | GET | `/v3/pix/addressKeys` | Listar chaves | verificado |
| `asaas.empresa.obter.chave_pix` | GET | `/v3/pix/addressKeys/{id}` | Recuperar uma única chave | verificado |
| `asaas.empresa.excluir.chave_pix` | DELETE | `/v3/pix/addressKeys/{id}` | Remover chave | verificado |
| `asaas.cobranca.criar.pix_qrcode_estatico` | POST | `/v3/pix/qrCodes/static` | Criar QR Code estático | verificado |
| `asaas.pagamento.criar.pix_qrcode` | POST | `/v3/pix/qrCodes/pay` | Pagar um QRCode | verificado |
| `asaas.pagamento.validar.pix_qrcode` | POST | `/v3/pix/qrCodes/decode` | Decodificar um QRCode para pagamento | verificado |
| `asaas.transacao.listar.pix` | GET | `/v3/pix/transactions` | Listar transações | verificado |
| `asaas.transacao.obter.pix` | GET | `/v3/pix/transactions/{id}` | Recuperar uma única transação | verificado |
| `asaas.pagamento.cancelar.pix_agendado` | POST | `/v3/pix/transactions/{id}/cancel` | Cancelar uma transação agendada | verificado |
| `asaas.pagamento.criar.transferencia` | POST | `/v3/transfers` | Transferir para conta de outra Instituição ou chave Pix | verificado |
| `asaas.pagamento.criar.transferencia_asaas` | POST | `/v3/transfers/` | Transferir para conta Asaas | verificado |
| `asaas.pagamento.listar.transferencia` | GET | `/v3/transfers` | Listar transferências | verificado |
| `asaas.pagamento.obter.transferencia` | GET | `/v3/transfers/{id}` | Recuperar uma única transferência | verificado |
| `asaas.pagamento.cancelar.transferencia` | DELETE | `/v3/transfers/{id}/cancel` | Cancelar uma transferência | verificado |
| `asaas.transacao.listar` | GET | `/v3/financialTransactions` | Recuperar extrato | verificado |
| `asaas.empresa.obter.saldo` | GET | `/v3/finance/balance` | Recuperar saldo da conta | verificado |
| `asaas.nota_fiscal.criar.nfse` | POST | `/v3/invoices` | Agendar nota fiscal | verificado |
| `asaas.nota_fiscal.listar.nfse` | GET | `/v3/invoices` | Listar notas fiscais | verificado |
| `asaas.nota_fiscal.obter.nfse` | GET | `/v3/invoices/{id}` | Recuperar uma única nota fiscal | verificado |
| `asaas.nota_fiscal.atualizar.nfse` | PUT | `/v3/invoices/{id}` | Atualizar nota fiscal | verificado |
| `asaas.nota_fiscal.emitir.nfse` | POST | `/v3/invoices/{id}/authorize` | Emitir uma nota fiscal | verificado |
| `asaas.nota_fiscal.cancelar.nfse` | POST | `/v3/invoices/{id}/cancel` | Cancelar uma nota fiscal | verificado |
| `asaas.empresa.criar.subconta` | POST | `/v3/accounts` | Criar subconta | verificado |
| `asaas.empresa.listar.subconta` | GET | `/v3/accounts` | Listar subcontas | verificado |
| `asaas.empresa.obter.subconta` | GET | `/v3/accounts/{id}` | Recuperar uma única subconta | verificado |
| `asaas.autenticacao.autenticar.chave_subconta` | POST | `/v3/accounts/{id}/accessTokens` | Criar chave de API para uma subconta | verificado |
| `asaas.webhook.assinar_webhook` | POST | `/v3/webhooks` | Criar novo webhook | verificado |
| `asaas.webhook.listar` | GET | `/v3/webhooks` | Listar webhooks | verificado |
| `asaas.webhook.obter` | GET | `/v3/webhooks/{id}` | Recuperar um único webhook | verificado |
| `asaas.webhook.atualizar` | PUT | `/v3/webhooks/{id}` | Atualizar webhook existente | verificado |
| `asaas.webhook.excluir` | DELETE | `/v3/webhooks/{id}` | Remover um webhook | verificado |
| `asaas.webhook.atualizar.remover_penalizacao` | POST | `/v3/webhooks/{id}/removeBackoff` | Remover penalização de webhook | verificado |

**Catalogados sem detalhamento (151):** Antecipações (8); Assinaturas (7); Ações em sandbox (3); Cartão de crédito (3); Chargeback (3); Checkout (2); Clientes (2); Cobranças (9); Cobranças com dados resumidos (11); Consulta Serasa (3); Conta Escrow (6); Documentos de cobranças (5); Envio de documentos White Label (5); Informações e personalização da conta (9); Informações financeiras (2); Informações fiscais (10); Link de pagamentos (11); Negativações (9); Notificações (2); Pagamento de contas (5); Parcelamentos (6); Pix (3); Pix Automático (7); Pix Recorrente (5); Recargas de celular (5); Registro de Recebíveis (1); Splits (4); Subcontas Asaas (5).

Todo endpoint detalhado tem snippets em curl, Python e TypeScript; as leituras também têm Power Query M (Excel/Power BI). Há ainda 18 perguntas frequentes em `faq.jsonl` e um kit pronto em `kit/` (Power Query com tabela tbConfig, Python, TypeScript) em que só se preenchem credencial e ambiente.

### Armadilhas
- Sem idempotência na API: timeouts em POST podem duplicar cobranças/transferências — usar externalReference e consultar antes de repetir.
- Webhook só é confirmado com HTTP 200 exato (201/204 contam como falha); 15 falhas interrompem a fila e eventos somem após 14 dias.
- Token de webhook é estático (sem HMAC): validar asaas-access-token e, se possível, IPs de origem.
- Chave com '$' no início quebra em PHP com aspas duplas e em shells sem aspas simples.
- Chaves sem uso são desabilitadas em 3 meses e expiram em 6 — monitorar eventos ACCESS_TOKEN_*.
- Transferências/pagamentos exigem autorização crítica (token) a menos que se configure whitelist de IPs ou webhook de validação de saque.
- QR Code Pix sem chave cadastrada vale só até 23:59 do dia (recurso com descontinuação anunciada).
- Cota de 25.000 requisições por 12 h: polling e refresh frequente de Power BI consomem a cota.
- User-Agent obrigatório para contas novas (desde 13/06/2024).

### Lacunas
- **endpoints.erros** (medio): Não há catálogo público completo de códigos de erro de negócio; só alguns códigos aparecem em exemplos (invalid_customer, invalid_value, invalid_dueDate, invalid_object, invalid_action). O código invalid_cpfCnpj em asaas.cliente.criar é inferência.
- **limites.idempotencia** (alto): Nenhum mecanismo de idempotência (header ou campo) documentado para POSTs de cobrança/transferência/pagamento.
- **autenticacao.escopos_permissoes** (baixo): Não foi confirmada a existência de permissões por chave (ex.: PAYMENT:WRITE aparece apenas em resumo de busca, não lido na página oficial).
- **limites.rate_limit** (medio): Valores de rate limit por endpoint não são publicados (apenas os headers). O endpoint removeBackoff tem limite 'mais restrito' sem número.
- **limites.tamanho_max_payload / timeout_recomendado** (baixo): Não documentados.
- **asaas.cobranca.criar.cartao_credito** (medio): Comportamento em recusa do cartão (cobrança criada ou não, código de erro) não confirmado; a spec usa path '/v3/payments/' com barra final como variante documental do mesmo POST.
- **asaas.empresa.criar.subconta** (medio): Guia chama a chave retornada de apiKey; a spec a nomeia accessToken. Confirmar no sandbox.
- **asaas.assinatura.atualizar** (medio): O campo value não aparece no schema de atualização da spec (endpoint marcado como inferido quanto a alteração de valor).
- **paginacao** (baixo): GET /v3/subscriptions/{id}/payments e GET /v3/transfers não listam offset/limit na spec; a paginação padrão foi assumida.
- **taxonomia** (baixo): Pix Automático (autorizações/instruções de pagamento) foi catalogado como Assinatura por falta de entidade específica; antecipações como ContaReceber; negativação/Serasa como Cobranca/Pessoa. Sugestão: entidade 'Recebivel' ou 'Antecipacao' e ação 'restaurar'.
- **conformidade.residencia_dados** (baixo): Local de hospedagem dos dados não informado na documentação consultada.
- **conformidade.permite_uso_em_produto_terceiro** (medio): A página de Termos e Condições (central.ajuda.asaas.com, URL localizada via busca no domínio oficial) respondeu 403 ao acesso automatizado em 2026-09-17; cláusulas sobre uso por plataformas terceiras não foram lidas.
- **comercial.tempo_medio_aprovacao** (baixo): Prazo de aprovação da conta de produção não publicado.
- **kit/powerquery** (medio): Planilha gerada (saida/Asaas.xlsx) testada em 2026-09-17 apenas com chave inválida: as 7 consultas chegam à API e exibem o erro de credencial (o Excel intercepta o 401). O refresh com chave de sandbox válida e o formato real das colunas não foram testados por falta de credencial; a lógica de paginação foi validada com páginas simuladas.
- **cnpj_alfanumerico** (medio): Suporte do Asaas ao CNPJ alfanumérico não encontrado na documentação.

### Onde a confiança é menor
- `asaas.assinatura.atualizar` está marcado como **inferido** quanto à alteração de `value` (campo ausente no schema da spec).
- Código `invalid_cpfCnpj` em `asaas.cliente.criar` é inferido; demais erros de negócio vêm de exemplos oficiais.
- Paginação de `GET /v3/subscriptions/{id}/payments` e `GET /v3/transfers` assumida pelo padrão geral.
- Efeitos de remoção (cliente, parcelamento, assinatura) sobre cobranças já emitidas não estão detalhados na documentação.
- Classificação canônica de Pix Automático, antecipações e negativações (secundários) é aproximada.

### Monitoramento
- Changelog: https://docs.asaas.com/changelog
- Breaking changes: https://docs.asaas.com/page/breaking-changes (e-mail aos clientes afetados e Discord https://discord.gg/invite/X2kgZm69HV); status: https://status.asaas.com/
- Revisão sugerida: mensal

### Fontes (consulta 2026-09-17)
- [Índice da documentação (llms.txt)](https://docs.asaas.com/llms.txt)
- [Especificação OpenAPI oficial v3](https://www.asaas.com/openApi/document?version=3&languageCode=pt-BR)
- [Autenticação](https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1)
- [Chaves de API](https://docs.asaas.com/docs/chaves-de-api)
- [Padrão de chave com $ e clientes PHP](https://docs.asaas.com/docs/padr%C3%A3o-de-chave-com-e-clientes-php)
- [Whitelist de IPs](https://docs.asaas.com/docs/whitelist-de-ips)
- [FAQ Security (autorização crítica)](https://docs.asaas.com/docs/security)
- [Comece por aqui (ambientes)](https://docs.asaas.com/reference/comece-por-aqui)
- [Limites da API](https://docs.asaas.com/reference/rate-e-quota-limit)
- [Listagem e paginação](https://docs.asaas.com/reference/listagem-e-paginacao)
- [Códigos HTTP das respostas](https://docs.asaas.com/reference/codigos-http-das-respostas)
- [Sandbox](https://docs.asaas.com/docs/sandbox)
- [Introdução - Webhooks](https://docs.asaas.com/docs/sobre-os-webhooks)
- [Criar novo Webhook pela API](https://docs.asaas.com/docs/criar-novo-webhook-pela-api)
- [Receber eventos no endpoint](https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook)
- [Penalização de filas](https://docs.asaas.com/docs/penaliza%C3%A7%C3%A3o-de-filas)
- [Fila pausada](https://docs.asaas.com/docs/fila-pausada)
- [Como reativar fila interrompida](https://docs.asaas.com/docs/como-reativar-fila-interrompida)
- [Tipos de envio](https://docs.asaas.com/docs/tipos-de-envio)
- [Idempotência em webhooks](https://docs.asaas.com/docs/como-implementar-idempotencia-em-webhooks)
- [IPs oficiais do Asaas](https://docs.asaas.com/docs/ips-oficiais-do-asaas)
- [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- [Cobranças via Pix](https://docs.asaas.com/docs/cobrancas-via-pix)
- [QR Code estático](https://docs.asaas.com/docs/o-que-e-qr-code-estatico)
- [Estornos](https://docs.asaas.com/docs/estornos)
- [Criação de subcontas](https://docs.asaas.com/docs/criacao-de-subcontas)
- [SDK](https://docs.asaas.com/docs/sdks)
- [SDK Java](https://docs.asaas.com/docs/java)
- [MCP Server (IA)](https://docs.asaas.com/docs/mcp-1)
- [Introdução (visão geral)](https://docs.asaas.com/docs/visao-geral)
- [Changelog](https://docs.asaas.com/changelog)
- [Breaking changes](https://docs.asaas.com/page/breaking-changes)
- [Preços e taxas](https://www.asaas.com/precos-e-taxas)
- [Termos e Condições de Uso](https://central.ajuda.asaas.com/hc/pt-br/articles/32096847160859-Termos-e-Condi%C3%A7%C3%B5es-de-Uso)
