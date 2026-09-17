# Pagar.me — ficha de integração

> Categoria: pagamentos_psp · Status: documentado · Consulta: 2026-09-17 · Core API v5 (REST/JSON) · Índice de integrabilidade: **66/100**

## 1. Resumo comercial

**O que é.** Provedor de serviços de pagamento (PSP) e gateway do grupo Stone. O site oficial anuncia "Pagar.me agora é Stone", traz no rodapé a razão social **Stone Instituição de Pagamento S.A. (CNPJ 16.501.555/0001-57)** e redireciona a página institucional para stone.com.br; a documentação garante que contrato e integrações existentes continuam funcionando. A empresa opera em dois modelos: **Gateway** (você é o dono da conta na adquirente) e **PSP** (o Pagar.me intermedeia, e é o único modelo com split e antifraude).

**O que dá para fazer com a API (principais casos):**
- **Checkout de e-commerce com cartão, Pix e boleto** — Cada meio integrado por conta própria, com baixa manual. → Um único contrato de pedido para todos os meios, QR code e boleto na mesma resposta e baixa por webhook.
- **Recorrência de SaaS com régua antichurn** — Mensalidades controladas à mão, cartões que expiram sem tratamento. → Cobrança automática por ciclo, troca de cartão sem recriar a assinatura e retentativa manual antes de suspender.
- **Marketplace com split e repasse a sellers** — Repasse manual a parceiros, sem trilha nem controle de responsabilidade por chargeback. → Divisão automática por regra, saldo segregado por seller e apuração de comissão pela agenda de recebíveis.
- **Conciliação financeira e fluxo de caixa futuro** — Planilha manual para saber quanto e quando o dinheiro cai. → Agenda de recebíveis com taxa por parcela, amarrada à liquidação e ao crédito na conta.
- **Venda por link sem desenvolver checkout** — Time comercial sem meio de cobrar fora do site. → Link com carrinho, prazo e limite de uso, gerando pedidos rastreáveis.
- **Antecipação de recebíveis sob demanda** — Caixa antecipado contratado fora do PSP, com custo opaco. → Simulação do custo antes de contratar e histórico das antecipações.

**Quanto custa.** **Não publicado.** Na consulta de 17/09/2026 o Pagar.me não mantém tabela de preços aberta — nem no site oficial nem na documentação. Não há cobrança por chamada de API; o custo é transacional (MDR, tarifa de boleto/Pix, antecipação, transferência) e sai na proposta comercial, variando por volume, modelo (Gateway ou PSP) e prazo de recebimento. Canais oficiais: comercial@pagar.me, relacionamento@pagar.me, 4004-1330. Depois de integrado, a taxa efetiva real é apurável em `GET /core/v5/payables`, que traz `fee` e `anticipation_fee` por parcela.

**Quanto demora.** Complexidade média; MVP estimado em ~60 h (Julgamento do arquiteto: pedido com Pix e boleto, consulta de cobrança, webhook idempotente e baixa no ERP, com dev pleno acostumado a REST, usando chave de teste e os simuladores). Cartão com tokenização soma 20–40 h; recebedores com split e KYC somam 40–80 h; conciliação por recebíveis e liquidações soma 20–40 h. **Acesso não é self-service:** as chaves de teste vêm com a conta, mas as de produção só saem após o fechamento do contrato, e o prazo desse processo não é publicado.

**Índice de integrabilidade: 66/100**

