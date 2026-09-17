# Mercado Pago — ficha de integração

> Categoria: pagamentos_psp · Status: documentado · Consulta: 2026-09-17 · API REST (base única `https://api.mercadopago.com`) · Índice de integrabilidade: **82/100**

## 1. Resumo comercial

**O que é.** Instituição de pagamento do grupo Mercado Livre, autorizada pelo Banco Central. Uma API REST única cobre receber por Pix, boleto, cartão de crédito/débito e saldo Mercado Pago, em três formatos de checkout (hospedado, modular e transparente), mais assinaturas recorrentes, cofre de cartões, maquininhas Point, QR Code de loja, OAuth para marketplace e relatórios financeiros.

**O que dá para fazer com a API (principais casos):**
- **Conciliação diária de recebimentos em planilha** — hoje o financeiro baixa relatório do painel à mão e cruza com o ERP. → Extrato de vendas, taxas, valor líquido e data de liberação atualizado todo dia sem digitação.
- **Cobrança por Pix e boleto direto do sistema de gestão** — hoje se emite uma a uma no painel e se manda o QR por WhatsApp. → Cobrança emitida no mesmo minuto da venda, com baixa automática por webhook.
- **Checkout pronto para e-commerce próprio (Checkout Pro)** — evita construir e certificar um checkout do zero. → Página de pagamento hospedada em poucas horas, sem escopo de PCI no servidor da loja.
- **Mensalidade recorrente de SaaS ou clube de assinatura** — hoje o controle de mensalidades e atrasos é manual. → Cobrança recorrente automática, histórico de faturas e MRR consultável.
- **Marketplace com split e cobrança em nome do vendedor** — hoje o repasse a sellers é manual. → O vendedor autoriza a plataforma por OAuth e a comissão sai por `application_fee` na própria transação.
- **One-click com cartão salvo** — hoje o cliente redigita o cartão a cada compra. → O cartão fica no cofre do Mercado Pago (o servidor da loja nunca guarda o PAN) e a recompra é um clique.
- **Painel de inadimplência e estorno em BI** — hoje só se sabe o que foi estornado abrindo o painel. → Power BI com aprovados, recusados, estornados e chargebacks por período e meio.

**Quanto custa.** Não há mensalidade nem cobrança pelo uso da API. O custo é a taxa por transação, que varia por meio de pagamento e pelo prazo de recebimento escolhido pelo lojista, além de ser negociável por contrato. Os valores **não foram transcritos** aqui por serem voláteis: consulte a tabela oficial em https://www.mercadopago.com.br/developers/pt/support/37740 na data do orçamento.

**Quanto demora.** Complexidade média; MVP estimado em **~48 h**. *(Premissa do arquiteto: criar aplicação, cobrar por Pix e boleto via Orders API, tratar webhook com validação de `x-signature`, dar baixa no ERP e montar a extração de conciliação, com dev pleno já familiarizado com REST, incluindo testes com conta de teste. Cartão transparente com tokenização no frontend soma de 16 a 40 h; assinaturas, de 16 a 32 h; marketplace com OAuth e split, de 24 a 60 h.)* Credenciais de teste na hora; credenciais de produção liberadas no painel depois de informar ramo de atividade e site.

**Índice de integrabilidade: 82/100**

