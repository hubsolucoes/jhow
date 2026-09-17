# PlugNotas (TecnoSpeed) — ficha do catálogo

**Slug:** `plugnotas` · **Categoria:** `fiscal_gateway` · **Status:** documentado
**Fornecedor:** TecnoSpeed S/A — https://tecnospeed.com.br/plugdfe/plugnotas/ (o domínio plugnotas.com.br redireciona para lá)
**Data da pesquisa:** 2026-09-17 · **Versão da API consultada:** 2.4.2 (campo `info.version` da especificação oficial)
**Índice de integrabilidade:** 62/100

---

## 1. Resumo comercial

### O que dá para fazer

O PlugNotas é o gateway fiscal REST/JSON da TecnoSpeed. Você manda um JSON e ele cuida de assinatura, comunicação com o órgão autorizador, contingência, geração de PDF e XML e envio por e-mail. Cobre:

| Documento | Emissão | Consulta | Cancelamento | Eventos | Download |
|---|---|---|---|---|---|
| **NFS-e municipal** | sim | por id, protocolo e período | sim (onde a prefeitura permite por webservice) | substituição, interrupção, sincronização | PDF, XML, RPS, histórico em ZIP |
| **NFS-e Ambiente Nacional** | sim | por id, chave e período | sim (códigos 1, 2 e 9) | manifestação e consulta de eventos | PDF, XML, XML do evento |
| **NF-e** | sim | resumo por id, chave, protocolo, idIntegracao e período | sim | CC-e, inutilização, insucesso de entrega, conciliação financeira e 13 eventos da Reforma Tributária | DANFE em 3 modelos, XML, XML de cancelamento e de CC-e |
| **NFC-e** | sim | resumo e período | sim | inutilização | PDF, XML |
| **NFCom (modelo 62)** | sim | resumo e período | sim | vinculação de pagamento (110300) | PDF, XML |
| **MDF-e** | sim | resumo e período | sim | **encerramento**, inclusão de condutor, inclusão de DF-e, confirmação de serviço, pagamento de operação | DAMDFE, XML, XML por evento |
| **Notas destinadas (DF-e)** | — | listagem completa com itens | — | manifestação do destinatário | XML |
| **NFC-e em contingência (Neverstop)** | sim, **no agente local** | sim | sim | — | PDF, XML |

Fora dos documentos, ainda há: cadastro de certificado digital e de empresas emitentes por API, grupos de empresas, cadastro opcional de tomadores e serviços de NFS-e, webhook em dois níveis, relatórios de emissão por documento e por organização, e consultas auxiliares de município, CEP, CNPJ na Receita e versão da calculadora de tributos.

**Cobertura declarada de NFS-e:** mais de 2.200 municípios, com suporte a ABRASF, DSF e mais de 150 sistemas próprios (fonte: página do produto).

### O que NÃO dá

- **Não emite CT-e nem CT-e OS.** Não há uma única rota de conhecimento de transporte nas 184 operações da especificação. A TecnoSpeed vende componentes de CT-e separados (repositórios `Componente-CTe` e `Componente-CTeOS` no GitHub oficial), mas são outro produto, com outro modelo de integração.
- **Não calcula tributo por você.** Existe uma calculadora interna (a versão é consultável em `/calculadora/versao`), mas NCM, CFOP, CST/CSOSN, bases e alíquotas têm de sair corretos do seu sistema.
- **Não tem contingência de NFC-e na nuvem.** O Neverstop é um agente instalado no PDV.

### Custo e prazo

Preços **não são publicados**. O site trabalha com formulário comercial perguntando o volume de documentos, e o posicionamento é explicitamente para software houses (a página fala em mais de 4.100 integradas). Registrado como lacuna de impacto alto e marcado como volátil.

O que a documentação confirma sobre consumo: `POST /nfe/importa` (importação de XML de NF-e já autorizada) **é contabilizada na fatura**, e as notas trazidas pela Consulta DF-e da NFS-e Nacional também **contam como emissões**. Duas rotas que parecem "só leitura" e não são, do ponto de vista do contrato.

Prazo: o Sandbox é imediato e sem cadastro. Produção depende de contrato com a TecnoSpeed e do certificado A1 do emitente.

### Esforço de integração

