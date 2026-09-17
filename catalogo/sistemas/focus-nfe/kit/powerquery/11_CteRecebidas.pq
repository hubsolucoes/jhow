// CteRecebidas: CT-e em que o CNPJ da aba Config e tomador/interessado. Somente leitura.
// Rota: GET /v2/ctes_recebidas?cnpj=...&versao=...
let
    Dados = fnApi("v2/ctes_recebidas", [cnpj = Parametros[Cnpj]], "versao"),
    Colunas = {"chave_cte", "nome_emitente", "documento_emitente", "cnpj_destinatario", "valor_total",
               "data_emissao", "situacao", "tipo_cte", "versao"},
    Tabela = Table.FromRecords(Dados, Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"chave_cte", type text}, {"nome_emitente", type text}, {"documento_emitente", type text},
        {"cnpj_destinatario", type text}, {"valor_total", type number}, {"data_emissao", type datetimezone},
        {"situacao", type text}, {"tipo_cte", type text}, {"versao", Int64.Type}}, "en-US")
in
    Tipos
