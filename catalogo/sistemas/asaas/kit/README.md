# Kit pronto — Asaas (API v3)

Código pronto para Excel/Power BI (Power Query), Python e TypeScript. **Você só preenche a chave de API e o ambiente**; nada mais precisa ser editado.
Ambiente padrão: **sandbox** (testes, sem dinheiro real). Consulta da documentação oficial: 2026-09-17.

| Pasta | Para quem | O que faz |
|---|---|---|
| `powerquery/` | Analistas de BI (Excel e Power BI) | Consultas **somente leitura**: Cobrancas, Clientes, Assinaturas, Extrato, Transferencias, NotasFiscais e Saldo |
| `python/` | Desenvolvedores | Cliente com retry, paginação e erros + exemplo (cliente → cobrança Pix → QR Code) |
| `typescript/` | Desenvolvedores Node 18+ | Mesmo cliente com `fetch` nativo |

## 1. Obtenha a chave de API

1. **Sandbox (comece por aqui):** crie uma conta gratuita em https://sandbox.asaas.com — ela é separada da conta de produção, mesmo que você já seja cliente.
2. No painel, com um usuário **administrador**, abra **Integrações > Chaves de API** e gere uma chave. Ela aparece **uma única vez**: copie e guarde num cofre de senhas.
3. Chaves de sandbox começam com `$aact_hmlg_`; de produção, com `$aact_prod_`. O `$` faz parte da chave. Chave e ambiente precisam combinar, senão a API responde `401 invalid_environment`.
4. Chaves sem uso são desabilitadas após 3 meses e expiram após 6 meses. Se o kit parar com 401, confira o status da chave no painel.

## 2. Excel (Power Query)

1. **Jeito mais fácil:** abra a planilha pronta gerada a partir deste kit (`saida/Asaas.xlsx`, criada por `scripts/gerar_planilha.ps1`). Ela já tem a aba **Config** com a tabela **tbConfig**, as consultas e uma aba por entidade.
2. Na aba **Config**, preencha **somente** `ApiKey` (e, se quiser, `DataInicial`/`DataFinal` no formato AAAA-MM-DD). Deixe `Ambiente` = `sandbox` até terminar os testes. Layout completo em `powerquery/Config_layout.md`.
3. Clique em **Dados > Atualizar Tudo**. Se o Excel pedir credencial para `api-sandbox.asaas.com`, escolha **Anônimo** (a chave vai no header `access_token`).
4. Montagem manual (sem o gerador): crie a tabela `tbConfig` com as linhas de `powerquery/tbConfig.json` e, em **Dados > Obter Dados > De Outras Fontes > Consulta Nula > Editor Avançado**, crie uma consulta por arquivo `.pq` (exceto o de Power BI). O nome da consulta é o nome do arquivo sem o número: `00_Parametros.pq` → **Parametros**, `01_fnApi.pq` → **fnApi**, `10_Cobrancas.pq` → **Cobrancas** etc. Nesse caso, ative em **Opções de Consulta > Pasta de Trabalho Atual > Privacidade** a opção de ignorar os níveis de privacidade (é o que a planilha gerada já traz gravado), senão o Excel acusa Formula.Firewall ao combinar a aba Config com a API.
5. Erros: com chave errada ou de outro ambiente, o Excel mostra **"As credenciais fornecidas para a fonte Web são inválidas"** (ele intercepta o HTTP 401 da API). Não é a credencial do Excel que está errada: confira `ApiKey` e `Ambiente` na tbConfig e mantenha a fonte como Anônima. Os demais erros (403 IP bloqueado, 404, 429 limite) aparecem na consulta com texto explicativo. Comportamento verificado em 2026-09-17 com chave inválida; o carregamento com chave válida não pôde ser testado pelo catálogo (sem credencial de sandbox).
6. Consultas disponíveis: `Cobrancas` (filtra por data de criação), `Clientes`, `Assinaturas`, `Extrato`, `Transferencias` (data de criação), `NotasFiscais` (data de emissão) e `Saldo`.

## 3. Power BI