**Complexidade média, ~55 horas para o MVP.** Premissa: um ERP que já tem os dados fiscais corretos integrando NFS-e de alguns municípios mais NF-e de uma empresa, com cadastro de certificado e empresa por API, webhook, consulta por resumo, cancelamento e download de PDF/XML. É julgamento do analista, não número do fornecedor. Cada família nova de município de NFS-e e cada documento adicional (NFC-e, MDF-e, NFCom) somam esforço próprio.

### Índice de integrabilidade — 62/100

| Componente | Peso | Pontos | Por quê |
|---|---:|---:|---|
| Documentação | 20 | 17 | OpenAPI 3.1.1 oficial e baixável, 184 operações, exemplos de sucesso e de erro por status. Perde por não documentar rate limit, por defeitos na spec e por artigos importantes atrás de proteção antibot. |
| Sandbox | 15 | 11 | Público, token fixo, sem cadastro — excelente para avaliar. Mas é mock, com dados compartilhados e rotas não implementadas. |
| Autenticação | 15 | 6 | Chave estática em cabeçalho, sem OAuth2, sem escopo, sem rotação por API. |
| Webhooks | 15 | 10 | Dois níveis, CRUD, rota de teste, reentrega de ~6h, IPs publicados. Sem HMAC e sem reenvio manual. |
| Limites e paginação | 10 | 6 | Cursor bem definido e paginação por página nos relatórios. Sem rate limit publicado e sem total nas listas por cursor. |
| SDKs e comunidade | 10 | 5 | Pacote PHP, demos em C# e Delphi, repositório de JSONs atualizado em 2026, coleção Postman. Sem SDK mantido para Python, Node ou Java. |
| Acesso sem barreira | 10 | 5 | Documentação e Sandbox abertos, mas sem preço público e sem autoatendimento de contratação. |
| Versionamento | 5 | 2 | Versão só na spec, sem versão no path, sem changelog público e sem política de depreciação. |

---

## 2. Comparação direta com a Focus NFe

As duas são gateways fiscais brasileiros REST/JSON e disputam o mesmo cliente. As diferenças que importam na decisão:

| Aspecto | **PlugNotas** | **Focus NFe** |
|---|---|---|
| **CT-e / CT-e OS** | **não emite** | emite na mesma API |
| **NFS-e** | forte: +2.200 municípios declarados, ABRASF, DSF e +150 sistemas próprios; metadados por município via API (`/nfse/cidades/{ibge}`) | cobre municipal e Nacional; integração de município novo tem taxa e prazo publicados |
| **Autenticação** | `x-api-key` (chave estática em cabeçalho próprio) | HTTP Basic com o token no lugar do usuário e senha vazia |
| **Ambientes** | uma base para produção **e** homologação fiscal; o ambiente vem da flag `config.producao` da empresa. Sandbox é um mock à parte | duas bases distintas, uma por ambiente, com token diferente em cada |
| **Sandbox** | público, token fixo publicado, **sem cadastro e sem certificado** | conta de teste com trial; exige certificado A1 mesmo em homologação |
| **Preço** | **não publicado**, só contato comercial | tabela pública de planos no site |
| **Rate limit** | **não publicado**, sem cabeçalhos de limite | 100 créditos/min por token, com cabeçalhos `Rate-Limit-*` |
| **Paginação de listas** | cursor `hashProximaPagina`, 25 por página, janela de 31 dias, sem total | offset com 50 por página e `X-Total-Count`; paginação por versão nos recebidos |
| **Webhook** | 2 níveis (organização e empresa), reentrega ~6h, IPs de origem publicados, rota de teste | gatilhos com 14 eventos nomeados, reentrega escalonada até 24h, reenvio manual por rota |
| **Assinatura de webhook** | sem HMAC; cabeçalho fixo configurável | sem HMAC; cabeçalho fixo configurável |
| **Idempotência** | `idIntegracao` no corpo, devolve 409 com o documento anterior | `ref` na URL, com `already_processed` / `pending_operation` |
| **NFC-e offline** | Neverstop, **agente local no PDV** (`http://localhost:8082`) | contingência tratada no próprio serviço |
| **Notas de entrada** | NF-e destinadas (DF-e) com documento completo e manifestação | NF-e, CT-e e NFS-e Nacional recebidas, com manifestação |
| **Spec oficial** | OpenAPI 3.1.1 em `docs.plugnotas.com.br/api.json` | OpenAPI embutido por página no portal, mais `llms.txt` |

