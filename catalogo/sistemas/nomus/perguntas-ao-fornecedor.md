# Perguntas para a Nomus sobre a API REST do Nomus ERP

> **Como usar este documento.** Copie do "Contexto" em diante e envie ao suporte ou ao consultor da Nomus
> (Central de Ajuda: <https://atendimento.nomus.com.br/hc/pt-br>, onde há abertura de chamado).
> As perguntas foram reduzidas ao que a documentação pública **não responde**. O que ela já responde está no bloco
> "O que já sabemos", no fim, para não gastar uma rodada de e-mail com pergunta respondida.
>
> Levantamento feito em **2026-10-09** sobre a coleção Postman oficial
> (<https://documenter.getpostman.com/view/22813773/2s93JutNgM>, 191 requisições) e sobre os artigos da seção
> API REST da Central de Ajuda, a partir de "Introdução à integração com API REST".

---

## Contexto (para colar no e-mail)

Somos clientes do **{PRODUTO: Nomus ERP Industrial / Nomus Start Industrial}** e vamos conectar o ERP a uma ferramenta
de análise de dados (Excel / Power BI e um assistente interno). O uso será **exclusivamente de leitura**: nenhuma
criação, alteração ou exclusão de registro pela API.

Já localizamos a documentação pública (coleção Postman e artigos da seção API REST) e mapeamos os endpoints de
leitura. Restam as perguntas abaixo, que a documentação não responde.

---

## 1. Chave e autenticação

1. O artigo de introdução diz que o cabeçalho é `Authorization: Basic` seguido da **chave em Base64**, e a coleção
   Postman envia `Basic` seguido da chave como está. O valor exibido em **Configuração Geral > "Chave de acesso para
   integração com o erp via REST"** já está em Base64, ou precisamos convertê-lo antes de enviar?
2. Essa chave é **única para todo o ERP**? Existe forma de gerar uma chave **somente de leitura**, ou com acesso
   restrito a alguns recursos ou empresas?
3. A chave **expira**? Como gerar uma nova (rotação) e o que acontece com integrações que usam a antiga?
4. Qual é a **resposta da API para chave inválida** (código HTTP e corpo)? Queremos tratar esse caso sem confundir com
   endereço errado.
5. Há **allowlist de IP** ou alguma restrição de origem que precisemos informar (servidor de onde as chamadas saem)?

## 2. Endereço e ambiente

6. Qual é a **URL base exata** da nossa instalação? A documentação usa o modelo `https://empresa.nomus.com.br/empresa/rest`;
   no nosso caso, subdomínio e contexto são iguais? (Para instalação em servidor dedicado: qual é o endereço?)
7. O comparativo entre Nomus Start e Nomus ERP Industrial cita a possibilidade de **instalação de base de testes**.
   Como pedimos uma, qual seria o endereço da API nela e há custo?

## 3. Limite de requisições

8. O comparativo oficial informa **1 requisição a cada 20 segundos**. Esse limite é **por chave, por base ou por IP**?
   Vale igual para todos os endpoints? Existe rajada permitida?
9. A coleção descreve um throttling que bloqueia "após uma certa quantidade total de requisições". Qual é essa
   quantidade e em que janela de tempo?
10. É possível **ampliar o limite** no nosso contrato (por exemplo, para a carga histórica inicial)? Com que custo?
11. Além do campo `tempoAteLiberar` no corpo do 429, a API envia algum cabeçalho (`Retry-After` ou similar)?

## 4. Paginação e filtros

12. As páginas têm **50 registros fixos**. Qual campo define a **ordem** das páginas (id, data de criação)? A ordem é
    estável se novos registros forem criados durante a extração?
13. Existe algum parâmetro para **aumentar o tamanho da página** em endpoints que usam `pagina` (como `limite`, que
    aparece em etiquetas e usuários)?
14. No parâmetro `query`: qual é a **grafia de booleanos** (`status==false`? `status==0`?) e é possível filtrar por
    **campo aninhado** (por exemplo, `categorias.fornecedor` em `/pessoas`)?
15. O operador de igualdade correto é `==` (artigos) ou `=` (vários exemplos da coleção)? Os dois funcionam?
16. A regra "qualquer campo devolvido pode ser filtrado; datas em yyyy-MM-ddTHH:mm:ss" vale para **todos** os campos
    de data (inclusive `dataVencimento`, `dataEmissao`, `dataHoraEntrega`)?
17. A listagem de itens de tabela de preço (`GET /tabelasPreco/{id}/itens`) é paginada?

## 5. Conteúdo das respostas

18. Em `/contasPagar`, os campos se chamam `valorReceber`, `saldoReceber` e `valorRecebido` e vêm **negativos** no
    exemplo. O sinal é sempre negativo para contas a pagar?
19. É possível **omitir campos pesados** nas listagens (PDF do boleto em `boletoBancario` em `/contasReceber`, XML em
    `/nfes` e `/nfses`)?
20. Quais são os **códigos de status** de NFS-e (`/nfses`), de notas destinadas (`/nfesDestinadas`), de empenhos e de
    itens de proposta, e os valores possíveis de `status` e `tipoOrdem` em `/ordens`?
21. Qual é a resposta para **id inexistente** nas consultas por id (404? 406? corpo vazio?)?
22. Os formatos numéricos variam por endpoint (texto `1.234,56`, texto `10.000000`, número JSON). Há previsão de
    padronizar? Há como pedir os valores em número?

## 6. Uso, contrato e mudanças

23. Existem **termos de uso da API** além da política de privacidade? Podemos usar os dados lidos pela API dentro de uma
    **ferramenta de terceiro** contratada por nós? Pedimos essa confirmação **por escrito**.
24. Há **custo** para usar a API no nosso plano?
25. Existe **changelog** ou canal de aviso de mudanças na API? A coleção Postman é a referência oficial e sempre atual?
26. A API tem **versão**? Comportamentos mudam com a versão do sistema instalado (a coleção cita o processamento de
    inventário nas versões 2884.197 a 2884.220)? Como sabemos a versão da nossa instalação pela API?

---

## O que já sabemos (não perguntar)

- Base por cliente: endereço do ERP + contexto + `/rest`; cada serviço é um caminho depois disso (`/produtos`, `/pedidos`...).
- Cabeçalhos: `Authorization: Basic <chave>` e `Content-Type: application/json`. Chave em Configuração Geral.
- Listagens paginadas por `pagina` (padrão 1), 50 registros por página; sem `pagina`, os 50 mais recentes.
- Filtro `query` com `==`, `!=`, `<`, `<=`, `>`, `>=`, `;` (E) e `,` (OU); datas em `yyyy-MM-ddTHH:mm:ss`.
- Throttling com HTTP 429 e corpo `{"tempoAteLiberar": <segundos>}`; limite de 1 requisição a cada 20 s no comparativo.
- Não há webhooks na API REST.
- Erros de regra de negócio em 406 com `descricao`, `erros[{codigo, mensagem}]` e `status`.
- A API está disponível no Nomus Start Industrial e no Nomus ERP Industrial; base de testes só no ERP Industrial.
