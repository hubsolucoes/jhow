# Bling — ficha de integração

> ERP nacional em nuvem · API REST v3 · OAuth 2.0 · consultado em 2026-09-17 · status: **documentado**

## Resumo comercial

**O que é:** ERP em nuvem muito usado por pequenas e médias empresas de varejo e e-commerce: vendas, estoque, emissão fiscal (NF-e, NFC-e, NFS-e), financeiro, logística e integração com marketplaces.

**O que dá para fazer pela API:**
- Ler e gravar contatos (clientes/fornecedores), produtos, estoque por depósito, pedidos de venda e de compra, propostas comerciais.
- Gerar NF-e a partir do pedido, transmitir à SEFAZ (NF-e e NFC-e), consultar e baixar XML/DANFE; criar, emitir e **cancelar NFS-e**.
- Contas a receber e a pagar (criar, alterar, baixar/conciliar), boletos vinculados a vendas, formas de pagamento e plano de contas gerencial.
- Logística personalizada (objetos com rastreio, etiquetas PDF/ZPL, remessas).
- Webhooks assinados para pedidos, produtos, estoque, produto-fornecedor, NF-e e NFC-e.
- Levar tudo para **Excel/Power BI** com o kit (`kit/`): 9 consultas prontas (pedidos, produtos, estoque, contas, notas, contatos, compras, categorias).

**O que não dá (pela API v3 consultada):** cancelar NF-e/NFC-e, carta de correção e inutilização; gerir webhooks por API; sandbox com dados fictícios; webhooks de financeiro/contatos.

**Custo:** a API não é cobrada à parte, mas exige conta Bling ativa (30 dias grátis). Planos são dimensionados por **pedidos importados via marketplace/API por mês** — pedidos criados pela API consomem essa cota. Tabela vista em 17/09/2026 (com promoções): Cobalto R$ 720/ano (até 200 pedidos/mês), Titânio a partir de R$ 1.440/ano (500 a 5.000), Diamante R$ 7.800/ano (até 10.000), Elite sob medida (capacidade de API ampliada). *Valores voláteis — confirme em bling.com.br/planos-e-precos.*

**Prazo típico:** MVP de uma sincronização (OAuth + pedidos/contatos/produtos + webhooks) em ~60 h de desenvolvimento; um painel Power BI com o kit sai em horas, desde que exista uma rotina que renove o token. App público na Central de Extensões exige homologação (prazo não publicado).

**Índice de integrabilidade: 64/100** — API ampla e bem documentada (spec OpenAPI oficial), OAuth moderno e webhooks assinados; perde por não ter sandbox, pelo limite de 3 req/s por conta, pela ausência de client credentials (dificulta BI e robôs) e por lacunas fiscais (cancelar NF-e).

| Componente | Pontos | Justificativa |
|---|---|---|
| documentacao | 16/20 | Spec OpenAPI oficial baixável (257 operações), guias de OAuth, erros, limites, webhooks, homologação e changelog. Perde pontos por lista de escopos não pública, expiração do access_token só por exemplo, URLs de token inconsistentes entre páginas, resposta da revogação não descrita e inconsistências de enum na spec (ex.: situação de NFS-e). |
| sandbox | 4/15 | Não há sandbox com dados fictícios; testes exigem conta real (30 dias grátis). A API de homologação cobre só um produto fictício para o processo de aprovação. |
| autenticacao | 12/15 | OAuth 2.0 com JWT, refresh de 30 dias e revogação granular. Sem client credentials: toda automação depende de autorização interativa e armazenamento de refresh_token; code de 1 minuto. |
| webhooks | 11/15 | HMAC-SHA256 com client_secret, retentativas por até 3 dias, payload versionado. Cobre só 7 recursos (sem financeiro/contatos/NFS-e), configuração apenas pelo painel, sem reenvio manual e com desativação automática após falhas. |
| limites_paginacao | 5/10 | 3 req/s por conta é baixo para cargas reais e as listagens resumidas forçam N+1; paginação por página sem total; janelas de data limitadas a 1 ano. Limites e respostas 429 bem documentados. |
| sdks_comunidade | 6/10 | Sem SDKs oficiais; há coleção Postman/spec e um servidor MCP oficial hospedado. Ecossistema grande de integradores (Central de Extensões), mas bibliotecas de comunidade não foram avaliadas. |
| acesso_sem_barreira | 7/10 | API disponível em qualquer plano e apps privados sem aprovação; exige conta paga após 30 dias e homologação para apps públicos. Pedidos via API contam na cota do plano. |
| versionamento | 3/5 | Versão no path e changelog público por release, mas sem política de depreciação formal; migrações (v2->v3, opaco->JWT) com datas não claramente publicadas. |