| Componente | Pontos | Justificativa |
|---|---|---|
| documentacao | 14/20 | Portal completo, 127 operações na referência, `llms.txt`, markdown de cada página, simuladores documentados e uma página dedicada às mudanças de contrato. Perde pontos porque a spec OpenAPI não é baixável (o portal desabilita o download), vários exemplos de resposta vêm vazios (links de pagamento, settlements), a referência expõe caminhos artificiais (`/charges.`, `/subscriptions2`, `/recipients1`, `/odersMF`) e não há catálogo de erros de negócio além da tabela ABECS. |
| sandbox | 11/15 | Ambiente de teste completo, sem custo, com simuladores determinísticos por meio de pagamento (cartão por número, boleto por CEP, Pix, voucher, PSP) e os mesmos endpoints da produção. Não é self-service público: as chaves acompanham a conta. |
| autenticacao | 8/15 | HTTP Basic com chave estática, sem OAuth2, sem expiração e sem rotação por API — revogação só no Dash. Compensa parcialmente com separação entre chave secreta e pública, tokenização no navegador, allowlist de IPs e de domínios e menção a escopo/permissão por chave. |
| webhooks | 8/15 | 66 eventos cobrindo pedido, cobrança, fatura, assinatura, recebedor, conta bancária, checkout e antifraude, com histórico consultável e reenvio por API. Perde pontos porque não há assinatura HMAC, token de verificação nem IPs de origem documentados, a política de reentrega não é publicada e a configuração do endpoint só existe no Dash. |
| limites_paginacao | 7/10 | Rate limit publicado rota a rota e por minuto — raro no mercado — e paginação adequada a carga alta em recebíveis (cursor, até 1000) e liquidações (até 2000). Perde pontos por conviver com três modelos de paginação e por não publicar o `size` máximo do modelo padrão. |
| sdks_comunidade | 9/10 | SDKs oficiais em sete linguagens (Java, .NET, Node, PHP, Python, Ruby, Go em beta) no GitHub, mais tokenizecard.js, checkout hospedado e plugins para Magento 2, Shopify, VTEX, Nuvemshop e WooCommerce. Ponto descontado pela quebra de compatibilidade da versão 7 das SDKs. |
| acesso_sem_barreira | 5/10 | Sem autocadastro com chave de produção: o acesso passa por contrato comercial, e split e antifraude dependem de a conta estar no modelo PSP. Recebedores de marketplace passam por análise cadastral e prova de vida. |
| versionamento | 4/5 | Versão fixa no path (`/core/v5`), página de mudanças com cronograma, janela de 45 dias, ambiente de mocks (`sdx-api.pagar.me` com `X-Use-Mocks: true`) e aviso por e-mail. Perde ponto por não haver changelog incremental navegável e pela profundidade das descontinuações recentes. |

## 2. Técnica

### Autenticação
- Tipo: **HTTP Basic com chave estática** (`basic`). A chave secreta vai no lugar do **usuário** e a senha é **vazia**: `Authorization: Basic base64("sk_...:")`. Não há OAuth2, não há token de sessão e não existe rota de API para gerar ou rotacionar chaves — isso é feito no Dash, em https://id.pagar.me > Desenvolvimento > Chaves.
- Duas chaves por ambiente: **secreta** (`sk_test_` em teste, `sk_` em produção), exclusiva do backend; e **pública** (`pk_test_` / `pk_`), usada no navegador para tokenizar cartão (`POST /core/v5/tokens?appId=pk_...`) e no checkout.
- O *Access Token* por customer foi descontinuado em 13/11/2023; gestão de cartões e endereços passou a ser feita pelas rotas de wallet e por tokenização.
- Escopos: a documentação cita escopo **Transacional** e permissão **somente leitura** ao descrever a API de Disputas, mas não publica o catálogo de escopos nem como restringir uma chave.
- Segurança adicional: **IP Allowlist** opcional por Account e por Merchant (IP, faixa, CIDR ou intervalo, IPv4 e IPv6); depois de ligada, recusa qualquer origem fora da lista. Na tokenização também é possível liberar **domínios**. No sentido inverso, o Pagar.me pede que se libere `api.pagar.me` (ou a lista de IPs da página de Segurança) na saída da rede.
- TLS 1.2 ou 1.3 (1.3 recomendado), SHA256/384/512, cifras de 128 bits ou mais. Os certificados do domínio são renovados a cada 90 dias — **não faça pinning**.

```http
GET /core/v5/customers?size=1 HTTP/1.1
Host: api.pagar.me
Authorization: Basic <base64 de "<<SUA_SECRET_KEY>>:">
```

### Ambientes
| Ambiente | URL base | Como obter |
|---|---|---|
| Teste (simulador) | `https://api.pagar.me/core/v5` | Chave `sk_test_` / `pk_test_` no Dash, junto com a conta |
| Produção | `https://api.pagar.me/core/v5` | Chave `sk_` / `pk_`, entregue após o fechamento do contrato |
| Mocks das mudanças 2026 | `https://sdx-api.pagar.me/core/v5` | Mesma chave de teste + header `X-Use-Mocks: true` |
| Teste de **link de pagamento / Checkout** | `https://sdx-api.pagar.me/core/v5` | Chave `sk_test_` (exceção documentada só para essas rotas) |

**Não existe host de sandbox geral.** Para as rotas que o assistente executa (leitura), teste e produção usam exatamente a mesma URL; o que decide se a transação vai para o simulador ou para o fluxo produtivo é o **prefixo da chave**. Promover para produção é trocar uma variável de ambiente — e um engano aqui cobra dinheiro de verdade.

**Exceção verificada:** as páginas de referência de link de pagamento (criar, obter, listar, ativar e cancelar) e a de Apple Pay mandam usar `sdx-api.pagar.me` em contas de teste, e as páginas do Checkout trazem uma tabela de ambientes que apresenta esse host como "Teste". Checagem própria em 2026-09-17: uma chamada sem credencial a `https://sdx-api.pagar.me/core/v5/customers` devolve **404** — ou seja, o `sdx-api` **não** serve a Core API inteira. Trate-o como host do Checkout/links, do Apple Pay e dos mocks, não como sandbox.

