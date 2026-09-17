# NFE.io — ficha do catálogo

**Slug:** `nfe-io` · **Categoria:** `fiscal_gateway` · **Status:** documentado
**Data da consulta:** 2026-09-17 · **Índice de integrabilidade:** 69/100 · **Qualidade da documentação:** 9/10
**Revisão sugerida:** mensal — fiscal muda rápido, e a Reforma Tributária está em transição.

---

## 1. Resumo comercial

### O que dá para fazer

A NFE.io é um gateway fiscal que cobre três frentes:

1. **Emissão** de NFS-e (nota de serviço municipal), NF-e (modelo 55), NFC-e (modelo 65) e Declaração de Conteúdo Eletrônica (DC-e).
2. **Recepção** de documentos emitidos contra o CNPJ do cliente — NF-e, CT-e e NFS-e — pela distribuição da SEFAZ e pelo Ambiente Nacional, com manifestação do destinatário.
3. **Consultas** cadastrais vendidas como produto: CNPJ na Receita Federal, situação de CPF, endereço por CEP e NF-e de terceiros pela chave de acesso.

Ainda há um motor de cálculo de tributos e um cadastro de produtos com customização tributária, vendidos à parte.

A origem da empresa é a NFS-e municipal, e é ali que ela tem a maior profundidade: cálculo automático de imposto a partir do código de serviço, cenários documentados um a um (exportação, cliente não identificado, construção civil, locação, imóveis, retenções) e uma página pública de prefeituras integradas.

### O que NÃO tem

**CT-e, MDF-e e NFCom de emissão não aparecem na plataforma.** CT-e existe apenas do lado de recepção (captura de conhecimentos de transporte emitidos contra o cliente). Transportadora que precisa emitir CT-e e encerrar MDF-e não se resolve aqui — é o principal recorte em relação à concorrência.

### Custo (volátil — confira na página de planos)

| Plano NFS-e | Mensal | Notas incluídas |
|---|---|---|
| Base | R$ 190 | até 250 |
| Growth | R$ 265 | até 500 |
| Scale | R$ 375 | até 1.000 |

Semestral com 10% de desconto e anual com 20% (há um plano anual Initial de R$ 1.075 para até 100 notas, limitado a 2 CNPJs). Enterprise sob consulta. Todos incluem API, emissão em lote por planilha, armazenamento por 11 anos e cálculo automático de imposto.

**Buracos de preço:** a página não publica valor de NF-e, NFC-e, captura fiscal, consultas cadastrais nem o preço da nota excedente. A captura fiscal é cobrada **por documento capturado** — e reposicionar o cursor de NSU recaptura e **recobra** o histórico.

### Prazo estimado

**MVP de NFS-e: ~55 horas.** Premissa: um SaaS ou ERP que já tem os dados do serviço corretos, emitindo para uma empresa em um município, com cadastro (empresa + inscrição municipal + certificado), emissão, consulta por `externalId`, cancelamento, download de PDF/XML e webhook assinado. É julgamento do analista, não número do fornecedor.

NF-e acrescenta o dado fiscal de produto (NCM, CFOP, CST/CSOSN, bases) e o credenciamento na SEFAZ: some 40 a 60 h. NFC-e acrescenta CSC e contingência.

### Índice de integrabilidade — 69/100

