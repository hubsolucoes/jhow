# SyGeCom — Sagi, SGR, SGR+, Easy

**Slug:** `sygecom` · **Categoria:** `erp_nacional` · **Status:** `documentado`
**Fornecedor:** SYGECOM INFORMATICA LTDA. (CNPJ 07.572.823/0001-30) — Alvorada/RS — <https://sygecom.com.br>
**Índice de integrabilidade:** **39/100** · **Qualidade da doc:** 5/10 · **Consulta:** 2026-09-17

---

## 1. Resumo comercial

### O que é

ERP vertical para **gestão de resíduos e reciclagem**. A linha tem quatro produtos de gestão, do menor para o maior: **Easy** (operação iniciante), **SGR** (recicladora em crescimento), **SGR Plus** (SGR mais o módulo de prestação de serviços, com contratos, rotas e MTR) e **Sagi** (a plataforma completa, que centraliza comercial, transporte, gestão de resíduos, pesagem, estoque, financeiro e fiscal). Em volta deles há **Cloud SyGeCom** (backup e hospedagem), **SRM** (relação com fornecedores), **Portal do Contador** (consulta de notas de entrada, saída e TE com download de XML e DANFE), **LogVerde** (portal integrado ao Sagi, SGR e SGR Plus com histórico de cargas e extratos), **integração com WhatsApp**, **UniSyGe** (treinamento) e **SyGe.ai** (atendimento automatizado a fornecedor via WhatsApp). O app móvel (App Sygecom, Google Play e App Store) é extensão do Sagi e reflete nele o que for feito, conforme as permissões do usuário.

### O que dá para fazer pela API

A API oficial se chama **API SAGI** e atende Sagi e SGR. Pelo recorte de leitura ela entrega, em ordem de valor:

| Bloco | O que sai | Endpoint |
|---|---|---|
| **Pesagem / movimentação** | Boleto de balança com peso bruto, tara, líquido, impureza, preço, valor, produto, categoria, fornecedor/cliente, placa, classificador, comprador, filial e NF | `GET /movimentos` |
| **Estoque** | Saldo por produto e filial numa data, custo médio, reservado, tabela de preços | `GET /produtos` |
| **Cadastros** | Fornecedores (com FEPAM e vencimento), clientes, credores, funcionários, motoristas | `GET /fornecedores`, `GET /clientes` |
| **Comercial** | Pedidos de compra e de venda com itens, abertos ou fechados | `GET /pedido-compra`, `GET /pedido-venda` |
| **Financeiro** | Pagamentos a fornecedor com vale, desconto, acréscimo e condição; saldo por fornecedor | `GET /pagamentos/fornecedores`, `GET /saldo/fornecedores/{id}` |
| **Logística** | Ordens de coleta e embarque com status, placa, motorista, tipo de caminhão | `GET /ordems` |
| **Ambiental** | MTR com tipo de resíduo, origem, acondicionamento, estado físico e quantidade | `GET /mtr` |
| **Exportação** | Contratos com produto/peso/porto/moeda, invoices, containers com lacre e pesos | `GET /contrato`, `GET /invoice`, `GET /container` |
| **Ad hoc** | `SELECT` no banco do tenant, com teto de 1000 registros e 5 s | `POST /sql-query` |

Escrita também existe na API (criar e alterar cliente, fornecedor, produto, ordem, caçamba, motorista, além de alteração de preços em lote e exclusão de ordens), mas está **fora do escopo do executor**, que é somente leitura.

### Custo e prazo

- **Custo:** não publicado. Acesso **sob contrato** — a documentação e a spec são abertas, mas usar depende de ser cliente Sagi/SGR ativo. A API aplica bloqueio comercial no próprio login (`403 TENANT_FINANCIAL_BLOCK` quando a `data_limite` do contrato vence). Se há cobrança adicional para liberar a API, isso **não está publicado**.
- **Liberação:** o passo a passo oficial tem dois passos e é feito dentro do próprio ERP — criar um usuário em *Menu Úteis > Controle de Usuários e Senhas > Cadastro de Usuários*, com senha, com e-mail na aba E-mail e com **"Bloquear Acesso ao SAGI Mobile" desmarcado**. Não há homologação de aplicação, cadastro de parceiro nem aprovação de app.
- **Prazo de MVP:** ~**24 h** para uma extração de leitura completa (login, renovação de token, os quatro estilos de paginação, movimentos, produtos, fornecedores e pedidos por período, normalização e carga em planilha/BI). Não inclui escrita, conciliação fiscal nem múltiplas instalações.

