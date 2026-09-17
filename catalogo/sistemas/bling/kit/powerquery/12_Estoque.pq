// Estoque: saldo fisico e virtual por produto e por deposito, para os produtos ativos do tipo P.
// Endpoint: GET /Api/v3/estoques/saldos (bling.estoque.listar.saldos). Nao paginado: envia IDs em lotes de 50
// (a doc nao informa o maximo por chamada) e espera 0,4 s entre lotes. Depende da consulta Produtos.
let
    Ativos = Table.SelectRows(Produtos, each [situacao] = "A" and [tipo] = "P" and [id] <> null),
    Lotes = List.Split(List.Transform(Ativos[id], Text.From), 50),
    Dados = List.Combine(List.Transform(Lotes, each Function.InvokeAfter(() => fnApi("estoques/saldos", [#"idsProdutos[]" = _])[data], #duration(0, 0, 0, 0.4)))),
    Tabela = Table.FromRecords(Dados, {"produto", "saldoFisicoTotal", "saldoVirtualTotal", "depositos"}, MissingField.UseNull),
    Exp1 = Table.ExpandRecordColumn(Tabela, "produto", {"id", "codigo"}, {"idProduto", "sku"}),
    Linhas = Table.ExpandListColumn(Exp1, "depositos"),
    Extra = Table.ExpandRecordColumn(Linhas, "depositos", {"id", "saldoFisico", "saldoVirtual"}, {"idDeposito", "saldoFisicoDeposito", "saldoVirtualDeposito"}),
    Tipos = Table.TransformColumns(Extra, {
        {"saldoFisicoTotal", each try Number.From(_) otherwise null, type number},
        {"saldoVirtualTotal", each try Number.From(_) otherwise null, type number},
        {"idProduto", each try Int64.From(_) otherwise null, Int64.Type},
        {"sku", each if _ = null then null else Text.From(_), type text},
        {"idDeposito", each try Int64.From(_) otherwise null, Int64.Type},
        {"saldoFisicoDeposito", each try Number.From(_) otherwise null, type number},
        {"saldoVirtualDeposito", each try Number.From(_) otherwise null, type number}
    })
in
    Tipos
