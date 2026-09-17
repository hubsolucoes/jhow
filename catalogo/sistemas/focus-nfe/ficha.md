# Focus NFe — ficha de integração

> Gateway REST/JSON de documentos fiscais eletrônicos. Categoria: `fiscal_gateway`. Status: **documentado**. Consulta à documentação oficial: 2026-09-17.

## 1. Resumo comercial

**O que dá para fazer**
- **Emitir** NF-e, NFC-e, NFS-e (webservice municipal e **padrão Nacional**), CT-e / CT-e OS / CT-e Simplificado, MDF-e, NFCom, DC-e e NFGás (beta). A Focus monta o XML, assina com o certificado A1 do cliente e transmite à SEFAZ, à prefeitura ou ao Ambiente Nacional.
- **Eventos**: cancelamento, carta de correção (NF-e e CT-e), inutilização (NF-e e NFC-e), encerramento e inclusão de condutor/DF-e no MDF-e, ECONF, insucesso de entrega, ator interessado e eventos da **Reforma Tributária**.
- **Receber**: NF-e, CT-e e NFS-e Nacional emitidas contra o CNPJ, com manifestação do destinatário (ciência, confirmação etc.), desacordo de CT-e e download de XML/DANFE.
- **Gerir**: cadastro de empresas emitentes (certificado, CSC, séries) via API, webhooks, backups mensais de XML, e-mails bloqueados.
- **Consultas auxiliares**: CEP, CFOP, CNAE, CNPJ, NCM e municípios (com regras de NFS-e por cidade).

**Quanto custa** (página de planos, volátil): Solo R$89,90/mês (1 CNPJ, 100 notas), Start R$113,90/mês (3 CNPJs), Growth R$548,00/mês (CNPJs ilimitados, 4.000 notas), Enterprise sob consulta, e planos de varejo para NFC-e (Retail R$59,90 e Retail+ R$629,90). A nota adicional custa de R$0,05 a R$0,15, conforme o plano e o documento. Não há taxa de setup nem fidelidade. Teste grátis de 30 dias. Integrar um município novo de NFS-e custa R$199,00, com prazo de até 15 dias.

**Quanto demora**: conta de teste imediata. Um MVP de NF-e + NFC-e (emissão, consulta/webhook, cancelamento, CC-e, XML/DANFE) leva por volta de **60 horas**, estimativa do analista para quem já tem os dados fiscais corretos. NFS-e em muitos municípios pode dobrar o esforço.

**Índice de integrabilidade: 67/100**
| Componente | Pontos | Por quê |
|---|---|---|
| Documentação | 17/20 | Portal com OpenAPI por página, Markdown e llms.txt, mais site de campos; schemas de CT-e/MDF-e/NFS-e Nacional incompletos |
| Sandbox | 13/15 | Homologação self-service; exige A1 real; API de Empresas só em produção |
| Autenticação | 7/15 | Token estático em HTTP Basic |
| Webhooks | 9/15 | 14 eventos, reentrega documentada, reenvio manual; sem HMAC |
| Limites/paginação | 6/10 | 100 req/min por token; offset (50) e versão (100) com cabeçalhos |
| SDKs/comunidade | 4/10 | Só repositórios de exemplo de 2019 |
| Acesso sem barreira | 9/10 | Preço público, trial imediato |
| Versionamento | 2/5 | /v2 no path, sem política de depreciação |

## 2. Técnica

### Autenticação
HTTP Basic em todas as rotas: **usuário = token da empresa, senha vazia** (`Authorization: Basic base64("<token>:")`). Não há OAuth, escopos nem endpoint de login. Cada ambiente tem o seu token.

### Ambientes
| Ambiente | Base URL | Efeito |
|---|---|---|
| Homologação | `https://homologacao.focusnfe.com.br` | Sem validade fiscal |
| Produção | `https://api.focusnfe.com.br` | Documentos válidos |

Todas as rotas usam o prefixo `/v2`. A API de Empresas só existe em produção (use `dry_run=1` para simular). Java pode exigir importar a cadeia de certificados TLS no truststore.

