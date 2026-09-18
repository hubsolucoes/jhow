# SEFAZ — NF-e e NFC-e (web services oficiais)

**Slug:** `sefaz-nfe` · **Categoria:** `fiscal_governo` · **Status:** documentado
**Estilo de API:** SOAP 1.2 (não é REST) · **Versão:** leiaute 4.00 · **MOC vigente:** versão 7.0
**Data da consulta:** 2026-09-18 · **Revisão sugerida:** mensal

---

## 1. Resumo comercial

### O que é

Não é um fornecedor, é o **ambiente autorizador do Fisco**. São os web services SOAP que as administrações tributárias estaduais e a Receita Federal publicam para autorizar, consultar, cancelar, corrigir, inutilizar e distribuir NF-e (modelo 55) e NFC-e (modelo 65). Todo gateway fiscal do mercado — Focus NFe, PlugNotas, NFe.io, Tecnospeed — é uma camada por cima disto.

### O que dá para fazer

| Capacidade | Serviço oficial |
|---|---|
| Autorizar NF-e e NFC-e | NfeAutorizacao (lote assíncrono ou síncrono) |
| Acompanhar o processamento do lote | NfeRetAutorizacao |
| Consultar a situação de um documento | NfeConsultaProtocolo |
| Verificar se o autorizador está no ar | NfeStatusServico |
| Fechar buraco de numeração | NfeInutilizacao |
| Cancelar, corrigir (CC-e), manifestar, registrar EPEC | NFeRecepcaoEvento |
| Descobrir e baixar notas recebidas de fornecedores | NFeDistribuicaoDFe (Ambiente Nacional) |
| Consultar cadastro de contribuinte do ICMS | NfeConsultaCadastro |

### Custo

Não há tarifa por chamada nem contrato com a SEFAZ. O custo é indireto:

- **Certificado ICP-Brasil A1**, renovado anualmente (valor comercial, algumas centenas de reais).
- **Credenciamento estadual** como emissor — processo administrativo, sem endpoint.
- **Engenharia**: MVP da ordem de **400 horas**, mais manutenção permanente das Notas Técnicas.

### Prazo e índice de integrabilidade

**Índice: 43/100** — documentação oficial profunda e rastreável (14/20), mas autenticação por certificado em mTLS sem OAuth (4/15), ausência total de webhooks (1/15), sandbox que exige certificado pago e credenciamento (6/15) e barreira de acesso real (3/10). É o piso de integrabilidade de todo o catálogo fiscal, e é exatamente por isso que o mercado de gateways existe.

**Complexidade:** muito alta. Um MVP honesto de emissão de NF-e com contingência leva meses, não semanas.

### Quando integrar direto (e quando não)

Integrar direto compensa com **volume alto** o bastante para a mensalidade do gateway doer, **equipe fiscal e de TI dedicada** e necessidade de **controle fino do XML**. Fora disso, gateway — a comparação está na seção 8.

---

## 2. Autenticação

**Não existe token, chave de API, login nem OAuth.** São duas camadas independentes:

### Camada 1 — canal (mTLS)

TLS 1.2 ou superior com **autenticação mútua**. O cliente apresenta um certificado ICP-Brasil que precisa conter:

- CNPJ no `otherName OID 2.16.76.1.3.3` ou CPF no `OID 2.16.76.1.3.1`;
- Extended Key Usage com permissão de **Autenticação Cliente**.

### Camada 2 — documento (XML-DSig)

Toda mensagem de escrita vai assinada digitalmente com XML-DSig (Enveloped + C14N), sobre o elemento identificado pelo atributo `Id` (`infNFe`, `infInut`, `infEvento`). O certificado de assinatura precisa conter o **CNPJ/CPF do emitente do documento** — pode ser matriz ou qualquer filial do mesmo CNPJ base. O XML não deve conter `X509SubjectName`, `X509IssuerSerial`, `X509IssuerName`, `X509SerialNumber` nem `X509SKI`.

O certificado de transmissão e o de assinatura **podem ser diferentes** — é assim que um escritório contábil transmite documentos assinados por certificados de clientes.

### Camada 3 — credenciamento (administrativa)

Nada funciona sem o CNPJ credenciado como emissor na SEFAZ da UF. Sem isso, `cStat 203`.

