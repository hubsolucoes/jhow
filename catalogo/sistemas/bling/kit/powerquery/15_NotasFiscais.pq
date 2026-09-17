// NotasFiscais: NF-e de saida emitidas entre DataInicial e DataFinal. Somente leitura.
// Endpoint: GET /Api/v3/nfe (bling.nota_fiscal.listar.nfe). Sem filtro de situacao o Bling nao traz canceladas.
// situacao: 1 pendente, 2 cancelada, 4 rejeitada, 5 autorizada, 6 emitida DANFE, 9 denegada (ver doc).
let
    Dados = fnApi("nfe", [
        tipo = "1",
        dataEmissaoInicial = Record.FieldOrDefault(Parametros, "DataInicial", null),
        dataEmissaoFinal = Record.FieldOrDefault(Parametros, "DataFinal", null)
    ], true),
    Tabela = Table.FromRecords(Dados, {"id", "tipo", "situacao", "numero", "dataEmissao", "dataOperacao", "chaveAcesso", "contato", "naturezaOperacao"}, MissingField.UseNull),
    Exp1 = Table.ExpandRecordColumn(Tabela, "contato", {"id", "nome", "numeroDocumento"}, {"idContato", "destinatario", "documentoDestinatario"}),
    Exp2 = Table.ExpandRecordColumn(Exp1, "naturezaOperacao", {"id"}, {"idNaturezaOperacao"}),
    Tipos = Table.TransformColumns(Exp2, {
        {"id", each try Int64.From(_) otherwise null, Int64.Type},
        {"tipo", each try Int64.From(_) otherwise null, Int64.Type},
        {"situacao", each try Int64.From(_) otherwise null, Int64.Type},
        {"numero", each if _ = null then null else Text.From(_), type text},
        {"dataEmissao", each try DateTime.FromText(_) otherwise null, type datetime},
        {"dataOperacao", each try DateTime.FromText(_) otherwise null, type datetime},
        {"chaveAcesso", each if _ = null then null else Text.From(_), type text},
        {"idContato", each try Int64.From(_) otherwise null, Int64.Type},
        {"destinatario", each if _ = null then null else Text.From(_), type text},
        {"documentoDestinatario", each if _ = null then null else Text.From(_), type text},
        {"idNaturezaOperacao", each try Int64.From(_) otherwise null, Int64.Type}
    })
in
    Tipos
