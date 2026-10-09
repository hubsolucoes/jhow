# Nomus ERP — Nomus ERP Industrial e Nomus Start Industrial

**Slug:** `nomus` · **Categoria:** `erp_nacional` · **Status:** `documentado`
**Fornecedor:** Nomus Consultoria e Desenvolvimento em Tecnologia de Gestão Ltda EPP — <https://www.nomus.com.br>
**Índice de integrabilidade:** **29/100** · **Qualidade da doc:** 5/10 · **Consulta:** 2026-10-09

---

## 1. Resumo comercial

### O que é

ERP feito para indústria: engenharia de produto (lista de materiais, roteiros), PCP com MRP II, chão de fábrica (apontamentos, empenhos, reportes), estoque, compras, vendas e faturamento (NF-e e NFS-e), financeiro e, por projeto, CRM, qualidade, custos e SPED. São duas versões sobre a mesma base: o **Nomus ERP Industrial**, para médias e grandes, multiempresa, em nuvem ou servidor dedicado, e o **Nomus Start Industrial**, para pequenas indústrias do Simples, com um CNPJ e só em nuvem. As duas têm a API.

### O que dá para fazer pela API

API REST + JSON dentro do ERP de cada cliente, documentada numa **coleção Postman pública com 191 requisições** (133 leituras). Pelo recorte de leitura, que é o que o assistente executa:

| Bloco | O que sai | Endpoint |
|---|---|---|
| **Financeiro** | Títulos a receber e a pagar, recebimentos e pagamentos efetivados, boletos | `GET /contasReceber`, `/contasPagar`, `/recebimentos`, `/pagamentos`, `/boletos` |
| **Faturamento** | Itens faturados com cliente, município/UF, produto, CFOP, quantidade, valores e impostos | `GET /itensDocumentoSaida` |
| **Fiscal** | NF-e emitidas e importadas, NFS-e, NF-e destinadas pelos fornecedores com manifestação | `GET /nfes`, `/nfses`, `/nfesDestinadas` |
| **Comercial** | Propostas, pedidos de venda com itens e situação por item, clientes | `GET /propostas`, `/pedidos`, `/clientes` |
| **Compras** | Pedidos de compra com itens e parcelas | `GET /pedidoscompra` |
| **Estoque** | Documentos e movimentações, saldo e custo por produto numa data | `GET /documentosEstoque`, `/movimentacoesEstoque`, `/saldosEstoqueProduto/{idProduto}` |
| **Produção** | Ordens, apontamentos, empenhos de material | `GET /ordens`, `/apontamentos`, `/empenhos` |
| **Cadastros** | Produtos, pessoas (todos os papéis), empresas, centros de custo, tabelas de preço | `GET /produtos`, `/pessoas`, `/empresas`, `/centrosCusto`, `/tabelasPreco/{id}/itens` |

A API também grava (pedidos, clientes, produtos, recebimentos, ordens, apontamentos, inventário e outros), mas o assistente só explica e entrega o código dessas operações.

**Casos de uso de negócio**

| Caso | Valor | Endpoints |
|---|---|---|
| Fluxo de caixa previsto e realizado | Previsto (títulos por vencimento) e realizado (recebimentos e pagamentos por data) num só lugar, por empresa e por conta bancária. | `nomus.conta_receber.listar`, `nomus.conta_pagar.listar`, `nomus.pagamento.listar.recebimentos`, `nomus.pagamento.listar` |
| Inadimplência e carteira de cobrança | Aging por cliente com títulos confirmados em aberto, situação do boleto e contato do cliente para cobrança. | `nomus.conta_receber.listar`, `nomus.cobranca.listar`, `nomus.cliente.listar` |
| Faturamento por produto, cliente e região | Itens faturados com quantidade, valor, impostos, CFOP, cliente e município, prontos para tabela dinâmica ou Power BI. | `nomus.nota_fiscal.listar.itens_saida`, `nomus.nota_fiscal.listar`, `nomus.produto.listar` |
| Carteira de pedidos e funil comercial | Propostas por período, pedidos com situação de cada item e entrega prevista, por cliente e representante. | `nomus.orcamento.listar`, `nomus.pedido.listar.venda`, `nomus.cliente.listar` |
| Estoque valorizado e giro | Saldo e custo médio por empresa e setor numa data, mais o kardex do período. Viável para dezenas de produtos; para a base inteira, o limite de 20 s pesa. | `nomus.estoque.listar.saldo_produto`, `nomus.estoque.listar.movimentacoes`, `nomus.produto.obter` |
| Acompanhamento de produção (PCP) | Ordens com entrega e situação, apontamentos por recurso e funcionário, e saldo de material empenhado a requisitar. | `nomus.ordem_producao.listar`, `nomus.ordem_producao.listar.apontamentos`, `nomus.ordem_producao.listar.empenhos` |
| Compras e notas de fornecedores | Pedidos de compra com entrega prevista ao lado das NF-e destinadas ao CNPJ, com manifestação e fornecedor. | `nomus.pedido.listar.compra`, `nomus.nota_fiscal.listar.destinadas`, `nomus.pessoa.listar` |