**Grafia da chave de produção:** a documentação diverge de si mesma — a página "Chaves de acesso" mostra `sk_<alfanumérico>` e as páginas do Checkout mostram `sk_live_...`. Aceite as duas formas e nunca deduza o ambiente pela *ausência* de `test`.

Simuladores (escolhidos no Dash em Configurações > Meios de pagamento; contas Gateway veem "Simulator", contas PSP veem "PSP"):
- **Cartão de crédito** — o cenário vem do número: `4000000000000010` aprova, `4000000000000028` recusa, `4000000000000036` processa e depois aprova, `4000000000000044` processa e depois falha. Use validade futura.
- **Boleto** — o cenário vem do CEP do comprador: `01046010` pagamento a menor, `57400000` pagamento a maior, `70070300` não concilia, qualquer outro CEP concilia integral.
- Há ainda simuladores de cartão de débito, voucher, Pix e o simulador PSP (antifraude e split).

A idempotência dura **5 minutos** em teste contra 24 h em produção, e o rate limit de conta de teste é de **10 req/s** em qualquer rota.

### Limites e paginação
- **Rate limit por rota, por minuto:** 200 em `GET /charges`, `/charges/*`, `/orders`, `/orders/*`, `/customers`, `/customers/*`, `/subscriptions`, `/subscriptions/*`, `/invoices` e `/invoices/*`; 150 em `GET /recipients/*`; 100 em `GET /recipients`; 50 em `GET /hooks` e `/hooks/*`; 700 em `GET /payables`; 300 em `GET /balance/operations` (rota descontinuada). Contas de teste: 10 req/s em qualquer rota.
- Limite de negócio fora da tabela: após 10 tentativas de cancelar a **mesma** cobrança Pix, só uma a cada 15 minutos.
- **Paginação — três modelos coexistentes:**

| Modelo | Parâmetros | Onde | Fim da listagem |
|---|---|---|---|
| Página | `page` + `size` | modelo padrão (clientes, pedidos, cobranças, assinaturas, faturas, planos, recebedores, webhooks) | página incompleta; `paging.total` e às vezes `paging.next` |
| Forward cursor | `forward_cursor` + `size` | `GET /core/v5/payables` (único modelo aceito desde 28/08/2026) | `paging.forward_cursor` volta nulo; não dá para voltar |
| Cursor por header | `cursor` + `count` | `GET /core/v5/transfers` | headers `x-cursor-nextpage` / `x-cursor-previouspage`; resposta é array na raiz |

  Máximos conhecidos: 1000 em payables, transfers e bulk_anticipations; 2000 em settlements; **30** em paymentlinks. O `size` máximo do modelo padrão não é publicado.
- **Idempotência: suportada**, header `Idempotency-key` gerado pelo cliente. Vale 24 h em produção e 5 min em teste, é case-sensitive, devolve **409** se a primeira requisição ainda estiver em andamento e **não** é gravada quando a requisição falha com 4xx de validação ou 500. Duas requisições com a mesma chave e corpos diferentes ainda geram um único pedido.
- Retry: em 429, reduzir concorrência e aplicar backoff (não há header de reset publicado); em 5xx, repetir com a **mesma** `Idempotency-key`.
- Outros: token de cartão vale 60 s e um uso; `statement_descriptor` 22 caracteres (Gateway) ou 13 (PSP); instruções do boleto até 256 caracteres; histórico de recebíveis pagos limitado a 24 meses.

### Formato de erro
Validação: `{"message": "The request is invalid.", "errors": {"<campo>": ["<mensagem>"]}, "request": {<eco do corpo>}}`. Autenticação: `{"message": "Authorization has been denied for this request."}` com header `X-Payments-Auth: Unauthorized` (confirmado contra a API real em 17/09/2026). Recurso inexistente às vezes vem como **400** com `{"message": "Order not found."}`.

| HTTP | Significado |
|---|---|
| 400 | Requisição inválida **ou** recurso não encontrado (a API usa 400 onde se esperaria 404) |
| 401 | Chave ausente, inválida, de outro ambiente ou Basic mal montado |
| 403 | Origem fora da IP Allowlist, ou chave sem escopo/permissão |
| 409 | Conflito de idempotência: já há requisição em andamento com a mesma chave |
| 412 | Pré-condição não atendida (editar cartão de cobrança já autorizada, cancelar fatura paga) |
| 422 | Falha de validação, com `errors{}` apontando cada campo |
| 429 | Rate limit da rota |
| 500 | Falha interna; repetir com a mesma `Idempotency-key` |

**Erro de negócio não é erro HTTP.** Cartão recusado volta **200** com o pedido em `failed` e o motivo em `charges[].last_transaction.acquirer_return_code`, que desde 28/08/2026 segue o **padrão ABECS** (tabela de-para publicada pelo fornecedor).