| Componente | Peso | Pontos | Por quê |
|---|---:|---:|---|
| Documentação | 20 | 18 | 15 specs OpenAPI oficiais baixáveis, `llms.txt` e `llms-full.txt` por produto, `index.md` em toda página, catálogo de webhooks com payloads reais. Perde por divergências entre spec e páginas-guia. |
| Sandbox | 15 | 11 | Conta self-service; NFS-e testa sem certificado. Perde porque não há host de sandbox e NF-e/NFC-e exigem certificado mesmo em homologação. |
| Autenticação | 15 | 6 | Chave estática, sem OAuth2, sem escopo por endpoint, sem rotação por API — e são duas chaves com roteamento por host. |
| Webhooks | 15 | 12 | HMAC-SHA1 com secret próprio, cabeçalhos de deduplicação, CRUD com ping de teste, IPs publicados, reenvio manual. Perde porque a grade de reentrega da emissão não é publicada. |
| Limites e paginação | 10 | 5 | Três estilos de paginação, `limit` padrão 10 em NF-e/NFC-e e rate limit sem valor numérico. |
| SDKs e comunidade | 10 | 6 | SDK Node.js v3 em TypeScript, sem dependências e bem documentado; PHP e Ruby sem a mesma profundidade. |
| Acesso sem barreira | 10 | 7 | Self-service e preço público — só para NFS-e. |
| Versionamento | 5 | 4 | Versão no caminho, release notes datadas, política "recomendada x legada" e guia de migração. |

---

## 2. Comparação com a Focus NFe (concorrente direto)

As duas vendem a mesma promessa — "emita nota fiscal por API" — mas resolvem problemas diferentes.

| Dimensão | **NFE.io** | **Focus NFe** |
|---|---|---|
| **Cobertura de documentos** | NFS-e, NF-e, NFC-e, DC-e. Recepção de NF-e, CT-e e NFS-e. **Não emite CT-e, MDF-e nem NFCom.** | NF-e, NFC-e, NFS-e, NFS-e Nacional, **CT-e, CT-e OS, MDF-e, NFCom**, DC-e, além de recepção de NF-e e CT-e. |
| **Foco histórico** | NFS-e municipal, com cálculo automático de imposto pelo código de serviço. | Amplitude: cobre a malha inteira de documentos, incluindo transporte. |
| **Modelo de preço** | Entrada R$ 190/mês com 250 notas; sem preço público de NF-e, NFC-e, captura e consultas; captura cobrada por documento. | Entrada R$ 89,90/mês com 100 notas e R$ 0,10 por nota adicional; plano Retail para NFC-e a partir de R$ 59,90; preços públicos por linha. |
| **Autenticação** | Chave estática no header `Authorization`, **duas chaves** (Dados e Nota Fiscal) com roteamento por host. | Token estático via HTTP Basic (token no lugar do usuário, senha vazia), **um token por ambiente**. |
| **Ambientes** | Sem host de sandbox: ambiente é atributo da inscrição municipal/estadual. | **Hosts separados** (`homologacao.focusnfe.com.br` e `api.focusnfe.com.br`) — mais difícil errar. |
| **Webhooks** | **Assinatura HMAC-SHA1** (`X-Hub-Signature`), `X-Hook-Id` para deduplicação, IPs publicados, ping de teste, catálogo de eventos com payloads reais. **Grade de reentrega não publicada.** | **Sem HMAC** — só um cabeçalho fixo configurável. Em compensação, **grade de reentrega documentada** (1 min, 30 min, 1 h, 3 h e 24 h) e reenvio manual por endpoint. |
| **Rate limit** | **Não publicado** (só a distribuição expõe cabeçalhos `X-RateLimit-*`). | **100 requisições/min por token**, com cabeçalhos `Rate-Limit-*`. |
| **Cálculo de tributos** | NFS-e calcula automaticamente pelo código de serviço; há motor de cálculo para produto (produto à parte). | **Não calcula**: CST/CSOSN, bases e alíquotas têm de vir corretos do sistema do cliente. |
| **Documentação** | Specs OpenAPI oficiais baixáveis, `llms.txt`/`llms-full.txt`, `index.md` por página, página dedicada a agentes de IA. | Portal ReadMe com OpenAPI por página, `llms.txt` e site de campos por documento; specs parciais para CT-e/MDF-e. |
| **Índice do catálogo** | **69** | **67** |

### Como escolher