## Técnica

### Autenticação
- Somente **OAuth 2.0 authorization code**. App cadastrado em *Central de Extensões > Área do Integrador* (client_id/client_secret, link de redirecionamento, escopos por módulo).
- Autorização: `GET https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=...&state=...` → callback com `code` (1 min, uso único) e `state`.
- Token: `POST https://api.bling.com.br/Api/v3/oauth/token` (form-urlencoded, `Authorization: Basic base64(client_id:client_secret)`, `grant_type=authorization_code|refresh_token`). Resposta: `access_token`, `expires_in` (exemplo oficial 21600), `token_type=Bearer`, `scope` (IDs), `refresh_token` (30 dias).
- **JWT:** envie `enable-jwt: 1` ao obter/renovar e em todas as chamadas; token opaco descontinuado (bloqueio "em definição"). JWT tem 1.500–3.000 caracteres.
- Revogação: `POST https://api.bling.com.br/oauth/revoke` (`token`, `token_type_hint`, `revoke_action=logout|uninstall`, `revoke_target=user|company`).
- Alterar escopos revoga todos os tokens do app. Reusar um `code` revoga o usuário. Empresa inativa não renova.

### Ambientes
- Produção: `https://api.bling.com.br/Api/v3`. **Não há sandbox**: teste numa conta Bling de teste (30 dias grátis). A spec declara `https://developer.bling.com.br/api/bling` como ambiente de teste do console da documentação (uso não documentado).
- Homologação de apps públicos: sequência GET/POST/PUT/PATCH/DELETE em `/homologacao/produtos` repassando o cabeçalho `x-bling-homologacao`, em até 10 s (máx. 2 s entre chamadas), com teste de refresh de token.

### Limites e paginação
- **3 req/s e 120.000 req/dia por conta** (todos os apps somados); 429 `TOO_MANY_REQUESTS` com `limit` e `period`.
- Bloqueio de IP: 300 erros/10 s ou 600 req/10 s (10 min); 20 chamadas a `/oauth/token` em 60 s (60 min).
- Paginação `pagina`/`limite` (padrão 100), sem total: pare na página incompleta. Filtros de período ≤ 1 ano (senão 400).
- Sem idempotência: use `numeroLoja`, `numeroDocumento`, `codigo` como chave externa e consulte antes de criar.

### Webhooks
- Configuração só no painel do app (servidores, recursos, ações, versão v1). Eventos: `order.*`, `product.*`, `stock.*`, `virtual_stock.updated`, `product_supplier.*`, `invoice.*`, `consumer_invoice.*` (`created|updated|deleted`).
- Payload: `eventId`, `date`, `version`, `event`, `companyId`, `data`.
- Assinatura: `X-Bling-Signature-256: sha256=<hex>` = HMAC-SHA256(corpo bruto, client_secret).
- Entrega ok = 2xx em até 5 s; retentativas crescentes por até 3 dias e depois o webhook é desabilitado. Pode duplicar e chegar fora de ordem.

### Erros
Formato `{"error": {"type", "message", "description", "fields": [{"code", "msg", "element", "namespace", "collection"}]}}`. Principais: 400 `VALIDATION_ERROR`/`MISSING_REQUIRED_FIELD_ERROR`/`UNKNOWN_ERROR`, 401 `invalid_token`, 403 `insufficient_scope`, 404 `RESOURCE_NOT_FOUND`, 429 `TOO_MANY_REQUESTS`, 500 `SERVER_ERROR`; na etapa de token: `invalid_client`, `invalid_grant`, "Invalid authorization code", "Empresa inativa".

### Endpoints canônicos detalhados (75)

Coluna PQ = há Power Query M pronto (apenas leituras).