**Resumindo a escolha:** para quem faz transporte e precisa de CT-e, a Focus resolve o ciclo inteiro e o PlugNotas não. Para quem vive de NFS-e em muitos municípios, quer avaliar a API antes de falar com vendedor, ou precisa emitir NFC-e com internet instável, o PlugNotas leva vantagem. Quem precisa dimensionar carga com segurança sofre no PlugNotas pela ausência de rate limit publicado e de preço público.

---

## 3. Técnico

### 3.1 Autenticação

- **Tipo:** `api_key` em cabeçalho `x-api-key`, com o token puro, **sem prefixo**.
- **Sem** rota de login, refresh, escopo ou expiração documentada.
- O token é **da organização**: enxerga todos os CNPJs vinculados. Por isso quase toda leitura pede `cpfCnpj` como filtro.
- Produção: token gerado em https://app2.plugnotas.com.br/. Sandbox: token fixo publicado na introdução da documentação oficial.
- **Observado em chamada real (2026-09-17, não documentado):** `GET /nfse/cidades/{codigoIbge}` respondeu **200 mesmo com token inválido**, no Sandbox e na produção; já `GET /cep/{cep}` sem cabeçalho devolveu 401. A exigência de token varia por rota — não use a consulta de município para testar autenticação.

### 3.2 Ambientes

| | URL | O que é |
|---|---|---|
| Produção | `https://api.plugnotas.com.br` | base única para produção **e** homologação fiscal |
| Sandbox | `https://api.sandbox.plugnotas.com.br` | mock com token fixo público; não chega à SEFAZ nem à prefeitura |

O ambiente fiscal é definido por `{documento}.config.producao` no cadastro da empresa, e não pela URL. **Verificado em 2026-09-17:** no Sandbox, `GET /empresa` responde `{"message":"Não implementado no ambiente do Sandbox."}`, `GET /certificado` devolve dados fictícios e as consultas por período trazem documentos de outros testadores.

### 3.3 Limites publicados

| Limite | Valor |
|---|---|
| Rate limit | **não publicado** (nem cabeçalhos de limite nas respostas reais) |
| Documentos por JSON de NFS-e | 500 |
| Registros por página (consultas por período e `/nfe/destinada`) | 25, cursor `hashProximaPagina` |
| Registros por página (`GET /empresa`) | 150 |
| Itens por página (relatórios) | 100 (`page` / `perPage`), rodapé com `totalPages` e `totalItems` |
| Janela de consulta por período e de relatórios | 31 dias |
| Cache da consulta de NFS-e por período | 300 segundos |
| Mesma chave em `POST /nfe/sincronizarDestinada/{cnpj}` | 18 por hora |
| Regerações de PDF por NFS-e | 3 (a quarta devolve 429) |
| Logotipo | 200 kB |
| Importação de XML de NF-e | autorizada há no máximo 90 dias |

### 3.4 Webhooks

- Dois níveis: organização (`/webhook`) e empresa (`/empresa/{cnpj}/webhook`), com CRUD completo e rota `/verify` que devolve o corpo e o status do **seu** endpoint.
- Dispara quando o documento chega a situação final (`CONCLUIDO`, `REJEITADO`, `CANCELADO`, `DENEGADO`) e nas conclusões de eventos. `PROCESSANDO` não dispara.
- Uma notificação **por documento** — lote de 50 notas gera 50 chamadas.
- Reentrega em intervalos regulares por **cerca de 6 horas**, até receber 2xx. **Não há** reenvio manual de uma notificação específica.
- **Sem assinatura HMAC.** A verificação é o objeto `headers` que você configura (por exemplo um `Authorization` seu) mais os IPs de origem publicados: `54.144.48.129` e `3.210.19.145`.
- O payload traz `id`, `idIntegracao`, `status`, `emitente`, `destinatario`, `valor`, `numero`, `serie`, `chave`, `protocolo`, `mensagem`, `cStat`, `documento`, `pdf` e `xml`. Não há schema publicado por tipo de evento (lacuna).

### 3.5 Erros

Envelope padrão:

```json
{ "error": { "message": "...", "data": { "fields": { "documento[0].itens[0].ncm": "Preenchimento obrigatório" } } } }
```