1. Use `00_Parametros_PowerBI.pq` **no lugar de** `00_Parametros.pq` (mesmo nome de consulta: **Parametros**). Antes, crie os parâmetros `AsaasApiKey`, `AsaasAmbiente`, `AsaasDataInicial` e `AsaasDataFinal` em **Transformar dados > Gerenciar Parâmetros**.
2. Cole `01_fnApi.pq` (consulta **fnApi**) e as consultas `1x_*.pq` como no Excel. Se o Power BI Desktop acusar Formula.Firewall, ajuste em Arquivo > Opções > Privacidade (a combinação é entre parâmetros e a API).
3. Após publicar, defina os parâmetros em **Configurações do modelo semântico > Parâmetros** e a credencial da fonte web como **Anônima**. As URLs base são fixas por ambiente e o caminho vai em `RelativePath`, o que permite o refresh agendado. Ao trocar de ambiente, o serviço pode pedir a credencial da outra URL.
4. Cada página de 100 registros é uma requisição. A conta tem cota de **25.000 requisições a cada 12 horas** (compartilhada com o seu ERP/sistemas). Agende poucos refreshes por dia e use `DataInicial`/`DataFinal`.
5. O Power Query é **só leitura**: nenhum arquivo do kit cria, cancela ou estorna nada — um refresh repetiria a operação.

## 4. Python

```bash
cd python
cp .env.example .env        # preencha ASAAS_API_KEY (entre aspas simples) e mantenha ASAAS_AMBIENTE=sandbox
pip install requests python-dotenv
python cliente.py           # exemplo: saldo, cliente, cobrança Pix e QR Code (recusa rodar em produção)
```

Uso em código: `from cliente import AsaasCliente; api = AsaasCliente(); api.listar_cobrancas(status="RECEIVED")`.
Métodos: clientes, cobranças (criar, obter, status, QR Code Pix, linha digitável, excluir, estornar, listar), assinaturas, saldo, extrato, transferência Pix, notas fiscais, webhooks (criar, listar, reativar) e `webhook_autentico()` para validar o header `asaas-access-token`.

## 5. TypeScript (Node 18+)

```bash
cd typescript
cp .env.example .env        # preencha ASAAS_API_KEY
npx tsx --env-file=.env cliente.ts      # Node 20.6+ (em Node 18: npm i dotenv && npx tsx -r dotenv/config cliente.ts)
```

Importe com `import { AsaasCliente } from "./cliente"`; os métodos espelham os do Python.

## 6. Trocar de sandbox para produção

1. Crie/aprovar a conta em https://www.asaas.com e gere uma chave de **produção**.
2. Troque **ao mesmo tempo** o ambiente (`Ambiente`/`AsaasAmbiente`/`ASAAS_AMBIENTE` = `producao`) e a chave. Nada mais muda.
3. **Atenção:** em produção as cobranças são reais (clientes recebem e-mails/SMS) e transferências movimentam dinheiro. Webhooks, chaves Pix e configurações do sandbox **não** são copiados — recrie-os.
4. Transferências e pagamentos via API podem voltar com `invalid_action` (autorização crítica). Resolva com whitelist de IPs ou com o webhook de validação de saque, no painel do Asaas.

## 7. Segurança

- Não compartilhe a planilha, o `.pbix` ou o `.env` com a chave preenchida; não versione o `.env`.
- No Power BI, prefira parâmetros do modelo semântico; em servidores, use cofre de segredos (Key Vault, Secrets Manager).
- O Asaas não documenta escopos por chave: uma chave dá acesso à conta inteira. Para BI, considere uma conta/subconta dedicada e restrinja IPs em **Integrações > Mecanismos de segurança**.
- Troque a chave imediatamente se ela vazar (Integrações > Chaves de API) e defina data de expiração.
- A API não tem proteção contra duplicidade: os clientes Python/TS não repetem escritas em erro 5xx; em timeout, consulte pelo `externalReference` antes de tentar de novo.

## Limitações conhecidas

- Não há OAuth nem certificado digital: autenticação por chave estática no header `access_token`.
- As listagens de transferências e de cobranças de uma assinatura não documentam `offset`/`limit` na especificação; o kit usa a paginação padrão da API (inferido).
- Webhooks exigem um endpoint HTTPS público; o Power Query não recebe webhooks.

Fontes: https://docs.asaas.com/docs/autentica%C3%A7%C3%A3o-1 · https://docs.asaas.com/reference/listagem-e-paginacao · https://docs.asaas.com/reference/rate-e-quota-limit · https://docs.asaas.com/docs/sandbox
