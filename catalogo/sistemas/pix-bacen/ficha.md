# API Pix (arranjo Bacen) — ficha de integração

> Categoria: pagamentos_padrao · Status: documentado · Consulta: 2026-09-17 · Especificação **2.10.0** (release oficial de 19/08/2026) · Índice de integrabilidade: **64/100**

> **Leia isto primeiro.** O Pix não é um fornecedor. O Banco Central publica um *padrão de API* que todo PSP recebedor precisa expor — caminhos, schemas, escopos OAuth, estados e modelo de erro — mas **não hospeda nada**. Quem serve a API é o banco ou a instituição de pagamento onde a empresa tem a conta que recebe. Por isso não existe base URL, não existe sandbox do Bacen e não existe tarifa do arranjo: essas três coisas vêm do PSP escolhido. O ganho é a portabilidade: trocar de banco é trocar configuração, não reescrever a integração.

## 1. Resumo comercial

**O que é.** O padrão de integração do arranjo Pix, definido pelo Banco Central e publicado como especificação OpenAPI no repositório oficial `bacen/pix-api`. Cobre o lado do **usuário recebedor**: gerar cobranças (imediatas, com vencimento, em lote e recorrentes), servir QR dinâmico por *location*, consultar os Pix recebidos, solicitar devoluções, configurar webhooks e operar o Pix Automático.

**O que dá para fazer com a API (principais casos):**
- **Checkout com QR dinâmico e baixa automática** — Acaba a conferência manual de comprovante: o `txid` amarra o pagamento ao pedido do ERP e o webhook libera em segundos.
- **Conciliação diária de recebimentos** — `endToEndId` e `txid` como chaves naturais, com a composição de juros, multa e desconto de cada pagamento aberta em `componentesValor`.
- **Cobrança com vencimento no lugar do boleto** — Vencimento, multa, juros, abatimento e desconto calculados pelo PSP, liquidação imediata e sem arquivo de retorno CNAB.
- **Carnê e mensalidades em lote** — Uma requisição cria centenas de cobranças e devolve, parcela a parcela, o motivo de cada recusa.
- **Devolução de Pix rastreável** — Estorno amarrado ao `endToEndId` original, com `rtrId`, status e trilha de auditoria, dentro de uma janela de 90 dias.
- **Assinaturas com Pix Automático** — Autorização única do pagador e cobranças recorrentes agendadas pelo PSP pagador, com política de retentativa padronizada.
- **Painel financeiro em Excel/Power BI** — Extrato de recebimentos, carteira em aberto e inadimplência em planilha, por script agendado (o Power Query não alcança a API; veja Armadilhas).

**Quanto custa.** A especificação é pública e gratuita (repositório oficial do Bacen, licença Apache 2.0 declarada). O que custa é o serviço do PSP: tarifa por Pix recebido, por cobrança gerada ou mensalidade de pacote, definida em contrato. **Não há tabela oficial do arranjo** — valores só podem ser registrados na ficha de cada PSP. O Regulamento do Pix proíbe cobrar tarifa de pessoa natural em recebimentos, salvo hipóteses previstas; pessoa jurídica é tarifada livremente. Campo volátil.

**Quanto demora.** Complexidade **alta**; MVP estimado em **~80 h**. Premissa: emissão de cobrança imediata + consulta de Pix recebidos + webhook idempotente + baixa no ERP, com dev pleno já familiarizado com REST, **incluindo** a jornada de emissão de certificado no PSP, a montagem do canal mTLS (cliente e servidor do webhook) e a homologação no ambiente do PSP — é essa parte, e não o JSON, que consome o tempo. Cobrança com vencimento soma de 20 a 40 h; lote, de 10 a 20 h; Pix Automático, de 60 a 120 h. Não há prazo publicado de aprovação: depende da abertura da conta e da liberação de produtos por cada PSP.

**Índice de integrabilidade: 64/100**