| Status | Situação típica |
|---|---|
| 202 | **não é erro:** arquivo (PDF/XML) ainda em geração, ou evento em processamento |
| 400 | validação de schema (`error.data.fields`), parâmetro obrigatório ausente, situação incompatível com a ação, período sem data final, município não homologado |
| 401 | token inválido ou cabeçalho ausente |
| 404 | documento, empresa, certificado, tomador ou protocolo inexistente |
| 406 | XML de NF-e com mais de 90 dias na importação |
| 409 | duplicidade por `idIntegracao` (o corpo traz o documento anterior em `data.current`) |
| 429 | limite de 3 regerações de PDF, ou importação de AIDF já em andamento |
| 500 | falha interna |

**Rejeição da SEFAZ ou da prefeitura não é erro HTTP.** Ela aparece na consulta, em `situacao`/`status` igual a `REJEITADO`, com `mensagem` e, nos documentos da SEFAZ, `cStat`.

### 3.6 Endpoints canônicos (90 detalhados + 94 catalogados)

| Grupo | Endpoints detalhados |
|---|---|
| **Auxiliares** | `tabela_auxiliar.listar.cidades`, `tabela_auxiliar.obter.cidade`, `endereco.obter.cep`, `pessoa.obter.cnpj`, `tabela_auxiliar.obter.versao_calculadora` |
| **Certificado** | `empresa.listar.certificado`, `empresa.obter.certificado`, `empresa.criar.certificado`, `empresa.substituir.certificado`, `empresa.excluir.certificado` |
| **Empresa** | `empresa.listar`, `empresa.obter`, `empresa.criar`, `empresa.atualizar` |
| **Webhook** | `webhook.obter.organizacao`, `webhook.assinar_webhook.organizacao`, `webhook.atualizar.organizacao`, `webhook.excluir.organizacao`, `webhook.enviar.teste_organizacao` e os cinco equivalentes por empresa |
| **Tomador e serviço** | `cliente.criar.tomador`, `cliente.obter.tomador`, `produto.criar.servico`, `produto.obter.servico` |
| **NFS-e** | `nota_fiscal.emitir.nfse`, `obter.nfse`, `consultar_status.nfse`, `listar.nfse_periodo`, `baixar_arquivo.pdf_nfse`, `baixar_arquivo.xml_nfse`, `cancelar.nfse`, `consultar_status.cancelamento_nfse`, `enviar.email_nfse` |
| **NFS-e Nacional** | `listar.nfsen_periodo`, `manifestar.nfsen`, `listar.eventos_nfsen`, `baixar_arquivo.xml_evento_nfsen` |
| **NF-e** | `emitir.nfe`, `consultar_status.nfe`, `listar.nfe_periodo`, `baixar_arquivo.pdf_nfe`, `baixar_arquivo.xml_nfe`, `cancelar.nfe`, `consultar_status.cancelamento_nfe`, `baixar_arquivo.xml_cancelamento_nfe`, `corrigir.nfe`, `consultar_status.cce_nfe`, `inutilizar.nfe`, `consultar_status.inutilizacao_nfe`, `listar.eventos_nfe`, `enviar.email_nfe` |
| **Destinadas (DF-e)** | `listar.nfe_destinada`, `criar.sincronizacao_destinada`, `consultar_status.sincronizacao_dfe`, `manifestar.nfe_destinada`, `consultar_status.manifestacao_nfe` |
| **NFC-e** | `emitir.nfce`, `consultar_status.nfce`, `listar.nfce_periodo`, `baixar_arquivo.pdf_nfce`, `baixar_arquivo.xml_nfce`, `cancelar.nfce`, `consultar_status.cancelamento_nfce`, `inutilizar.nfce`, `consultar_status.inutilizacao_nfce` |
| **NFCom** | `emitir.nfcom`, `consultar_status.nfcom`, `listar.nfcom_periodo`, `baixar_arquivo.pdf_nfcom`, `baixar_arquivo.xml_nfcom`, `cancelar.nfcom`, `consultar_status.cancelamento_nfcom` |
| **MDF-e** | `emitir.mdfe`, `consultar_status.mdfe`, `listar.mdfe_periodo`, `baixar_arquivo.pdf_mdfe`, `baixar_arquivo.xml_mdfe`, `encerrar.mdfe`, `consultar_status.encerramento_mdfe`, `cancelar.mdfe` |
| **Relatórios** | `relatorio.listar.nfse`, `relatorio.listar.nfe`, `relatorio.listar.nfce`, `relatorio.listar.mdfe`, `relatorio.listar.nfcom`, `relatorio.obter.organizacao` |

