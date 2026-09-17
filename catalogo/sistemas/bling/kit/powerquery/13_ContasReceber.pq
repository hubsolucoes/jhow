// ContasReceber: titulos a receber com VENCIMENTO entre DataInicial e DataFinal (tipoFiltroData = V). Somente leitura.
// Endpoint: GET /Api/v3/contas/receber (bling.conta_receber.listar).
// situacao: 1 aberto, 2 pago, 3 parcial, 4 devolvido, 5 cancelado (6 e 7 existem no registro).
let
    Dados = fnApi("contas/receber", [
        tipoFiltroData = "V",
        dataInicial = Record.FieldOrDefault(Parametros, "DataInicial", null),
        dataFinal = Record.FieldOrDefault(Parametros, "DataFinal", null)
    ], true),
    Tabela = Table.FromRecords(Dados, {"id", "situacao", "vencimento", "valor", "dataEmissao", "contato", "formaPagamento", "origem"}, MissingField.UseNull),
    Exp1 = Table.ExpandRecordColumn(Tabela, "contato", {"id", "nome", "numeroDocumento"}, {"idContato", "cliente", "documentoCliente"}),
    Exp2 = Table.ExpandRecordColumn(Exp1, "formaPagamento", {"id"}, {"idFormaPagamento"}),
    Exp3 = Table.ExpandRecordColumn(Exp2, "origem", {"id", "tipoOrigem", "numero"}, {"idOrigem", "tipoOrigem", "numeroOrigem"}),
    Tipos = Table.TransformColumns(Exp3, {
        {"id", each try Int64.From(_) otherwise null, Int64.Type},
        {"situacao", each try Int64.From(_) otherwise null, Int64.Type},
        {"vencimento", each try Date.FromText(Text.Start(_, 10)) otherwise null, type date},
        {"valor", each try Number.From(_) otherwise null, type number},
        {"dataEmissao", each try Date.FromText(Text.Start(_, 10)) otherwise null, type date},
        {"idContato", each try Int64.From(_) otherwise null, Int64.Type},
        {"cliente", each if _ = null then null else Text.From(_), type text},
        {"documentoCliente", each if _ = null then null else Text.From(_), type text},
        {"idFormaPagamento", each try Int64.From(_) otherwise null, Int64.Type},
        {"idOrigem", each try Int64.From(_) otherwise null, Int64.Type},
        {"tipoOrigem", each if _ = null then null else Text.From(_), type text},
        {"numeroOrigem", each if _ = null then null else Text.From(_), type text}
    })
in
    Tipos