| Componente | Pontos | Justificativa |
|---|---|---|
| documentacao | 16/20 | Referência completa em português com parâmetros, enums, exemplos e tabela de erros por endpoint, versão Markdown de cada página para LLM, MCP Server oficial, CLI e biblioteca de prompts. Perde pontos por não publicar OpenAPI, por marcar como OBRIGATÓRIO filtros claramente opcionais nas buscas, por omitir `offset`/`limit` da tabela de parâmetros de `/v1/payments/search`, por não publicar rate limit e por manter o mesmo endpoint duplicado em seções de produto diferentes com conteúdo às vezes divergente. |
| sandbox | 12/15 | Credenciais de teste na hora, até 15 contas de teste por aplicação criadas automaticamente, cartões públicos de teste e gatilhos de status pelo nome do titular (APRO, OTHE, FUND…). Perde pontos porque não há URL de sandbox separada, porque credenciais de teste só valem para Checkout Transparente e Bricks e porque relatórios financeiros de conta de teste vêm vazios. |
| autenticacao | 13/15 | OAuth 2.0 completo (authorization_code com PKCE opcional, refresh_token, client_credentials), escopos read/write/offline_access, Bearer no header, Public Key separada para o frontend e rotação no painel. Perde pontos porque o caminho padrão de conta única é um Access Token estático de validade longa e porque o refresh_token é de uso único. |
| webhooks | 12/15 | 13 tópicos de evento, assinatura HMAC-SHA256 em `x-signature` com manifesto documentado e validador nos SDKs, reentrega a cada 15 min com intervalo crescente e dashboard com o JSON de cada evento. Perde pontos porque não existe endpoint de API para cadastrar webhooks (só painel ou `notification_url` por transação), porque o número máximo de tentativas e a retenção não são publicados e porque QR Code não pode ser validado por assinatura. |
| limites_paginacao | 6/10 | Paginação consistente com envelope `paging{total,limit,offset}` nas buscas e limites publicados nos relatórios (limit ≤ 500, offset ≤ 10000). Perde pontos porque o rate limit não é publicado em lugar nenhum, porque `offset`/`limit` de `/v1/payments/search` não constam da tabela de parâmetros e porque a busca de pagamentos cobre só 12 meses, com intervalo máximo de 365 dias. |
| sdks_comunidade | 10/10 | 11 bibliotecas oficiais (PHP, Java, Node.js, Ruby, .NET, Python, Go no servidor; MercadoPago.js e React no navegador; iOS e Android no mobile), geração de snippet por linguagem dentro da referência, MCP Server, CLI e comunidade oficial no Discord. |
| acesso_sem_barreira | 9/10 | Cadastro self-service e gratuito, sem contrato prévio, sem programa de parceiro obrigatório e sem cobrança pela API. Perde 1 ponto porque as credenciais de produção exigem preencher ramo de atividade e site antes de serem liberadas. |
| versionamento | 4/5 | Versão fixa no path (`/v1`), estabilidade histórica boa e changelog público. Perde pontos porque não há política formal de depreciação nem calendário de sunset, e porque a Payments API foi colocada em modo de manutenção sem data de encerramento anunciada. |

## 2. Técnica

### Qual API usar: Orders API ou Payments API?

Esta é a decisão mais importante do projeto, e a documentação é explícita:

- **A Orders API (`POST /v1/orders`) é a recomendada para integrações novas** de Checkout Transparente. A página de visão geral do Checkout Transparente diz textualmente que, para quem está começando, o caminho é a Orders API.
- **A Payments API (`POST /v1/payments`) continua funcionando**, mas o mesmo aviso oficial diz que ela **não vai receber funcionalidades novas — apenas correções de segurança e estabilidade**. A documentação de webhooks já marca o Checkout Transparente por Payments API como *legacy*. **Não há data de encerramento anunciada.**

Diferenças declaradas pela documentação:

| Característica | Payments API | Orders API |
|---|---|---|
| Processamento | Automático (cria e processa) | Automático **ou** manual (você decide quando processar) |
| Transações | Uma por requisição | Várias por requisição |
| Operações | Pagamentos online | Pagamentos online **e** presenciais (Point) |
| Notificações | Configuração avançada via `notification_url` | Configuração mais simples em Suas integrações |
| Validação de erro | Um erro por vez | Lista completa de erros da requisição |

Convivência: os ids são diferentes (`ORD…` na Orders, numérico na Payments) e o boleto muda de nome — `boleto`/`ticket` na Orders, `bolbradesco` na Payments. Os relatórios financeiros servem às duas.

### Autenticação

