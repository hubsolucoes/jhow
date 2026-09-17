// Pedidos: pedidos de venda com data entre DataInicial e DataFinal (tbConfig). Somente leitura.
// Endpoint: GET /Api/v3/pedidos/vendas (bling.pedido.listar.venda). Periodo maximo: 1 ano.
// idSituacao e personalizado por conta Bling; itens/parcelas exigem GET /pedidos/vendas/{id} (nao incluido).
let
    Dados = fnApi("pedidos/vendas", [
        dataInicial = Record.FieldOrDefault(Parametros, "DataInicial", null),
        dataFinal = Record.FieldOrDefault(Parametros, "DataFinal", null)
    ], true),
    Tabela = Table.FromRecords(Dados, {"id", "numero", "numeroLoja", "data", "dataSaida", "dataPrevista", "totalProdutos", "total", "contato", "situacao", "loja"}, MissingField.UseNull),
    Exp1 = Table.ExpandRecordColumn(Tabela, "contato", {"id", "nome", "tipoPessoa", "numeroDocumento"}, {"idContato", "cliente", "tipoPessoa", "documentoCliente"}),
    Exp2 = Table.ExpandRecordColumn(Exp1, "situacao", {"id", "valor"}, {"idSituacao", "valorSituacao"}),
    Exp3 = Table.ExpandRecordColumn(Exp2, "loja", {"id"}, {"idLoja"}),
    Tipos = Table.TransformColumns(Exp3, {
        {"id", each try Int64.From(_) otherwise null, Int64.Type},
        {"numero", each try Int64.From(_) otherwise null, Int64.Type},
        {"numeroLoja", each if _ = null then null else Text.From(_), type text},
        {"data", each try Date.FromText(Text.Start(_, 10)) otherwise null, type date},
        {"dataSaida", each try Date.FromText(Text.Start(_, 10)) otherwise null, type date},
        {"dataPrevista", each try Date.FromText(Text.Start(_, 10)) otherwise null, type date},
        {"totalProdutos", each try Number.From(_) otherwise null, type number},
        {"total", each try Number.From(_) otherwise null, type number},
        {"idContato", each try Int64.From(_) otherwise null, Int64.Type},
        {"cliente", each if _ = null then null else Text.From(_), type text},
        {"tipoPessoa", each if _ = null then null else Text.From(_), type text},
        {"documentoCliente", each if _ = null then null else Text.From(_), type text},
        {"idSituacao", each try Int64.From(_) otherwise null, Int64.Type},
        {"valorSituacao", each try Int64.From(_) otherwise null, Int64.Type},
        {"idLoja", each try Int64.From(_) otherwise null, Int64.Type}
    })
in
    Tipos
