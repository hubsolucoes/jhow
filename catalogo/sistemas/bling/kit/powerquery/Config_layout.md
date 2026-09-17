# Aba "Config": tabela `tbConfig` (kit Bling)

A tabela fica na aba **Config** da planilha e se chama `tbConfig`. Tem três colunas: `Chave | Valor | Descricao`.
Só a coluna **Valor** deve ser editada. A consulta `Parametros` lê essa tabela; nenhuma outra consulta guarda credencial.

| Chave | Obrigatória? | Descrição | Exemplo |
|---|---|---|---|
| `Ambiente` | sim | `sandbox` usa o token de uma **conta Bling de teste**; `producao` usa a conta real. O Bling não tem ambiente sandbox separado: as duas opções chamam `https://api.bling.com.br/Api/v3`. O valor serve para você saber de qual conta é o token. | `sandbox` |
| `AccessToken` | sim | Token OAuth2 (Bearer) da conta Bling. Expira (o exemplo oficial mostra 6 h). Deixe o script `kit/python/cliente.py renovar --excel <planilha>` gravar aqui; ou cole um token gerado pelo script. | `<<SEU_ACCESS_TOKEN>>` |
| `DataInicial` | não | Início do período (AAAA-MM-DD) usado em Pedidos, PedidosCompra, NotasFiscais, ContasReceber (vencimento) e ContasPagar (vencimento). Vazio = padrão da API. | `2026-01-01` |
| `DataFinal` | não | Fim do período (AAAA-MM-DD). O Bling recusa (HTTP 400) intervalos maiores que 1 ano. | `2026-12-31` |
| `TokenAtualizadoEm` | não | Data/hora da última gravação do token pelo script. Só informativo. | `2026-09-17 08:00:00` |

**Não** coloque `ClientId`, `ClientSecret` ou `RefreshToken` na planilha: o Power Query não usa esses valores e eles dão acesso permanente à conta. Eles ficam apenas no `.env` do script Python/Node.

Consultas que usam cada chave:

| Consulta | Endpoint | Chaves |
|---|---|---|
| `Pedidos` | `GET /pedidos/vendas` | AccessToken, DataInicial, DataFinal |
| `Produtos` | `GET /produtos` | AccessToken |
| `Estoque` | `GET /estoques/saldos` | AccessToken (usa a consulta Produtos) |
| `ContasReceber` | `GET /contas/receber` | AccessToken, DataInicial, DataFinal |
| `ContasPagar` | `GET /contas/pagar` | AccessToken, DataInicial, DataFinal |
| `NotasFiscais` | `GET /nfe` | AccessToken, DataInicial, DataFinal |
| `Contatos` | `GET /contatos` | AccessToken |
| `PedidosCompra` | `GET /pedidos/compras` | AccessToken, DataInicial, DataFinal |
| `CategoriasFinanceiras` | `GET /categorias/receitas-despesas` | AccessToken |
