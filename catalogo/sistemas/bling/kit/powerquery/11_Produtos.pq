// Produtos: catalogo completo (criterio=5: todos, inclusive inativos/excluidos; filtre por situacao). Somente leitura.
// Endpoint: GET /Api/v3/produtos (bling.produto.listar). NCM/GTIN exigem GET /produtos/{id} (nao incluido).
let
    Dados = fnApi("produtos", [criterio = "5", tipo = "T"], true),
    Tabela = Table.FromRecords(Dados, {"id", "idProdutoPai", "nome", "codigo", "preco", "precoCusto", "tipo", "situacao", "formato", "estoque"}, MissingField.UseNull),
    Exp1 = Table.ExpandRecordColumn(Tabela, "estoque", {"saldoVirtualTotal"}, {"saldoVirtualTotal"}),
    Tipos = Table.TransformColumns(Exp1, {
        {"id", each try Int64.From(_) otherwise null, Int64.Type},
        {"idProdutoPai", each try Int64.From(_) otherwise null, Int64.Type},
        {"nome", each if _ = null then null else Text.From(_), type text},
        {"codigo", each if _ = null then null else Text.From(_), type text},
        {"preco", each try Number.From(_) otherwise null, type number},
        {"precoCusto", each try Number.From(_) otherwise null, type number},
        {"tipo", each if _ = null then null else Text.From(_), type text},
        {"situacao", each if _ = null then null else Text.From(_), type text},
        {"formato", each if _ = null then null else Text.From(_), type text},
        {"saldoVirtualTotal", each try Number.From(_) otherwise null, type number}
    })
in
    Tipos