- **Header:** `Authorization: Bearer <ACCESS_TOKEN>` em toda chamada de servidor, mais `Content-Type: application/json`.
- **Conta própria:** copie o Access Token em `mercadopago.com.br/developers/panel/app` → sua aplicação → **Testes** (token `TEST-…`) ou **Produção** (token `APP_USR-…`). Funciona como chave estática; renovação é manual no painel e invalida o valor anterior na hora.
- **Terceiros (marketplace):** `POST /oauth/token` com `grant_type` `authorization_code` (o `code` vale 10 minutos; PKCE opcional por `code_verifier`), `refresh_token` ou `client_credentials`. Escopos `read`, `write`, `offline_access`. `expires_in` padrão de **15552000 s (180 dias)**.
- **Public Key** é só frontend (tokenizar cartão) e nunca substitui o Access Token.
- **O `refresh_token` é de uso único.** Cada renovação devolve um par novo; se a aplicação não persistir o valor novo (ou se duas renovações rodarem em paralelo), o acesso àquele vendedor se perde e ele precisa autorizar de novo.

### Ambientes

**Não existe URL de sandbox.** A base é `https://api.mercadopago.com` nos dois ambientes, e quem define o ambiente é o prefixo do token (`TEST-` x `APP_USR-`). O campo `live_mode` das respostas confirma onde a chamada caiu.

Dois caminhos de teste, **não intercambiáveis**:
1. **Credenciais de teste** (`TEST-…`), liberadas na hora — só existem para Checkout Transparente e Checkout Bricks.
2. **Contas de teste**: criadas automaticamente com a aplicação, até 15 por aplicação, sem possibilidade de exclusão. São necessárias pelo menos duas (vendedor e comprador, do mesmo país; marketplace usa também integrador), com código de verificação de 6 dígitos para login e saldo fictício opcional. **A Orders API exige este caminho**: com credencial de teste ela devolve `401 invalid_credentials` e manda usar as credenciais de produção de um usuário de teste.

Cartões de teste públicos (ex.: Mastercard 5480 8328 0103 3311, CVV 123, validade 11/30) com o resultado controlado pelo **nome do titular**: `APRO` aprova, `OTHE` recusa por erro geral, `FUND` por saldo, `SECU` por CVV, `EXPI` por validade, `CONT` deixa pendente.

**Limitação documentada:** relatórios financeiros gerados por conta de teste vêm **vazios** — os fluxos de geração, consulta e listagem funcionam, mas sem dados.

### Limites e paginação

**Rate limit não é publicado.** Ele existe — a Orders API documenta `429 too_many_requests` (Client ID bloqueado no gateway) e `429 usage_quota_exceeded` (cota por cliente no backend), e o `/oauth/token` documenta `429 local_rate_limited` — mas nenhum número, janela ou header `RateLimit-*` aparece na documentação. A instrução oficial é ler o header **`Retry-After`** e aplicar backoff exponencial com jitter.

Três estilos de paginação convivem:

| Estilo | Envelope | Onde |
|---|---|---|
| `offset`/`limit` | `paging{total,limit,offset}` + `results[]` | `/v1/payments/search`, `/preapproval/search`, `/preapproval_plan/search`, `/authorized_payments/search`, `/v1/chargebacks/search`, `/v1/account/release_report/search` |
| `page`/`page_size` | `data[]` + `paging{total,total_pages,offset,limit}` | `/v1/orders` (Orders API) |
| `offset`/`limit` | `elements[]` + `next_offset` + `total` | `/checkout/preferences/search`, `/merchant_orders/search` |
| sem paginação | array na raiz | `/v1/payment_methods`, `/v1/identification_types`, `/v1/payments/{id}/refunds`, `/v1/customers/{customer_id}/cards` |

Janelas de consulta: `/v1/payments/search` cobre **os últimos 12 meses** e exige intervalo **menor que 365 dias** (erro 9062); `/checkout/preferences/search` e `/merchant_orders/search` cobrem **90 dias**; `/v1/orders` exige `begin_date` e `end_date`. Tamanhos: `page_size` até **100** na Orders API; `limit` até **500** e `offset` até **10000** nos relatórios; nos demais o máximo **não é publicado** e o padrão observado é 30.

**Idempotência:** header `X-Idempotency-Key` (1 a 128 caracteres, UUID v4 recomendado), **obrigatório** em `POST /v1/payments`, `POST /v1/orders`, cancelamento, captura e reembolso de order e `POST /v1/payments/{id}/refunds`. Use a **mesma** chave em toda retentativa da mesma operação; chave reusada em operação diferente devolve `409 idempotency_key_already_used`. `POST /checkout/preferences` e `POST /preapproval` **não** aceitam o header.