| Componente | Pontos | Justificativa |
|---|---|---|
| documentacao | 17/20 | Especificação OpenAPI oficial e versionada no GitHub do Bacen (releases, changelog, HTML renderizado), somada ao Manual de Padrões para Iniciação do Pix (mesma versão 2.10.0) com regras de negócio, estados e casos de uso, e ao catálogo completo de tipos de erro e violações por tag. Perde pontos porque a spec é OpenAPI 3.0 com servidores fictícios, sem base URL nem endpoint de token, e porque segurança e homologação ficam fora do repositório, em manuais separados. |
| sandbox | 4/15 | Não há sandbox nem mock oficial do Bacen. Testar depende do ambiente de homologação de cada PSP, com credencial e certificado próprios, qualidade desigual e nenhuma garantia de paridade com produção. Sem PSP, resta subir um mock local a partir da spec. |
| autenticacao | 14/15 | OAuth2 client credentials com escopos granulares por recurso e operação, sobre mTLS obrigatório, com access token vinculado ao certificado (RFC 8705) e credencial amarrada ao CPF/CNPJ do recebedor. Perde 1 ponto porque URL de token, TTL e jornada de emissão do certificado não são padronizados. |
| webhooks | 9/15 | Webhooks padronizados para Pix recebidos, devoluções, recorrências e cobranças recorrentes, em canal mTLS e com payload especificado. Perde pontos porque não há assinatura do payload, SLA e reentrega ficam a cargo de cada PSP e só Pix com `txid` geram notificação. |
| limites_paginacao | 7/10 | Paginação uniforme em todas as listagens (`paginacao.paginaAtual`/`itensPorPagina`, até 1000 por página, com `quantidadeDePaginas` e `quantidadeTotalDeItens` na resposta) e filtro de período obrigatório. Perde pontos porque o padrão não define rate limit, timeout nem política de retry. |
| sdks_comunidade | 3/10 | O Bacen não publica SDK, apenas a spec. Existem bibliotecas de comunidade e SDKs de PSPs que implementam o padrão, mas nenhuma referência oficial multiplataforma; o caminho suportado é gerar cliente a partir do OpenAPI. |
| acesso_sem_barreira | 5/10 | A especificação é pública, livre e sem cadastro, e qualquer PJ com conta em PSP pode usar a API. Porém nada funciona sem contrato com um PSP, emissão de certificado e liberação de escopos por produto — e o próprio padrão prevê que o PSP conceda só um subconjunto das funcionalidades. |
| versionamento | 5/5 | SemVer explícito, major no path (`v2`), releases datadas com changelog no repositório oficial, regra escrita do que é retrocompatível e marcação de campos deprecados. |

## 2. Técnica

### Autenticação

Duas camadas, ambas obrigatórias (Manual de Padrões, Anexo II, seção 3.1 — requisitos de segurança obrigatórios):

1. **TLS 1.2+ com autenticação mútua (mTLS, RFC 8705)** em toda conexão, inclusive a do endpoint de token. O certificado cliente é emitido pelo próprio PSP ou por AC externa aceita por ele — **não precisa ser ICP-Brasil** e **certificado autoassinado não é aceito**.
2. **OAuth 2.0, fluxo client credentials.** O PSP mantém Authorization Server e Resource Server próprios, ambos em mTLS. O token é emitido com **vinculação ao certificado** (*Client Certificate-Bound Access Tokens*), e o Resource Server confere se o thumbprint do certificado da conexão é o mesmo que originou o token. Não há refresh token.

O `client_id` é vinculado ao CPF/CNPJ do usuário recebedor e **só alcança contas desse titular**. O onboarding é feito em ambiente logado do PSP, com canal seguro para entrega das credenciais.

**Escopos** (24, um par `.read`/`.write` por recurso): `cob`, `cobv`, `lotecobv`, `pix`, `webhook`, `payloadlocation`, `payloadlocationrec`, `rec`, `solicrec`, `cobr`, `webhookrec`, `webhookcobr`. Peça no token só o que a rotina precisa.

```http
POST /oauth/token HTTP/1.1          # caminho ILUSTRATIVO: cada PSP define o seu
Host: <host do Authorization Server do seu PSP>
Authorization: Basic <<CLIENT_ID_E_SECRET_EM_BASE64>>
Content-Type: application/x-www-form-urlencoded
# + certificado cliente no handshake TLS (obrigatório também aqui)

grant_type=client_credentials&scope=pix.read cob.read
```

```http
GET /cob?inicio=2026-08-01T00:00:00Z&fim=2026-08-31T23:59:59Z HTTP/1.1
Host: <host da API Pix do seu PSP>
Authorization: Bearer <<ACCESS_TOKEN>>
# + o MESMO certificado cliente do handshake que gerou o token
```

### Ambientes

| Ambiente | URL base | Como obter |
|---|---|---|
| Produção | **definida por cada PSP** (`null` no catálogo) | Portal de desenvolvedores do PSP, após abertura de conta e contratação dos produtos |
| Homologação | **definida por cada PSP** (`null` no catálogo) | Portal do PSP; credenciais e certificado de teste próprios |
| Sandbox do Bacen | **não existe** | — |