| id | Método e path | Entidade/ação | PQ | Confiança |
|---|---|---|---|---|
| `bling.autenticacao.autenticar.authorize` | GET `/oauth/authorize` | Autenticacao/autenticar | - | verificado |
| `bling.autenticacao.autenticar.token` | POST `/oauth/token` | Autenticacao/autenticar | - | verificado |
| `bling.autenticacao.autenticar.revogar` | POST `/oauth/revoke` | Autenticacao/autenticar | - | inferido |
| `bling.empresa.obter` | GET `/empresas/me/dados-basicos` | Empresa/obter | sim | verificado |
| `bling.pessoa.listar` | GET `/contatos` | Pessoa/listar | sim | verificado |
| `bling.pessoa.obter` | GET `/contatos/{idContato}` | Pessoa/obter | sim | verificado |
| `bling.pessoa.criar` | POST `/contatos` | Pessoa/criar | - | verificado |
| `bling.pessoa.substituir` | PUT `/contatos/{idContato}` | Pessoa/substituir | - | verificado |
| `bling.pessoa.excluir` | DELETE `/contatos/{idContato}` | Pessoa/excluir | - | verificado |
| `bling.pessoa.atualizar.situacao` | PATCH `/contatos/{idContato}/situacoes` | Pessoa/atualizar | - | verificado |
| `bling.produto.listar` | GET `/produtos` | Produto/listar | sim | verificado |
| `bling.produto.obter` | GET `/produtos/{idProduto}` | Produto/obter | sim | verificado |
| `bling.produto.criar` | POST `/produtos` | Produto/criar | - | verificado |
| `bling.produto.substituir` | PUT `/produtos/{idProduto}` | Produto/substituir | - | verificado |
| `bling.produto.atualizar` | PATCH `/produtos/{idProduto}` | Produto/atualizar | - | verificado |
| `bling.produto.excluir` | DELETE `/produtos/{idProduto}` | Produto/excluir | - | verificado |
| `bling.estoque.listar.saldos` | GET `/estoques/saldos` | Estoque/listar | sim | verificado |
| `bling.estoque.listar.saldo_deposito` | GET `/estoques/saldos/{idDeposito}` | Estoque/listar | sim | verificado |
| `bling.deposito.listar` | GET `/depositos` | Deposito/listar | sim | verificado |
| `bling.estoque.criar` | POST `/estoques` | Estoque/criar | - | verificado |
| `bling.estoque.atualizar` | PUT `/estoques/{idEstoque}` | Estoque/atualizar | - | verificado |
| `bling.pedido.listar.venda` | GET `/pedidos/vendas` | Pedido/listar | sim | verificado |
| `bling.pedido.obter.venda` | GET `/pedidos/vendas/{idPedidoVenda}` | Pedido/obter | sim | verificado |
| `bling.pedido.criar.venda` | POST `/pedidos/vendas` | Pedido/criar | - | verificado |
| `bling.pedido.substituir.venda` | PUT `/pedidos/vendas/{idPedidoVenda}` | Pedido/substituir | - | verificado |
| `bling.pedido.excluir.venda` | DELETE `/pedidos/vendas/{idPedidoVenda}` | Pedido/excluir | - | verificado |
| `bling.pedido.atualizar.venda_situacao` | PATCH `/pedidos/vendas/{idPedidoVenda}/situacoes/{idSituacao}` | Pedido/atualizar | - | verificado |
| `bling.nota_fiscal.criar.nfe_de_pedido` | POST `/pedidos/vendas/{idPedidoVenda}/gerar-nfe` | NotaFiscal/criar | - | verificado |
| `bling.pedido.listar.compra` | GET `/pedidos/compras` | Pedido/listar | sim | verificado |
| `bling.pedido.obter.compra` | GET `/pedidos/compras/{idPedidoCompra}` | Pedido/obter | sim | verificado |
| `bling.pedido.criar.compra` | POST `/pedidos/compras` | Pedido/criar | - | verificado |
| `bling.pedido.substituir.compra` | PUT `/pedidos/compras/{idPedidoCompra}` | Pedido/substituir | - | verificado |
| `bling.pedido.excluir.compra` | DELETE `/pedidos/compras/{idPedidoCompra}` | Pedido/excluir | - | verificado |
| `bling.orcamento.listar` | GET `/propostas-comerciais` | Orcamento/listar | sim | verificado |
| `bling.orcamento.obter` | GET `/propostas-comerciais/{idPropostaComercial}` | Orcamento/obter | sim | verificado |
| `bling.orcamento.criar` | POST `/propostas-comerciais` | Orcamento/criar | - | verificado |
| `bling.orcamento.substituir` | PUT `/propostas-comerciais/{idPropostaComercial}` | Orcamento/substituir | - | verificado |
| `bling.orcamento.excluir` | DELETE `/propostas-comerciais/{idPropostaComercial}` | Orcamento/excluir | - | verificado |
| `bling.nota_fiscal.listar.nfe` | GET `/nfe` | NotaFiscal/listar | sim | verificado |
| `bling.nota_fiscal.obter.nfe` | GET `/nfe/{idNotaFiscal}` | NotaFiscal/obter | sim | verificado |
| `bling.nota_fiscal.criar.nfe` | POST `/nfe` | NotaFiscal/criar | - | verificado |
| `bling.nota_fiscal.emitir.nfe` | POST `/nfe/{idNotaFiscal}/enviar` | NotaFiscal/emitir | - | verificado |
| `bling.nota_fiscal.baixar_arquivo.nfe` | GET `/nfe/documento/{chaveAcesso}` | NotaFiscal/baixar_arquivo | sim | verificado |
| `bling.nota_fiscal.listar.nfce` | GET `/nfce` | NotaFiscal/listar | sim | verificado |
| `bling.nota_fiscal.obter.nfce` | GET `/nfce/{idNotaFiscalConsumidor}` | NotaFiscal/obter | sim | verificado |
| `bling.nota_fiscal.criar.nfce` | POST `/nfce` | NotaFiscal/criar | - | verificado |
| `bling.nota_fiscal.emitir.nfce` | POST `/nfce/{idNotaFiscalConsumidor}/enviar` | NotaFiscal/emitir | - | verificado |
| `bling.nota_fiscal.listar.nfse` | GET `/nfse` | NotaFiscal/listar | sim | verificado |
| `bling.nota_fiscal.obter.nfse` | GET `/nfse/{idNotaServico}` | NotaFiscal/obter | sim | verificado |
| `bling.nota_fiscal.criar.nfse` | POST `/nfse` | NotaFiscal/criar | - | verificado |
| `bling.nota_fiscal.emitir.nfse` | POST `/nfse/{idNotaServico}/enviar` | NotaFiscal/emitir | - | verificado |
| `bling.nota_fiscal.cancelar.nfse` | POST `/nfse/{idNotaServico}/cancelar` | NotaFiscal/cancelar | - | verificado |
| `bling.nota_fiscal.excluir.nfse` | DELETE `/nfse/{idNotaServico}` | NotaFiscal/excluir | - | verificado |
| `bling.conta_receber.listar` | GET `/contas/receber` | ContaReceber/listar | sim | verificado |
| `bling.conta_receber.obter` | GET `/contas/receber/{idContaReceber}` | ContaReceber/obter | sim | verificado |
| `bling.conta_receber.criar` | POST `/contas/receber` | ContaReceber/criar | - | verificado |
| `bling.conta_receber.substituir` | PUT `/contas/receber/{idContaReceber}` | ContaReceber/substituir | - | verificado |
| `bling.conta_receber.excluir` | DELETE `/contas/receber/{idContaReceber}` | ContaReceber/excluir | - | verificado |
| `bling.conta_receber.liquidar` | POST `/contas/receber/{idContaReceber}/baixar` | ContaReceber/liquidar | - | verificado |
| `bling.cobranca.listar.boletos` | GET `/contas/receber/boletos` | Cobranca/listar | sim | verificado |
| `bling.conta_pagar.listar` | GET `/contas/pagar` | ContaPagar/listar | sim | verificado |
| `bling.conta_pagar.obter` | GET `/contas/pagar/{idContaPagar}` | ContaPagar/obter | sim | verificado |
| `bling.conta_pagar.criar` | POST `/contas/pagar` | ContaPagar/criar | - | verificado |
| `bling.conta_pagar.substituir` | PUT `/contas/pagar/{idContaPagar}` | ContaPagar/substituir | - | verificado |
| `bling.conta_pagar.excluir` | DELETE `/contas/pagar/{idContaPagar}` | ContaPagar/excluir | - | verificado |
| `bling.conta_pagar.liquidar` | POST `/contas/pagar/{idContaPagar}/baixar` | ContaPagar/liquidar | - | verificado |
| `bling.tabela_auxiliar.listar.formas_pagamento` | GET `/formas-pagamentos` | TabelaAuxiliar/listar | sim | verificado |
| `bling.tabela_auxiliar.obter.forma_pagamento` | GET `/formas-pagamentos/{idFormaPagamento}` | TabelaAuxiliar/obter | sim | verificado |
| `bling.plano_contas.listar` | GET `/categorias/receitas-despesas` | PlanoContas/listar | sim | verificado |
| `bling.plano_contas.obter` | GET `/categorias/receitas-despesas/{idCategoria}` | PlanoContas/obter | sim | verificado |
| `bling.plano_contas.criar` | POST `/categorias/receitas-despesas` | PlanoContas/criar | - | verificado |
| `bling.envio.criar` | POST `/logisticas/objetos` | Envio/criar | - | verificado |
| `bling.envio.obter` | GET `/logisticas/objetos/{idObjeto}` | Envio/obter | sim | verificado |
| `bling.envio.baixar_arquivo.etiquetas` | GET `/logisticas/etiquetas` | Envio/baixar_arquivo | sim | verificado |
| `bling.envio.criar.remessa` | POST `/logisticas/remessas` | Envio/criar | - | inferido |