- **Empresa de serviço, SaaS, software house, clínica, agência** → NFE.io. O cálculo automático de ISS pelo código de serviço e a profundidade de cenários municipais economizam semanas.
- **Transportadora, operador logístico, indústria com frota** → Focus NFe. CT-e e MDF-e são requisito, e a NFE.io não emite.
- **Varejo com volume alto de NFC-e e orçamento apertado** → Focus NFe tende a sair mais barato na entrada (plano Retail, preço por nota excedente publicado).
- **Quem recebe muita nota de fornecedor e precisa manifestar no prazo** → NFE.io tem a captura fiscal mais bem documentada das duas, com NFS-e recebida (Ambiente Nacional), OData, exportação em massa e CSV analítico.
- **Quem precisa de segurança forte no webhook** → NFE.io, pela assinatura HMAC. Na Focus NFe, a validação de origem fica por conta de um cabeçalho fixo.
- **Quem precisa dimensionar carga antes de contratar** → Focus NFe publica o limite; na NFE.io é preciso perguntar.

**Facilidade de integração, na prática:** a Focus NFe é mais simples de começar (um token, dois hosts óbvios, preço na página). A NFE.io é mais difícil no primeiro dia — duas chaves, seis hosts, três estilos de paginação — e mais confortável depois, porque a documentação é melhor, tem spec OpenAPI para gerar cliente e cobre os cenários fiscais com muito mais detalhe.

---

## 3. Técnica

### 3.1 Autenticação

Chave estática no cabeçalho `Authorization`, **sem prefixo** (não é `Bearer`, não é `Basic`), sem endpoint de login e sem expiração. A conta tem **duas chaves**:

| Chave | Hosts | Para quê |
|---|---|---|
| **Chave de Dados** | `legalentity.api.nfe.io`, `naturalperson.api.nfe.io`, `address.api.nfe.io`, `nfe.api.nfe.io` | Consultas de CNPJ, CPF, CEP e NF-e de terceiros |
| **Chave de Nota Fiscal** | `api.nfe.io`, `api.nfse.io` | Emitir, cadastrar empresa, certificado, inscrições, webhooks, distribuição |

Regra mnemônica da própria documentação: **subdomínio antes de `api.nfe.io` → Chave de Dados; produto no caminho → Chave de Nota Fiscal.**

Na captura fiscal existem papéis: `Nota Fiscal (api.nfe.io)`, `NFSeDist (dfe.nfe.io)` e `Management` (só para os endpoints de manutenção).

> **Testado em 2026-09-17 (2 chamadas com credencial inválida, dentro do limite da regra 2.1):** o `401` vem com **corpo vazio** (`Content-Length: 0`), cabeçalho `www-authenticate: Bearer` e `x-request-id`. Não há JSON de erro para exibir — trate pelo status e guarde o `x-request-id`. Nenhum cabeçalho `X-RateLimit-*` voltou nessas rotas.

### 3.2 Hosts

| Host | Produto |
|---|---|
| `https://api.nfe.io` | NFS-e (emissão, consulta, cancelamento, PDF/XML) e a API legada `/v1/companies` |
| `https://api.nfse.io` | NF-e, NFC-e, empresas, certificados, inscrições, webhooks, cálculo de tributos, captura fiscal |
| `https://legalentity.api.nfe.io` | Consulta de CNPJ (v3 recomendada) |
| `https://naturalperson.api.nfe.io` | Consulta de CPF |
| `https://address.api.nfe.io` | Consulta de endereço/CEP |
| `https://nfe.api.nfe.io` | Consulta de NF-e na SEFAZ por chave de acesso |

**`api.nfe.io` e `api.nfse.io` diferem por uma letra e servem produtos distintos.** É a confusão mais cara da plataforma.

### 3.3 Ambientes

Não existe host de sandbox. O ambiente é atributo do cadastro:

- **NFS-e** → campo `Environment` da **Inscrição Municipal** (`Development` ou `Production`). No ambiente de testes a NFE.io simula a prefeitura em servidor próprio, e **certificado é dispensado**.
- **NF-e / NFC-e** → campo `environmentType` da **Inscrição Estadual** (`Test` ou `Production`). O ambiente de homologação da SEFAZ é o órgão real, então **certificado A1 é obrigatório mesmo para testar**. NFC-e exige CSC.

Consequência para leitura de dados: uma listagem sem filtro pode misturar nota de teste com nota real. Em NF-e o parâmetro `environment` é obrigatório; em NFC-e é opcional; em NFS-e não há filtro — cada registro traz `environment` e a separação fica do lado do consumidor.

### 3.4 Limites e paginação

**Rate limit:** publicado apenas para a distribuição de documentos recebidos, com `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` e `429` no estouro. **O valor numérico não é divulgado em lugar nenhum.**

**Três estilos de paginação convivem:**

| Família | Estilo | Parâmetros | Fim |
|---|---|---|---|
| NFS-e, `/v1/companies` | Página | `pageIndex` (1-based) + `pageCount` | `page == totalPages` |
| NF-e, NFC-e, Contribuintes v2 | Cursor | `startingAfter` + `limit` (**padrão 10**) | `hasMore == false` |
| NFS-e Inbound | Página | `pageIndex` + `pageCount` (máx 100) | página incompleta |
| Distribuição DFe | OData | `$filter` (**obrigatório**) + `$top` (máx 1000) + `$skiptoken` | sem `@odata.nextLink` |

Para **sincronização** (não relatório), a documentação é enfática: filtre por NSU (`nsuBegin` na NFS-e, `nsu gt` no OData), nunca por posição de página — documentos novos durante a varredura fazem páginas mudarem de tamanho.

### 3.5 Webhooks

- **Assinatura:** HMAC-SHA1 sobre os **bytes crus** do corpo, com um `secret` de 32 a 64 caracteres, no cabeçalho `X-Hub-Signature` (`sha1=<hex>`). Na captura fiscal o cabeçalho vem em minúsculas; integrações legadas recebem também `X-NFEIO-Signature` em base64.
- **Cabeçalhos:** `X-Hook-Event` (tipo), `X-Hook-Id` (deduplicação), `X-Hook-Attempts`.
- **Entrega:** at-least-once, com reenvio quando a resposta sai da faixa 2xx. **A grade de tentativas não é publicada.**
- **IPs de origem:** `34.44.243.117`, `40.78.80.242`, `20.237.231.30`, `104.45.219.39` — camada adicional, não substitui a assinatura.
- **Dois envelopes:** NFS-e chega em `{"payload": {...}}`; NF-e, NFC-e e os eventos de entrada chegam **achatados na raiz**. Normalize com `body.payload ?? body`.
- **Reenvio manual:** `POST .../inbound/nfse/{id}/resend-webhook` e `POST .../inbound/productinvoices/{access_key_or_nsu}/processwebhook`.

### 3.6 Formato de erro

```json
{ "errors": [ { "code": 404, "message": "Document not found for the given access key." } ] }
```

Vale para emissão (NFS-e v1, NF-e/NFC-e v2), Contribuintes v2 e distribuição. **Exceções:** as consultas em `nfe.api.nfe.io` devolvem *string simples* em 400/404/500, e o `401` de toda a plataforma vem **sem corpo**.

**Rejeição fiscal não é erro HTTP.** A emissão responde `202` e o resultado real aparece depois em `flowStatus`/`flowMessage` (NFS-e) ou `status` + `lastEvents.events[]` (NF-e/NFC-e), ou chega por webhook.

### 3.7 Endpoints canônicos detalhados (43)