Os servidores da especificação (`https://pix.example.com/api/`) são fictícios, colocados para o arquivo OpenAPI ser válido. O major `v2` aparece no path, mas a posição varia por PSP. Sem PSP, o caminho para desenvolver é um **mock local** gerado a partir do `spec.yaml` da release 2.10.0 (Prism, WireMock, openapi-mock): valida contrato e códigos de erro, mas não simula liquidação no SPI.

### Limites e paginação

- **Rate limit, burst, tamanho máximo de payload e timeout: não definidos pelo padrão.** O manual só exige do PSP tecnologia que garanta alta disponibilidade. Cada PSP publica (ou não) os seus números.
- **Paginação uniforme** em todas as listagens: `paginacao.paginaAtual` (inteiro, começa em 0, padrão 0) e `paginacao.itensPorPagina` (padrão 100, **máximo 1000**). A resposta traz, em `parametros.paginacao`, os campos `paginaAtual`, `itensPorPagina`, `quantidadeDePaginas` e `quantidadeTotalDeItens`.
- **O nome do array de dados muda por endpoint** — `cobs` (`/cob`, `/cobv`), `lotes` (`/lotecobv`), `loc` (`/loc`, `/locrec`), `pix` (`/pix`), `webhooks` (`/webhook`), `recs` (`/rec`), `cobsr` (`/cobr`). Copiar o parser sem trocar o nome faz a lista voltar vazia, sem erro.
- **Período obrigatório**: quase toda listagem exige `inicio` e `fim` em RFC 3339 com fuso (a exceção é `GET /webhook`, onde são opcionais).
- **Retry**: o padrão não define política. Regra segura — repetir `GET`, e repetir `PUT` com identificador definido por você (idempotente por construção), com backoff exponencial em 503 e 504; **nunca** repetir cegamente `POST /cob`, `POST /cobr` ou `POST /solicrec`, porque o identificador é gerado pelo servidor e a repetição cria um segundo registro.
- **Idempotência**: não há header de idempotência. Ela vem do desenho — `PUT /cob/{txid}`, `PUT /cobv/{txid}`, `PUT /cobr/{txid}` e `PUT /pix/{e2eid}/devolucao/{id}` usam identificador escolhido pelo cliente.

### Formato de erro

**RFC 7807** (`application/problem+json`): `type` no padrão `https://pix.bcb.gov.br/api/v2/error/<TipoErro>` (é só um identificador, não precisa ser URL navegável), mais `title`, `status`, `detail`, `correlationId` e, em erro de campo, o array `violacoes[]` com `razao`, `propriedade` e `valor`.

| HTTP | Tipo geral | Significado |
|---|---|---|
| 400 | `RequisicaoInvalida` | Requisição inválida (erro geral) |
| 403 | `AcessoNegado` | Autenticado, mas viola regra de autorização (escopo, contrato ou titularidade) |
| 404 | `NaoEncontrado` | Entidade não encontrada |
| 410 | `PermanentementeRemovido` | Entidade existiu e foi removida em definitivo |
| 500 | `ErroInternoDoServidor` | Condição inesperada no PSP |
| 503 | `ServicoIndisponivel` | Manutenção ou fora da janela de funcionamento |
| 504 | `IndisponibilidadePorTempoEsgotado` | O serviço demorou além do esperado |

Além dos gerais, cada tag tem os seus, no padrão `<Tag>OperacaoInvalida` (400, escrita), `<Tag>ConsultaInvalida` (400, parâmetros de consulta) e `<Tag>NaoEncontrado` (404): `Cob`, `CobV`, `LoteCobV`, `CobR`, `Rec`, `SolicRec`, `PayloadLocation`, `PayloadLocationRec`, `Webhook`, `WebhookRec`, `WebhookCobR`, `Pix` (com `PixConsultaInvalida`, `PixNaoEncontrado`, `PixDevolucaoInvalida` e `PixDevolucaoNaoEncontrada`) e `CobPayload`/`RecPayload` para os endpoints públicos.

### Webhooks

São **três** webhooks independentes, e configurar um não configura os outros:

| Recurso | Configuração | Notificação | Escopos |
|---|---|---|---|
| Pix recebidos e devoluções | `PUT /webhook/{chave}` — um por chave Pix | `POST {webhookUrl}/pix` | `webhook.read` / `webhook.write` |
| Recorrências (Pix Automático) | `PUT /webhookrec` — um por usuário recebedor | `POST {webhookUrl}/rec` | `webhookrec.read` / `webhookrec.write` |
| Cobranças recorrentes | `PUT /webhookcobr` — um por usuário recebedor | `POST {webhookUrl}/cobr` | `webhookcobr.read` / `webhookcobr.write` |