### Webhooks
- **66 eventos**: `order.*`, `charge.*` (incluindo `charge.underpaid`, `charge.overpaid`, `charge.partial_canceled` e os quatro de antifraude), `invoice.*`, `subscription.*`, `plan.*`, `customer.*`, `card.*`, `address.*`, `recipient.*`, `bank_account.*`, `checkout.*`, `usage.*`, `discount.*`, `increment.*` e `chargeback.received`. Lista completa em `system.json`.
- **Verificação de assinatura: NÃO DOCUMENTADA.** A documentação consultada não descreve HMAC, header de token nem IPs de origem. Trate o payload como não confiável: use o `id` do evento só para deduplicar e confirme o estado com `GET /core/v5/charges/{charge_id}` ou `/orders/{order_id}` antes de liberar mercadoria.
- Reentrega: há retentativas automáticas (o campo `attempts` vem como "n/N", 3/3 nos exemplos) e reenvio manual por `POST /core/v5/hooks/{hook_id}/retry`. O número de tentativas, os intervalos e o prazo de retenção **não são publicados**.
- Configuração: endpoints e eventos são configurados no **Dash**. A API v5 só lista, consulta e reenvia — não há rota pública para criar ou excluir webhook.
- Portas: 80 (http) e 443 (https).
- Avisos ativos: `charge.chargedback` será substituído por `chargeback.received` (migração até 30/09/2026); cobranças reprocessadas após falha de antifraude chegam com **novo `charge_id`** — amarre pelo `order_id`.

### SDKs e ferramentas
- SDKs oficiais no GitHub: Java, C#/.NET Standard 2.0, Node.js, PHP, Python, Ruby e Go (beta). **A versão 7 acompanha as mudanças de 28/08/2026 e não é retrocompatível.**
- `tokenizecard.js` (tokenização no navegador), checkout hospedado e link de pagamento, `llms.txt` com o índice da documentação e markdown por página, plugins para Magento 2, Shopify, VTEX, Nuvemshop e WooCommerce, página de status em https://status.pagar.me/.
- **Não há spec OpenAPI para download**: a referência é montada sobre uma definição OpenAPI 3.1 embutida nas páginas, mas o portal desabilita o download e nenhuma URL pública de arquivo foi encontrada. O `openapi.yaml` deste catálogo é reconstrução própria.

### Endpoints canônicos detalhados (62 — 28 de leitura executável, 34 de escrita)