| id | Método | Path | Host | Executável |
|---|---|---|---|---|
| `nfe-io.nota_fiscal.listar.nfse` | GET | `/v1/companies/{company_id}/serviceinvoices` | api.nfe.io | ✅ |
| `nfe-io.nota_fiscal.obter.nfse` | GET | `/v1/companies/{company_id}/serviceinvoices/{id}` | api.nfe.io | ✅ |
| `nfe-io.nota_fiscal.obter.nfse_externo` | GET | `/v1/companies/{company_id}/serviceinvoices/external/{id}` | api.nfe.io | ✅ |
| `nfe-io.nota_fiscal.emitir.nfse` | POST | `/v1/companies/{company_id}/serviceinvoices` | api.nfe.io | ❌ |
| `nfe-io.nota_fiscal.cancelar.nfse` | DELETE | `/v1/companies/{company_id}/serviceinvoices/{id}` | api.nfe.io | ❌ |
| `nfe-io.nota_fiscal.baixar_arquivo.nfse_pdf` | GET | `/v1/companies/{company_id}/serviceinvoices/{id}/pdf` | api.nfe.io | ✅ |
| `nfe-io.nota_fiscal.baixar_arquivo.nfse_xml` | GET | `/v1/companies/{company_id}/serviceinvoices/{id}/xml` | api.nfe.io | ✅ |
| `nfe-io.nota_fiscal.enviar.nfse_email` | PUT | `/v1/companies/{company_id}/serviceinvoices/{id}/sendemail` | api.nfe.io | ❌ |
| `nfe-io.nota_fiscal.listar.nfe` | GET | `/v2/companies/{companyId}/productinvoices` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.obter.nfe` | GET | `/v2/companies/{companyId}/productinvoices/{invoiceId}` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.emitir.nfe` | POST | `/v2/companies/{companyId}/productinvoices` | api.nfse.io | ❌ |
| `nfe-io.nota_fiscal.cancelar.nfe` | DELETE | `/v2/companies/{companyId}/productinvoices/{invoiceId}` | api.nfse.io | ❌ |
| `nfe-io.nota_fiscal.listar.eventos_nfe` | GET | `/v2/companies/{companyId}/productinvoices/{invoiceId}/events` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.baixar_arquivo.nfe_xml` | GET | `/v2/companies/{companyId}/productinvoices/{invoiceId}/xml` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.baixar_arquivo.nfe_pdf` | GET | `/v2/companies/{companyId}/productinvoices/{invoiceId}/pdf` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.corrigir.nfe` | PUT | `/v2/companies/{companyId}/productinvoices/{invoiceId}/correctionletter` | api.nfse.io | ❌ |
| `nfe-io.nota_fiscal.listar.nfce` | GET | `/v2/companies/{companyId}/consumerinvoices` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.emitir.nfce` | POST | `/v2/companies/{companyId}/consumerinvoices` | api.nfse.io | ❌ |
| `nfe-io.nota_fiscal.baixar_arquivo.nfce_pdf` | GET | `/v2/companies/{companyId}/consumerinvoices/{invoiceId}/pdf` | api.nfse.io | ✅ |
| `nfe-io.empresa.listar` | GET | `/v2/companies` | api.nfse.io | ✅ |
| `nfe-io.empresa.obter` | GET | `/v2/companies/{company_id}` | api.nfse.io | ✅ |
| `nfe-io.empresa.criar` | POST | `/v2/companies` | api.nfse.io | ❌ |
| `nfe-io.empresa.listar.certificados` | GET | `/v2/companies/{company_id}/certificates` | api.nfse.io | ✅ |
| `nfe-io.empresa.criar.certificado` | POST | `/v2/companies/{company_id}/certificates` | api.nfse.io | ❌ |
| `nfe-io.empresa.listar.inscricoes_municipais` | GET | `/v2/companies/{company_id}/municipaltaxes` | api.nfse.io | ✅ |
| `nfe-io.webhook.listar` | GET | `/v2/webhooks` | api.nfse.io | ✅ |
| `nfe-io.webhook.assinar_webhook` | POST | `/v2/webhooks` | api.nfse.io | ❌ |
| `nfe-io.webhook.excluir` | DELETE | `/v2/webhooks/{webhook_id}` | api.nfse.io | ❌ |
| `nfe-io.tabela_auxiliar.listar.tipos_evento` | GET | `/v2/webhooks/eventtypes` | api.nfse.io | ✅ |
| `nfe-io.pessoa.obter.cnpj` | GET | `/v3/legalentities/basicInfo/{federalTaxNumber}` | legalentity | ✅ |
| `nfe-io.pessoa.consultar_status.cpf` | GET | `/v1/naturalperson/status/{federalTaxNumber}/{birthDate}` | naturalperson | ✅ |
| `nfe-io.endereco.obter.cep` | GET | `/v2/addresses/{postalCode}` | address | ✅ |
| `nfe-io.endereco.listar` | GET | `/v2/addresses/{term}` | address | ✅ |
| `nfe-io.nota_fiscal.obter.sefaz_chave` | GET | `/v2/productinvoices/{accessKey}` | nfe.api | ✅ |
| `nfe-io.nota_fiscal.listar.eventos_sefaz` | GET | `/v2/productinvoices/events/{accessKey}` | nfe.api | ✅ |
| `nfe-io.empresa.criar.inbound_nfe` | POST | `/v2/companies/{company_id}/inbound/productinvoices` | api.nfse.io | ❌ |
| `nfe-io.empresa.obter.inbound_nfe` | GET | `/v2/companies/{company_id}/inbound/productinvoices` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.listar.inbound_nfe` | GET | `/v2/companies/{company_id}/inbound/odata/ProductInvoices` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.obter.inbound_nfe` | GET | `/v2/companies/{company_id}/inbound/productinvoices/{access_key}` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.baixar_arquivo.inbound_xml` | GET | `/v2/companies/{company_id}/inbound/{access_key}/xml` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.manifestar.inbound_nfe` | POST | `/v2/companies/{company_id}/inbound/{access_key}/manifest` | api.nfse.io | ❌ |
| `nfe-io.nota_fiscal.listar.inbound_nfse` | GET | `/v2/companies/{companyId}/inbound/nfse` | api.nfse.io | ✅ |
| `nfe-io.nota_fiscal.obter.inbound_nfse` | GET | `/v2/companies/{companyId}/inbound/nfse/{id}` | api.nfse.io | ✅ |