### Formato de erro

Duas famílias convivem. Ambas foram confirmadas contra a API real em 2026-09-17, com uma leitura usando token inválido:

- **APIs antigas** (`/v1/payments`, `/v1/customers`, `/checkout/preferences`, `/preapproval`): `{"message", "error", "status", "cause":[{"code", "description", "data"}]}`, com `code` numérico. Exemplo real recebido: `401 {"message":"Unauthorized use of live credentials","error":"unauthorized","status":401,"cause":[{"code":7,…}]}`.
- **APIs novas** (Orders, Relatórios, OAuth): códigos textuais (`invalid_begin_date`, `order_not_found`, `invalid_client`…). A Orders API devolve **todos** os erros de validação de uma vez. Exemplo real recebido em `GET /v1/orders` com token inválido: `403 {"status":403,"message":"At least one policy returned UNAUTHORIZED.","code":"PA_UNAUTHORIZED_RESULT_FROM_POLICIES","blocked_by":"PolicyAgent"}` — ou seja, **credencial inválida pode voltar como 403, não 401**.

Todas as respostas trazem `X-Request-Id`: guarde em log, é o que o suporte pede.

| Status | Código | O que significa |
|---|---|---|
| 400 | 1 | Params Error — parâmetro ausente ou malformado |
| 400 | 3 | Token must be for test — credencial do ambiente errado |
| 400 | 2062 | Token de cartão inválido, já usado ou expirado |
| 400 | 2198 | `payer.email` não é de usuário de teste no ambiente de teste |
| 400 | 2059 | `application_fee` usado com token que não veio de OAuth |
| 400 | 2018 | Ação inválida para o estado atual do pagamento |
| 400 | 9062 | Intervalo de busca maior que 365 dias |
| 401 | unauthorized / invalid_credentials | Token ausente, inválido ou do ambiente errado |
| 403 | 4 / 3002 / PA_UNAUTHORIZED_RESULT_FROM_POLICIES | Sem permissão, ou conta bloqueada |
| 404 | 2000 / order_not_found | Recurso inexistente, de outra conta ou do outro ambiente |
| 409 | idempotency_key_already_used | Chave de idempotência reusada em operação diferente |
| 429 | too_many_requests / usage_quota_exceeded / local_rate_limited | Limite de requisições — leia `Retry-After` |

### Webhooks

**Não existe API para cadastrar webhooks.** A URL é registrada em Suas integrações (por aplicação) ou informada em `notification_url` a cada pagamento/preferência/order — e o valor por transação **tem precedência** sobre o do painel.

Tópicos disponíveis: `order`, `payment`, `subscription_preapproval`, `subscription_preapproval_plan`, `subscription_authorized_payment`, `mp-connect`, `wallet_connect`, `stop_delivery_op_wh`, `topic_claims_integration_wh`, `topic_card_id_wh`, `topic_merchant_order_wh`, `topic_chargebacks_wh`, `point_integration_wh`.

**Validação de origem (`x-signature`).** O header vem como `ts=<timestamp>,v1=<hmac>`. Monte o manifesto `id:[data.id];request-id:[x-request-id];ts:[ts];`, calcule HMAC-SHA256 em hexadecimal com a chave secreta da aplicação e compare com `v1`. Duas regras que economizam horas: `data.id` alfanumérico em maiúsculas (ids de order, `ORD…`) precisa ser convertido para **minúsculas**; campos ausentes precisam ser **removidos** do manifesto, não deixados vazios. A chave secreta é gerada ao salvar a configuração, não expira e pode ser resetada. **Notificações de QR Code não podem ser validadas por assinatura.**

**Reentrega:** o Mercado Pago espera `HTTP 200` ou `201` em até **22 segundos**. Sem confirmação, reenvia a cada **15 minutos**; a partir da terceira tentativa o intervalo aumenta, mas as tentativas continuam. O número máximo de tentativas e a retenção **não são publicados**. O painel tem dashboard de notificações com o JSON de cada evento, útil para recuperar o que se perdeu.