### Índice de integrabilidade — 39/100

| Componente | Peso | Pontos | Por quê |
|---|---:|---:|---|
| Documentação | 20 | 12 | OpenAPI 3.0.1 público com 79 operações e Swagger aberto — muito acima do normal no nicho. Mas metade das operações sem `summary`, schemas de resposta só como `example`, sem guia, sem changelog, sem página de erros. |
| Sandbox | 15 | 6 | Homologação existe (`"homol": true` no login) e o token só vale no ambiente gerado, mas a URL base desse ambiente **não é publicada** e não há self-service. |
| Autenticação | 15 | 7 | JWT Bearer moderno no transporte, mas a credencial é e-mail e senha de **usuário humano do ERP**: sem client_id/secret, sem escopos, sem refresh, sem validade declarada. |
| Webhooks | 15 | 0 | Não existem. Nenhum evento, nenhum callback. |
| Limites e paginação | 10 | 5 | Paginação na maioria das listagens, com alguns tetos declarados — mas **quatro convenções diferentes** convivem e vários endpoints não paginam. Nenhum rate limit publicado. |
| SDKs e comunidade | 10 | 1 | Nenhum SDK, nenhuma coleção pronta, nenhum pacote de comunidade. A orientação oficial é testar no Insomnia. |
| Acesso sem barreira | 10 | 6 | Spec e Swagger legíveis sem login, liberação curta e documentada. A barreira é o contrato, aplicado no login. |
| Versionamento | 5 | 2 | `/api/v1` e `info.version 1.0.0`, sem política de depreciação nem changelog, e com campos condicionados à versão do ERP instalado. |

**Leitura do número:** 39 é baixo em absoluto, mas alto **para a categoria**. A maioria dos ERPs verticais brasileiros deste porte não publica spec nenhuma. O que derruba a nota é estrutural (zero webhook, zero SDK, credencial de pessoa física, sem rate limit publicado), não a ausência de dados: os dados estão lá e são ricos.

---

## 2. Ficha técnica

### Autenticação

| Item | Valor |
|---|---|
| Tipo | JWT Bearer, obtido por login com e-mail e senha |
| Rota de token | `POST https://api.sagierp.com.br/api/v1/login` (corpo `{"email", "password", "origem": "API"}`) |
| Rota alternativa | `POST /auth` — token vem em `user[0].token`, não na raiz |
| Header nas demais rotas | `Authorization: Bearer <token>` |
| Escopos | Não existem. O token enxerga o que o **usuário do ERP** enxerga (`GET /filiais`, `GET /dados-e-permissoes/{iduser}`) |
| Validade | **Não declarada.** O JWT de exemplo em `/auth` sugere 7 dias (`exp − iat = 604800`), mas é inferência sobre um exemplo |
| Renovação | Repetir o login. **Não há refresh token** |
| Outros esquemas na spec | `BasicAuth` e `XSecretAuth` (header `x-secret`) — este último para rotas internas da Sygecom |

### Ambientes

| Ambiente | URL base |
|---|---|
| Produção | `https://api.sagierp.com.br/api/v1` |
| Homologação | **Não publicada.** A spec manda enviar `"homol": true` no login e avisa que o token só funciona no ambiente em que foi gerado — sem dizer qual é |

Em 2026-09-17, `https://api.sygecom.com.br/api/v1` servia a **mesma aplicação e a mesma spec, byte a byte** (mesmo ETag, 397.869 bytes). Adotamos `api.sagierp.com.br` como canônico por ser o host indicado pelo fornecedor ao cliente; confirmar em contrato.

### Limites

- **Rate limit:** não publicado. Não há `429` documentado.
- **Timeouts do servidor:** `POST /sql-query` responde `408` acima de **5 s**; `GET /filiais` responde `408` acima de **10 s**.
- **Tetos de página:** `pageSize` ≤ **500** em `/filiais` e `/sql-query`; `limite_por_pagina` entre **10 e 100** em `/container`; `/sql-query` tem teto global de **1000 registros retornados**. Os demais não declaram teto.
- **Idempotência:** não há header de idempotência.
- **Retry sugerido (autoral):** só em `503` e `408`, backoff exponencial, máximo 3 tentativas. Nunca repetir `4xx`.

### Paginação — quatro convenções