**Catalogados sem detalhe (185):** TabelaAuxiliar (51), Produto (34), Estoque (19), Pedido (19), Envio (16), NotaFiscal (15), Pessoa (6), Contrato (5), Transacao (5), PlanoContas (3), Mensagem (3), Autenticacao (3), Pagamento (2), Orcamento (2), ContaReceber (1), Documento (1). Incluem anúncios de marketplace, campos customizados, contratos, caixas e bancos, borderôs, grupos/categorias/lotes/variações/estruturas de produto, logísticas e serviços, naturezas de operação, notificações, ordens de produção, situações e transições, vendedores, lançamento/estorno de estoque e contas a partir de pedidos e notas, e a API de homologação.

### Excel / Power BI e kit
- Power Query M pronto em todas as leituras detalhadas; escritas só em Python/TypeScript (o refresh repetiria a operação).
- O Power Query **não renova o token OAuth**: o kit usa um script Python agendado (`cliente.py renovar --excel`) que grava o `AccessToken` na tabela `tbConfig`; para o serviço do Power BI, prefira o script gravando os dados num banco/SharePoint.
- `kit/`: `powerquery/` (Parametros, Parametros_PowerBI, fnApi, 9 consultas, tbConfig), `python/cliente.py`, `typescript/cliente.ts` (OAuth completo, retry, paginação, confirmação de escrita em produção). O refresh não foi testado com a API real (sem credencial de teste).