| id | Método | Path | Operação (Pagar.me) | Execução | Confiança |
|---|---|---|---|---|---|
| `pagarme.cliente.criar` | POST | `/core/v5/customers` | Criar cliente | escrita | verificado |
| `pagarme.cliente.listar` | GET | `/core/v5/customers` | Listar clientes | leitura | verificado |
| `pagarme.cliente.obter` | GET | `/core/v5/customers/{customer_id}` | Obter cliente | leitura | verificado |
| `pagarme.cliente.atualizar` | PUT | `/core/v5/customers/{customer_id}` | Editar cliente | escrita | verificado |
| `pagarme.cartao.criar` | POST | `/core/v5/customers/{customer_id}/cards` | Criar cartão | escrita | verificado |
| `pagarme.cartao.listar` | GET | `/core/v5/customers/{customer_id}/cards` | Listar cartões | leitura | verificado |
| `pagarme.cartao.obter` | GET | `/core/v5/customers/{customer_id}/cards/{card_id}` | Obter cartão | leitura | verificado |
| `pagarme.cartao.excluir` | DELETE | `/core/v5/customers/{customer_id}/cards/{card_id}` | Excluir cartão | escrita | verificado |
| `pagarme.cartao.criar.token` | POST | `/core/v5/tokens` | Criar token de cartão | escrita | verificado |
| `pagarme.endereco.criar` | POST | `/core/v5/customers/{customer_id}/addresses` | Criar endereço | escrita | verificado |
| `pagarme.endereco.listar` | GET | `/core/v5/customers/{customer_id}/addresses` | Listar endereços | leitura | verificado |
| `pagarme.endereco.atualizar` | PUT | `/core/v5/customers/{customer_id}/addresses/{address_id}` | Editar endereço | escrita | verificado |
| `pagarme.endereco.excluir` | DELETE | `/core/v5/customers/{customer_id}/addresses/{address_id}` | Excluir endereço | escrita | verificado |
| `pagarme.pedido.criar` | POST | `/core/v5/orders` | Criar pedido | escrita | verificado |
| `pagarme.pedido.listar` | GET | `/core/v5/orders` | Listar pedidos | leitura | verificado |
| `pagarme.pedido.obter` | GET | `/core/v5/orders/{order_id}` | Obter pedido | leitura | verificado |
| `pagarme.pedido.encerrar` | PATCH | `/core/v5/orders/{order_id}/closed` | Fechar um pedido | escrita | verificado |
| `pagarme.cobranca.criar` | POST | `/core/v5/charges` | Criar cobrança / incluir cobrança no pedido | escrita | verificado |
| `pagarme.cobranca.listar` | GET | `/core/v5/charges` | Listar cobranças | leitura | verificado |
| `pagarme.cobranca.obter` | GET | `/core/v5/charges/{charge_id}` | Obter cobrança | leitura | verificado |
| `pagarme.cobranca.cancelar` | DELETE | `/core/v5/charges/{charge_id}` | Cancelar cobrança (cancelamento e estorno) | escrita | verificado |
| `pagarme.cobranca.autorizar` | POST | `/core/v5/charges/{charge_id}/capture` | Capturar cobrança | escrita | verificado |
| `pagarme.cobranca.atualizar.vencimento` | PATCH | `/core/v5/charges/{charge_id}/due-date` | Editar data de vencimento da cobrança | escrita | verificado |
| `pagarme.cobranca.atualizar.meio_pagamento` | PATCH | `/core/v5/charges/{charge_id}/payment-method` | Editar método de pagamento da cobrança | escrita | verificado |
| `pagarme.cobranca.atualizar.cartao` | PATCH | `/core/v5/charges/{charge_id}/card` | Editar cartão da cobrança | escrita | verificado |
| `pagarme.cobranca.autorizar.retentativa` | POST | `/core/v5/charges/{charge_id}/retry` | Retentar uma cobrança manualmente | escrita | verificado |
| `pagarme.cobranca.liquidar` | POST | `/core/v5/charges/{charge_id}/confirm-payment` | Confirmar cobrança em dinheiro | escrita | verificado |
| `pagarme.cobranca.criar.link_pagamento` | POST | `/core/v5/paymentlinks` | Criar link de pagamento | escrita | verificado |
| `pagarme.cobranca.listar.link_pagamento` | GET | `/core/v5/paymentlinks` | Obter links de pagamento | leitura | inferido |
| `pagarme.cobranca.cancelar.link_pagamento` | PATCH | `/core/v5/paymentlinks/{payment_link_id}/cancel` | Cancelar link de pagamento | escrita | verificado |
| `pagarme.plano.criar` | POST | `/core/v5/plans` | Criar plano | escrita | verificado |
| `pagarme.plano.listar` | GET | `/core/v5/plans` | Listar planos | leitura | verificado |
| `pagarme.plano.obter` | GET | `/core/v5/plans/{plan_id}` | Obter plano | leitura | verificado |
| `pagarme.plano.atualizar` | PUT | `/core/v5/plans/{plan_id}` | Editar plano | escrita | verificado |
| `pagarme.assinatura.criar` | POST | `/core/v5/subscriptions` | Criar assinatura | escrita | verificado |
| `pagarme.assinatura.listar` | GET | `/core/v5/subscriptions` | Listar assinaturas | leitura | verificado |
| `pagarme.assinatura.obter` | GET | `/core/v5/subscriptions/{subscription_id}` | Obter assinatura | leitura | verificado |
| `pagarme.assinatura.cancelar` | DELETE | `/core/v5/subscriptions/{subscription_id}` | Cancelar assinatura | escrita | verificado |
| `pagarme.assinatura.atualizar.cartao` | PATCH | `/core/v5/subscriptions/{subscription_id}/card` | Editar cartão da assinatura | escrita | verificado |
| `pagarme.assinatura.atualizar.split` | PATCH | `/core/v5/subscriptions/{subscription_id}/split` | Editar regras de split da assinatura | escrita | verificado |
| `pagarme.assinatura.criar.ciclo` | POST | `/core/v5/subscriptions/{subscription_id}/cycles` | Renovar ciclo da assinatura | escrita | verificado |
| `pagarme.assinatura.listar.ciclo` | GET | `/core/v5/subscriptions/{subscription_id}/cycles` | Listar ciclos da assinatura | leitura | verificado |
| `pagarme.cobranca.listar.fatura` | GET | `/core/v5/invoices` | Listar faturas | leitura | verificado |
| `pagarme.cobranca.obter.fatura` | GET | `/core/v5/invoices/{invoice_id}` | Obter fatura | leitura | verificado |
| `pagarme.cobranca.cancelar.fatura` | DELETE | `/core/v5/invoices/{invoice_id}` | Cancelar fatura | escrita | verificado |
| `pagarme.empresa.criar.recebedor` | POST | `/core/v5/recipients` | Criar recebedor | escrita | verificado |
| `pagarme.empresa.listar.recebedor` | GET | `/core/v5/recipients` | Listar recebedores | leitura | verificado |
| `pagarme.empresa.obter.recebedor` | GET | `/core/v5/recipients/{recipient_id}` | Obter recebedor | leitura | verificado |
| `pagarme.empresa.atualizar.recebedor` | PUT | `/core/v5/recipients/{recipient_id}` | Editar recebedor | escrita | verificado |
| `pagarme.empresa.obter.saldo` | GET | `/core/v5/recipients/{recipient_id}/balance` | Obter saldo do recebedor | leitura | verificado |
| `pagarme.pagamento.criar.saque` | POST | `/core/v5/recipients/{recipient_id}/withdrawals` | Criar saque do recebedor | escrita | verificado |
| `pagarme.pagamento.listar.saque` | GET | `/core/v5/recipients/{recipient_id}/withdrawals` | Listar saques do recebedor | leitura | verificado |
| `pagarme.pagamento.criar.transferencia` | POST | `/core/v5/transfers` | Criar transferência bancária | escrita | verificado |
| `pagarme.pagamento.listar.transferencia` | GET | `/core/v5/transfers` | Listar transferências | leitura | verificado |
| `pagarme.recebivel.listar` | GET | `/core/v5/payables` | Obter recebíveis | leitura | verificado |
| `pagarme.recebivel.criar.antecipacao` | POST | `/core/v5/recipients/{recipient_id}/bulk_anticipations` | Criar antecipação | escrita | verificado |
| `pagarme.recebivel.listar.antecipacao` | GET | `/core/v5/recipients/{recipient_id}/bulk_anticipations` | Listar antecipações | leitura | verificado |
| `pagarme.recebivel.calcular.antecipacao` | GET | `/core/v5/recipients/{recipient_id}/bulk_anticipations/simulate` | Simular antecipação spot | leitura | inferido |
| `pagarme.pagamento.listar.liquidacao` | GET | `/core/v5/settlements` | Listar liquidações (settlements) | leitura | inferido |
| `pagarme.webhook.listar` | GET | `/core/v5/hooks` | Listar webhooks | leitura | verificado |
| `pagarme.webhook.obter` | GET | `/core/v5/hooks/{hook_id}` | Obter webhook | leitura | verificado |
| `pagarme.webhook.enviar` | POST | `/core/v5/hooks/{hook_id}/retry` | Reenviar webhook | escrita | verificado |