### Fluxo de emissão e referência (`ref`)
- Toda emissão leva `?ref=` com um identificador **único por token**, só com letras e números. Ele serve como chave de idempotência.
- **NF-e, NFS-e, NFS-e Nacional, CT-e e MDF-e** são assíncronas: a API responde 202 (`processando_autorizacao`) e o resultado vem pela consulta `GET /v2/<doc>/{ref}` ou pelo webhook. NF-e e MDF-e podem ser configuradas como síncronas no cadastro da empresa.
- **NFC-e é síncrona** (201 com `autorizado` ou `erro_autorizacao`).
- Rejeição da SEFAZ **não é erro HTTP**: a consulta mostra `status: erro_autorizacao` com `status_sefaz`/`mensagem_sefaz`. Corrija e reenvie **com a mesma ref**. Depois que a nota é autorizada, mesmo que seja cancelada, a ref não pode ser reutilizada.
- De-para de status: `processando_autorizacao`→processando, `autorizado`→autorizado, `cancelado`→cancelado, `erro_autorizacao`/`denegado`/`negado`→rejeitado, `erro_cancelamento`→erro.

### Limites
- **100 requisições por minuto por token** (1 crédito por chamada). Cabeçalhos `Rate-Limit-Limit`, `Rate-Limit-Remaining`, `Rate-Limit-Reset`; ao estourar, 429. *Fonte: doc legada oficial (repositório FocusNFe/api-doc); o portal atual não repete a informação.*
- Paginação por **offset** (50 por página, total em `X-Total-Count`) em CFOP, NCM, CEP e empresas; municípios aceitam `limit`. Nos documentos recebidos a paginação é por **versao** (até 100 por chamada nas NF-e, próximo ponto em `X-Max-Version`).
- Tamanho máximo de payload e timeout: não documentados.

### Webhooks
`POST /v2/hooks` com `cnpj`/`cpf`, `event` e `url`, e opcionalmente `authorization` + `authorization_header` para um segredo em cabeçalho próprio. Eventos: `nfe`, `nfse`, `nfsen`, `nfce_contingencia`, `nfe_recebida`, `nfe_recebida_falha_consulta`, `cte_recebida`, `inutilizacao`, `cte`, `mdfe`, `nfcom`, `nfsen_recebida`, `dce`, `nfce_consulta_automatica`. Cada POST leva um documento. Se a resposta não for 2xx, há nova tentativa após 1 min, 30 min, 1 h, 3 h e 24 h, e depois o evento é abandonado. Para reenviar à mão: `POST /v2/<doc>/{ref}/hook`. **Sem assinatura HMAC.**

### Erros
Corpo JSON `{codigo, mensagem, erros[{campo, mensagem}]}`. Na NFS-e há também `correcao`; a API de Empresas pode responder `{erros:[...]}`. O 401 vem em text/html (`HTTP Basic: Access denied`). Códigos frequentes: `requisicao_invalida`, `nao_encontrado`, `permissao_negada`, `formato_invalido`, `erro_validacao_schema`, `pending_operation`, `already_processed`, `nfe_nao_autorizada`, `cte_em_processamento` (409), `mdfe_ja_encerrado`, `ambiente_nao_configurado`, `empresa_nao_habilitada`.

### Reforma Tributária (IBS/CBS)
O guia oficial diz que NF-e/NFC-e, CT-e/CT-e OS, NFS-e Nacional e NFCom já aceitam os campos novos. Na NF-e, por item: `ibs_cbs_situacao_tributaria`, `ibs_cbs_classificacao_tributaria`, `ibs_cbs_base_calculo`, `cbs_aliquota`, `cbs_valor`, `ibs_uf_aliquota`, `ibs_uf_valor`, `ibs_mun_aliquota`, `ibs_mun_valor` e grupos de Imposto Seletivo (`is_*`). Os eventos novos ficam em `POST /v2/nfe/{ref}/evento`. A NFS-e municipal tem os campos, mas prefeituras em transição podem ignorá-los. Em 2026 as alíquotas são simbólicas (CBS 0,9% e IBS 0,1%), e a validação da Receita começou em 01/04/2026, segundo o guia.

### Excel / Power BI
Há consultas Power Query para todas as leituras e um kit pronto em `kit/`. **Emissão, cancelamento, CC-e e inutilização não devem rodar no Power Query**, porque cada atualização repetiria a operação: use o `kit/python` ou o `kit/typescript`. No Power Query a autenticação é um cabeçalho `Authorization` montado a partir do token, com a fonte de dados configurada como Anônima.