### Custo e prazo

- **Custo da API:** não publicado à parte. O comparativo oficial lista a "API Nomus" como disponível no Start e no ERP Industrial; o acesso depende de ser cliente.
- **Liberação:** o próprio cliente copia a chave na tela Configuração Geral; não há aprovação de parceiro.
- **Prazo de MVP de leitura:** cerca de 32 horas (MVP de leitura com 8 a 10 consultas (contas a receber e a pagar, recebimentos, pagamentos, pedidos, itens faturados, produtos, saldo, ordens): montador do parâmetro query para período e empresa, paginação de 50 com espera de 20 s e tratamento do 429, conversão de números e datas campo a campo, cruzamento de ids com cadastros. Sem escrita.)
- **O gargalo é o limite de requisições:** 1 a cada 20 segundos, com páginas de 50. Uma carga inicial grande leva horas.

### Índice de integrabilidade — 29/100

| Componente | Pontos | Justificativa |
|---|---|---|
| Documentação | 10/20 | Coleção Postman oficial pública com 191 requisições em 73 pastas de recursos, quase todas com exemplo de resposta, mais 17 artigos na Central de Ajuda com tabelas de campos e enumerações. Perde pontos por não ter schema tipado nem catálogo de erros (401/403/404 não aparecem), por exemplos com URL trocada, uma requisição sem URL, descrições copiadas de outro recurso e regras divergentes entre coleção e artigos (operador = versus ==, rotas antigas de Processo e Contatos). |
| Sandbox | 3/15 | Não há sandbox público nem self-service. O comparativo oficial diz que a 'instalação de base de testes' é permitida no Nomus ERP Industrial (não no Start), sem procedimento, endereço ou custo publicados. O ambiente de homologação que aparece nos campos de NF-e é o da SEFAZ, não da API. |
| Autenticação | 4/15 | Chave estática única por ERP, enviada em Authorization: Basic em toda requisição. Sem OAuth, sem escopos, sem expiração e sem rotação documentada; a mesma chave serve para leitura e escrita. A própria descrição do formato (chave 'em Base64') é ambígua. |
| Webhooks | 0/15 | A API REST não publica webhooks nem eventos. As menções a webhook na Central de Ajuda são de conectores específicos (RD Station, Exact Sales) em que o Nomus recebe eventos, não de assinatura de eventos do ERP. |
| Limites e paginação | 3/10 | Paginação e limite estão documentados e o 429 traz o tempo de espera (tempoAteLiberar), o que é bom. Mas o tamanho de página é fixo em 50 e o limite publicado é de 1 requisição a cada 20 segundos: 1.000 registros levam cerca de 7 minutos e uma carga inicial de 50 mil registros, mais de 5 horas. |
| SDKs e comunidade | 2/10 | Nenhum SDK oficial nem pacote de comunidade localizado. A coleção Postman pode ser importada e serve de cliente de teste. |
| Acesso sem barreira | 6/10 | Documentação aberta sem login (Postman e Central de Ajuda). A chave é obtida pelo próprio cliente na tela Configuração Geral, sem aprovação de parceiro. A barreira é ser cliente do ERP, e a API está listada como disponível nos dois produtos (Start e ERP Industrial). |
| Versionamento | 1/5 | Sem versão no caminho, sem changelog e sem política de depreciação. Há ao menos um comportamento que muda com a versão do sistema instalado (processar inventário usa GET nas versões 2884.197 a 2884.220). |