A notificação traz **só o id**: confirme com 200 na hora e busque o recurso pela API depois.

### SDKs e ferramentas

11 bibliotecas oficiais: **servidor** PHP (`mercadopago/dx-php`), Java, Node.js, Ruby, .NET, Python e Go; **navegador** MercadoPago.js (`@mercadopago/sdk-js`) e React; **mobile** iOS e Android. Além disso: MCP Server oficial de documentação, Mercado Pago CLI, biblioteca de prompts para IA, geração de snippet por linguagem dentro da própria referência e uma versão Markdown de cada página (`<url>.md`) pensada para LLMs. Comunidade oficial no Discord e canal no YouTube.

### Endpoints canônicos detalhados (41)

| id | método/path | nome no fornecedor | execução |
|---|---|---|---|
| `mercado-pago.autenticacao.autenticar` | POST /oauth/token | Criar e atualizar token | escrita |
| `mercado-pago.cobranca.criar.order` | POST /v1/orders | Criar order | escrita |
| `mercado-pago.cobranca.obter.order` | GET /v1/orders/{id} | Obter order por ID | leitura |
| `mercado-pago.cobranca.listar.orders` | GET /v1/orders | Buscar order | leitura |
| `mercado-pago.cobranca.cancelar.order` | POST /v1/orders/{order_id}/cancel | Cancelar order por ID | escrita |
| `mercado-pago.cobranca.estornar.order` | POST /v1/orders/{order_id}/refund | Reembolsar uma order | escrita |
| `mercado-pago.cobranca.autorizar.order_captura` | POST /v1/orders/{order_id}/capture | Capturar order totalmente | escrita |
| `mercado-pago.cobranca.criar` | POST /v1/payments | Criar pagamento | escrita |
| `mercado-pago.cobranca.obter` | GET /v1/payments/{id} | Obter pagamento | leitura |
| `mercado-pago.cobranca.listar` | GET /v1/payments/search | Buscar em pagamentos | leitura |
| `mercado-pago.cobranca.atualizar` | PUT /v1/payments/{id} | Atualizar pagamento / Criar cancelamento | escrita |
| `mercado-pago.cobranca.estornar` | POST /v1/payments/{id}/refunds | Criar reembolso | escrita |
| `mercado-pago.cobranca.listar.reembolsos` | GET /v1/payments/{id}/refunds | Obter lista de reembolsos | leitura |
| `mercado-pago.cobranca.obter.reembolso` | GET /v1/payments/{id}/refunds/{refund_id} | Obter reembolso específico | leitura |
| `mercado-pago.contestacao.listar` | GET /v1/chargebacks/search | Buscar contestações | leitura |
| `mercado-pago.cobranca.criar.preferencia` | POST /checkout/preferences | Criar preferência | escrita |
| `mercado-pago.cobranca.obter.preferencia` | GET /checkout/preferences/{id} | Obter preferência | leitura |
| `mercado-pago.cobranca.listar.preferencias` | GET /checkout/preferences/search | Buscar em preferências | leitura |
| `mercado-pago.cobranca.atualizar.preferencia` | PUT /checkout/preferences/{id} | Atualizar preferência | escrita |
| `mercado-pago.pedido.obter` | GET /merchant_orders/{id} | Obter pedido comercial (merchant order) | leitura |
| `mercado-pago.pedido.listar` | GET /merchant_orders/search | Buscar pedidos comerciais | leitura |
| `mercado-pago.cliente.criar` | POST /v1/customers | Criar cliente | escrita |
| `mercado-pago.cliente.obter` | GET /v1/customers/{id} | Obter cliente | leitura |
| `mercado-pago.cliente.listar` | GET /v1/customers/search | Buscar clientes | leitura |
| `mercado-pago.cartao.criar` | POST /v1/customers/{customer_id}/cards | Salvar cartão | escrita |
| `mercado-pago.cartao.listar` | GET /v1/customers/{customer_id}/cards | Obter cartões do cliente | leitura |
| `mercado-pago.tabela_auxiliar.listar.meios_pagamento` | GET /v1/payment_methods | Obter meios de pagamento | leitura |
| `mercado-pago.tabela_auxiliar.listar.tipos_documento` | GET /v1/identification_types | Obter tipos de documento | leitura |
| `mercado-pago.plano.criar` | POST /preapproval_plan | Criar plano de assinatura | escrita |
| `mercado-pago.plano.listar` | GET /preapproval_plan/search | Buscar planos de assinatura | leitura |
| `mercado-pago.assinatura.criar` | POST /preapproval | Criar assinatura | escrita |
| `mercado-pago.assinatura.obter` | GET /preapproval/{id} | Obter assinatura | leitura |
| `mercado-pago.assinatura.listar` | GET /preapproval/search | Buscar em assinaturas | leitura |
| `mercado-pago.assinatura.atualizar` | PUT /preapproval/{id} | Atualizar assinatura | escrita |
| `mercado-pago.assinatura.listar.faturas` | GET /authorized_payments/search | Buscar em faturas | leitura |
| `mercado-pago.assinatura.obter.fatura` | GET /authorized_payments/{id} | Obter dados da fatura | leitura |
| `mercado-pago.assinatura.baixar_arquivo.exportacao` | GET /preapproval/export | Exportar assinaturas | leitura |
| `mercado-pago.relatorio.criar.liberacao` | POST /v1/account/release_report | Criar relatório de liberações | escrita |
| `mercado-pago.relatorio.consultar_status.liberacao` | GET /v1/account/release_report/task/{task-id} | Consultar tarefa de criação de relatório | leitura |
| `mercado-pago.relatorio.listar.liberacao` | GET /v1/account/release_report/search | Consultar lista de relatórios de liberações | leitura |
| `mercado-pago.relatorio.baixar_arquivo.liberacao` | GET /v1/account/release_report/{file_name} | Baixar relatório de liberações | leitura |