- **Cobertura:** somente Pix **associados a um `txid`** são informados. QR estático sem txid, Pix por chave e transferências avulsas nunca geram callback — só aparecem em `GET /pix`. Pix recebido em chave sem webhook também não notifica.
- **Segurança:** **não há assinatura de payload** nem cabeçalho de verificação no padrão. A garantia é o canal: as notificações trafegam em **mTLS**, e o manual recomenda usar o mesmo certificado da API Pix (outro é possível por acordo entre as partes). Valide o certificado cliente no seu servidor/proxy, trate o corpo como aviso e **confirme com `GET /pix/{e2eid}` antes de dar baixa**.
- **Reentrega:** SLA e política de retentativa não são definidos pelo padrão; o PSP pode agrupar vários Pix da mesma chave numa chamada. Deduplique por `endToEndId` e mantenha **polling periódico em `GET /pix`** como rede de segurança, não como plano B.

### SDKs e ferramentas

O Banco Central **não publica SDK** — apenas a especificação (`spec.yaml`, `spec.json` e `spec.html` em cada release) e o HTML renderizado em `bacen.github.io/pix-api`. O caminho suportado é gerar cliente a partir do OpenAPI (openapi-generator, Kiota) ou usar o SDK do próprio PSP, com a ressalva de que SDK de PSP costuma embutir extensões proprietárias e reduzir a portabilidade.

### Endpoints canônicos detalhados (49)