### Endpoints canônicos detalhados (62)

| id | Método | Path | Doc | Confiança |
|---|---|---|---|---|
| `focus-nfe.nota_fiscal.emitir.nfe` | POST | `/v2/nfe` | nfe | verificado |
| `focus-nfe.nota_fiscal.consultar_status.nfe` | GET | `/v2/nfe/{referencia}` | nfe | verificado |
| `focus-nfe.nota_fiscal.cancelar.nfe` | DELETE | `/v2/nfe/{referencia}` | nfe | verificado |
| `focus-nfe.nota_fiscal.corrigir.nfe` | POST | `/v2/nfe/{referencia}/carta_correcao` | nfe | verificado |
| `focus-nfe.nota_fiscal.inutilizar.nfe` | POST | `/v2/nfe/inutilizacao` | nfe | verificado |
| `focus-nfe.nota_fiscal.listar.inutilizacoes_nfe` | GET | `/v2/nfe/inutilizacoes` | nfe | verificado |
| `focus-nfe.nota_fiscal.enviar.email_nfe` | POST | `/v2/nfe/{referencia}/email` | nfe | verificado |
| `focus-nfe.nota_fiscal.baixar_arquivo.nfe` | GET | `/{caminho_arquivo}` | nfe | verificado |
| `focus-nfe.nota_fiscal.baixar_arquivo.previa_danfe_nfe` | POST | `/v2/nfe/danfe` | nfe | verificado |
| `focus-nfe.nota_fiscal.emitir.evento_nfe` | POST | `/v2/nfe/{referencia}/evento` | nfe | verificado |
| `focus-nfe.webhook.enviar.reenvio_nfe` | POST | `/v2/nfe/{referencia}/hook` | nfe | verificado |
| `focus-nfe.nota_fiscal.emitir.nfce` | POST | `/v2/nfce` | nfce | verificado |
| `focus-nfe.nota_fiscal.consultar_status.nfce` | GET | `/v2/nfce/{referencia}` | nfce | verificado |
| `focus-nfe.nota_fiscal.cancelar.nfce` | DELETE | `/v2/nfce/{referencia}` | nfce | verificado |
| `focus-nfe.nota_fiscal.inutilizar.nfce` | POST | `/v2/nfce/inutilizacao` | nfce | verificado |
| `focus-nfe.nota_fiscal.listar.inutilizacoes_nfce` | GET | `/v2/nfce/inutilizacoes` | nfce | verificado |
| `focus-nfe.nota_fiscal.enviar.email_nfce` | POST | `/v2/nfce/{referencia}/email` | nfce | verificado |
| `focus-nfe.nota_fiscal.emitir.nfse` | POST | `/v2/nfse` | nfse | verificado |
| `focus-nfe.nota_fiscal.consultar_status.nfse` | GET | `/v2/nfse/{referencia}` | nfse | verificado |
| `focus-nfe.nota_fiscal.cancelar.nfse` | DELETE | `/v2/nfse/{referencia}` | nfse | verificado |
| `focus-nfe.nota_fiscal.enviar.email_nfse` | POST | `/v2/nfse/{referencia}/email` | nfse | verificado |
| `focus-nfe.nota_fiscal.emitir.nfsen` | POST | `/v2/nfsen` | nfsen | verificado |
| `focus-nfe.nota_fiscal.consultar_status.nfsen` | GET | `/v2/nfsen/{referencia}` | nfsen | verificado |
| `focus-nfe.nota_fiscal.cancelar.nfsen` | DELETE | `/v2/nfsen/{referencia}` | nfsen | verificado |
| `focus-nfe.nota_fiscal.enviar.email_nfsen` | POST | `/v2/nfsen/{referencia}/email` | nfsen | verificado |
| `focus-nfe.nota_fiscal.emitir.cte` | POST | `/v2/cte` | cte | verificado |
| `focus-nfe.nota_fiscal.emitir.cte_os` | POST | `/v2/cte_os` | cte | verificado |
| `focus-nfe.nota_fiscal.consultar_status.cte` | GET | `/v2/cte/{referencia}` | cte | verificado |
| `focus-nfe.nota_fiscal.cancelar.cte` | DELETE | `/v2/cte/{referencia}` | cte | verificado |
| `focus-nfe.nota_fiscal.corrigir.cte` | POST | `/v2/cte/{referencia}/carta_correcao` | cte | verificado |
| `focus-nfe.nota_fiscal.emitir.mdfe` | POST | `/v2/mdfe` | mdfe | verificado |
| `focus-nfe.nota_fiscal.consultar_status.mdfe` | GET | `/v2/mdfe/{referencia}` | mdfe | verificado |
| `focus-nfe.nota_fiscal.cancelar.mdfe` | DELETE | `/v2/mdfe/{referencia}` | mdfe | verificado |
| `focus-nfe.nota_fiscal.encerrar.mdfe` | POST | `/v2/mdfe/{referencia}/encerrar` | mdfe | verificado |
| `focus-nfe.nota_fiscal.listar.nfe_recebida` | GET | `/v2/nfes_recebidas` | nfe | verificado |
| `focus-nfe.nota_fiscal.obter.nfe_recebida` | GET | `/v2/nfes_recebidas/{chave}.json` | nfe | verificado |
| `focus-nfe.nota_fiscal.baixar_arquivo.xml_nfe_recebida` | GET | `/v2/nfes_recebidas/{chave}.xml` | nfe | verificado |
| `focus-nfe.nota_fiscal.baixar_arquivo.danfe_nfe_recebida` | GET | `/v2/nfes_recebidas/{chave}.pdf` | nfe | verificado |
| `focus-nfe.nota_fiscal.manifestar.nfe_recebida` | POST | `/v2/nfes_recebidas/{chave}/manifesto` | nfe | verificado |
| `focus-nfe.nota_fiscal.listar.cte_recebida` | GET | `/v2/ctes_recebidas` | cte | verificado |
| `focus-nfe.nota_fiscal.listar.nfsen_recebida` | GET | `/v2/nfsens_recebidas` | nfsen | verificado |
| `focus-nfe.empresa.criar` | POST | `/v2/empresas` | - | verificado |
| `focus-nfe.empresa.listar` | GET | `/v2/empresas` | - | verificado |
| `focus-nfe.empresa.obter` | GET | `/v2/empresas/{id}` | - | verificado |
| `focus-nfe.empresa.atualizar` | PUT | `/v2/empresas/{id}` | - | verificado |
| `focus-nfe.empresa.excluir` | DELETE | `/v2/empresas/{id}` | - | verificado |
| `focus-nfe.webhook.assinar_webhook` | POST | `/v2/hooks` | - | verificado |
| `focus-nfe.webhook.listar` | GET | `/v2/hooks` | - | verificado |
| `focus-nfe.webhook.obter` | GET | `/v2/hooks/{id}` | - | verificado |
| `focus-nfe.webhook.excluir` | DELETE | `/v2/hooks/{id}` | - | verificado |
| `focus-nfe.endereco.obter.cep` | GET | `/v2/ceps/{cep}` | - | verificado |
| `focus-nfe.endereco.listar.cep` | GET | `/v2/ceps` | - | verificado |
| `focus-nfe.tabela_auxiliar.listar.cfop` | GET | `/v2/cfops` | - | verificado |
| `focus-nfe.tabela_auxiliar.obter.cfop` | GET | `/v2/cfops/{codigo}` | - | verificado |
| `focus-nfe.tabela_auxiliar.listar.ncm` | GET | `/v2/ncms` | - | verificado |
| `focus-nfe.tabela_auxiliar.obter.ncm` | GET | `/v2/ncms/{codigo}` | - | verificado |
| `focus-nfe.pessoa.obter.cnpj` | GET | `/v2/cnpjs/{cnpj}` | - | verificado |
| `focus-nfe.tabela_auxiliar.listar.municipio` | GET | `/v2/municipios` | - | verificado |
| `focus-nfe.tabela_auxiliar.obter.municipio` | GET | `/v2/municipios/{codigo_municipio}` | - | verificado |
| `focus-nfe.tabela_auxiliar.listar.itens_lista_servico` | GET | `/v2/municipios/{codigo_municipio}/itens_lista_servico` | - | verificado |
| `focus-nfe.tabela_auxiliar.listar.cnae` | GET | `/v2/codigos_cnae` | - | verificado |
| `focus-nfe.documento.listar.backup` | GET | `/v2/backups/{cnpj}.json` | - | verificado |

