// Transferencias: Transferências (Pix/TED/entre contas Asaas) criadas no período. (somente leitura; período DataInicial/DataFinal da tbConfig).
// Endpoint: GET /v3/transfers  (id canônico asaas.pagamento.listar.transferencia). Não requer edição.
let
    Dados = fnApi("v3/transfers", null, {"dateCreated[ge]", "dateCreated[le]"}, true),
    Tabela = Table.FromRecords(Dados, {"id", "dateCreated", "value", "netValue", "status", "type", "endToEndIdentifier", "effectiveDate", "operationType", "externalReference", "description", "object"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"id", type text}, {"dateCreated", type date}, {"value", type number}, {"netValue", type number}, {"status", type text}, {"type", type text}, {"endToEndIdentifier", type text}, {"effectiveDate", type date}, {"operationType", type text}, {"externalReference", type text}, {"description", type text}, {"object", type text}})
in
    Tipos
