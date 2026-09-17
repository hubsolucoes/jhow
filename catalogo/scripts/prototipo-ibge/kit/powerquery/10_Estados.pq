// Estados: lista as UFs (somente leitura).
let
    Dados = fnApi("api/v1/localidades/estados", [orderBy = "nome"]),
    Tabela = Table.FromRecords(Dados, {"id", "sigla", "nome"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"id", Int64.Type}, {"sigla", type text}, {"nome", type text}})
in
    Tipos