### Registro em `execucao_auth`

Registramos `"tipo": "nenhum"` com explicação em `observacao`. Nenhum valor do enum da especificação descreve certificado ICP-Brasil em mTLS somado a XML-DSig; `mtls_oauth2` não serve porque **não há OAuth**. A necessidade de um tipo novo `certificado_icp_brasil` está em `lacunas[]`. Consequência prática: **o executor do produto não consegue montar nenhuma chamada a partir deste bloco**, nem mesmo as consultas puras.

---

## 3. Não existe base URL única

Esta é a diferença estrutural em relação a qualquer API comercial. As URLs variam em **três dimensões simultâneas**: UF do emitente, ambiente (produção/homologação) e modelo (55 x 65).

### Autorizadores próprios (produção)

| UF | Base |
|---|---|
| AM | `https://nfe.sefaz.am.gov.br/services2/services/` |
| BA | `https://nfe.sefaz.ba.gov.br/webservices/` |
| GO | `https://nfe.sefaz.go.gov.br/nfe/services/` |
| MG | `https://nfe.fazenda.mg.gov.br/nfe2/services/` |
| MS | `https://nfe.sefaz.ms.gov.br/ws/` |
| MT | `https://nfe.sefaz.mt.gov.br/nfews/v2/services/` |
| PE | `https://nfe.sefaz.pe.gov.br/nfe-service/services/` |
| PR | `https://nfe.sefa.pr.gov.br/nfe/` |
| RS | `https://nfe.sefazrs.rs.gov.br/ws/` |
| SP | `https://nfe.fazenda.sp.gov.br/ws/` |

### Autorizadores virtuais e Ambiente Nacional

| Autorizador | Atende | Base (produção) |
|---|---|---|
| SVAN | MA | `https://www.sefazvirtual.fazenda.gov.br/` |
| SVRS | AC, AL, AP, CE, DF, ES, PA, PB, PI, RJ, RN, RO, RR, SC, SE, TO | `https://nfe.svrs.rs.gov.br/ws/` |
| SVC-AN (contingência) | AC, AL, AP, CE, DF, ES, MG, PA, PB, PI, RJ, RN, RO, RR, RS, SC, SE, SP, TO | `https://www.sefazvirtual.fazenda.gov.br/` |
| SVC-RS (contingência) | AM, BA, GO, MA, MS, MT, PE, PR | `https://nfe.svrs.rs.gov.br/ws/` |
| AN — NFeDistribuicaoDFe 1.00 | todos | `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx` |
| AN — RecepcaoEvento 4.00 (manifestação e EPEC) | todos | `https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx` |

> Para consulta cadastro, o SVRS atende apenas AC, ES, RN, PB e SC, e em host próprio: `https://cad.svrs.rs.gov.br/ws/cadconsultacadastro/cadconsultacadastro4.asmx`.

### Homologação confirmada nesta consulta

| Autorizador | Base |
|---|---|
| SVRS NF-e (55) | `https://nfe-homologacao.svrs.rs.gov.br/ws/` |
| SVRS NFC-e (65) | `https://nfce-homologacao.svrs.rs.gov.br/ws/` |
| SP | `https://homologacao.nfe.fazenda.sp.gov.br/ws/` |
| MG | `https://hnfe.fazenda.mg.gov.br/nfe2/services/` |
| PE | `https://nfehomolog.sefaz.pe.gov.br/nfe-service/services/` |
| AN RecepcaoEvento | `https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx` |