Em `endpoints_secundarios` ficam, entre outros: os 13 eventos da Reforma Tributária da NF-e, os eventos secundários do MDF-e (inclusão de condutor e de DF-e, confirmação de serviço, pagamento de operação, com seus status e XMLs), o grupo NFC-e contingência (Neverstop), as variantes de consulta por `idIntegracao` + CNPJ, os relatórios por CNPJ, logotipo, série, grupos de empresas, prévia do DANFE, reimpressão de PDF, importação de XML, RPS, upload, AIDF do padrão Governa e as rotas de interromper/sincronizar/resolver NFS-e.

**56 dos 90 endpoints detalhados são seguros para o assistente executar** (leitura pura). Todas as emissões, cancelamentos, eventos, inutilizações, envios de e-mail, cadastros e exclusões estão marcados com `seguro_para_executar: false` e motivo.

### 3.7 Armadilhas

1. **Não existe CT-e.** Confirme antes de vender o projeto para uma transportadora.
2. **Produção e homologação compartilham a mesma base.** O que troca é `{documento}.config.producao`. Um PATCH de um campo só vira o ambiente fiscal inteiro daquele CNPJ — proteja essa operação.
3. **O Sandbox é mock e compartilhado.** Não serve para validar volume nem para conferir dados do seu CNPJ.
4. **Toda emissão é assíncrona.** HTTP 200 é aceite do JSON, não autorização.
5. **Rejeição não é erro HTTP.** Se o seu código só olha status HTTP, ele não vê rejeição nenhuma.
6. **`idIntegracao` é a idempotência.** Gere um valor único e estável por documento; trate 409 lendo `data.current`.
7. **HTTP 202 em download** significa "ainda em geração", não falha.
8. **XML concatenado.** Sem o parâmetro `tipo`, nota cancelada devolve dois XMLs em sequência (no MDF-e podem ser três).
9. **Janela de 31 dias e cursor sem total.** Relatório anual exige 12 chamadas e loop de cursor.
10. **Cada município de NFS-e tem regra própria.** `GET /nfse/cidades/{codigoIbge}` responde antes o que a prefeitura exige.
11. **Rotas que consomem franquia sem emitir.** `POST /nfe/importa` e a consulta DF-e da NFS-e Nacional entram na fatura.
12. **MDF-e precisa ser encerrado**, não só cancelado. Manifesto em aberto bloqueia o próximo do mesmo veículo.
13. **Sem rate limit publicado.** Dimensione o polling por conta própria e prefira webhook.
14. **Webhook sem HMAC.** Valide o cabeçalho fixo e também o IP de origem.
15. **Dados sensíveis em respostas de leitura.** `GET /empresa` pode trazer login e senha do portal da prefeitura; `GET /cnpj/{cnpj}` traz nomes de sócios.

### 3.8 Defeitos observados na especificação oficial (2026-09-17)

- `GET /nfcom/{idOrChave}/cancelamento/xml` está **sem `operationId`**.
- O schema `#/components/schemas/sucess-email` é referenciado mas **não existe**.
- Várias chaves de caminho aparecem **duplicadas com um espaço em branco no fim**, só para repetir a mesma operação em outra tag.
- As rotas do grupo Neverstop estão **sem barra inicial** e apontam para `http://localhost:8082`.

---

## 4. Lacunas

