// MunicipiosNfse: municipios da UF da aba Config e a situacao da integracao de NFS-e na Focus. Somente leitura.
// Rota: GET /v2/municipios?sigla_uf=...&offset=...
let
    Dados = fnApi("v2/municipios", [sigla_uf = Parametros[UF]], "offset"),
    Colunas = {"codigo_municipio", "nome_municipio", "sigla_uf", "nfse_habilitada", "status_nfse",
               "requer_certificado_nfse", "possui_ambiente_homologacao_nfse", "possui_cancelamento_nfse", "provedor_nfse"},
    Tabela = Table.FromRecords(Dados, Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"codigo_municipio", type text}, {"nome_municipio", type text}, {"sigla_uf", type text},
        {"nfse_habilitada", type logical}, {"status_nfse", type text}, {"requer_certificado_nfse", type logical},
        {"possui_ambiente_homologacao_nfse", type logical}, {"possui_cancelamento_nfse", type logical},
        {"provedor_nfse", type text}})
in
    Tipos
