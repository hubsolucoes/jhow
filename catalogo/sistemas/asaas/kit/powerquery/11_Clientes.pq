// Clientes: Cadastro completo de clientes (pagadores). (somente leitura; sem filtro de período).
// Endpoint: GET /v3/customers  (id canônico asaas.cliente.listar). Não requer edição.
let
    Dados = fnApi("v3/customers", null, null, true),
    Tabela = Table.FromRecords(Dados, {"id", "dateCreated", "name", "cpfCnpj", "email", "externalReference", "object", "phone", "mobilePhone", "address", "addressNumber", "complement"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"id", type text}, {"dateCreated", type text}, {"name", type text}, {"cpfCnpj", type text}, {"email", type text}, {"externalReference", type text}, {"object", type text}, {"phone", type text}, {"mobilePhone", type text}, {"address", type text}, {"addressNumber", type text}, {"complement", type text}})
in
    Tipos