### Armadilhas
- Só existe OAuth authorization code: integrações 'robôs' e Power BI precisam de um processo que guarde e renove o refresh_token (30 dias).
- code expira em 1 minuto e é de uso único; reutilizar revoga o usuário.
- Header enable-jwt: 1 deve ir na obtenção/renovação e nas chamadas; token opaco está descontinuado e JWT tem até ~3.000 caracteres.
- Limite de 3 req/s por conta, compartilhado entre todos os apps da empresa; listagens resumidas forçam uma chamada por item (N+1) para detalhes.
- Paginação sem total: pare na página incompleta; períodos acima de 1 ano dão 400.
- IDs de situação de pedidos são personalizados por conta; descubra via /situacoes/modulos.
- Sem idempotência: retries cegos duplicam pedidos, lançamentos de estoque e baixas.
- Sem sandbox: testes em conta real, cuidado com emissão fiscal em produção.
- Não há endpoint para cancelar NF-e/NFC-e nem para gerir webhooks via API.
- Formatos de resposta variam (alguns sem envelope data, ex.: proposta obter, boletos, gerar-nfe).
- Pedidos criados via API consomem a cota mensal de pedidos importados do plano.

### Lacunas
- **autenticacao.escopos_permissoes** (medio): A lista de escopos (IDs e nomes por módulo) não está publicada na documentação pública; só aparece na tela do aplicativo.
- **autenticacao.expiracao_token** (medio): Validade do access_token não é declarada em texto; só o exemplo expires_in=21600. Também não está claro se o refresh_token anterior é invalidado após a renovação.
- **autenticacao.urls** (medio): A doc usa https://api.bling.com.br/Api/v3/oauth/token, um exemplo da página de JWT usa https://api.bling.com.br/oauth/token e a spec declara https://bling.com.br/Api/v3/oauth/token. A revogação aparece como /oauth/revoke no host api.bling.com.br, sem /Api/v3; resposta de sucesso não descrita (endpoint marcado inferido).
- **api.politica_versionamento** (baixo): Data oficial de desativação da API v2 não confirmada em página oficial nesta sessão (fontes de terceiros citam 01/08/2024; a página de ajuda oficial retornou conteúdo dinâmico/403). Data de bloqueio do token opaco está 'em definição'.
- **limites.paginacao.tamanho_max** (baixo): Valor máximo aceito para 'limite' não documentado (só o padrão 100).
- **limites.tamanho_max_payload** (baixo): Tamanho máximo de corpo e quantidade máxima de IDs em filtros como idsProdutos[] não documentados.
- **ambiente_testes** (alto): Não há sandbox; o servidor 'ambiente de teste da documentação' (developer.bling.com.br/api/bling) não tem uso documentado.
- **endpoints.nota_fiscal.cancelar** (alto): A referência v3 não tem endpoint de cancelamento, carta de correção ou inutilização de NF-e/NFC-e (só cancelamento de NFS-e). Nem consulta de status separada.
- **webhooks** (medio): Sem API para cadastrar/listar webhooks, sem reenvio manual e sem eventos para financeiro, contatos, NFS-e e propostas. Intervalos exatos das retentativas não publicados.
- **endpoints.envio.criar.remessa** (baixo): Estrutura de objetos[] da remessa e obrigatoriedade de campos somente leitura pouco claras; exemplo inferido.
- **endpoints (schemas)** (baixo): Vários schemas oficiais marcam campos somente leitura (id, situacao, saldo) como obrigatórios e há divergências de enum (situação de NFS-e 0-3 x filtro 1-4; NFC-e filtro até 12). Registrado como está na spec.
- **kit.powerquery** (medio): O refresh da planilha (saida/Bling.xlsx) foi executado em 2026-09-17 apenas com token inválido: todas as 9 consultas chegaram à API e retornaram a mensagem de credencial recusada. O caminho de sucesso (HTTP 200, paginação, tipagem) não foi testado com a API real por falta de credencial de teste. Observação: com HTTP 401/403 o Excel entrega a resposta sem Response.Status (null), por isso o fnApi trata status nulo.
- **comercial.tempo_medio_aprovacao** (baixo): Prazo da revisão de apps públicos não publicado.
- **conformidade.residencia_dados** (baixo): Local de hospedagem dos dados não informado na documentação consultada.
- **fornecedor.razao_social** (baixo): Razão social não confirmada nas páginas consultadas.
- **taxonomia** (baixo): Sugestões de extensão: entidade 'Deposito' (hoje mapeado em Estoque), 'OrdemProducao' (mapeado em Pedido), 'Anuncio' de marketplace (mapeado em Produto) e 'Situacao/Workflow' (mapeado em TabelaAuxiliar); ação 'baixar' (liquidar título) hoje mapeada como Pagamento/criar.