Outras **142 operações** ficam em `endpoints_secundarios[]`: CT-e Inbound completo, DC-e, eventos de autoridade da RTC, notas de crédito e débito, inutilização, inscrições estaduais, responsável técnico e CSRT, motor de cálculo, cadastro de produtos e toda a manutenção da captura fiscal.

**Somente leitura executável:** o assistente executa apenas os 30 endpoints marcados com ✅. Emissão, cancelamento, carta de correção, manifestação, upload de certificado, cadastro de empresa e webhook e ativação da captura são escrita: o assistente explica e entrega o código, mas quem executa é o cliente.

### 3.8 Armadilhas

1. **`api.nfe.io` × `api.nfse.io`** — uma letra separa NFS-e de NF-e/NFC-e/empresas/webhooks.
2. **Duas chaves** — Chave de Dados para os subdomínios de consulta, Chave de Nota Fiscal para o resto. Chave certa no host errado = `401`.
3. **`401` sem corpo** — só o status e o `x-request-id`; não há mensagem para logar.
4. **`202` não é autorização** — é fila. Confirme por `flowStatus`/`status` ou webhook.
5. **Ambiente não está na URL** — está na inscrição municipal/estadual. Relatório sem filtro mistura teste com produção.
6. **`environment` obrigatório em NF-e** e opcional em NFC-e — o esquecimento vira `400`.
7. **`limit` padrão 10** em NF-e, NFC-e e Contribuintes v2.
8. **Vocabulário divergente** — `provider`/`borrower` em NFS-e, `issuer`/`buyer` em NF-e.
9. **Dois envelopes de webhook** — `body.payload ?? body`.
10. **Certificado A1 obrigatório em NF-e/NFC-e mesmo em homologação**; dispensado no teste de NFS-e.
11. **Download na distribuição devolve link, não arquivo** — e o campo tem dois nomes nas fontes oficiais (`url` e `publicTemporaryUri`). O link expira.
12. **Reposicionar NSU recaptura e RECOBRA** documentos já processados.
13. **CNPJ alfanumérico** — rotas v1/v2 de emissão rejeitam com `400`; a v3 de consulta devolve `federalTaxNumber` como *string*.
14. **`/v1/companies` em `api.nfe.io` está em descontinuação** — use Contribuintes v2 em `api.nfse.io`.
15. **TLS 1.0 e 1.1 não são mais aceitos** (release note 2026.7).
16. **A captura fiscal se desativa sozinha** por circuit breaker (certificado vencido, falhas no poll) sem avisar.

