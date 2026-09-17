// Saldo: Saldo atual da conta (uma linha). (somente leitura; sem filtro de período).
// Endpoint: GET /v3/finance/balance  (id canônico asaas.empresa.obter.saldo). Não requer edição.
let
    Dados = fnApi("v3/finance/balance", null, null, false),
    Tabela = Table.FromRecords(Dados, {"balance"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"balance", type number}})
in
    Tipos
