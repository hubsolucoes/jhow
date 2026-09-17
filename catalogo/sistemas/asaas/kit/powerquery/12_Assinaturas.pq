// Assinaturas: Assinaturas recorrentes (base para MRR). (somente leitura; sem filtro de período).
// Endpoint: GET /v3/subscriptions  (id canônico asaas.assinatura.listar). Não requer edição.
let
    Dados = fnApi("v3/subscriptions", null, null, true),
    Tabela = Table.FromRecords(Dados, {"id", "dateCreated", "customer", "value", "billingType", "status", "nextDueDate", "cycle", "externalReference", "description", "object", "paymentLink"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"id", type text}, {"dateCreated", type date}, {"customer", type text}, {"value", type number}, {"billingType", type text}, {"status", type text}, {"nextDueDate", type date}, {"cycle", type text}, {"externalReference", type text}, {"description", type text}, {"object", type text}, {"paymentLink", type text}})
in
    Tipos
