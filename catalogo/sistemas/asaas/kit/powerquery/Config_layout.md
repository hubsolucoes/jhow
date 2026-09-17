# Aba "Config" — tabela `tbConfig` (Kit Asaas)

Crie uma aba chamada **Config** com uma tabela do Excel (Inserir > Tabela) chamada **tbConfig** e exatamente estas colunas:

| Chave | Valor | Descricao |
|---|---|---|

Linhas esperadas:

| Chave | Obrigatória? | Exemplo de Valor | Descrição |
|---|---|---|---|
| `Ambiente` | Sim | `sandbox` | `sandbox` (testes, padrão) ou `producao`. Qualquer outro valor é tratado como sandbox. |
| `ApiKey` | Sim | `<<SUA_API_KEY>>` | Chave de API do Asaas do mesmo ambiente. Sandbox começa com `$aact_hmlg_`; produção com `$aact_prod_`. Gerada em Integrações > Chaves de API (somente administradores, exibida uma única vez). |
| `DataInicial` | Não | `2026-01-01` | Início do período (AAAA-MM-DD) usado em Cobrancas (data de criação), Extrato, Transferencias e NotasFiscais (data de emissão). |
| `DataFinal` | Não | *(vazio)* | Fim do período (AAAA-MM-DD). Vazio = sem limite. |
| `UserAgent` | Não | `financeiro-minhaempresa/1.0` | Identificação da aplicação no header User-Agent (obrigatório pela API para contas novas; o kit envia um valor padrão se vazio). |

Observações:
- Digite as datas como texto (`'2026-01-01`) ou como data do Excel; a consulta `Parametros` converte os dois formatos.
- O valor inicial desta tabela está em `tbConfig.json`.
- Não compartilhe a planilha com a `ApiKey` preenchida.
