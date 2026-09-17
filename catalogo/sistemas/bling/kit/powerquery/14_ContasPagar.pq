// ContasPagar: titulos a pagar com vencimento entre DataInicial e DataFinal. Somente leitura.
// Endpoint: GET /Api/v3/contas/pagar (bling.conta_pagar.listar). O fornecedor vem so com id (cruze com Contatos).
let
    Dados = fnApi("contas/pagar", [
        dataVencimentoInicial = Record.FieldOrDefault(Parametros, "DataInicial", null),
        dataVencimentoFinal = Record.FieldOrDefault(Parametros, "DataFinal", null)
    ], true),
    Tabela = Table.FromRecords(Dados, {"id", "situacao", "vencimento", "valor", "contato", "formaPagamento"}, MissingField.UseNull),
    Exp1 = Table.ExpandRecordColumn(Tabela, "contato", {"id"}, {"idContato"}),
    Exp2 = Table.ExpandRecordColumn(Exp1, "formaPagamento", {"id"}, {"idFormaPagamento"}),
    Tipos = Table.TransformColumns(Exp2, {
        {"id", each try Int64.From(_) otherwise null, Int64.Type},
        {"situacao", each try Int64.From(_) otherwise null, Int64.Type},
        {"vencimento", each try Date.FromText(Text.Start(_, 10)) otherwise null, type date},
        {"valor", each try Number.From(_) otherwise null, type number},
        {"idContato", each try Int64.From(_) otherwise null, Int64.Type},
        {"idFormaPagamento", each try Int64.From(_) otherwise null, Int64.Type}
    })
in
    Tipos