**Catalogados sem detalhamento (63):** Assinaturas (24); Recebedores (7); Pedidos (5); Planos (5); Disputas (3); Transferências (3); Antecipações (2); Cartões (2); Faturas (2); Link de pagamento (2); Liquidações (2); Operações de saldo (2, ambas descontinuadas); Endereços (1); Recebíveis (1); Registradora (1); Saques (1).

Todo endpoint detalhado traz o bloco `execucao` (seção 7.1): `seguro_para_executar`, caminho do array de registros, modelo de paginação, filtros recomendados e 5 a 15 colunas sugeridas com caminho exato. **Nenhum endpoint de escrita é executável pelo assistente.** Há ainda 19 perguntas em `faq.jsonl` e um chunk por endpoint em `chunks.jsonl`.

### Armadilhas
- Valores são **sempre inteiros em centavos** (R$ 149,90 = `14990`). Enviar `149.90` cobra R$ 1,49 sem erro nenhum. Exceção de leitura: em regras de split, `amount` é percentual quando `type` é `percentage`.
- Cartão recusado volta **200** com `status: failed`; o motivo está em `last_transaction.acquirer_return_code` (padrão ABECS desde 28/08/2026).
- Teste e produção compartilham a **mesma URL**; o ambiente vem do prefixo da chave. Não há host errado para avisar do engano.
- **Webhook sem assinatura documentada**: não confie no payload; deduplique pelo `id` e confirme por `GET` antes de liberar mercadoria.
- `Idempotency-key` vale 24 h em produção e **5 minutos** em teste; duas requisições com a mesma chave e corpos diferentes criam um único pedido; 409 significa "a primeira ainda está rodando", não "tente de novo".
- **Cancelar e estornar são a mesma rota** (`DELETE /core/v5/charges/{charge_id}`); o efeito depende de a cobrança já ter sido capturada. Não existe rota de refund separada na v5.
- Cancelamento de cobrança **Pix** tem limite próprio: após 10 tentativas na mesma cobrança, só uma a cada 15 minutos. Devolução de Pix só dentro de 90 dias da conciliação.
- Mudanças **já em vigor** desde 28/08/2026: `/core/v5/balance/operations` e `/core/v5/payables/{payable_id}` descontinuados; recebíveis paginam só por cursor; histórico de recebíveis pagos limitado a 24 meses; ids de `payables`, `settlements` e `recipients` mudaram de formato.
- `gateway_id` pode ser **alfanumérico**: coluna `INTEGER` no banco quebra.
- A referência tem caminhos artificiais do portal (`/charges.`, `/subscriptions2`, `/recipients1`, `/odersMF`) que **não existem** na API.
- **Split exige conta PSP** e recebedores previamente cadastrados; em `percentage` as regras somam 100 e exatamente um recebedor precisa ter `charge_remainder_fee: true`.
- IP Allowlist, depois de ligada, recusa qualquer origem fora da lista — inclusive o servidor novo que entrou no cluster.
- Objeto Pix no corpo do pedido se chama `Pix`, com **P maiúsculo**; a API tem campos com grafia errada consolidada (`mininum_price`, `additiona_information`).