| Convenção | Onde | Observação |
|---|---|---|
| `limit` + `offset` | `/movimentos`, `/clientes/lista`, `/credores` | **`offset` é base 1** em `/movimentos` |
| `limit` + `page` | `/fornecedores` | |
| `limite_por_pagina` + `pagina` | `/mtr`, `/contrato`, `/container`, `/pedido-compra`, `/pedido-venda`, `/invoice`, `/porto`, `/cotacao-moeda`, `/cfop`, `/pais` | Os dois são **obrigatórios** |
| `page` + `pageSize` | `/filiais`, `/sql-query` | Únicos com total de registros |
| **Sem paginação** | `/produtos`, `/ordems`, `/pagamentos/fornecedores`, `/cargas/fornecedores`, `/clientes` | Devolvem tudo que casar com o filtro |

### Webhooks

**Não existem.** Nenhuma rota de assinatura, nenhum evento, nenhuma menção a callback nas 79 operações. Sincronização é **polling por janela de data**, tipicamente `GET /movimentos` com sobreposição de 24–48 h para capturar correções de boleto.

### Erros

Três formatos convivem:

1. `{"error": [{"path", "message", "errorCode"}]}` — rotas validadas pelo middleware OpenAPI (`required.openapi.validation`, `format.openapi.validation`).
2. `{"errors": [{"path", "message", "errorCode"}]}` — rotas mais novas (`/filiais`, `/sql-query`), com `ValidationError`, `AuthenticationError`, `TimeoutError`, `InternalError`, `ExecutionError`.
3. `{"error": "texto"}` — rotas simples (`/mtr`, `/contrato`, `/invoice`).

| Status | Significado |
|---|---|
| `204` | **Sem registros** — não é erro. Corpo vazio; não chame `.json()` |
| `400` | Validação: data fora de `AAAA-MM-DD`, obrigatório ausente, `pageSize` acima do teto, ou, em `/sql-query`, comando não-`SELECT` |
| `401` | Token ausente/inválido, ou usuário não encontrado no login |
| `403` | `TENANT_FINANCIAL_BLOCK` — pendência financeira do contrato. Traz `code`, `data_limite` e `traceId` |
| `408` | Timeout do servidor (5 s em `/sql-query`, 10 s em `/filiais`) |
| `500` | Erro interno; em `/sql-query` devolve a mensagem do banco |
| `503` | "Falha no servidor do cliente" — a instalação do cliente não respondeu |

### Endpoints canônicos detalhados

| ID canônico | Método e path | Entidade / ação | Executável |
|---|---|---|:--:|
| `sygecom.autenticacao.autenticar` | `POST /login` | Autenticacao / autenticar | não |
| `sygecom.autenticacao.autenticar.app` | `POST /auth` | Autenticacao / autenticar | não |
| `sygecom.empresa.listar` | `GET /filiais` | Empresa / listar | sim |
| `sygecom.estoque.listar.movimentos` | `GET /movimentos` | Estoque / listar | sim |
| `sygecom.produto.listar` | `GET /produtos` | Produto / listar | sim |
| `sygecom.fornecedor.listar` | `GET /fornecedores` | Fornecedor / listar | sim |
| `sygecom.cliente.listar` | `GET /clientes` | Cliente / listar | sim |
| `sygecom.pedido.listar.venda` | `GET /pedido-venda` | Pedido / listar | sim |
| `sygecom.pedido.listar.compra` | `GET /pedido-compra` | Pedido / listar | sim |
| `sygecom.conta_pagar.listar.pagamentos_fornecedor` | `GET /pagamentos/fornecedores` | ContaPagar / listar | sim |
| `sygecom.fornecedor.obter.saldo` | `GET /saldo/fornecedores/{id}` | Fornecedor / obter | sim |
| `sygecom.estoque.listar.cargas_fornecedor` | `GET /cargas/fornecedores` | Estoque / listar | sim |
| `sygecom.envio.listar.ordens_coleta` | `GET /ordems` | Envio / listar | sim |
| `sygecom.documento.listar.mtr` | `GET /mtr` | Documento / listar | sim |
| `sygecom.contrato.listar` | `GET /contrato` | Contrato / listar | sim |
| `sygecom.tabela_auxiliar.listar.sql` | `POST /sql-query` | TabelaAuxiliar / listar | sim |

Outras **63 operações** ficam em `endpoints.json > endpoints_secundarios` — domínios auxiliares (CFOP, países, portos, moedas, regiões, tipos), cadastros secundários (credores, funcionários, motoristas, ativos, caçambas, favorecidos), exportação (invoice, container) e **todas as operações de escrita**.