Mais **83 endpoints catalogados e não detalhados** em `endpoints.json > endpoints_secundarios`: Point (lojas, caixas, terminais, orders presenciais), QR Code, reclamações e mediação pós-venda, relatório de dinheiro em conta (settlement), configuração e agendamento de relatórios, endereços de cliente, atualização/exclusão de cartão, documentação de contestação, transações de order em modo manual e as variantes de Checkout Pro na Orders API.

### O que é bom para planilha e BI

1. **Vendas.** `GET /v1/payments/search` (Payments API) ou `GET /v1/orders` (Orders API). O primeiro traz status, meio, valor bruto, valor estornado, líquido (`transaction_details.net_received_amount`), parcelas e as quatro datas (criação, aprovação, atualização e **liberação do dinheiro**), com `range` escolhendo por qual delas filtrar.
2. **Conciliação com taxas — a melhor fonte.** O relatório de liberação de dinheiro traz uma linha por movimento com `GROSS_AMOUNT`, `MP_FEE_AMOUNT`, `FINANCING_FEE_AMOUNT`, `SHIPPING_FEE_AMOUNT`, `TAXES_AMOUNT`, `NET_CREDIT_AMOUNT`, `NET_DEBIT_AMOUNT`, `INSTALLMENTS`, `PAYMENT_METHOD`, `POS_ID`, `STORE_ID` e `REFUND_ID`. É o único lugar onde a taxa vem somável. Fluxo: criar configuração (uma vez por conta) → disparar geração → descobrir o `file_name` pela task ou pela busca → baixar o CSV/XLSX.
3. **Recorrência.** `GET /preapproval/search` para a carteira (valor por ciclo, próxima cobrança, `summarized`) e `GET /authorized_payments/search` para fatura a fatura, com `retry_attempt` como indicador direto de inadimplência.
4. **Perdas.** `GET /v1/chargebacks/search` (sempre por `payment_id`), com `amount`, `reason`, cobertura e `date_documentation_deadline`.

### Armadilhas

