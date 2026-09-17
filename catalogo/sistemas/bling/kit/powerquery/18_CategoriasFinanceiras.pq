// CategoriasFinanceiras: plano de contas gerencial (categorias de receita e despesa, ativas e inativas). Somente leitura.
// Endpoint: GET /Api/v3/categorias/receitas-despesas (bling.plano_contas.listar). tipo: 1 despesa, 2 receita, 3 ambos.
let
    Dados = fnApi("categorias/receitas-despesas", [tipo = "0", situacao = "0"], true),
    Tabela = Table.FromRecords(Dados, {"id", "idCategoriaPai", "descricao", "tipo"}, MissingField.UseNull),
    Tipos = Table.TransformColumns(Tabela, {
        {"id", each try Int64.From(_) otherwise null, Int64.Type},
        {"idCategoriaPai", each try Int64.From(_) otherwise null, Int64.Type},
        {"descricao", each if _ = null then null else Text.From(_), type text},
        {"tipo", each try Int64.From(_) otherwise null, Int64.Type}
    })
in
    Tipos