> **A tabela oficial e completa de produção** está no Portal Nacional da NF-e, em *Serviços > Relação de Serviços Web*:
> <https://www.nfe.fazenda.gov.br/portal/webServices.aspx?tipoConteudo=OUC/YVNWZfo=>
> As URLs de **homologação** não estão lá: consulte o portal da SEFAZ da UF ou o portal do SVRS (<https://dfe-portal.svrs.rs.gov.br/Nfe/Servicos> e `/NFCE/Servicos`).
> NFC-e do SVRS em produção: `https://nfce.svrs.rs.gov.br/ws/`.

---

## 4. Como é a chamada

Envelope SOAP 1.2, WS-I Basic Profile, `Document/Literal`, `Content-Type: application/soap+xml; charset=utf-8`:

```xml
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Header>
    <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <cUF>43</cUF>
      <versaoDados>4.00</versaoDados>
    </nfeCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <!-- enviNFe, consSitNFe, inutNFe, envEvento, distDFeInt... -->
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>
```

**O HTTP devolve sempre 200.** O resultado de negócio está em `cStat` (código) e `xMotivo` (texto). Não há 401, 403, 422 nem 429.

---

## 5. Endpoints canônicos

| ID canônico | Serviço | Processo | Executável pelo assistente |
|---|---|---|---|
| `sefaz-nfe.nota_fiscal.emitir` | NfeAutorizacao | assíncrono/síncrono | ❌ escrita fiscal |
| `sefaz-nfe.nota_fiscal.consultar_status.lote` | NfeRetAutorizacao | assíncrono | ✅ leitura (mas ver nota) |
| `sefaz-nfe.nota_fiscal.consultar_status.protocolo` | NfeConsultaProtocolo | síncrono | ✅ leitura |
| `sefaz-nfe.nota_fiscal.consultar_status.servico` | NfeStatusServico | síncrono | ✅ leitura |
| `sefaz-nfe.nota_fiscal.inutilizar` | NfeInutilizacao | síncrono | ❌ escrita irreversível |
| `sefaz-nfe.nota_fiscal.cancelar` | RecepcaoEvento 110111 | síncrono | ❌ escrita fiscal |
| `sefaz-nfe.nota_fiscal.cancelar.substituicao` | RecepcaoEvento 110112 (NFC-e) | síncrono | ❌ escrita fiscal |
| `sefaz-nfe.nota_fiscal.corrigir` | RecepcaoEvento 110110 (CC-e) | síncrono | ❌ escrita fiscal |
| `sefaz-nfe.nota_fiscal.manifestar` | RecepcaoEvento 210200/210210/210220/210240 (AN) | síncrono | ❌ declaração ao Fisco |
| `sefaz-nfe.nota_fiscal.emitir.epec` | RecepcaoEvento 110140 (AN) | síncrono | ❌ escrita fiscal |
| `sefaz-nfe.nota_fiscal.listar` | NFeDistribuicaoDFe (AN) | síncrono | ✅ leitura |
| `sefaz-nfe.pessoa.obter.cadastro_icms` | NfeConsultaCadastro | síncrono | ✅ leitura |

> **Nota importante sobre as leituras marcadas ✅:** elas são consultas puras e por isso `seguro_para_executar: true`. Na prática, porém, **o executor não consegue montar nenhuma delas**, porque `execucao_auth.tipo` está como `nenhum` — seria preciso carregar certificado e chave no contexto TLS e montar o envelope SOAP, coisas que o bloco não descreve. Isso está registrado em `motivo_inseguro`/`observacao` e em `lacunas[]`.

**Catalogados e não detalhados** (`endpoints_secundarios`): NfeAutorizacaoLoteZip, evento 110130 (Ator Interessado/Transportador), 111500/111501 (Pedido de Prorrogação), 110192 (Insucesso na Entrega), ECONF (Conciliação Financeira), os eventos de IBS/CBS da NT 2025.002-RTC, o 110001 (Cancelamento de Evento) e os eventos da Suframa.

---

## 6. Limites

| Item | Valor |
|---|---|
| NF-e por lote (modelo 55) | 50 |
| NFC-e por lote (modelo 65) | **1** — mais de um devolve `cStat 126` (NT 2023.002) |
| Eventos por lote | 20 |
| Documentos por resposta do NFeDistribuicaoDFe | 50 |
| Números por pedido de inutilização | 10.000 |
| Retenção do NFeDistribuicaoDFe | **3 meses** |
| Espera antes de consultar o recibo | mínimo 15 segundos |
| Intervalo entre consultas de status em laço | mínimo 3 minutos |
| Rate limit numérico | **não publicado** |

Compressão opcional: `NfeAutorizacaoLoteZip` recebe `enviNFe` em GZip + Base64 (reduz ~70%); falha de descompactação devolve `cStat 416`. Na distribuição, cada `docZip` vem individualmente em GZip + Base64.

**Paginação:** só o NFeDistribuicaoDFe pagina, por cursor NSU (`ultNSU` no pedido; `ultNSU` e `maxNSU` na resposta). Continue enquanto `ultNSU < maxNSU`. Reconsultar o mesmo `ultNSU` em intervalo curto devolve `cStat 656` (consumo indevido).

---

## 7. Webhooks

**Não existem.** A SEFAZ nunca chama o seu servidor. O substituto é o polling do **NFeDistribuicaoDFe**, que é como uma empresa descobre que emitiram nota contra o seu CNPJ. Detalhe de negócio: antes da manifestação do destinatário (Ciência, Confirmação ou Operação não Realizada), só chega o **resumo** da NF-e; o XML completo vem depois.

---

## 8. Armadilhas

### 8.1 Certificado A1 x A3

Só o **A1** (arquivo `.pfx`/`.p12`) serve para integração desassistida. O A3 fica em token/smartcard, exige PIN e não exporta a chave privada. Converter antes de usar:

```bash
openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out cert.pem
openssl pkcs12 -in certificado.pfx -nocerts -nodes  -out chave.pem
```

Erros 280–285 quase sempre são cadeia intermediária faltando, certificado SSL de servidor no lugar de e-CNPJ, ou validade vencida.

### 8.2 Contingência — e por que ela muda a chave de acesso

Caindo o autorizador (`cStat 108`/`109`), há três saídas, **sem hierarquia entre elas**:

| Modalidade | `tpEmis` | Para onde vai |
|---|---|---|
| SVC-AN | 6 | `https://www.sefazvirtual.fazenda.gov.br/` |
| SVC-RS | 7 | `https://nfe.svrs.rs.gov.br/ws/` |
| EPEC | 4 | Ambiente Nacional, evento 110140 |
| Offline NFC-e | 9 | local, transmitida depois |

**`tpEmis` compõe a chave de acesso (posição 35).** A mesma venda emitida em contingência tem chave diferente da que teria em modo normal, e o EPEC **consome definitivamente** o número — a faixa não pode mais ser inutilizada (`cStat 241`). Por isso o MOC exige faixa de numeração exclusiva para contingência. Depois que o serviço volta, a NF-e do EPEC **precisa** ser transmitida ao autorizador de origem; o campo `chNFePend` da resposta lista os EPEC pendentes de conciliação.

### 8.3 CSC da NFC-e

O **Código de Segurança do Contribuinte** é solicitado em página web da SEFAZ da UF (também acessível pelo Portal Nacional da NFC-e). Não participa da autenticação: entra no **hash do QR Code** impresso no DANFE NFC-e. São 16 a 36 caracteres alfanuméricos, com um código sequencial de identificação de até 6 dígitos. **A empresa só pode ter 2 CSC válidos por UF ao mesmo tempo** — para pedir um terceiro é preciso revogar um dos anteriores. Homologação exige CSC próprio.

### 8.4 Numeração e séries

A numeração é responsabilidade exclusiva do contribuinte. Faixas de série reservadas:

| Faixa | Uso |
|---|---|
| 000–889 | aplicativo do contribuinte, emitente CNPJ, assinatura por e-CNPJ |
| 890–899 | NFA-e no site do Fisco, CNPJ ou CPF |
| 900–909 | NFA-e no site do Fisco, emitente CNPJ |
| 910–919 | NFA-e no site do Fisco, emitente CPF |
| 920–969 | aplicativo do contribuinte, emitente CPF, assinatura por e-CPF |

Buraco na sequência se fecha com **NfeInutilizacao**, antes do prazo estadual. Número já usado ou já coberto por EPEC derruba o pedido inteiro (`cStat 241`); faixa sobreposta a inutilização anterior, `cStat 256`; pedido repetido, `cStat 563` (a resposta traz o `nProt` do pedido original — guarde-o em vez de repetir).

### 8.5 Prazos

| Evento | Prazo |
|---|---|
| Cancelamento de NF-e | **24 horas** da autorização (`cStat 501` depois disso; `155` quando a UF aceita fora do prazo) |
| Cancelamento por substituição (NFC-e) | **7 dias** (168 horas) |
| Cancelamento de NFC-e comum | definido em legislação estadual — em várias UF é de 30 minutos; **confirmar no RICMS da UF** |
| Carta de Correção | até 20 sequenciais por nota; cada uma substitui a anterior |
| Ciência da Emissão | **10 dias** da autorização |
| Manifestação conclusiva | **90 dias** da autorização (era 180; reduzido pelo Ajuste SINIEF 14/26, NT 2020.001 v1.60) |

### 8.6 Tamanho de lote e assincronismo

Resposta síncrona só acontece com `indSinc=1` **e** uma única NF-e no lote **e** autorizador que implemente o modo síncrono. No modo assíncrono a resposta imediata é só o recibo (`cStat 103`); é obrigatório aguardar **15 segundos** antes da primeira consulta e tratar `cStat 105` em laço.

### 8.7 O erro que mais custa dinheiro

**Timeout depois do POST de autorização.** Reenviar o mesmo XML devolve `cStat 204` (duplicidade); reenviar com novo `cNF` cria uma segunda nota fiscal real. A recuperação correta é sempre **consultar antes**: pelo recibo (NfeRetAutorizacao) ou pela chave (NfeConsultaProtocolo). Persista chave e recibo **antes** do POST.

### 8.8 Reforma Tributária (IBS/CBS/IS)

**NT 2025.002-RTC v1.51** (julho/2026), sobre a LC 214/2025, substituiu a NT 2024.002 no âmbito da NF-e/NFC-e:

- novo arquivo `DFeTiposBasicos_v1.00.xsd`, compartilhado por todos os DF-e;
- grupos novos: **UB** (IBS/CBS/IS por item), **VB** (total do item), **VC** (referenciamento de item de outro DF-e), **W03** (totais de IBS/CBS/IS);
- `CST` e `cClassTrib` por item — tabela divulgada pelo **Informe Técnico 2025.002-RTC**, em *Documentos > Diversos*;
- novas finalidades de emissão **nota de débito** e **nota de crédito** na NF-e modelo 55 (Ajuste SINIEF 49/2025);
- **`cStat` ampliado para 4 posições** nas rejeições exclusivas de IBS/CBS/IS, e **número do protocolo reestruturado** — os dois quebram parser existente;
- eventos novos de apuração (112110–112150, 211110–211150, 212110/212120, 412120/412130) mais o **110001** (Cancelamento de Evento), autorizados na **SVRS**, com orientação de **enviar um a um, sem lote**.

**Cronograma:** opcionais em produção durante 2025, validados apenas se preenchidos; **a partir de janeiro de 2026 as regras de validação de IBS e CBS passaram a ser aplicadas.**

Relacionadas e vigentes: **NT 2026.006** (vinculação NF-e × transação de *split payment*), **NT 2026.001 v1.02b** (Provedor de Assinatura e Autorização — PAA), **NT 2026.004 v1.01** (CNPJ alfanumérico), **NT 2026.007** (validação contra LCC-RFB e CCC), **NT 2014.002 v1.40** (distribuição de DF-e), **NT 2014.001 v1.41** (EPEC).

### 8.9 Por que a maioria usa gateway

| | Direto na SEFAZ | Gateway fiscal |
|---|---|---|
| Protocolo | SOAP 1.2 + XML-DSig | REST/JSON |
| Autenticação | certificado ICP-Brasil em mTLS | token no header |
| URL | dezenas, por UF/ambiente/modelo | uma |
| Contingência | sua responsabilidade | do gateway |
| Notas Técnicas | você acompanha | o gateway absorve |
| Custo | certificado + ~400h de MVP + manutenção | mensalidade / por documento |
| Controle do XML | total | limitado ao que a API expõe |

---

## 9. Lacunas

1. **`execucao_auth.tipo`** — nenhum valor do enum descreve certificado ICP-Brasil em mTLS + XML-DSig. Usamos `nenhum` com explicação; proposta de novo tipo `certificado_icp_brasil`. (A taxonomia v1.2 já tem esse valor em `enums.auth`, usado em `autenticacao.tipos`; falta o equivalente em `execucao_auth`.) **Impacto alto.**
2. **Entidade canônica para status de ambiente** — `NfeStatusServico` consulta a disponibilidade do autorizador, não um documento. Mapeado como `NotaFiscal` + `consultar_status` + qualificador `servico`; sugestão de entidade `Disponibilidade`/`ServicoFornecedor`. **Impacto baixo.**
3. **URLs de homologação de todas as UF** — confirmamos SVRS (55 e 65), SP, MG, PE e o AN de eventos. As demais precisam ser consultadas no portal estadual. **Impacto alto.**
4. **Rate limit numérico** — não publicado. Só há regras temporais e de quantidade. **Impacto médio.**
5. **Prazo de cancelamento da NFC-e comum** — definido em legislação estadual, não confirmado em fonte nacional. **Impacto médio.**
6. **URL de homologação do NFeDistribuicaoDFe** — a Relação de Serviços Web publica só produção; a de homologação (`hom1.nfe.fazenda.gov.br`) ficou marcada como **inferida**. **Impacto médio.**
7. **URLs próprias dos novos eventos de IBS/CBS** — a NT 2025.002-RTC diz que serão autorizados na SVRS e remete à Relação de Serviços Web, onde não localizamos seção específica. Documentados em `endpoints_secundarios` sem afirmar URL. **Impacto médio.**
8. **`power_query_m` null em todos os endpoints** — o Power Query não envia certificado cliente nem assina XML. Alternativa documentada: coletor em Python/.NET gravando CSV/Parquet. **Impacto médio.**

---

## 10. Fontes

| Documento | URL |
|---|---|
| Relação de Serviços Web (URLs de produção) | <https://www.nfe.fazenda.gov.br/portal/webServices.aspx?tipoConteudo=OUC/YVNWZfo=> |
| Manuais (MOC 7.0, anexos, DANFE NFC-e/QR Code v6.0, contingência offline NFC-e v2.0) | <https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=ndIjl+iEFdE=> |
| Notas Técnicas vigentes | <https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=> |
| MOC 7.00 — Visão Geral (PDF) | <https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=LrBx7WT9PuA=> |
| NT 2025.002-RTC v1.51 — Reforma Tributária | <https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=AKD/muSmiIY=> |
| NT 2023.002 v1.01 — NFC-e por CPF, fim da denegação, fim do lote | <https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=T3QyeMfpios=> |
| NT 2020.001 v1.60 — Manifestação do Destinatário (90 dias) | <https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=> |
| Manual DANFE NFC-e e QR Code v6.0 (CSC) | <https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=k/IuuaW4YiY=> |
| SVRS — serviços NF-e | <https://dfe-portal.svrs.rs.gov.br/Nfe/Servicos> |
| SVRS — serviços NFC-e | <https://dfe-portal.svrs.rs.gov.br/NFCE/Servicos> |
| SEFAZ-SP — URLs dos web services | <https://portal.fazenda.sp.gov.br/servicos/nfe/Paginas/URL-WEBSERVICES.aspx> |
| SPED MG — web services (AN de eventos, produção e homologação) | <https://portalsped.fazenda.mg.gov.br/spedmg/nfe/webservices/> |
| SEFAZ-PE — URLs de produção e homologação | <https://www.sefaz.pe.gov.br/Servicos/nota-fiscal-eletronica/Paginas/url-web-services-prod-homolog.aspx> |

**Todas as consultas em 2026-09-18.** Nenhum web service real da SEFAZ foi chamado (regra 2.1): o trabalho foi feito integralmente sobre a documentação oficial.

---

## 11. Relação com o `focus-nfe` deste catálogo

A ficha `focus-nfe` documenta um **gateway que encapsula exatamente estes web services**. O que muda ao integrar direto:

| | `focus-nfe` | `sefaz-nfe` |
|---|---|---|
| Protocolo | REST/JSON | SOAP 1.2 + XML |
| Autenticação | HTTP Basic com token no lugar do usuário | certificado ICP-Brasil em mTLS + XML-DSig |
| Base URL | duas (produção e homologação) | dezenas, por UF/ambiente/modelo |
| Assinatura do XML | o gateway assina | você assina |
| Webhooks | sim, com reentrega | **não existem** |
| Rate limit | 100 créditos/min documentado | não publicado |
| Contingência | tratada pelo gateway | sua responsabilidade (SVC, EPEC, offline) |
| Notas Técnicas | absorvidas pelo gateway | você acompanha e implementa |
| Power Query | viável | **inviável** (sem certificado cliente) |
| Custo | mensalidade / por documento | certificado + engenharia |

Em troca, integrando direto você controla cada campo do XML, não depende da disponibilidade de um terceiro e não paga por documento.