1. **A mesma base URL serve teste e produção.** Só o prefixo do token muda o ambiente. Um token trocado no deploy cobra dinheiro real sem aviso.
2. **Duas APIs vivas para o mesmo problema.** Orders API para o novo; Payments API só com correções de segurança e estabilidade. Escolher errado custa retrabalho.
3. **`X-Idempotency-Key` é obrigatório nas escritas de pagamento.** Retry sem a mesma chave duplica a cobrança.
4. **`/v1/payments/search` só enxerga 12 meses** e exige intervalo menor que 365 dias (erro 9062).
5. **`offset` e `limit` de `/v1/payments/search` não estão na tabela de parâmetros da referência**, mas funcionam. Sem informar, vêm 30 registros.
6. **A referência marca filtros opcionais como OBRIGATÓRIO** em várias buscas (`external_reference`, `collector.id`, `payer.id`, `preapproval_id`…). Não são — se fossem, a busca seria inútil.
7. **O token de cartão é de uso único e vive poucos minutos.** Reaproveitar dá erro 2062.
8. **O QR code do Pix não está na raiz da resposta** da Payments API: está em `point_of_interaction.transaction_data`.
9. **Boleto exige endereço completo do pagador.** Sem `zip_code`, `street_name`, `street_number`, `neighborhood`, `city` e `state`, o pagamento não é processado.
10. **Webhook não tem API de cadastro** — painel ou `notification_url` por transação, e o valor por transação tem precedência.
11. **Relatórios de conta de teste vêm vazios.**
12. **A geração de relatório é assíncrona e o POST devolve 202 sem corpo** — o nome do arquivo só aparece na task ou na listagem.
13. **O `refresh_token` do OAuth é de uso único.** Não persistir o valor novo derruba o acesso do vendedor.
14. **Pagamento por Pix não devolve os dados do pagador** (regra do Bacen). A conciliação depende do seu `external_reference`.
15. **Os campos de `paging` da Orders API voltam como string** (`"54"`, `"3"`), não como número.
16. **Preferência não tem status de pagamento.** Quem sabe se o pedido foi quitado é a merchant order (`status=closed` e `paid_amount == total_amount`) ou o pagamento.
17. **`payments[]` da merchant order traz também as tentativas recusadas.** Filtre por `status=approved` antes de somar faturamento.
18. **O relatório de liberação é por data de liberação, não de venda** — o total não bate com o faturamento do mesmo período.
19. **O e-mail do cliente do cofre (`/v1/customers`) é imutável** (erro 126) e duplicado devolve erro 101.
20. **`boleto`/`ticket` na Orders API x `bolbradesco` na Payments API** — os ids não são intercambiáveis.

### Lacunas

| Campo | O que falta | Impacto |
|---|---|---|
| `limites.rate_limit` | O número de requisições permitidas não é publicado em nenhuma página. A existência do limite está confirmada (429 `too_many_requests`, `usage_quota_exceeded`, `local_rate_limited`, com `Retry-After`), mas valor, janela e escopo não. | médio |
| `execucao.paginacao.tamanho_max` | O máximo de `limit` não é publicado em `/v1/payments/search`, `/checkout/preferences/search`, `/preapproval/search`, `/preapproval_plan/search`, `/authorized_payments/search` e `/merchant_orders/search`. Registrado como `null`; padrão observado 30 (20 em assinaturas). | médio |
| `parametros.obrigatorio` | A referência de várias buscas marca filtros como OBRIGATÓRIO de forma inconsistente (em `/v1/payments/search` são oito ao mesmo tempo, incompatíveis entre si e com os próprios exemplos de SDK). Registrados como opcionais, com observação. | médio |
| `endpoints_secundarios` | A API tem mais de 190 operações públicas. Point, QR Code presencial, reclamações/mediação, relatório de dinheiro em conta e endereços de cliente ficaram catalogados sem detalhamento. | médio |
| `mercado-pago.cobranca.listar.reembolsos` | A página de referência deste endpoint não expõe a versão Markdown/LLM, só o HTML — que não carregou o conteúdo nas tentativas. Path e método vêm do índice da referência; o formato de resposta foi deduzido do endpoint irmão. Marcado como `inferido`. | baixo |
| `mercado-pago.assinatura.baixar_arquivo.exportacao` | A referência não publica as colunas do CSV nem exemplo de resposta. Marcado como `inferido`. | baixo |
| `webhooks.politica_reentrega` | O número máximo de tentativas e o prazo de retenção do evento não são publicados. | baixo |
| `api.spec_oficial_url` | Não há OpenAPI/Swagger oficial. O `openapi.yaml` deste catálogo foi reconstruído endpoint a endpoint. | baixo |
| `limites.tamanho_max_payload` | Tamanho máximo de corpo de requisição não documentado. | baixo |
| `conformidade.residencia_dados` | A documentação pública não informa em que país ficam armazenados os dados. | baixo |
| `comercial.custo_api` | Taxas por transação não transcritas: variam por meio, prazo de recebimento e negociação. | baixo |
| `cliente.listar` | A resposta de `/v1/customers/search` tem envelope `paging`/`results`, mas a referência não documenta `offset` nem `limit` neste endpoint. Registrado como sem paginação. | baixo |