### 3.9 Casos de uso de negócio

1. **Fechamento mensal de NFS-e para o contábil** — listagem por competência + XML de cada nota.
2. **Conciliação faturamento × nota emitida** — cruzamento pelo `externalId`.
3. **Captura e manifestação das notas de fornecedores** — distribuição + manifestação no prazo.
4. **Saneamento cadastral antes de emitir** — CNPJ, IE por UF e CEP com código IBGE.
5. **Painel de saúde da emissão** — status das notas + validade de certificado + webhooks ativos.
6. **Auditoria de NF-e de terceiros pela chave** — situação na SEFAZ, eventos e XML, sem ser destinatário.

---

## 4. Lacunas

| Campo | O que falta | Impacto |
|---|---|---|
| `limites.rate_limit` | Valor numérico não publicado em nenhuma API. Não dá para dimensionar carga sem perguntar. | médio |
| `comercial.custo_api` | Sem preço público de NF-e, NFC-e, captura fiscal, consultas e nota excedente. | **alto** |
| `api.spec_oficial_url` | NFS-e Inbound não tem spec OpenAPI publicada, embora a doc afirme que a referência é gerada de um contrato canônico. | médio |
| `response_sucesso` da distribuição | Divergência oficial: spec diz `{"url": ...}`, página de endpoints diz `{"publicTemporaryUri": ...}`. | médio |
| `webhooks.politica_reentrega` | Grade de tentativas dos webhooks de emissão não publicada. | médio |
| `conformidade.residencia_dados` | Região de nuvem não nomeada na página de segurança e LGPD. | médio |
| `fornecedor.razao_social` | Rodapé publica CNPJ e endereço, não a razão social. | baixo |
| Envelopes não documentados | Nome do envelope de `GET /v2/webhooks`, `GET /v2/webhooks/eventtypes` e dos eventos em `nfe.api.nfe.io` não aparece nas specs; os snippets aceitam as variantes. | baixo |
| `endpoints_secundarios` | CT-e Inbound, DC-e, eventos de autoridade RTC, notas de crédito/débito, cadastro de produtos e motor de cálculo foram catalogados, não detalhados. | médio |
| Taxonomia | A ativação/desativação da captura fiscal foi mapeada como `Empresa` + `criar`/`obter`/`excluir`. Uma entidade tipo `AssinaturaDistribuicao` ou uma ação `ativar` representaria melhor. | baixo |

### Onde a confiança é menor

- **Preço** (`volatil: true`): só NFS-e é público, e mudou de faixa em relação a levantamentos anteriores do mercado.
- **Rate limit**: sem número, a estimativa de carga é chute.
- **NFS-e Inbound**: documentado a partir da página de endpoints e do guia REST, não de spec — há chance de divergência de nome de campo.
- **Códigos de evento de manifestação**: a NT 2025.002-RTC está em transição e a NFS-e usa códigos próprios (`203202`, `203206`) diferentes dos da NF-e. Confirme na tabela de tipos e enums antes de fixar valores em produção.
- **Envelopes de webhook e de algumas listagens**: verificados na documentação narrativa, não em spec.

