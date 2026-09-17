// PedidosCompra: pedidos de compra com data entre DataInicial e DataFinal. Somente leitura.
// Endpoint: GET /Api/v3/pedidos/compras (bling.pedido.listar.compra).
// valorSituacao: 0 em aberto, 1 atendido, 2 cancelado, 3 em andamento.
let
    Dados = fnApi("pedidos/compras", [
        dataInicial = Record.FieldOrDefault(Parametros, "DataInicial", null),
        dataFinal = Record.FieldOrDefault(Parametros, "DataFinal", null)
    ], true),
    Tabela = Table.FromRecords(Dados, {"id", "numero", "data", "dataPrevista", "totalProdutos", "total", "fornecedor", "situacao"}, MissingField.UseNull),
    Exp1 = Table.ExpandRecordColumn(Tabela, "fornecedor", {"id"}, {"idFornecedor"}),
    Exp2 = Table.ExpandRecordColumn(Exp1, "situacao", {"id", "valor"}, {"idSituacao", "valorSituacao"}),
    Tipos = Table.TransformColumns(Exp2, {
        {"id", each try Int64.From(_) otherwise null, Int64.Type},
        {"numero", each try Int64.From(_) otherwise null, Int64.Type},
        {"data", each try Date.FromText(Text.Start(_, 10)) otherwise null, type date},
        {"dataPrevista", each try Date.FromText(Text.Start(_, 10)) otherwise null, type date},
        {"totalProdutos", each try Number.From(_) otherwise null, type number},
        {"total", each try Number.From(_) otherwise null, type number},
        {"idFornecedor", each try Int64.From(_) otherwise null, Int64.Type},
        {"idSituacao", each try Int64.From(_) otherwise null, Int64.Type},
        {"valorSituacao", each try Int64.From(_) otherwise null, Int64.Type}
    })
in
    Tipos