---

## 2. Ficha técnica

### Autenticação

- Cabeçalho em **toda** requisição: `Authorization: Basic <chave>` e `Content-Type: application/json`.
- A chave fica em **Configuração Geral > "Chave de acesso para integração com o erp via REST"**. Não há login, token temporário, OAuth nem escopos; a mesma chave lê e grava.
- Apesar do "Basic", **não é usuário:senha**. A Central de Ajuda descreve o valor como a chave "em Base64"; a coleção envia a chave como está. Se a chave copiada for recusada, teste convertê-la para Base64 (lacuna registrada).
- Receita do executor (`execucao_auth`): `header_api_key`, header `Authorization`, prefixo `Basic `, credenciais `api_key` (segredo) e `base_url`.

### Ambientes

- **URL base por cliente**: endereço do ERP + contexto + `/rest`, no modelo `https://<empresa>.nomus.com.br/<empresa>/rest`. Instalações em servidor dedicado ou locais têm endereço próprio.
- **Sem sandbox.** O comparativo oficial permite "base de testes" só no ERP Industrial, sem procedimento nem custo publicados.
- O campo `ambiente` das NF-e (1 produção, 2 homologação) é o da SEFAZ, não da API.

### Limites

- **1 requisição a cada 20 segundos** (comparativo oficial Nomus Start x ERP Industrial).
- Excesso responde **429** com corpo `{"tempoAteLiberar": 20}`: esperar os segundos informados e repetir. Não há cabeçalho `Retry-After` documentado.
- Sem idempotência em escrita.

### Paginação

- Parâmetro `pagina`, começando em 1; **tamanho fixo de 50**, sem parâmetro de tamanho. Sem `pagina`, vêm os 50 mais recentes.
- Fim: página com menos de 50 registros.
- Exceções: `GET /etiquetas` (inicio a partir de 0, limite até 100) e o exemplo de `GET /usuarios` (inicio e limite).

### Filtro (parâmetro `query`)

- `campo<operador>valor`, operadores `==` `!=` `<` `<=` `>` `>=`; `;` = E, `,` = OU; vale para qualquer campo devolvido.
- Datas em `yyyy-MM-ddTHH:mm:ss`; a resposta devolve `dd/mm/aaaa`. Exemplo: `query=dataVencimento>=2026-08-01T00:00:00;dataVencimento<=2026-08-31T23:59:59`.
- Recorte por empresa (filial): `idEmpresa==<id>` (ids em `GET /empresas`). Texto com espaço entre aspas.
- Não documentado: grafia de booleanos, filtro em campo aninhado. Alguns exemplos oficiais usam `=` em vez de `==`.

### Webhooks

Não existem na API REST. Sincronização por consulta periódica, idealmente por `dataModificacao`.

### Erros

Não uniforme. 429: {"tempoAteLiberar": <segundos>}. 406 (regra de negócio ou id inválido): {"descricao", "erros": [{"codigo", "mensagem"}], "status": 406}. 400 na CC-e inexistente: {"status": 400}. Algumas exclusões devolvem texto puro ou true. Respostas para chave inválida, id inexistente e filtro inválido não são documentadas.

| Status | Quando |
|---|---|
| 200 | Sucesso, inclusive na maioria das criações (que devolvem o id criado, às vezes com 'Mensagem'). |
| 201 | Criação de apontamento (único exemplo com 201). |
| 204 | Mover apontamento para a lixeira. |
| 400 | Obter CC-e de NF-e que não tem carta de correção. |
| 406 | Id inválido (permissões de grupo de usuários) ou operação recusada (processar ou excluir inventário fora da situação permitida). |
| 429 | Throttling: limite de requisições atingido; aguardar tempoAteLiberar segundos. |
| 500 | Aparece em exemplos de DANFE e de roteiro de produto com corpo válido; provavelmente erro de documentação. |

### Endpoints canônicos detalhados (35)