| Id canônico | Método | Path | Escopo | Executável | O que faz |
|---|---|---|---|---|---|
| `pix-bacen.cobranca.criar` | PUT | `/cob/{txid}` | `cob.write` | não (escrita) | Cria uma cobrança Pix imediata (QR dinâmico sem vencimento) com um txid escolhido pelo usuário recebedor |
| `pix-bacen.cobranca.criar.cob_txid_psp` | POST | `/cob` | `cob.write` | não (escrita) | Cria uma cobrança Pix imediata deixando a geração do txid a cargo do PSP recebedor |
| `pix-bacen.cobranca.atualizar` | PATCH | `/cob/{txid}` | `cob.write` | não (escrita) | Altera campos de uma cobrança imediata ATIVA, incrementando revisao, ou remove a cobrança enviando status… |
| `pix-bacen.cobranca.obter` | GET | `/cob/{txid}` | `cob.read` | sim (leitura) | Devolve uma cobrança imediata pelo txid, com status, valores, BR Code e o array pix[] com os pagamentos já liquidados e suas… |
| `pix-bacen.cobranca.listar` | GET | `/cob` | `cob.read` | sim (leitura) | Lista cobranças imediatas criadas dentro de um período, com filtros por CPF/CNPJ do devedor, status e presença de location, e… |
| `pix-bacen.cobranca.criar.cobv` | PUT | `/cobv/{txid}` | `cobv.write` | não (escrita) | Cria uma cobrança Pix com vencimento (o substituto do boleto no arranjo): data de vencimento, prazo de validade após o… |
| `pix-bacen.cobranca.atualizar.cobv` | PATCH | `/cobv/{txid}` | `cobv.write` | não (escrita) | Altera campos de uma cobrança com vencimento ATIVA ou a remove enviando status REMOVIDA_PELO_USUARIO_RECEBEDOR |
| `pix-bacen.cobranca.obter.cobv` | GET | `/cobv/{txid}` | `cobv.read` | sim (leitura) | Devolve uma cobrança com vencimento pelo txid, com encargos configurados, BR Code, status e os pagamentos liquidados no array… |
| `pix-bacen.cobranca.listar.cobv` | GET | `/cobv` | `cobv.read` | sim (leitura) | Lista cobranças com vencimento criadas no período, com filtros por devedor, status, presença de location e pelo id do lote que… |
| `pix-bacen.cobranca.criar.lote_cobv` | PUT | `/lotecobv/{id}` | `lotecobv.write` | não (escrita) | Cria de uma vez um conjunto de cobranças com vencimento, cada uma com seu txid, ou reenvia o mesmo lote com alterações |
| `pix-bacen.cobranca.atualizar.lote_cobv` | PATCH | `/lotecobv/{id}` | `lotecobv.write` | não (escrita) | Revisa um subconjunto das cobranças de um lote já existente, sem mexer nas demais |
| `pix-bacen.cobranca.obter.lote_cobv` | GET | `/lotecobv/{id}` | `lotecobv.read` | sim (leitura) | Devolve um lote com a descrição, a data de criação e o array cobsv com o resultado de cada cobrança: EM_PROCESSAMENTO, CRIADA… |
| `pix-bacen.cobranca.listar.lote_cobv` | GET | `/lotecobv` | `lotecobv.read` | sim (leitura) | Lista os lotes criados no período, com a composição de cada um, paginados |
| `pix-bacen.location_pagamento.criar` | POST | `/loc` | `payloadlocation.write` | não (escrita) | Cria uma URL (location) que o aplicativo do pagador consulta para obter o payload JSON da cobrança vigente |
| `pix-bacen.location_pagamento.obter` | GET | `/loc/{id}` | `payloadlocation.read` | sim (leitura) | Devolve uma location pelo id, incluindo o txid da cobrança atualmente vinculada, se houver |
| `pix-bacen.location_pagamento.listar` | GET | `/loc` | `payloadlocation.read` | sim (leitura) | Lista as locations criadas no período, com filtro por tipo de cobrança e pela existência de txid vinculado |
| `pix-bacen.location_pagamento.desvincular.txid` | DELETE | `/loc/{id}/txid` | `payloadlocation.write` | não (escrita) | Remove o vínculo entre a location e a cobrança que ela serve |
| `pix-bacen.autenticacao.autenticar` | POST | `/oauth/token` | — | não (escrita) | Troca client_id e client_secret por um access_token no Authorization Server do PSP recebedor, pedindo os escopos necessários |
| `pix-bacen.transacao.listar` | GET | `/pix` | `pix.read` | sim (leitura) | Lista os Pix creditados na conta do usuário recebedor dentro de um período, com endToEndId, valor, horário de liquidação, txid… |
| `pix-bacen.transacao.obter` | GET | `/pix/{e2eid}` | `pix.read` | sim (leitura) | Devolve um Pix recebido pelo seu endToEndId, com valor, horário, txid, composição do valor e o histórico de devoluções… |
| `pix-bacen.transacao.estornar` | PUT | `/pix/{e2eid}/devolucao/{id}` | `pix.write` | não (escrita) | Solicita a devolução, total ou parcial, de um Pix já liquidado |
| `pix-bacen.transacao.obter.devolucao` | GET | `/pix/{e2eid}/devolucao/{id}` | `pix.read` | sim (leitura) | Devolve o estado de uma devolução específica: valor, rtrId, horários de solicitação e liquidação, status e, quando não… |
| `pix-bacen.webhook.assinar_webhook` | PUT | `/webhook/{chave}` | `webhook.write` | não (escrita) | Registra a URL base que o PSP vai chamar quando um Pix com txid for creditado na conta associada àquela chave Pix |
| `pix-bacen.webhook.obter` | GET | `/webhook/{chave}` | `webhook.read` | sim (leitura) | Mostra a configuração de webhook associada a uma chave Pix: URL registrada, CNPJ do recebedor e data de cadastro |
| `pix-bacen.webhook.excluir` | DELETE | `/webhook/{chave}` | `webhook.write` | não (escrita) | Remove a configuração de webhook da chave Pix indicada |
| `pix-bacen.webhook.listar` | GET | `/webhook` | `webhook.read` | sim (leitura) | Lista todos os webhooks Pix configurados pelo usuário recebedor, com a URL de cada um e a data de cadastro |
| `pix-bacen.webhook.assinar_webhook.rec` | PUT | `/webhookrec` | `webhookrec.write` | não (escrita) | Registra a URL base que receberá as notificações de mudanças de status das recorrências (CRIADA, APROVADA, REJEITADA,… |
| `pix-bacen.webhook.obter.rec` | GET | `/webhookrec` | `webhookrec.read` | sim (leitura) | Mostra a URL registrada para as notificações de mudanças de status das recorrências (CRIADA, APROVADA, REJEITADA, EXPIRADA,… |
| `pix-bacen.webhook.excluir.rec` | DELETE | `/webhookrec` | `webhookrec.write` | não (escrita) | Remove a configuração de webhook de mudanças de status das recorrências (CRIADA, APROVADA, REJEITADA, EXPIRADA, CANCELADA) |
| `pix-bacen.webhook.assinar_webhook.cobr` | PUT | `/webhookcobr` | `webhookcobr.write` | não (escrita) | Registra a URL base que receberá as notificações de mudanças de status das cobranças recorrentes e das suas tentativas de… |
| `pix-bacen.webhook.obter.cobr` | GET | `/webhookcobr` | `webhookcobr.read` | sim (leitura) | Mostra a URL registrada para as notificações de mudanças de status das cobranças recorrentes e das suas tentativas de… |
| `pix-bacen.webhook.excluir.cobr` | DELETE | `/webhookcobr` | `webhookcobr.write` | não (escrita) | Remove a configuração de webhook de mudanças de status das cobranças recorrentes e das suas tentativas de liquidação |
| `pix-bacen.assinatura.criar` | POST | `/rec` | `rec.write` | não (escrita) | Cria a recorrência (autorização de débito recorrente) do Pix Automático: o contrato entre recebedor e pagador que define… |
| `pix-bacen.assinatura.obter` | GET | `/rec/{idRec}` | `rec.read` | sim (leitura) | Devolve uma recorrência pelo idRec, com status atual, histórico de mudanças de status, dados do pagador quando já autorizada,… |
| `pix-bacen.assinatura.listar` | GET | `/rec` | `rec.read` | sim (leitura) | Lista as recorrências criadas no período, com filtros por devedor, status, convênio e presença de location |
| `pix-bacen.assinatura.atualizar` | PATCH | `/rec/{idRec}` | `rec.write` | não (escrita) | Altera dados da recorrência (devedor, calendário, valor, location) ou a encerra enviando status CANCELADA |
| `pix-bacen.assinatura.enviar.solicitacao` | POST | `/solicrec` | `solicrec.write` | não (escrita) | Envia ao PSP do pagador o pedido de confirmação da recorrência (jornada 1 de autorização): o pagador recebe a solicitação no… |
| `pix-bacen.assinatura.obter.solicitacao` | GET | `/solicrec/{idSolicRec}` | `solicrec.read` | sim (leitura) | Devolve o estado de uma solicitação de confirmação: se foi enviada, recebida pelo PSP pagador, aceita, rejeitada ou expirada,… |
| `pix-bacen.assinatura.atualizar.solicitacao` | PATCH | `/solicrec/{idSolicRec}` | `solicrec.write` | não (escrita) | Cancela uma solicitação de confirmação ainda pendente, enviando status CANCELADA |
| `pix-bacen.location_pagamento.criar.recorrencia` | POST | `/locrec` | `payloadlocationrec.write` | não (escrita) | Cria a URL que serve o payload JSON da recorrência, usada no QR Code de adesão ao Pix Automático (jornadas 2, 3 e 4) |
| `pix-bacen.location_pagamento.obter.recorrencia` | GET | `/locrec/{id}` | `payloadlocationrec.read` | sim (leitura) | Devolve uma location de recorrência pelo id, com a URL e o idRec atualmente vinculado, quando houver |
| `pix-bacen.location_pagamento.listar.recorrencia` | GET | `/locrec` | `payloadlocationrec.read` | sim (leitura) | Lista as locations de recorrência criadas no período, com filtro por convênio e pela existência de idRec vinculado |
| `pix-bacen.location_pagamento.desvincular.id_rec` | DELETE | `/locrec/{id}/idRec` | `payloadlocationrec.write` | não (escrita) | Remove o vínculo entre a location de recorrência e o idRec que ela serve, mantendo location e recorrência |
| `pix-bacen.cobranca.criar.cobr` | PUT | `/cobr/{txid}` | `cobr.write` | não (escrita) | Cria a cobrança de uma parcela dentro de uma recorrência aprovada do Pix Automático, com txid definido por você |
| `pix-bacen.cobranca.criar.cobr_txid_psp` | POST | `/cobr` | `cobr.write` | não (escrita) | Cria uma parcela da recorrência deixando o txid a cargo do PSP |
| `pix-bacen.cobranca.atualizar.cobr` | PATCH | `/cobr/{txid}` | `cobr.write` | não (escrita) | Cancela uma cobrança recorrente enviando status CANCELADA, desde que ainda não tenha chegado a data prevista da primeira… |
| `pix-bacen.cobranca.obter.cobr` | GET | `/cobr/{txid}` | `cobr.read` | sim (leitura) | Devolve uma cobrança recorrente pelo txid, com status, valor, histórico de status e o array tentativas, que mostra cada… |
| `pix-bacen.cobranca.listar.cobr` | GET | `/cobr` | `cobr.read` | sim (leitura) | Lista as cobranças recorrentes criadas no período, com filtros por recorrência, devedor, status e convênio |
| `pix-bacen.cobranca.criar.retentativa_cobr` | POST | `/cobr/{txid}/retentativa/{data}` | `cobr.write` | não (escrita) | Pede uma nova tentativa de liquidação de uma cobrança recorrente que não foi paga, para a data informada no path |

**Catalogados sem detalhamento (3)** — endpoints públicos servidos na *location*, consumidos pelo aplicativo do PSP **pagador** e não pela automação do usuário recebedor: `GET /{pixUrlAccessToken}`, `GET /cobv/{pixUrlAccessToken}` (aceita `codMun` e `DPP`) e `GET /rec/{recUrlAccessToken}`.

### Armadilhas

1. **Não existe base URL do padrão.** Cada PSP publica a sua, para produção e homologação, e a posição do `/v2` varia. Base URL, URL de token, credenciais e certificado têm de ser configuração, nunca código.
2. **mTLS em tudo.** O certificado vai também na chamada do token, e o token fica vinculado ao thumbprint dele. Proxy ou API gateway que termina o TLS no meio do caminho quebra a integração com 401 inexplicável. Trocou o certificado? Limpe o cache de tokens.
3. **O `txid` é do recebedor, tem 26 a 35 caracteres alfanuméricos e é único por CPF/CNPJ para sempre** — não pode ser reaproveitado nem depois de a cobrança ser removida. Quem usa `POST /cob` deixa o PSP gerar o txid e perde a idempotência.
4. **Webhook só notifica Pix com `txid`**, e é aviso, não prova: sem assinatura de payload, confirme por `GET /pix` ou `GET /cob/{txid}` antes de baixar o título, e trate reentrega duplicada por `endToEndId`.
5. **Valores são string** com duas casas decimais (padrão `\d{1,10}\.\d{2}`) e datas seguem RFC 3339 com fuso. Serializar float quebra a validação; comparar horários sem normalizar o fuso joga transações da virada do mês para o mês errado.
6. **Cada PSP implementa só os produtos que você contratou.** 403 `AcessoNegado` recorrente em `cobv`, `lotecobv` ou Pix Automático quase sempre é contrato, não bug. Confira o `scope` devolvido na resposta do token.
7. **Listagens de cobrança filtram a data de criação, não a de pagamento nem a de vencimento.** Para fechamento de caixa, use `GET /pix`; para vencimentos do mês, traga um período de criação largo e filtre no seu lado.
8. **O valor pago raramente é igual a `valor.original` em `cobv`**: quem paga depois do vencimento paga original + multa + juros − desconto − abatimento, e a composição só aparece em `componentesValor`, depois do pagamento.
9. **Devolução tem janela de 90 dias** desde a liquidação do Pix original, o `id` é seu (repetir o mesmo id em outra devolução do mesmo `e2eid` dá 400), e HTTP 201 não significa dinheiro devolvido — o status inicial é `EM_PROCESSAMENTO` e pode virar `NAO_REALIZADO`.
10. **Lote é assíncrono e fechado.** `PUT /lotecobv/{id}` devolve 202 sem corpo; o resultado de cada parcela só aparece em `GET /lotecobv/{id}`, com o objeto `problema` nas recusas. Depois de criado, não se adiciona nem remove cobrança do lote.
11. **Power Query não alcança esta API.** O `Web.Contents` do Excel e do Power BI não envia certificado cliente, e o mTLS é obrigatório até para obter o token — logo, **nenhuma** leitura funciona no Power Query, em nenhum PSP. A alternativa é um script agendado que grava CSV/XLSX e o Power Query lê o arquivo. Registrado em `system.json` como `kit_power_query.viavel = false`.
12. **Extensões proprietárias existem** (campos a mais, endpoints de saldo, QR em PNG, split, token no webhook). O que não está na spec do Bacen não é portável entre PSPs — se usar, documente como dependência.

### Lacunas

| Campo | O que falta | Impacto |
|---|---|---|
| `api.base_urls` | O padrão não define base URL; os `servers` da spec são exemplos (`pix.example.com`). Cada PSP publica a sua, e a posição do `/v2` varia. | alto |
| `execucao_auth.base_url_por_ambiente` / `token_url` | `null` porque não há host no padrão. Sem a URL base e a de token do PSP, o executor não monta chamada nenhuma; as duas entram como credenciais de configuração no cofre. | alto |
| `ambiente_testes.sandbox` | Não encontrei sandbox, mock ou coleção de testes oficial do Bacen para a API Pix (a organização `bacen` no GitHub só tem quickstart do DICT, restrito a participantes). Se houver algo para participantes em área logada, não é público. | alto |
| `autenticacao.expiracao_token` e URL do token | Endpoint de token, TTL e formato do segredo não estão na spec nem no manual (o `tokenUrl` da spec é exemplo). Documentados como PSP-dependentes; o endpoint `pix-bacen.autenticacao.autenticar` está marcado `inferido`. | médio |
| `limites.rate_limit` | Nenhum limite de requisições, payload ou timeout é definido pelo padrão; o manual só exige alta disponibilidade. Não encontrei número oficial. | médio |
| `webhooks.verificacao_assinatura` | O padrão não define assinatura de payload nem cabeçalho de verificação; a proteção é o mTLS do canal. Vários PSPs acrescentam token na URL ou cabeçalho próprio — desvio a registrar na ficha de cada PSP. | médio |
| `comercial.custo_api` | Tarifas por Pix recebido e por cobrança são definidas por cada PSP em contrato; não há tabela oficial do arranjo. | médio |
| `taxonomia.entidades` | Não existe entidade canônica para *location* de payload (`/loc`, `/locrec`). Mapeada como `Cobranca`/`Assinatura` com qualificador `location`. Sugestão: entidade `LocationPagamento`. | baixo |
| `taxonomia.acoes` | Não existe ação `desvincular` para `DELETE /loc/{id}/txid` e `DELETE /locrec/{id}/idRec`, que removem só o vínculo. Foi usado `excluir` com observação. | baixo |
| `POST /cobr/{txid}/retentativa/{data}` | Mapeado como `Cobranca`/`criar` com qualificador `retentativa_cobr` por falta de ação canônica para "solicitar nova tentativa de liquidação". A semântica real é agendar uma tentativa. | baixo |
| Endpoints `CobPayload`/`RecPayload` | Catalogados sem detalhamento: quem os chama é o aplicativo do PSP pagador, não a automação do usuário recebedor. | baixo |

### Onde a confiança é menor

- **`pix-bacen.autenticacao.autenticar` é o único endpoint marcado `inferido`.** O caminho `/oauth/token`, o método de autenticação do cliente (Basic x corpo), o TTL e o formato do token não são padronizados pelo Bacen; o que está verificado é a *obrigação* do fluxo client credentials sobre mTLS com token vinculado ao certificado (Manual de Padrões, Anexo II, 3.1) e os nomes dos escopos (spec 2.10.0). O restante é o comportamento usual de um Authorization Server OAuth2, não um fato documentado pelo arranjo.
- **Tudo que é operacional depende do PSP** e não pôde ser verificado em fonte oficial do Bacen: rate limit, TTL de token, tamanho máximo de lote, janela máxima de consulta, `itensPorPagina` efetivo, SLA e reentrega de webhook, tarifas e prazo de aprovação.
- **Nenhuma chamada foi feita contra API real** — não há credencial de PSP, e a regra 2.1 da especificação do catálogo proíbe. Os exemplos de resposta são autorais, construídos a partir dos schemas e dos exemplos da spec oficial, com CPF/CNPJ de teste (`00000000000`, `00000000000191`), chave Pix e identificadores obviamente fictícios.
- **Prazos do Pix Automático** (antecedência mínima entre criação da cobrança e vencimento, janela de agendamento) estão descritos no Guia de Implementação do Pix Automático e podem ser mais restritos no PSP; a ficha registra a regra qualitativa, não o número.

### Monitoramento

- Changelog: https://github.com/bacen/pix-api/releases (e `changelog.md` no repositório)
- Breaking changes: releases do repositório `bacen/pix-api`, comunicados do Fórum Pix e Informes SPI publicados em bcb.gov.br; os PSPs replicam os prazos de adoção.
- Frequência de revisão sugerida: **mensal** (pagamentos).
- Regra de versionamento: SemVer com quatro elementos (major.minor.patch.rc); só o major aparece no path (`v2`). Adição de recursos, de parâmetros opcionais, de campos em respostas, de itens em enumerações e mudança de ordem de campos são **retrocompatíveis** e podem sair a qualquer momento — o cliente precisa tolerá-las (parser não estrito, enum desconhecido não pode derrubar a integração).

### Fontes (consulta 2026-09-17)

| Fonte | Versão | URL |
|---|---|---|
| Repositório oficial da especificação da API Pix (organização `bacen`, verificada no GitHub como Banco Central do Brasil, site bcb.gov.br) | — | https://github.com/bacen/pix-api |
| Release 2.10.0 da API Pix (`spec.yaml`, `spec.json`, `spec.html`), publicada em 19/08/2026 | 2.10.0 | https://github.com/bacen/pix-api/releases/tag/2.10.0 |
| Especificação renderizada (branch master) | 2.10.0 | https://bacen.github.io/pix-api/index.html |
| Manual de Padrões para Iniciação do Pix (Anexo II: especificação técnica e requisitos de segurança da API) | 2.10.0 | https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf |
| Regulamentação do Pix (Resolução BCB nº 1/2020, Regulamento do Pix e manuais do arranjo) | — | https://www.bcb.gov.br/estabilidadefinanceira/pix?modalAberto=regulamentacao_pix |
| Guia de implementação do Pix Automático | — | https://www.bcb.gov.br/content/estabilidadefinanceira/pix/automatico/guia_pix_automatico.pdf |
| Página oficial do Pix no Banco Central | — | https://www.bcb.gov.br/estabilidadefinanceira/pix |