### Fontes
- [Bling API - Introdução e autenticação](https://developer.bling.com.br/bling-api) — consultado em 2026-09-17
- [Aplicativos (cadastro, escopos, OAuth 2.0, refresh, revogação)](https://developer.bling.com.br/aplicativos) — consultado em 2026-09-17
- [Migração para autenticação JWT](https://developer.bling.com.br/migracao-jwt) — consultado em 2026-09-17
- [Limites](https://developer.bling.com.br/limites) — consultado em 2026-09-17
- [Erros comuns](https://developer.bling.com.br/erros-comuns) — consultado em 2026-09-17
- [Boas práticas (paginação, erros, segurança)](https://developer.bling.com.br/boas-praticas) — consultado em 2026-09-17
- [Webhooks](https://developer.bling.com.br/webhooks) — consultado em 2026-09-17
- [Homologação de aplicativos](https://developer.bling.com.br/homologacao) — consultado em 2026-09-17
- [Como testar (Postman)](https://developer.bling.com.br/como-testar) — consultado em 2026-09-17
- [Perguntas frequentes](https://developer.bling.com.br/perguntas-frequentes) — consultado em 2026-09-17
- [MCP Server do Bling](https://developer.bling.com.br/mcp-server) — consultado em 2026-09-17
- [Referência da API (Swagger)](https://developer.bling.com.br/referencia) — consultado em 2026-09-17
- [Spec OpenAPI oficial (3.0.0, versão 3.0)](https://developer.bling.com.br/build/assets/openapi-DKXp8d1e.json) — consultado em 2026-09-17
- [Registro de alterações](https://developer.bling.com.br/changelogs) — consultado em 2026-09-17
- [Planos e preços](https://www.bling.com.br/planos-e-precos) — consultado em 2026-09-17
- [Termos de uso](https://www.bling.com.br/termos-de-uso) — consultado em 2026-09-17
- Monitoramento: https://developer.bling.com.br/changelogs (revisão mensal).
