// NfeRecebidas: NF-e emitidas contra o CNPJ da aba Config (notas de compra). Somente leitura.
// Rota: GET /v2/nfes_recebidas?cnpj=...&versao=... (ate 100 por chamada; paginacao por versao).
let
    Dados = fnApi("v2/nfes_recebidas", [cnpj = Parametros[Cnpj]], "versao"),
    Colunas = {"chave_nfe", "nome_emitente", "documento_emitente", "cnpj_destinatario", "valor_total", "data_emissao",
               "situacao", "manifestacao_destinatario", "nfe_completa", "tipo_nfe", "versao", "data_cancelamento"},
    Tabela = Table.FromRecords(Dados, Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"chave_nfe", type text}, {"nome_emitente", type text}, {"documento_emitente", type text},
        {"cnpj_destinatario", type text}, {"valor_total", type number}, {"data_emissao", type datetimezone},
        {"situacao", type text}, {"manifestacao_destinatario", type text}, {"nfe_completa", type text},
        {"tipo_nfe", type text}, {"versao", Int64.Type}, {"data_cancelamento", type datetimezone}}, "en-US")
in
    Tipos