### Endpoints catalogados, não detalhados (66)

Incluem NFCom, DC-e, NFGás, ECONF, insucesso de entrega, ator interessado, cancelamento de evento, importação de NF-e, DANFE etiqueta, CT-e Simplificado, inclusão de condutor/DF-e no MDF-e, rotas `/hook` de reenvio, desacordo de CT-e, variantes de consulta de documentos recebidos, e-mails bloqueados, códigos tributários municipais e o Comunicador Offline (servidor local de NFC-e em contingência). A lista completa está em `endpoints.json > endpoints_secundarios`.

### Armadilhas

- A API não calcula tributos: CST/CSOSN, bases e alíquotas devem vir corretas do seu sistema.
- Emissão de NF-e, NFS-e, CT-e e MDF-e é assíncrona (202): é preciso consultar ou usar webhook; NFC-e é síncrona.
- A ref fica presa ao documento depois de autorizado (mesmo cancelado): nova nota exige nova ref.
- O corpo usa 'items' (a página de campos chama a coleção de 'itens').
- Caminhos de XML/DANFE voltam relativos (caminho_*): concatenar com a base do ambiente e enviar o mesmo Basic Auth.
- Token e base URL são por ambiente; token de homologação em produção dá 401.
- Rate limit de 100 req/min por token: polling agressivo em lote estoura rápido; prefira webhooks.
- NFS-e municipal tem campos e regras por município; consultar /v2/municipios e o JSON de exemplo do município.
- Reforma Tributária: campos IBS/CBS (ibs_cbs_situacao_tributaria, ibs_cbs_classificacao_tributaria, cbs_*, ibs_uf_*, ibs_mun_*) já existem para NF-e/NFC-e, CT-e, NFS-e Nacional e NFCom.
- Só certificado A1 (e-CNPJ ou e-CPF de produtor rural); A3 não é aceito.
- Token errado repetido bloqueia o IP (429 limite_excedido, observado em teste); trate 401 sem retry automático.

