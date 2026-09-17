// Extrato: Lançamentos do extrato da conta no período. (somente leitura; período DataInicial/DataFinal da tbConfig).
// Endpoint: GET /v3/financialTransactions  (id canônico asaas.transacao.listar). Não requer edição.
let
    Dados = fnApi("v3/financialTransactions", null, {"startDate", "finishDate"}, true),
    Tabela = Table.FromRecords(Dados, {"id", "value", "type", "description", "balance", "date", "paymentId", "object", "splitId", "transferId", "anticipationId", "billId"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"id", type text}, {"value", type number}, {"type", type text}, {"description", type text}, {"balance", type number}, {"date", type date}, {"paymentId", type text}, {"object", type text}, {"splitId", type text}, {"transferId", type text}, {"anticipationId", type text}, {"billId", type text}})
in
    Tipos
