// NfseNacionalRecebidas: NFS-e do padrao Nacional tomadas pelo CNPJ da aba Config. Somente leitura.
// Rota: GET /v2/nfsens_recebidas?cnpj=...&versao=...
let
    Dados = fnApi("v2/nfsens_recebidas", [cnpj = Parametros[Cnpj]], "versao"),
    Colunas = {"chave_nfse", "nome_prestador", "documento_prestador", "valor_total", "data_emissao",
               "data_geracao", "situacao", "versao", "data_cancelamento", "motivo_cancelamento"},
    Tabela = Table.FromRecords(Dados, Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"chave_nfse", type text}, {"nome_prestador", type text}, {"documento_prestador", type text},
        {"valor_total", type number}, {"data_emissao", type datetimezone}, {"data_geracao", type datetimezone},
        {"situacao", type text}, {"versao", Int64.Type}, {"data_cancelamento", type datetimezone},
        {"motivo_cancelamento", type text}}, "en-US")
in
    Tipos