### Lacunas

- **limites.rate_limit** (medio): O limite de 100 créditos/min e os cabeçalhos Rate-Limit-* só constam na doc legada (repositório oficial FocusNFe/api-doc, último commit 2026-05-28). O portal doc.focusnfe.com.br não fala do assunto. Confirmar com o fornecedor se o valor continua válido.
- **limites.tamanho_max_payload / timeout_recomendado** (baixo): Não encontrados na documentação.
- **limites.idempotencia** (medio): Não existe cabeçalho de idempotência. A proteção contra duplicidade é o parâmetro ref (único por token; erros already_processed/pending_operation, 409 em CT-e/MDF-e). Por isso 'suportada: true' com header null.
- **webhooks.payload** (medio): A doc diz que o POST leva os dados do documento em JSON (um documento por disparo), mas não publica schema por evento. Assumir o mesmo formato da consulta do documento (inferência).
- **download de XML/DANFE emitidos** (medio): Não há endpoint dedicado no portal atual. A doc legada oficial diz para concatenar a base do ambiente com caminho_xml_nota_fiscal/caminho_danfe. Não está explícito se o download exige Basic Auth; os snippets enviam o cabeçalho por segurança.
- **endpoints CT-e / MDF-e / NFS-e Nacional (payload)** (medio): Os OpenAPI embutidos listam poucos campos (CT-e: 6; MDF-e: 4). O restante, incluindo modais, está só em campos.focusnfe.com.br. Documentados aqui apenas os campos confirmados; obrigatoriedade completa não detalhada.
- **NF-e regime_tributario_emitente** (baixo): O OpenAPI lista enum [1,2,3]; a página de campos inclui também 4 (MEI). Registrado o enum da página de campos com observação.
- **cobertura: NFCom, DC-e, NFGás** (baixo): Os subtipos nfcom, dce e nfgas foram incluídos na taxonomia v1.1, mas esses documentos seguem catalogados como secundários (não detalhados).
- **conformidade.permite_uso_em_produto_terceiro** (medio): Os planos atendem múltiplos CNPJs (SaaS/revenda), mas os termos de uso não foram analisados para uso em produto de terceiros.
- **chave_acesso_nfse** (baixo): A página de campos da NFS-e Nacional mostra chave de NFS-e substituída como String[50]; formato completo não detalhado.
- **cnpj alfanumérico** (medio): Não encontrada menção da Focus NFe ao CNPJ alfanumérico; schemas de NFS-e usam regex ^\d{14}$ para prestador.cnpj.
- **sdks_oficiais** (baixo): Coleção Postman da Focus NFe aparece em busca, mas não foi aberta nesta sessão.
- **limites.bloqueio_autenticacao** (medio): Comportamento observado em chamada real (2026-09-17), não documentado: 429 'limite_excedido' por excesso de autenticações falhas por IP, com retry-after em segundos. Limiar e duração não publicados.
- **erros.401** (baixo): A doc mostra 401 em text/html ('HTTP Basic: Access denied'); em chamada real a /v2/nfes_recebidas com token inválido veio JSON permissao_negada. O formato pode variar por rota.
- **power_query.cabecalhos** (medio): Teste no Excel (2026-09-17): Value.Metadata(Web.Contents) só expõe Content-Type, Content-Length, Date e Server; X-Total-Count, X-Max-Version e Rate-Limit-* não ficam visíveis. Os códigos M paginam pelo tamanho da página (offset) e pelo maior campo versao (documentos recebidos). Além disso, 401/403 não podem ser tratados com ManualStatusHandling: aparecem como erro de credencial do Excel.

