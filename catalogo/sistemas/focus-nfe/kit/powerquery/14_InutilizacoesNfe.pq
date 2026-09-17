// InutilizacoesNfe: faixas de numeracao de NF-e inutilizadas para o CNPJ da aba Config. Somente leitura.
// Rota: GET /v2/nfe/inutilizacoes?cnpj=...
let
    Dados = fnApi("v2/nfe/inutilizacoes", [cnpj = Parametros[Cnpj]]),
    Lista = if Dados is list then Dados else {Dados},
    Colunas = {"cnpj", "modelo", "serie", "numero_inicial", "numero_final", "status", "status_sefaz",
               "mensagem_sefaz", "protocolo_sefaz", "caminho_xml"},
    Tabela = Table.FromRecords(Lista, Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {
        {"cnpj", type text}, {"modelo", type text}, {"serie", type text}, {"numero_inicial", Int64.Type},
        {"numero_final", Int64.Type}, {"status", type text}, {"status_sefaz", type text},
        {"mensagem_sefaz", type text}, {"protocolo_sefaz", type text}, {"caminho_xml", type text}})
in
    Tipos