### Lacunas
- **api.spec_oficial_url** (medio): não há spec OpenAPI para download; a definição está embutida nas páginas, com download desabilitado no portal. O `openapi.yaml` é reconstrução.
- **webhooks.verificacao_assinatura** (alto): sem HMAC, header de token ou IPs de origem documentados — não é possível provar a autenticidade da notificação.
- **webhooks.politica_reentrega** (medio): número de tentativas, intervalos e retenção não publicados.
- **webhooks.configuracao** (medio): nenhuma rota pública para criar/excluir webhook; só o Dash.
- **limites.paginacao.tamanho_max** (medio): `size` máximo do modelo `page/size` não publicado para a maioria das rotas.
- **pagarme.pagamento.listar.liquidacao** (alto): o envelope de `GET /core/v5/settlements` não aparece no exemplo oficial; `execucao.lista_em` ficou nulo e o endpoint está como `inferido`.
- **pagarme.cobranca.listar.link_pagamento** (medio): exemplo de resposta vazio na referência; a estrutura `data[]`/`paging` foi assumida pelo padrão das demais listagens.
- **pagarme.recebivel.calcular.antecipacao** (alto): a referência publica GET com `payment_date` obrigatório, mas a página de mudanças diz que desde 28/08/2026 a rota é POST e não aceita mais esse parâmetro. As duas versões convivem na documentação.
- **autenticacao.formato_da_chave_de_producao** (medio): a doc usa `sk_<alfanumérico>` na página de chaves e `sk_live_...` nas páginas do Checkout, sem página que concilie as duas.
- **api.base_urls.sandbox** (medio): não há declaração única de host de teste. `sdx-api` é apontado como ambiente de teste nas rotas de link de pagamento/Apple Pay e como ambiente de mocks na página de mudanças, mas responde 404 em `/core/v5/customers`. Confirmar com o suporte antes de apontar um cliente de teste para lá.
- **comercial.custo_api** (alto): nenhuma tabela de taxas pública — impede estimativa de custo.
- **comercial.tempo_medio_aprovacao** (medio): prazo entre proposta e chaves de produção não publicado.
- **autenticacao.escopos_permissoes** (medio): escopo e permissão aparecem só na página da API de Disputas; não há catálogo nem instruções de configuração.
- **monitoramento.changelog_url** (medio): `https://docs.pagar.me/changelog` responde 404; as notas ficam espalhadas em páginas avulsas.
- **erros.codigos_principais** (medio): não há catálogo de códigos de erro de negócio; as mensagens conhecidas vêm de exemplos. Só os códigos da adquirente têm tabela (ABECS).
- **limites.timeout_recomendado / tamanho_max_payload** (baixo): não publicados para a Core API.
- **conformidade.residencia_dados** (baixo): não informada.
- **conformidade.permite_uso_em_produto_terceiro** (medio): o PDF de Termos de Uso não foi analisado nesta sessão.
- **endpoints_secundarios** (baixo): a operação "Criação de pedido MF" só aparece com o caminho artificial `/odersMF`, sem caminho real publicado — foi omitida em vez de inventada.
- **taxonomia** (baixo): cartões e tokens mapeados em `Cliente` (sugestão de extensão: `MeioPagamento`/`Cartao`); planos de recorrência mapeados em `Produto` (sugestão: `Plano`); endereços da carteira usam `Endereco`, cuja descrição na taxonomia fala de consulta por CEP (sugestão: ampliar a descrição).

### Onde a confiança é menor
- `pagarme.pagamento.listar.liquidacao`, `pagarme.cobranca.listar.link_pagamento` e `pagarme.recebivel.calcular.antecipacao` estão marcados como **inferido** — nos dois primeiros porque o exemplo oficial de resposta vem vazio, no terceiro porque referência e página de mudanças divergem no verbo HTTP.
- A política de reentrega de webhooks ("3 tentativas") é leitura do campo `attempts` nos exemplos, **não** uma afirmação da documentação.
- Os limites de `size` do modelo `page/size` usados nos snippets (100) são escolha conservadora deste catálogo, não valor publicado.
- A base legal LGPD em `conformidade.base_legal_tipica` é inferência de padrão do setor.
- Os endpoints secundários foram catalogados a partir da definição embutida no portal, sem leitura individual de cada página.