| Id canônico | Método e caminho | Nome no fornecedor | Executável | Confiança |
|---|---|---|---|---|
| `nomus.conta_receber.listar` | `GET /contasReceber` | Listar contas a receber | sim | verificado |
| `nomus.conta_receber.obter` | `GET /contasReceber/{id}` | Detalhar conta a receber | sim | verificado |
| `nomus.conta_pagar.listar` | `GET /contasPagar` | Listar contas a pagar | sim | verificado |
| `nomus.conta_pagar.obter` | `GET /contasPagar/{id}` | Detalhar conta a pagar | sim | verificado |
| `nomus.pagamento.listar` | `GET /pagamentos` | Listar pagamentos | sim | verificado |
| `nomus.pagamento.listar.recebimentos` | `GET /recebimentos` | Listar recebimentos | sim | verificado |
| `nomus.cobranca.listar` | `GET /boletos` | Listar boletos bancários | sim | verificado |
| `nomus.pedido.listar.venda` | `GET /pedidos` | Listar pedidos de venda | sim | verificado |
| `nomus.pedido.obter.venda` | `GET /pedidos/{id}` | Detalhar pedido de venda | sim | verificado |
| `nomus.pedido.listar.compra` | `GET /pedidoscompra` | Listar pedidos de compra | sim | verificado |
| `nomus.pedido.obter.compra` | `GET /pedidoscompra/{id}` | Detalhar pedido de compra | sim | inferido |
| `nomus.orcamento.listar` | `GET /propostas` | Listar propostas | sim | verificado |
| `nomus.cliente.listar` | `GET /clientes` | Listar clientes | sim | verificado |
| `nomus.cliente.obter` | `GET /clientes/{id}` | Detalhar cliente | sim | verificado |
| `nomus.pessoa.listar` | `GET /pessoas` | Listar pessoas | sim | verificado |
| `nomus.nota_fiscal.listar` | `GET /nfes` | Listar notas fiscais (NF-e) | sim | verificado |
| `nomus.nota_fiscal.obter` | `GET /nfes/{id}` | Detalhar nota fiscal (NF-e) | sim | verificado |
| `nomus.nota_fiscal.listar.nfse` | `GET /nfses` | Listar notas fiscais de serviço (NFS-e) | sim | verificado |
| `nomus.nota_fiscal.listar.destinadas` | `GET /nfesDestinadas` | Listar notas fiscais destinadas | sim | verificado |
| `nomus.nota_fiscal.listar.itens_saida` | `GET /itensDocumentoSaida` | Listar itens de documento de saída | sim | verificado |
| `nomus.estoque.listar.documentos` | `GET /documentosEstoque` | Listar documentos de estoque | sim | verificado |
| `nomus.estoque.listar.movimentacoes` | `GET /movimentacoesEstoque` | Listar movimentações de estoque | sim | verificado |
| `nomus.estoque.listar.saldo_produto` | `GET /saldosEstoqueProduto/{idProduto}` | Listar estoque de produto | sim | verificado |
| `nomus.produto.listar` | `GET /produtos` | Listar produtos | sim | verificado |
| `nomus.produto.obter` | `GET /produtos/{id}` | Detalhar produto | sim | verificado |
| `nomus.produto.listar.precos_tabela` | `GET /tabelasPreco/{id}/itens` | Detalhar tabela de preço com itens | sim | verificado |
| `nomus.ordem_producao.listar` | `GET /ordens` | Listar ordens | sim | verificado |
| `nomus.ordem_producao.listar.apontamentos` | `GET /apontamentos` | Listar apontamentos | sim | verificado |
| `nomus.ordem_producao.listar.empenhos` | `GET /empenhos` | Listar empenhos | sim | verificado |
| `nomus.empresa.listar` | `GET /empresas` | Listar empresas | sim | verificado |
| `nomus.centro_custo.listar` | `GET /centrosCusto` | Listar centros de custo | sim | verificado |
| `nomus.pedido.criar.venda` | `POST /pedidos` | Inserir pedido de venda | não (escrita) | verificado |
| `nomus.cliente.criar` | `POST /clientes` | Inserir cliente | não (escrita) | verificado |
| `nomus.produto.criar` | `POST /produtos` | Inserir produto | não (escrita) | inferido |
| `nomus.conta_receber.liquidar` | `POST /recebimentos` | Inserir recebimento | não (escrita) | verificado |