---

## 3. Armadilhas

1. **Quatro paginações diferentes.** Um paginador genérico único quebra. Ver a tabela acima.
2. **`offset` base 1 em `/movimentos`.** `offset=1` com `limit=10` devolve os dez primeiros.
3. **`204` no lugar de lista vazia.** `response.json()` direto quebra no caso mais comum do dia a dia.
4. **Endpoints sem paginação** devolvem a base inteira: `/produtos`, `/ordems`, `/pagamentos/fornecedores`, `/cargas/fornecedores`, `/clientes`.
5. **Obrigatórios com valor neutro.** Em `/ordems`, `codforcli`, `codmot`, `sr_recno` e `ordem` são obrigatórios e precisam ir com `0`, e `forcli` com `TODOS`. Em `/pagamentos/fornecedores` e `/cargas/fornecedores`, `codfor=0`.
6. **`results` vs. `response`.** `/pedido-compra` devolve a lista em `results`; `/pedido-venda`, em `response`.
7. **Nomes inconsistentes entre cadastros.** CNPJ do fornecedor vem em `cgc`; o do cliente, em `cpf_cnpj`. Razão social do fornecedor vem em `fornecedor`.
8. **Chave de produto é composta** (`codpro` + `subcod`). Juntar só por `codpro` mistura qualidades do mesmo material.
9. **Unidades misturadas.** `peso_liquido` vem na unidade do produto (`TN`, `KG`...). Somar sem agrupar por `unidade` produz número sem sentido. O mesmo vale para as quatro quantidades do MTR (`kg`, `ton`, `m3`, `litro`).
10. **MTR é um monte de boolean.** Tipo de resíduo, origem, acondicionamento e estado físico são ~24 campos booleanos independentes, vários podendo estar marcados no mesmo manifesto.
11. **O token é de uma pessoa, não de uma aplicação.** Dois tokens diferentes devolvem resultados diferentes para a mesma consulta. Carimbe toda extração com o resultado de `GET /filiais`.
12. **`403 TENANT_FINANCIAL_BLOCK` é contrato vencido**, não erro de integração. Não faça retry.
13. **`503` é a instalação do cliente fora do ar**, não a API com defeito.
14. **Campos condicionados à versão do ERP** (ex.: `CIDADE_IBGE` exige 9.4.0+). A superfície real varia por cliente.
15. **`/clientes` e `/clientes/lista` não são a mesma coisa.** A segunda devolve conferência de laudo de boleto.
16. **Datas só em `AAAA-MM-DD`.** Qualquer outro formato devolve `400 format.openapi.validation`.
17. **`/sql-query` alcança o banco inteiro.** Nunca `SELECT *`; a rota chega a tabelas com dado pessoal que os endpoints REST filtram. E não repasse a mensagem de erro crua do banco ao usuário final.
18. **Sem webhook e sem rate limit publicado**: dimensione o polling com conservadorismo, porque quem sofre é a instalação do cliente.

---

## 4. Conformidade

- **Dado pessoal:** sim. CPF/CNPJ, nome, endereço, telefone e e-mail de fornecedores, clientes, credores e motoristas; e, nas rotas de `/funcionarios`, CPF, RG, PIS, data de nascimento, admissão e demissão de trabalhadores.
- **Dado sensível:** não identificado nas rotas detalhadas.
- **Base legal típica:** execução de contrato e cumprimento de obrigação legal/regulatória (LGPD art. 7º, V e II).
- **Encarregado (DPO):** `compliance@sygecom.com.br` (contato corporativo publicado na política de privacidade, não dado pessoal).
- **Certificado digital:** não exigido pela API.
- **Lastro regulatório do dado:** MTR e cadastro FEPAM aparecem nos schemas. O MTR é instrumento do SINIR e dos órgãos estaduais — mas **a API não consulta o SINIR**, apenas expõe o que está registrado no ERP.
- **Termos de uso de API:** **não existem publicados.** A página oficial de liberação já teve um passo de *"Contrato de Consentimento para Compartilhamento de Dados"* (Menu Úteis > Integração com outros sistemas), hoje comentado no HTML da página. Isso é leitura de código-fonte, não uma revogação declarada. **Antes de expor dados do cliente em produto de terceiro, obter posição por escrito da Sygecom.**
- `permite_uso_em_produto_terceiro`: **indefinido**.

---