### Onde a confiança é menor

- Rate limit e regra de download por `caminho_*`: vêm da doc legada oficial (GitHub FocusNFe/api-doc), não do portal atual.
- Paginação por versão de CT-e e NFS-e Nacional recebidas: limite por página e `X-Max-Version` só estão documentados para NF-e recebidas.
- Payload de CT-e, MDF-e e NFS-e Nacional: só os campos listados nos OpenAPI e na página de campos; os modais não foram detalhados.
- FAQ sobre rejeições comuns: as causas típicas são conhecimento de mercado (marcadas como inferido); os códigos de rejeição são da SEFAZ.

### Monitoramento

- Changelog: https://focusnfe.com.br/atualizacoes/
- Breaking changes: Página de Atualizações, Guia da Reforma Tributária (https://focusnfe.com.br/guides/reforma-tributaria/) e status em https://status.focusnfe.com.br/
- Revisão sugerida: mensal

### Fontes

- [Introdução — API Focus NFe](https://doc.focusnfe.com.br/reference/introducao) — consultado em 2026-09-17
- [Ambiente (URLs de homologação e produção)](https://doc.focusnfe.com.br/reference/ambiente) — consultado em 2026-09-17
- [Autenticação HTTP Basic](https://doc.focusnfe.com.br/reference/autenticacao) — consultado em 2026-09-17
- [Referência (ref)](https://doc.focusnfe.com.br/reference/referencia) — consultado em 2026-09-17
- [Webhooks (gatilhos)](https://doc.focusnfe.com.br/reference/webhooks) — consultado em 2026-09-17
- [Índice completo da documentação (llms.txt)](https://doc.focusnfe.com.br/llms.txt) — consultado em 2026-09-17
- [Campos da NF-e 4.00](https://campos.focusnfe.com.br/nfe/NotaFiscalXML.html) — consultado em 2026-09-17
- [Campos da NFS-e Nacional (DPS)](https://campos.focusnfe.com.br/nfse_nacional/EmissaoDPSXml.html) — consultado em 2026-09-17
- [Doc legada oficial — limite de requisições](https://github.com/FocusNFe/api-doc/blob/master/source/includes/_limite-requisicoes.md) — consultado em 2026-09-17
- [Doc legada oficial — NF-e (download por caminho_*)](https://github.com/FocusNFe/api-doc/blob/master/source/includes/_nfe.md) — consultado em 2026-09-17
- [Guia da Reforma Tributária (IBS/CBS)](https://focusnfe.com.br/guides/reforma-tributaria/) — consultado em 2026-09-17
- [Planos e preços](https://focusnfe.com.br/precos/) — consultado em 2026-09-17
- [Termos de uso](https://focusnfe.com.br/termos-de-uso/) — consultado em 2026-09-17
- [Organização GitHub oficial](https://github.com/FocusNFe) — consultado em 2026-09-17
- Referência por operação: cada endpoint traz `fonte_url` em `endpoints.json`.
