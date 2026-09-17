// BackupsXml: links dos ZIPs mensais de XMLs e DANFEs do CNPJ da aba Config. Somente leitura.
// Rota: GET /v2/backups/{cnpj}.json. Gerados no dia 1o (parcial aos sabados); baixe a partir do dia 2.
let
    Dados = fnApi("v2/backups/" & Parametros[Cnpj] & ".json"),
    Lista = if Dados is list then Dados else {Dados},
    Tabela = Table.FromRecords(Lista, {"mes", "xmls", "danfes"}, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, {{"mes", type text}, {"xmls", type text}, {"danfes", type text}})
in
    Tipos