## 5. Lacunas

| Campo | Lacuna | Impacto |
|---|---|---|
| Sandbox | URL base de homologação não publicada, embora o mecanismo (`"homol": true`) exista | **alto** |
| URL de produção | Não está publicado se toda instalação Sagi/SGR atende pelo mesmo host, ou se instalação própria tem host distinto | **alto** |
| Termos de uso | Sem termos de API; status do contrato de consentimento indefinido | **alto** |
| Rate limit | Nenhum limite, janela ou burst publicado; sem `429` documentado | médio |
| Validade do token | Não declarada; 7 dias é inferência sobre um exemplo | médio |
| `security` da spec | 11 operações não declaram bloco `security` e a spec não define `security` global — provável omissão de escrita da spec, não rota aberta. Documentadas como Bearer, com `confianca: inferido`, sem teste sem credencial | médio |
| Webhooks | Não existem | médio |
| Schemas de resposta | `/produtos`, `/fornecedores`, `/clientes` e `/ordems` descrevem a resposta apenas como `example`, sem tipagem contratada | médio |
| Esquema do banco | O dicionário de dados só existe como PDF de ~8 MB, o que subaproveita `/sql-query` | médio |
| Tetos de página | Só `/filiais`, `/sql-query` e `/container` declaram máximo | baixo |
| Taxonomia | Falta entidade própria para **pesagem/movimentação** (mapeada em `Estoque`) e para **manifesto de resíduo** (mapeado em `Documento`) | baixo |

---

## 6. Monitoramento

- **Changelog:** não existe. **Canal de breaking changes:** não existe.
- **Como acompanhar:** baixar periodicamente `https://api.sagierp.com.br/api/v1/spec` e comparar o hash. A spec expõe dois sinais: `info.description` carrega uma data (em 2026-09-17, `18/03/2026`) e a resposta traz `ETag` e `Last-Modified`.
- **Frequência sugerida:** trimestral.
- **Suporte:** <https://sygecom.com.br/contato-suporte/> · telefone e WhatsApp (51) 3442-2345 · seg–sex, 8h30–12h e 13h–18h · Rua Artur Garcia, 271 — Bela Vista — Alvorada/RS. Há **Política de SLA** publicada em <https://sygecom.com.br/compliance/politica-de-sla/>.

---

## 7. Fontes

| Fonte | URL | Consulta |
|---|---|---|
| Spec OpenAPI 3.0.1 oficial da API SAGI (79 operações) | <https://api.sagierp.com.br/api/v1/spec> | 2026-09-17 |
| Swagger UI oficial | <https://api.sagierp.com.br/api-explorer/> | 2026-09-17 |
| Passo a passo oficial de liberação da API | <https://sagierp.com.br/doc_api/> | 2026-09-17 |
| Dicionário de Dados SAGI/SGR (PDF, `externalDocs` da spec) | <https://sagierp.com.br/devel/uteis/sagi_dicionario_dados.pdf> | 2026-09-17 |
| Soluções SyGeCom (Easy, SGR, SGR+, Sagi, Cloud, SRM, Portal do Contador, LogVerde, WhatsApp, UniSyGe, SyGe.ai) | <https://sygecom.com.br/solucoes/> | 2026-09-17 |
| `llms.txt` oficial | <https://sygecom.com.br/llms.txt> | 2026-09-17 |
| Contato e suporte | <https://sygecom.com.br/contato-suporte/> | 2026-09-17 |
| Política de Privacidade (razão social, CNPJ, DPO) | <https://sygecom.com.br/compliance/politica-de-privacidade/> | 2026-09-17 |
| Política de SLA | <https://sygecom.com.br/compliance/politica-de-sla/> | 2026-09-17 |
| App Sygecom — Google Play | <https://play.google.com/store/apps/details?id=com.sygecom> | 2026-09-17 |
| App Sygecom — App Store | <https://apps.apple.com/br/app/app-sygecom/id6633436754> | 2026-09-17 |

---

## 8. Kit Power Query

**Não produzido.** Kits estão em standby por decisão de 2026-09-17 (serviço premium futuro). Os snippets `power_query_m` dos endpoints de leitura em `endpoints.json` já cobrem o caso de uso de BI: base fixa em `Web.Contents` com `RelativePath`, paginação com `List.Generate`, tratamento de `204` e de erro via `ManualStatusHandling` e `Record.FieldOrDefault`, e token como parâmetro do Power Query — nunca fixo no código.
