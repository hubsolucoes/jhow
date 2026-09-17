// fnApi: funcao generica de leitura (GET) para a API.
// PROTOTIPO: usa a API publica de localidades do IBGE so para provar o mecanismo
// (config na planilha -> header de autenticacao -> resposta em tabela).
(caminho as text, optional consulta as nullable record) as any =>
let
    Ambiente = Parametros[Ambiente],
    BaseUrl =
        if Ambiente = "producao" then "https://servicodados.ibge.gov.br"
        else if Ambiente = "sandbox" then "https://servicodados.ibge.gov.br"
        else error Error.Record("Configuracao invalida", "Ambiente deve ser 'sandbox' ou 'producao'", Ambiente),
    Resposta = Web.Contents(
        BaseUrl,
        [
            RelativePath = caminho,
            Query = if consulta = null then [] else consulta,
            // Em um sistema real, aqui entra o header de autenticacao exigido pelo fornecedor.
            Headers = [#"X-Prototipo-Credencial" = Parametros[ApiKey], Accept = "application/json"],
            ManualStatusHandling = {400, 401, 403, 404, 422, 429, 500, 502, 503}
        ]
    ),
    // Com credencial recusada (HTTP 401/403) o Excel nao entrega o status: vem null.
    // Sem este teste, "Status >= 400" quebra com "nao foi possivel converter null em Logical".
    Status = Record.FieldOrDefault(Value.Metadata(Resposta), "Response.Status", null),
    Resultado =
        if Status = null then
            error Error.Record(
                "Erro da API",
                "Credencial recusada (HTTP 401/403): confira a credencial e o Ambiente na aba Config.",
                caminho
            )
        else if Status >= 400 then
            error Error.Record("Erro da API", "HTTP " & Text.From(Status), Text.FromBinary(Resposta))
        else
            Json.Document(Resposta)
in
    Resultado