Mais **159 operações** catalogadas em `endpoints.json > endpoints_secundarios` (cadastros auxiliares, engenharia, inventário, CRM, etiquetas, arquivos e todas as demais escritas), incluindo 5 rotas que só aparecem nos artigos da Central de Ajuda.

### Notas para o executor do site

- A paginação é do tipo `page` com `param_pagina = "pagina"` e **`param_tamanho = null`** (tamanho fixo 50). O executor precisa enviar só `pagina` e parar quando a página vier com menos de 50.
- O intervalo entre páginas precisa ser de **20 s**, e o 429 deve ser tratado lendo `tempoAteLiberar` no corpo.
- Os filtros de período e de empresa são **expressões dentro do parâmetro `query`**. Em `execucao.filtros_recomendados`, cada filtro traz `expressao` com marcadores `{data_inicial}`, `{data_final}` e `{id_empresa}` para o formulário montar.
- Cada coluna sugerida traz `formato_origem` quando o valor chega como texto (pt-BR, ponto decimal ou data dd/mm/aaaa).

---

## 3. Armadilhas

- Limite de 1 requisição a cada 20 segundos: 1.000 registros (20 páginas) levam cerca de 7 minutos. Sempre recorte por período e empresa.
- Página fixa de 50 registros, sem parâmetro de tamanho; sem o parâmetro pagina vêm só os 50 mais recentes.
- Filtro numa linguagem própria dentro do parâmetro query (campo>=valor;campo<=valor); datas em yyyy-MM-ddTHH:mm:ss, mas a resposta devolve dd/mm/aaaa.
- Valores financeiros em texto pt-BR ('11.245,57'), quantidades com ponto e até 30 casas, alguns campos em número JSON: converter coluna a coluna.
- A chave vai como 'Authorization: Basic <chave>', sem usuário:senha; a doc fala em chave 'em Base64' e a coleção envia a chave crua.
- URL base por cliente (https://<empresa>.nomus.com.br/<empresa>/rest), e não há host único.
- Listagens trazem ids, não nomes (pedidos, movimentações, apontamentos): é preciso cruzar com cadastros, cada um custando mais páginas de 20 s.
- Contas a pagar usam os nomes de campo das contas a receber (valorReceber, saldoReceber) e valores negativos.
- Respostas pesadas: PDF de boleto em Base64 em contas a receber e XML completo em NF-e e NFS-e.
- Campos sem valor podem não vir no JSON; montar a planilha pela união dos campos.
- A mesma chave permite escrita e não tem escopo; guardar com cuidado e nunca usar fora do executor de leitura.
- Sem webhooks: tudo por consulta periódica.

## 4. Conformidade

- Trafega dado pessoal de clientes, fornecedores, contatos, representantes, funcionários e usuários do ERP. Base legal típica: execução de contrato e obrigação legal (LGPD art. 7º, V e II).
- Não exige certificado digital na API (o A1 é usado pelo ERP para emitir NF-e).
- Não há termos de uso da API; só a política de privacidade (<https://www.nomus.com.br/privacidade/>). **Uso em produto de terceiro: indefinido**, pedir posição escrita da Nomus.
- A chave dá acesso de escrita: guardar no cofre e nunca usar fora do executor de leitura.

## 5. Lacunas

- **execucao_auth.credenciais_necessarias.api_key** (alto): A Central de Ajuda diz que o cabeçalho é 'Basic' seguido da chave 'em Base64', e o exemplo publicado é um texto Base64 truncado. A coleção Postman envia 'Basic ' + o valor da chave sem conversão. Não está claro se o valor exibido na Configuração Geral já está em Base64 ou se o integrador precisa codificá-lo. A receita do catálogo envia a chave como está; se o ERP recusar, codificar em Base64 é a primeira coisa a testar.
- **api.base_urls.producao** (alto): A URL base é por cliente (endereço do ERP + contexto + /rest). A coleção usa https://empresa.nomus.com.br/empresa/rest e o artigo de etiquetas usa http://cliente.nomus.com.br/cliente/rest, mas não há regra publicada de que subdomínio e contexto sejam sempre iguais, nem do endereço de instalações locais ou em servidor dedicado. O cliente precisa informar a URL exata.
- **limites.rate_limit** (alto): O comparativo oficial fixa 1 requisição a cada 20 segundos e a coleção descreve um bloqueio 'após uma certa quantidade total de requisições'. Não se sabe se o limite é por chave, por base ou por IP, se há rajada permitida nem se vale igual para todos os endpoints. É o maior gargalo para extração.
- **erros.codigos_principais** (medio): Os formatos de resposta para chave inválida (401/403), id inexistente (404) e filtro mal formado não são documentados. Só 429, 406 e um 400 específico (CC-e inexistente) têm exemplo.
- **limites.paginacao** (medio): Tamanho fixo de 50 sem parâmetro de tamanho. 'Sem página vêm os 50 mais recentes', mas o campo de ordenação não é declarado; se registros forem criados durante a extração, as páginas podem deslocar. Etiquetas e usuários usam outro esquema (inicio/limite), e não se sabe se a listagem de itens de tabela de preço é paginada.
- **parametro query** (medio): A regra geral (qualquer campo devolvido é filtrável; datas em yyyy-MM-ddTHH:mm:ss) está na descrição da coleção, mas não foi confirmada campo a campo. A coleção usa '=' em vários exemplos e os artigos usam '=='. A grafia de booleanos (status==false, ativo==true) e o suporte a campos aninhados (categorias.fornecedor) não estão documentados.
- **formatos numéricos e de data** (medio): Não há padrão: valores financeiros vêm em texto pt-BR ('11.245,57'), quantidades com ponto ('10.000000', '5.0000...0' com 30 casas), itens de documento de saída em número JSON, propostas em formato ambíguo ('1.000', '100,0000000000 por UNID'), boletos com ano de dois dígitos. Cada coluna precisa de conversão própria.
- **contas a pagar — sinal e nomes** (medio): GET /contasPagar devolve os campos valorReceber, saldoReceber e valorRecebido (nomes de contas a receber) com valores negativos no exemplo. A semântica do sinal não é explicada.
- **respostas pesadas** (medio): A listagem de contas a receber pode trazer o PDF do boleto em Base64 (boletoBancario) e a de NF-e o XML completo (xml); as NFS-e trazem dois XMLs. Não há parâmetro documentado para omitir esses campos.
- **webhooks** (medio): Não existem na API REST. Registrado para que ninguém prometa sincronização em tempo real: tudo é por consulta periódica, e com o limite de 20 s.
- **ambiente_testes** (alto): A base de testes é citada como permitida no Nomus ERP Industrial, sem procedimento, URL ou custo. Sem ela, todo teste de leitura é feito na base de produção do cliente.
- **autenticacao.escopos_permissoes** (alto): A chave é única para o ERP e vale para escrita também. Não há escopo de somente leitura nem documentação sobre se a chave respeita algum perfil de usuário. Para o assistente, isso significa que a credencial guardada no cofre poderia gravar dados se usada fora do executor.
- **conformidade.permite_uso_em_produto_terceiro** (alto): Não há termos de uso de API publicados; só a política de privacidade do site. Antes de ler dados do cliente por um produto de terceiro, pedir posição escrita da Nomus.
- **versionamento** (medio): Sem versão de API, changelog ou política de depreciação. O comportamento muda com a versão do sistema instalado (exemplo documentado: processar inventário).
- **documentação — erros de exemplo** (baixo): Exemplos com URL de outro recurso (atributos de pessoa, solicitações de compra, resultados de inspeção, vendedores, pedidos de compra), requisição de lotes/séries sem URL, exemplo de pedido de compra com texto lorem ipsum, DANFE e roteiro marcados com status 500 apesar do corpo válido, NFS-e e NF-e por id ora objeto, ora array.
- **taxonomia — recebimento** (baixo): Recebimentos (baixas de contas a receber) foram mapeados em Pagamento com o qualificador recebimentos, e a criação de recebimento em ContaReceber/liquidar. Sugestão de extensão: entidade 'Recebimento' ou ampliar a descrição de Pagamento para entradas.
- **taxonomia — documento de estoque e itens faturados** (baixo): Documentos de estoque e itens de documento de saída foram mapeados em Estoque e NotaFiscal. Sugestão: entidade 'DocumentoEstoque' (ou 'MovimentoEstoque'), também útil para o SyGeCom.
- **taxonomia — chão de fábrica** (baixo): Apontamentos, empenhos, requisições, reportes e resultados de inspeção foram agrupados em OrdemProducao com qualificador. Sugestão: entidades 'Apontamento' e 'InspecaoQualidade' se outros ERPs industriais repetirem o padrão.

Perguntas prontas para enviar à Nomus: `perguntas-ao-fornecedor.md`.

## 6. Onde a confiança é menor

- `nomus.pedido.obter.compra`: o exemplo oficial de resposta está preenchido com texto de teste; schema confirmado só pelo artigo de ajuda.
- `nomus.produto.criar`: a obrigatoriedade dos campos não é documentada e foi inferida dos exemplos.
- Regras gerais do filtro `query` (qualquer campo, formato de data) estão documentadas, mas não confirmadas campo a campo; nenhuma chamada foi feita à API (sem credencial).
- A forma exata da chave no cabeçalho (como está ou convertida para Base64).

## 7. Monitoramento

- Sem changelog nem canal de mudanças. Acompanhar a coleção Postman (o JSON pode ser baixado e comparado) e a seção API REST da Central de Ajuda, cujos artigos têm data de atualização.
- Frequência sugerida: **trimestral**.

## 8. Fontes

- Nomus ERP — coleção Postman oficial da API (documentação completa): <https://documenter.getpostman.com/view/22813773/2s93JutNgM> (2026-10-09)
- JSON da coleção Postman oficial (191 requisições), lido integralmente: <https://documenter.gw.postman.com/api/collections/22813773/2s93JutNgM?segregateAuth=true&versionTag=latest> (2026-10-09)
- api.nomus.com.br — 'API do Nomus ERP Industrial' no site, redireciona para a coleção: <https://api.nomus.com.br/> (2026-10-09)
- Introdução à integração com API REST (Central de Ajuda Nomus, atualizado em 2026-05-12): <https://atendimento.nomus.com.br/hc/pt-br/articles/35195281009819-Introdu%C3%A7%C3%A3o-%C3%A0-integra%C3%A7%C3%A3o-com-API-REST> (2026-10-09)
- Seção API REST da Central de Ajuda (17 artigos): <https://atendimento.nomus.com.br/hc/pt-br/sections/35195290469403> (2026-10-09)
- Artigo: Contas a receber: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195264712219-Contas-a-receber> (2026-10-09)
- Artigo: Clientes: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195303836571-Clientes> (2026-10-09)
- Artigo: Documentos de estoque: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195264487707-Documentos-de-estoque> (2026-10-09)
- Artigo: Notas fiscais emitidas e recebidas: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195276493211-Notas-fiscais-emitidas-e-recebidas> (2026-10-09)
- Artigo: Pedido: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195264156187-Pedido> (2026-10-09)
- Artigo: Pedido de Compra: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195297121563-Pedido-de-Compra> (2026-10-09)
- Artigo: Produtos: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195290872219-Produtos> (2026-10-09)
- Artigo: Recebimentos: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195296622747-Recebimentos> (2026-10-09)
- Artigo: Tabelas de preço: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195290684315-Tabelas-de-pre%C3%A7o> (2026-10-09)
- Artigo: Etiqueta (paginação inicio/limite): <https://atendimento.nomus.com.br/hc/pt-br/articles/35195276709659-Etiqueta> (2026-10-09)
- Artigo: Processo (rotas antigas e configurações de busca): <https://atendimento.nomus.com.br/hc/pt-br/articles/35195264014747-Processo> (2026-10-09)
- Artigo: Contatos: <https://atendimento.nomus.com.br/hc/pt-br/articles/35195297733915-Contatos> (2026-10-09)
- Qual solução escolher? Nomus Start x Nomus ERP Industrial (limite da API, base de testes): <https://atendimento.nomus.com.br/hc/pt-br/articles/43940587834651-Qual-solu%C3%A7%C3%A3o-escolher-Diferen%C3%A7as-entre-Nomus-Start-e-Nomus-ERP-Industrial> (2026-10-09)
- Política de privacidade da Nomus (razão social do controlador): <https://www.nomus.com.br/privacidade/> (2026-10-09)
- Site da Nomus: <https://www.nomus.com.br/> (2026-10-09)
