# Perguntas para a SyGeCom sobre a API do Sagi/SGR

> **Como usar este documento.** Copie do "Contexto" em diante e envie ao suporte ou ao consultor da SyGeCom
> (<https://sygecom.com.br/contato-suporte/> · telefone/WhatsApp (51) 3442-2345 · seg–sex 8h30–12h e 13h–18h).
> As perguntas foram reduzidas: tudo o que a documentação pública **já responde** saiu da lista e está no bloco
> "O que já sabemos", no fim, para você não gastar rodada de e-mail com pergunta respondida.
>
> Levantamento feito em **2026-09-17** sobre a spec oficial `https://api.sagierp.com.br/api/v1/spec`
> (OpenAPI 3.0.1, *"API para integracao com sistema SAGI - 18/03/2026"*, 79 operações em 58 caminhos) e sobre a
> página oficial `https://sagierp.com.br/doc_api/`.

---

## Contexto (para colar no e-mail)

Somos clientes do **{PRODUTO: Sagi / SGR / SGR Plus}** e vamos conectar o sistema a uma ferramenta de análise de
dados (Excel / Power BI e um assistente interno). O uso será **exclusivamente de leitura**: nenhuma criação,
alteração ou exclusão de registro pela API.

Já localizamos a documentação pública da API SAGI (Swagger em `https://api.sagierp.com.br/api-explorer/`, spec em
`https://api.sagierp.com.br/api/v1/spec` e o passo a passo em `https://sagierp.com.br/doc_api/`) e conseguimos
mapear os endpoints. Restam as perguntas abaixo, que a documentação não responde.

---

## 1. Liberação, contrato e custo

1. Para a nossa instalação, a API já está **liberada** ou é preciso alguma habilitação do lado de vocês, além de
   criar o usuário no ERP (*Menu Úteis > Controle de Usuários e Senhas > Cadastro de Usuários*, com e-mail e sem o
   bloqueio de acesso ao SAGI Mobile)?
2. Existe **custo adicional** — mensalidade, taxa de ativação ou cobrança por volume — para usar a API? Se sim,
   qual é o valor e como entra no nosso contrato atual?
3. O uso da API está coberto pelo contrato de licença que já temos, ou exige **aditivo / termo específico**?
4. A página oficial de liberação já teve um passo de assinatura do **"Contrato de Consentimento para
   Compartilhamento de Dados"** (*Menu Úteis > Integração com outros sistemas*), que hoje não aparece mais na
   página. Esse termo **ainda é exigido**? Se sim, como o solicitamos?
5. Podemos usar os dados lidos pela API dentro de uma **ferramenta de terceiro** (um produto de BI/assistente
   contratado por nós)? Existe alguma restrição contratual a isso? Pedimos essa confirmação **por escrito**.
6. Existem **termos de uso da API** ou política de uso aceitável em documento separado? Onde podemos obtê-los?
7. Há **SLA específico da API** (disponibilidade, janela de manutenção), ou ela está coberta pela Política de SLA
   publicada em `https://sygecom.com.br/compliance/politica-de-sla/`?

## 2. Endereço e ambiente

8. Qual é o **host correto** para a nossa instalação: `https://api.sagierp.com.br/api/v1`,
   `https://api.sygecom.com.br/api/v1` (em 17/09/2026 os dois serviam a mesma aplicação e a mesma spec) ou um
   endereço específico do nosso ambiente?
9. A spec instrui a enviar `"homol": true` no corpo do `POST /login` para gerar token de homologação e avisa que o
   token só funciona no ambiente em que foi gerado — mas **não publica a URL base de homologação**. Qual é ela?
10. É possível termos uma **base de homologação** com dados fictícios ou com cópia mascarada da nossa base, para
    testar sem risco em produção?
11. Há **allowlist de IP** ou alguma restrição de origem que precisamos informar (o servidor de onde as chamadas
    vão sair)?

## 3. Credenciais e segurança

12. Existe credencial **de aplicação** (client_id/client_secret, chave de API ou usuário de serviço), em vez de
    e-mail e senha de um usuário humano do ERP? Se não existir hoje, está no roadmap?
13. Qual é a **validade do token JWT**? O exemplo publicado sugere 7 dias (`exp − iat = 604800`), mas isso não está
    documentado. Existe rota de **refresh**, ou a renovação é sempre repetir o `POST /login`?
14. Qual é a **política de senha** do usuário de API: expira, exige troca periódica, bloqueia após N tentativas? Se
    a senha expirar, a integração para — precisamos saber para monitorar.
15. Dá para restringir o usuário de API a **somente leitura**, ou a granularidade é só a das permissões normais do
    ERP? Qual é o conjunto mínimo de permissões que ainda permite ler movimentos, produtos, cadastros, pedidos,
    financeiro de fornecedor, ordens de coleta e MTR?
16. A rota `GET /dados-e-permissoes/{iduser}` devolve as permissões do usuário. Existe **mapa de permissões**
    documentado, para sabermos qual permissão libera qual endpoint?

## 4. Cobertura de dados por módulo

17. **Pesagem:** `GET /movimentos` é a fonte completa das pesagens (entrada, saída e serviço), ou existe informação
    de balança que só está no banco e não sai pela API (segunda pesagem, tíquete de balança, foto, laudo de
    classificação)?
18. **Fiscal:** não encontramos endpoint de nota fiscal na API (o `GET /invoice` é de exportação). Como extraímos
    **NF-e de entrada e de saída, XML e dados de SPED**? É pelo **Portal do Contador**? Ele tem API ou só download
    manual?
19. **Financeiro:** a API expõe `GET /pagamentos/fornecedores` e `GET /saldo/fornecedores/{id}`. Existe endpoint
    para **contas a pagar e a receber em aberto**, fluxo de caixa, movimentação bancária e conciliação? Vimos o
    schema interno `Financeiro` na spec, mas nenhuma rota o utiliza — ele será exposto?
20. **Contas a receber / clientes:** existe o equivalente de `/pagamentos/fornecedores` e `/saldo` para **clientes**?
21. **Logística e rotas:** `GET /ordems` traz as ordens de coleta e embarque. Existe endpoint para **roteirização,
    posição de veículo e telemetria**? Qual é a relação com o **ISAT** (rastreamento) e com o **LogVerde** — eles
    têm API própria?
22. **Contratos:** `GET /contrato` parece cobrir contrato de exportação (produto, peso, porto, moeda). Existe
    endpoint para **contrato de prestação de serviço** do módulo do SGR Plus (coleta recorrente, locação de
    caçamba, medição)?
23. **MTR:** `GET /mtr` devolve o que está registrado no ERP. Existe **integração direta com o SINIR / sistemas
    estaduais de MTR** (emissão, consulta de situação, baixa)? Se sim, ela é exposta por API?
24. **Estoque:** `GET /produtos` devolve o saldo numa data. Existe endpoint de **movimentação de estoque e
    inventário** (entradas e saídas de depósito, ajustes, beneficiamento/produção)?

## 5. Limites, desempenho e operação

25. Existe **rate limit** (requisições por minuto/hora, burst, concorrência)? A spec não declara nenhum e não há
    código `429` documentado. Que volume é seguro para a nossa instalação?
26. Qual é a **janela de extração recomendada**? Pretendemos rodar polling a cada 5–15 minutos em `GET /movimentos`
    com sobreposição de 24–48 h. Isso é aceitável ou pesa demais no servidor?
27. Vários endpoints **não têm paginação** (`/produtos`, `/ordems`, `/pagamentos/fornecedores`,
    `/cargas/fornecedores`, `/clientes`). Há limite prático de registros por resposta? Há previsão de paginá-los?
28. O que exatamente significa o **`503` "Falha no servidor do cliente"** e qual é o procedimento recomendado
    (tempo de espera, número de tentativas, quando abrir chamado)?
29. Existe **janela de manutenção** conhecida em que a API fica indisponível?

## 6. Eventos e sincronização

30. Existe ou está previsto **webhook / notificação de evento** (pesagem registrada, ordem finalizada, pagamento
    baixado, MTR emitido)? Hoje não há nada disso na spec e tudo vira polling.
31. Existe algum campo de **carimbo de alteração** (`updated_at`, número de versão, log de alteração) que permita
    extração incremental confiável, em vez de reler janelas de data?
32. Quando um boleto de balança é **corrigido ou cancelado** depois de registrado, como isso aparece na API? Ele
    some da listagem, muda de status, ou gera um novo registro?

## 7. Alternativas à API

33. O endpoint `POST /sql-query` aceita `SELECT` no banco do tenant (teto de 1000 registros, timeout de 5 s). Vocês
    **recomendam** o uso dele para análise, ou ele existe para outra finalidade? Há restrição contratual?
34. O **Dicionário de Dados SAGI/SGR** está publicado como PDF grande. Existe versão **consultável** (CSV, planilha,
    HTML) das tabelas e colunas relevantes — especialmente movimento/boleto de balança, produto, fornecedor,
    cliente, financeiro e MTR?
35. É possível **acesso direto de leitura ao banco** (usuário read-only, réplica, ou exportação agendada para
    CSV/Parquet em storage)? Em que condições?
36. Existe **exportação agendada de relatórios** (e-mail, FTP, pasta) que possamos consumir como alternativa ou
    complemento à API?
37. O **Cloud SyGeCom** muda alguma coisa nesse cenário (acesso ao backup, à réplica, ao storage)?

## 8. Multiempresa e escopo do dado

38. Nossa operação tem **{N} filiais / {N} CNPJs**. Um único usuário de API consegue ler **todas** as filiais, ou
    precisamos de um usuário por empresa?
39. O `GET /filiais` devolve só as filiais permitidas ao usuário (controle na função `syg_retorna_filiais_user`).
    Como configuramos esse vínculo no ERP, e quem do nosso lado pode fazê-lo?
40. Endpoints como `GET /movimentos` e `GET /produtos` aceitam o parâmetro `filial`/`TODAS`. Quando usamos `TODAS`,
    o retorno é limitado às filiais do usuário ou a tudo o que existe na base?
41. Existe o conceito de **unidade de negócio** (parâmetro `unidade_negocio` em `/produtos`) separado de filial?
    Como ele se relaciona com a filial?

## 9. Versão, mudanças e roadmap

42. Qual é a **versão do Sagi/SGR** instalada hoje na nossa operação, e quais endpoints ou campos ficam
    indisponíveis nela? (A spec condiciona campos à versão — por exemplo, `CIDADE_IBGE` exige 9.4.0 ou superior.)
43. Como somos **avisados de mudanças** na API? Não encontramos changelog nem canal de breaking changes. Existe
    lista de e-mail, release notes ou aviso no sistema?
44. Existe **política de depreciação** (quanto tempo uma rota continua funcionando depois de substituída)?
45. Onze operações da spec (entre elas `GET /mtr`, `GET /pedido-compra`, `GET /pedido-venda`, `GET /invoice`,
    `GET /clientes/lista`) **não declaram bloco `security`**. Isso é omissão na escrita da spec, ou essas rotas
    realmente respondem sem autenticação? Perguntamos por **segurança**, não para usá-las sem credencial.
46. Há roadmap público ou previsão para: webhooks, credencial de aplicação, paginação nos endpoints que não têm,
    e endpoints de financeiro completo e de nota fiscal?

---

## O que já sabemos (não precisa perguntar)

| Tema | O que a documentação pública já responde | Onde |
|---|---|---|
| **Existe API?** | Sim. REST/JSON, "API SAGI", OpenAPI 3.0.1 com 79 operações em 58 caminhos. Não é SOAP. | `https://api.sagierp.com.br/api/v1/spec` |
| **Documentação** | Swagger UI aberto, sem login. | `https://api.sagierp.com.br/api-explorer/` |
| **Como liberar** | Criar usuário no ERP em *Menu Úteis > Controle de Usuários e Senhas > Cadastro de Usuários*, com senha, com e-mail na aba E-mail e com **"Bloquear Acesso ao SAGI Mobile" desmarcado**. | `https://sagierp.com.br/doc_api/` |
| **Como autenticar** | `POST /login` com `{"email", "password", "origem": "API"}` → JWT → `Authorization: Bearer <token>`. Sem client_id/secret, sem refresh. | spec |
| **Homologação** | Existe o mecanismo: `"homol": true` no corpo do login; o token só vale no ambiente em que foi gerado. Falta a **URL base** (pergunta 9). | spec |
| **Módulos com dados expostos** | Pesagem (`/movimentos`), estoque (`/produtos`), cadastros (`/fornecedores`, `/clientes`, `/credores`, `/funcionarios`, `/motoristas`), compras e vendas (`/pedido-compra`, `/pedido-venda`), financeiro de fornecedor (`/pagamentos/fornecedores`, `/saldo/fornecedores/{id}`), logística (`/ordems`, `/ordems_servicos`, `/cacambas`, `/container`), contratos e exportação (`/contrato`, `/invoice`, `/porto`, `/cotacao-moeda`), ambiental (`/mtr`), domínios (`/cfop`, `/pais`, `/regioes`, `/condicoes`, `/modulos`). | spec |
| **Webhooks** | **Não existem** na spec. Confirmação e roadmap ficam nas perguntas 30–32. | spec |
| **Consulta SQL** | Existe `POST /sql-query`, só `SELECT`, teto de 1000 registros, timeout de 5 s, paginação `page`/`pageSize` (máx. 500). | spec |
| **Multiempresa** | `GET /filiais` devolve só as filiais permitidas ao usuário; `POST /login` já retorna a lista de empresas com CNPJ e versão do sistema. | spec |
| **Bloqueio por contrato** | `403` com `code: TENANT_FINANCIAL_BLOCK`, `data_limite` e `traceId` quando o contrato está vencido. | spec |
| **Timeouts publicados** | `408` acima de 5 s em `/sql-query` e acima de 10 s em `/filiais`. | spec |
| **Erro sem registros** | `204` sem corpo, em vez de lista vazia. | spec |
| **Dicionário de dados** | Existe, como PDF: `https://sagierp.com.br/devel/uteis/sagi_dicionario_dados.pdf`. Falta formato consultável (pergunta 34). | `externalDocs` da spec |