### Monitoramento
- Changelog incremental: **não existe** (`/changelog` responde 404).
- Breaking changes: https://docs.pagar.me/docs/mudan%C3%A7as-de-apis (com páginas por área: Pagamentos, Financeiro, Antecipações, Liquidação e Recebedores). Datas oficiais também por e-mail; parceiros recebem janela própria pelo Stone Partner Program.
- Status do serviço: https://status.pagar.me/
- Revisão sugerida: **mensal** (pagamentos, e com um ciclo de descontinuações ainda em curso).

### Fontes (consulta 2026-09-17)
- [Índice da documentação (llms.txt)](https://docs.pagar.me/llms.txt)
- [API Reference — Introdução](https://docs.pagar.me/reference/introdu%C3%A7%C3%A3o-1)
- [Autenticação (Basic Auth, chaves de teste e produção)](https://docs.pagar.me/reference/autentica%C3%A7%C3%A3o-2)
- [Chaves de acesso](https://docs.pagar.me/docs/chaves-de-acesso)
- [Segurança (PCI, TLS, IPs)](https://docs.pagar.me/reference/seguran%C3%A7a-1)
- [IP Allowlist](https://docs.pagar.me/docs/ip-allowlist)
- [Rate Limit](https://docs.pagar.me/reference/rate-limit)
- [Paginação](https://docs.pagar.me/reference/pagina%C3%A7%C3%A3o-1)
- [Idempotência](https://docs.pagar.me/docs/o-que-%C3%A9)
- [Visão Geral das mudanças da API](https://docs.pagar.me/docs/mudan%C3%A7as-de-apis)
- [Mudanças no Financeiro](https://docs.pagar.me/docs/financeiro)
- [Mudanças em Liquidação, Transferências e Recebedores](https://docs.pagar.me/docs/liquida%C3%A7%C3%A3o-transfer%C3%AAncias-e-recebedores)
- [Recebíveis (objeto payable)](https://docs.pagar.me/reference/receb%C3%ADveis)
- [Objeto Settlements](https://docs.pagar.me/reference/objeto-settlements)
- [Objeto antecipação](https://docs.pagar.me/reference/objeto-antecipa%C3%A7%C3%A3o)
- [Eventos de webhook](https://docs.pagar.me/reference/eventos-de-webhook-1)
- [Visão geral sobre Webhooks](https://docs.pagar.me/reference/vis%C3%A3o-geral-sobre-webhooks)
- [Cobrança (status)](https://docs.pagar.me/docs/cobran%C3%A7a)
- [Split de pagamentos](https://docs.pagar.me/reference/split-1)
- [Recebedores](https://docs.pagar.me/reference/recebedores-1)
- [Pix](https://docs.pagar.me/docs/pix-1)
- [Meios de pagamento](https://docs.pagar.me/docs/meios-de-pagamento)
- [tokenizecard.js](https://docs.pagar.me/docs/tokenizecard)
- [Tokenização de cartão](https://docs.pagar.me/reference/tokeniza%C3%A7%C3%A3o-1)
- [Descontinuação do Access Token](https://docs.pagar.me/page/descontinua%C3%A7%C3%A3o-do-access-token)
- [O que é um simulador](https://docs.pagar.me/docs/o-que-%C3%A9-um-simulador)
- [Simulador de cartão de crédito](https://docs.pagar.me/docs/simulador-de-cart%C3%A3o-de-cr%C3%A9dito)
- [Simulador de boleto](https://docs.pagar.me/docs/simulador-de-boleto)
- [Códigos de retorno padrão ABECS](https://docs.pagar.me/docs/c%C3%B3digos-de-retorno-padr%C3%A3o-abecs)
- [Bibliotecas (SDKs oficiais)](https://docs.pagar.me/docs/bibliotecas-1)
- [Facilitadores de pagamento (subadquirente)](https://docs.pagar.me/reference/facilitadores-de-pagamento-dados-de-subadquirente)
- [API de Disputas (chargeback)](https://docs.pagar.me/reference/disputas)
- [Migração obrigatória da API Stone](https://docs.pagar.me/page/migra%C3%A7%C3%A3o-obrigat%C3%B3ria-da-api-stone)
- [Visão geral do Pagar.me](https://docs.pagar.me/docs/overview-principal)
- [Site oficial Pagar.me](https://www.pagar.me/)
- [Termos de Uso (PDF)](https://www.pagar.me/documentos/termos-de-uso.pdf)
- [Aviso de Privacidade (Stone)](https://docs.stone.com.br/aviso-de-privacidade/)
- [Status do serviço](https://status.pagar.me/)