### Onde a confiança é menor

- **Limites numéricos de paginação e de taxa.** Nada disso está publicado; qualquer valor no catálogo seria invenção. Ficou `null` + lacuna.
- **Flags de obrigatoriedade das buscas.** A referência se contradiz. Decidimos pelo comportamento evidenciado nos exemplos oficiais de SDK e registramos a divergência em `observacao_br` de cada parâmetro.
- **`GET /v1/payments/{id}/refunds` e `GET /preapproval/export`.** São os dois endpoints marcados como `inferido`: um por falta de página legível, o outro por falta de exemplo de resposta.
- **Códigos de erro das Assinaturas.** A referência publica apenas 400/401/403/404/500 genéricos, sem catálogo de causas. As causas prováveis registradas ali são leitura de contexto, não transcrição.
- **Colunas do relatório de liberação.** O cabeçalho registrado vem do exemplo oficial, mas a documentação diz que as colunas dependem da configuração salva por conta.

### Monitoramento

- Changelog: https://www.mercadopago.com.br/developers/pt/changelog
- Notícias: https://www.mercadopago.com.br/developers/pt/news · Status: https://status.mercadopago.com
- Não há lista de e-mail de breaking changes documentada.
- **Frequência de revisão sugerida: mensal.** Justificativa: a migração Payments API → Orders API está em curso, sem data de sunset anunciada, e é o tipo de mudança que muda a recomendação desta ficha.

### Fontes (consulta 2026-09-17)

- Referência de API (índice completo): https://www.mercadopago.com.br/developers/pt/reference
- OAuth — criar e atualizar token: https://www.mercadopago.com.br/developers/pt/reference/authentication/oauth/_oauth_token/post
- Credenciais: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/credentials
- Contas de teste: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/accounts
- Cartões de teste: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards
- Webhooks e `x-signature`: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
- Checkout Transparente — Payments API (aviso de manutenção): https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/overview
- Orders API — modelo de integração: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-model
- Pix na Orders API: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix
- Boleto na Orders API: https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/boleto
- Buscar em pagamentos: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/search-payments/get
- Buscar order: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api/search-order/get
- Relatórios (visão geral dos endpoints): https://www.mercadopago.com.br/developers/pt/reference/reports/overview
- Relatório de liberações (conceito e limitação em conta de teste): https://www.mercadopago.com.br/developers/pt/docs/reports/released-money/introduction
- Assinaturas (visão geral): https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/overview
- Checkout Pro — Preferences API: https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-preferences/overview
- Bibliotecas SDK: https://www.mercadopago.com.br/developers/pt/docs/sdks-library/landing
- Termos de uso: https://www.mercadopago.com.br/developers/pt/docs/resources/legal/terms-and-conditions

### Verificação contra a API real

Conforme a regra 2.1 da especificação, foram feitas **3 chamadas de LEITURA à API de produção com token propositalmente inválido**, apenas para confirmar o formato de erro (nenhuma escrita, nenhum dado real acessado):

1. `GET /v1/payments/search` → `401` com envelope `message/error/status/cause[]`.
2. `GET /v1/orders` → `403 PA_UNAUTHORIZED_RESULT_FROM_POLICIES`.
3. Repetição da primeira, para capturar o corpo completo.

Não foi usado mock local porque o objetivo era justamente descobrir o formato real do erro, que nenhuma página da documentação transcreve por inteiro.