---

## 5. Fontes

Todas consultadas em **2026-09-17**:

- Índice da documentação — <https://nfe.io/docs/>
- Documentação para agentes e LLMs (índice das specs e dos `llms.txt`) — <https://nfe.io/docs/docs-para-agentes/>
- Specs OpenAPI oficiais — <https://nfe.io/docs/api/> (`nf-servico-v1.yaml`, `nf-produto-v2.yaml`, `nf-consumidor-v2.yaml`, `contribuintes-v2.json`, `consulta-dfe-distribuicao-v2.yaml`, `consulta-nfe-distribuicao-v1.yaml`, `consulta-cte-v2.yaml`, `consulta-nf.yaml`, `consulta-cnpj.yaml`, `cpf-api.yaml`, `consulta-endereco.yaml`, `calculo-impostos-v1.yaml`, `product-register-pt-br-v1.yaml`, `product-invoice-rtc-v1.yaml`, `service-invoice-rtc-v1.yaml`)
- Chaves de autenticação — <https://nfe.io/docs/documentacao/nossa-plataforma/chaves-de-autenticacao/>
- Primeiros passos NFS-e — <https://nfe.io/docs/documentacao/nota-fiscal-servico-eletronica/primeiros-passos/>
- Primeiros passos NF-e — <https://nfe.io/docs/documentacao/nota-fiscal-produto-eletronica/integracao-api/primeiros-passos/>
- Catálogo de eventos de webhook — <https://nfe.io/docs/webhooks/catalogo-de-eventos/>
- Payloads dos webhooks de emissão — <https://nfe.io/docs/documentacao/webhooks/guias/payloads-de-emissao/>
- IPs de origem dos webhooks — <https://nfe.io/docs/documentacao/webhooks/ips-de-origem/>
- Erros HTTP e rate limiting da distribuição — <https://nfe.io/docs/distribuicao-nfe-cte-http-errors/>
- Endpoints e integração REST da NFS-e Inbound — <https://nfe.io/docs/distribuicao-nfse-inbound-endpoints/> e <https://nfe.io/docs/distribuicao-nfse-inbound-integracao-rest/>
- Endpoints de NF-e da captura fiscal — <https://nfe.io/docs/distribuicao-nfe-cte-endpoints-nfe/>
- Consulta de CNPJ v3 — <https://nfe.io/docs/documentacao/consultas/pessoa-juridica/consulta-cnpj-v3/>
- SDKs e bibliotecas — <https://nfe.io/docs/desenvolvedores/bibliotecas/>
- Release notes — <https://nfe.io/docs/release-notes/>
- Planos e preços — <https://nfe.io/precos/>
- Termos de serviço — <https://p.nfe.io/pt-br/termos-de-servico>

**Comparação:** dados da Focus NFe vindos de `sistemas/focus-nfe/system.json` deste catálogo (consulta de 2026-09-17).

---

## 6. Observações de conformidade

- **Nada foi copiado literalmente** da documentação: nomes de campo, paths e enums são fatos técnicos e estão exatos; toda frase descritiva é autoral.
- **Nenhuma credencial real** aparece nos arquivos. Placeholders: `<<SUA_CHAVE_NOTA_FISCAL>>`, `<<SUA_CHAVE_DADOS>>`, `<<COMPANY_ID>>`, `<<SEGREDO_HMAC_32_A_64_CARACTERES>>`.
- **CNPJ/CPF de exemplo:** `00000000000191` e `00000000000`; e-mails em `@example.com`.
- **Chamadas à API real:** 2 chamadas com credencial inválida, em 2026-09-17, só para confirmar o formato do `401` — dentro do limite de 3 da regra 2.1. Nenhuma operação de escrita foi executada.
- **Kit Power Query e planilha:** não produzidos (standby desde 2026-09-17). Os snippets `power_query_m` continuam em cada endpoint de leitura.
