// Contatos: todos os contatos (clientes, fornecedores etc.; criterio=1). Somente leitura.
// Endpoint: GET /Api/v3/contatos (bling.pessoa.listar). Documento vem com mascara.
let
    Dados = fnApi("contatos", [criterio = "1"], true),
    Tabela = Table.FromRecords(Dados, {"id", "nome", "codigo", "situacao", "numeroDocumento", "telefone", "celular"}, MissingField.UseNull),
    Tipos = Table.TransformColumns(Tabela, {
        {"id", each try Int64.From(_) otherwise null, Int64.Type},
        {"nome", each if _ = null then null else Text.From(_), type text},
        {"codigo", each if _ = null then null else Text.From(_), type text},
        {"situacao", each if _ = null then null else Text.From(_), type text},
        {"numeroDocumento", each if _ = null then null else Text.From(_), type text},
        {"telefone", each if _ = null then null else Text.From(_), type text},
        {"celular", each if _ = null then null else Text.From(_), type text}
    })
in
    Tipos
