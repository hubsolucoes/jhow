# LOTE 3 — SEFAZ (NF-e/NFC-e), NFE.io, PlugNotas

Concluído em 2026-09-18.

## Resumo

| Sistema | Status | Endpoints (detalhados + catalogados) | Executáveis | FAQ | Índice | Validador |
|---|---|---|---|---|---|---|
| nfe-io | documentado | 43 + 142 | 30 | 17 | **69** | 0 erros |
| plugnotas | documentado | 90 + 94 | 56 | 20 | **62** | 0 erros |
| sefaz-nfe | documentado | 12 + 8 | 5 | 15 | **43** | 0 erros |

**Catálogo acumulado:** 10 sistemas, 596 endpoints detalhados, 257 executáveis pelo assistente.

## Índice de integrabilidade

- **NFE.io (69):** melhor material para IA encontrado até agora no fiscal brasileiro — 15 specs OpenAPI oficiais, `llms.txt` por produto, versão Markdown de cada página e uma seção dedicada a agentes. Webhooks com assinatura. Perde por chave estática dupla, três estilos de paginação e limite de requisições não publicado.
- **PlugNotas (62):** cobertura completa (184 operações documentadas, 100% da spec) e sandbox público sem cadastro. Perde por chave estática, sem limite publicado e sem preço público.
- **SEFAZ (43):** documentação oficial profunda (MOC 7.0 e Notas Técnicas), mas é o oposto de uma API moderna: SOAP, certificado ICP-Brasil, sem webhooks, sem endereço único e com credenciamento estadual.

## Comparação dos três gateways fiscais do catálogo

| | Focus NFe | PlugNotas | NFE.io |
|---|---|---|---|
| Índice | 67 | 62 | 69 |
| NF-e / NFC-e | sim | sim | sim |
| NFS-e | sim | sim (forte) | sim (origem do produto) |
| CT-e | sim | **não** | não |
| MDF-e | sim | sim (só modal rodoviário publicado) | não |
| Sandbox | sim | sim, público e sem cadastro (é mock) | não há host separado |
| Webhook assinado | não | não | **sim (HMAC)** |

Essa tabela é material direto de pré-venda: responde "qual contratar" conforme o documento fiscal que o cliente emite.

## Achados que afetam o produto

1. **Novo tipo de autenticação `certificado_icp_brasil`**, criado a partir da ficha da SEFAZ e já aplicado na especificação, no validador e no executor. Vale também para CT-e, MDF-e, eSocial e EFD-Reinf. O executor recusa esse tipo com explicação: além do certificado no canal, cada documento precisa de assinatura XML e costuma haver credenciamento estadual.
2. **Reforma Tributária muda os códigos de retorno.** A NT 2025.002-RTC ampliou o `cStat` de 3 para 4 posições nas rejeições de IBS/CBS/IS e reestruturou o número do protocolo. Os gateways repassam esses códigos, então Focus NFe, PlugNotas e NFE.io precisam de revisão nesse ponto.
3. **NFE.io tem dois hosts quase idênticos e duas chaves diferentes** (`api.nfe.io` para NFS-e, `api.nfse.io` para NF-e/NFC-e). O host de cada endpoint está registrado, porque o executor não teria como adivinhar.
4. **Ambiente por inscrição, não por endereço** (NFE.io): teste e produção convivem no mesmo host, separados pela inscrição municipal ou estadual. Uma leitura mal filtrada mistura nota de teste com nota real.
5. **Captura fiscal cobra por documento** (NFE.io): reposicionar o cursor de leitura recaptura e recobra o histórico. Todos esses endpoints ficaram como escrita insegura.
6. **Documentação pensada para IA está virando padrão.** Asaas, Pagar.me, Mercado Pago e NFE.io publicam versão em texto puro das páginas. Isso baixa muito o custo de manter o catálogo atualizado.

## Lacunas relevantes

- **SEFAZ:** não foi possível confirmar em fonte oficial as URLs de homologação das 27 UFs (confirmadas SVRS, SP, MG, PE e o Ambiente Nacional); sem limite numérico de requisições; prazo de cancelamento da NFC-e é estadual.
- **PlugNotas:** não emite CT-e; MDF-e sem leiaute publicado para modais além do rodoviário; sandbox é mock compartilhado e a documentação não diz o que é simulado.
- **NFE.io:** preço público só para NFS-e; NFS-e Inbound sem spec; divergências internas entre páginas oficiais.

## Menor confiança

- **SEFAZ:** URLs de homologação fora das UFs confirmadas e o roteamento dos novos eventos de IBS/CBS.
- **PlugNotas:** campos do modal rodoviário do MDF-e vieram do exemplo, não do schema; catálogo de eventos de webhook inferido.
- **NFE.io:** família NFS-e Inbound inteira (sem spec) e envelopes de algumas listagens.

## Sugestões de taxonomia (v1.3, pendente de decisão)

| Tipo | Proposta | Hoje | Origem |
|---|---|---|---|
| entidade | `Disponibilidade` | `NotaFiscal` + `consultar_status` | status do ambiente (SEFAZ); deve reaparecer em vários sistemas |
| entidade | `CertificadoDigital` | `Empresa` + qualificador | PlugNotas, Focus NFe |
| entidade | `AssinaturaDistribuicao` | `Empresa` | ativação de captura fiscal (NFE.io) |
| ação | `testar` | `enviar` | teste de webhook que dispara requisição real (PlugNotas) |
| ação | `sincronizar` | `atualizar` | reconciliar estado local com o do órgão autorizador (PlugNotas) |
| ajuste | ampliar `Relatorio` | — | incluir relatório entregue como JSON agregado, não só arquivo |

## Próximo lote sugerido

Lote 4: `omie`, `tiny`, `conta-azul` — ERPs nacionais de grande adoção, que fecham o ciclo pedido → nota → financeiro com o que já está documentado.
