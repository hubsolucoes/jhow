// Cobrancas: Cobranças criadas no período (boleto, Pix, cartão). Troque dateCreated por paymentDate para ver o que foi pago no período. (somente leitura; período DataInicial/DataFinal da tbConfig).
// Endpoint: GET /v3/payments  (id canônico asaas.cobranca.listar). Não requer edição.
let
    Dados = fnApi("v3/payments", null, {"dateCreated[ge]", "dateCreated[le]"}, true),
    Tabela = Table.FromRecords(Dados, {"id", "dateCreated", "customer", "value", "netValue", "billingType", "status", "dueDate", "paymentDate", "externalReference", "description", "invoiceUrl"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"id", type text}, {"dateCreated", type date}, {"customer", type text}, {"value", type number}, {"netValue", type number}, {"billingType", type text}, {"status", type text}, {"dueDate", type date}, {"paymentDate", type date}, {"externalReference", type text}, {"description", type text}, {"invoiceUrl", type text}})
in
    Tipos
