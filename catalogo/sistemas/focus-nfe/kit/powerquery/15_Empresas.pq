// Empresas: emitentes da conta, com habilitacoes e validade do certificado. Somente leitura.
// Rota: GET /v2/empresas (50 por pagina). ATENCAO: esta API so existe em PRODUCAO e exige token
// com permissao de gestao de empresas. Em sandbox a consulta devolve uma linha explicativa.
// Os tokens das empresas NAO sao trazidos para a planilha.
let
    Colunas = {"id", "nome", "nome_fantasia", "cnpj", "habilita_nfe", "habilita_nfce", "habilita_nfse",
               "habilita_cte", "habilita_mdfe", "certificado_valido_de", "certificado_valido_ate"},
    Tabela =
        if Parametros[Ambiente] <> "producao" then
            #table(Colunas, {{null, "Disponivel apenas com Ambiente = producao", null, null, null, null, null, null, null, null, null}})
        else
            Table.FromRecords(fnApi("v2/empresas", null, "offset"), Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"id", Int64.Type}, {"nome", type text}, {"nome_fantasia", type text}, {"cnpj", type text},
        {"habilita_nfe", type logical}, {"habilita_nfce", type logical}, {"habilita_nfse", type logical},
        {"habilita_cte", type logical}, {"habilita_mdfe", type logical},
        {"certificado_valido_de", type datetimezone}, {"certificado_valido_ate", type datetimezone}}, "en-US")
in
    Tipos