| Campo | Lacuna | Impacto |
|---|---|---|
| `limites.rate_limit` | Nenhum limite de requisições publicado e nenhum cabeçalho de limite nas respostas reais. | **alto** |
| `comercial.custo_api` | Preços, franquias e forma de cobrança não são públicos. | **alto** |
| cobertura CT-e | O PlugNotas não emite CT-e; é outro produto da TecnoSpeed, fora desta API. | **alto** |
| `webhooks.payload` | Formato só aparece como exemplo dentro das rotas; sem schema por evento e sem lista formal de eventos. | médio |
| `webhooks.verificacao_assinatura` | Sem HMAC; a autenticidade depende de cabeçalho fixo e dos IPs publicados. | médio |
| `conformidade.residencia_dados` | Não informado publicamente. | médio |
| `conformidade.termos_uso_url` | Não foi localizada página de termos de uso específica do PlugNotas; registrada a política de privacidade da TecnoSpeed. `permite_uso_em_produto_terceiro: sim` apoia-se no posicionamento comercial, não em cláusula lida. | médio |
| cobertura do mock | A documentação não lista o que existe no Sandbox; o que se sabe veio de teste real. | médio |
| versionamento | Sem versão no path, sem changelog público, sem política de depreciação. | médio |
| Neverstop | As seis rotas de contingência dependem de agente local; instalação e requisitos não estão nesta documentação. | médio |
| schemas de emissão | Payloads de NF-e, NFC-e, NFCom e MDF-e têm centenas de campos; aqui estão os de primeiro nível e os grupos obrigatórios. | médio |
| MDF-e: `modalRodoviario` | O schema publicado de `POST /mdfe` **não lista nenhuma propriedade de veículo, RNTRC ou condutor**. Esses dados só aparecem no exemplo "MODAL RODOVIÁRIO" da rota, sob `modalRodoviario`. Os nomes registrados no catálogo vieram desse exemplo. Modais aéreo, aquaviário e ferroviário não têm leiaute publicado. | **alto** |
| nomes inconsistentes entre documentos | NFS-e e MDF-e usam `enviarEmail`; NF-e e NFC-e usam `enviaremail` (minúsculo). NFS-e usa `servico`/`cidadePrestacao`, NF-e usa `itens`/`natureza`, NFCom aninha tudo em `informacoesNFCom`. Sem normalização entre leiautes. | baixo |
| CNPJ alfanumérico | Nenhuma menção do fornecedor; `cpfCnpj` é tratado como string de 11 a 14 caracteres. | médio |
| exigência de token por rota | `GET /nfse/cidades/{codigoIbge}` respondeu 200 com token inválido; comportamento não documentado. | baixo |
| `execucao.campo_total` | Listas por cursor não devolvem total; só relatórios trazem `totalItems`. | baixo |
| `execucao.colunas_sugeridas` | Downloads binários não têm JSON de resposta, então ficam abaixo do mínimo de 5 colunas. | baixo |
| defeitos na spec | `operationId` ausente, schema quebrado, caminhos duplicados com espaço. | baixo |

---

## 5. Monitoramento

- **Changelog público da API:** não existe. A única pista de mudança é `info.version` em https://docs.plugnotas.com.br/api.json (2.4.2 em 2026-09-17).
- **Status:** https://status.plugnotas.com.br/
- **Base de conhecimento:** https://atendimento.tecnospeed.com.br/ (protegida por verificação antibot; não foi possível ler nesta sessão)
- **Frequência de revisão sugerida:** mensal (fiscal muda o tempo todo, e a Reforma Tributária está em implantação).

---

## 6. Fontes

| Fonte | URL | Consulta |
|---|---|---|
| Documentação oficial (ReDoc) | https://docs.plugnotas.com.br/ | 2026-09-17 |
| Especificação OpenAPI 3.1.1 oficial, v2.4.2 | https://docs.plugnotas.com.br/api.json | 2026-09-17 |
| Página do produto (TecnoSpeed) | https://tecnospeed.com.br/plugdfe/plugnotas/ | 2026-09-17 |
| Painel (geração do token) | https://app2.plugnotas.com.br/ | 2026-09-17 |
| Página de status | https://status.plugnotas.com.br/ | 2026-09-17 |
| Pacote PHP oficial | https://github.com/tecnospeed/plugnotas-php | 2026-09-17 |
| JSONs completos de exemplo | https://github.com/tecnospeed/plugnotas-json-completo | 2026-09-17 |
| Coleção Postman oficial | https://documenter.getpostman.com/view/3720339/2sB3WpSh1R?version=latest | 2026-09-17 |
| Política de privacidade TecnoSpeed | https://tecnospeed.com.br/politica-privacidade/ | 2026-09-17 |

**Relação com a TecnoSpeed (confirmada em fonte oficial):** a especificação traz `info.contact.name` igual a "Tecnospeed S/A - PlugNotas"; o domínio `plugnotas.com.br` redireciona para `tecnospeed.com.br/plugdfe/plugnotas/`; e a página do produto se apresenta como uma solução TecnoSpeed.

**Chamadas reais feitas nesta pesquisa (regra 2.1):** leituras no Sandbox com o token público publicado pelo fornecedor (`/nfse/cidades`, `/cep`, `/empresa`, `/certificado`, `/calculadora/versao`, consultas por período de NFS-e, NF-e, NFC-e, MDF-e e NFCom, `/nfe/destinada`, `/relatorio/{ano}/{mes}`, `/cnpj/{cnpj}`) e **3 chamadas com credencial inválida**, somente de leitura, para confirmar o formato do 401. Nenhuma chamada de escrita foi feita.
