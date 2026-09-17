// NotasFiscais: NFS-e com data de emissão no período (atenção: sufixos [Ge]/[Le] com G e L maiúsculos). (somente leitura; período DataInicial/DataFinal da tbConfig).
// Endpoint: GET /v3/invoices  (id canônico asaas.nota_fiscal.listar.nfse). Não requer edição.
let
    Dados = fnApi("v3/invoices", null, {"effectiveDate[Ge]", "effectiveDate[Le]"}, true),
    Tabela = Table.FromRecords(Dados, {"id", "customer", "value", "status", "type", "effectiveDate", "number", "externalReference", "object", "payment", "installment", "statusDescription"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"id", type text}, {"customer", type text}, {"value", type number}, {"status", type text}, {"type", type text}, {"effectiveDate", type date}, {"number", type text}, {"externalReference", type text}, {"object", type text}, {"payment", type text}, {"installment", type text}, {"statusDescription", type text}})
in
    Tipos
