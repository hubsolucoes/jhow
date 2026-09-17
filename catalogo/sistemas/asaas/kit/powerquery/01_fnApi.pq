// fnApi: funcao generica de leitura (GET) da API Asaas v3. Nao requer edicao.
// Le Ambiente, ApiKey, DataInicial, DataFinal e UserAgent da consulta Parametros.
//   caminho        ex.: "v3/payments"
//   consulta       filtros fixos da listagem (record) ou null
//   camposPeriodo  nomes dos filtros de periodo que recebem DataInicial/DataFinal,
//                  ex.: {"dateCreated[ge]", "dateCreated[le]"} ; null = sem filtro de periodo
//   paginar        true (padrao) percorre offset/limit ate hasMore = false; false = uma chamada (ex.: saldo)
// Retorna uma lista de records. Somente leitura: nunca envia corpo de requisicao.
(caminho as text, optional consulta as nullable record, optional camposPeriodo as nullable list, optional paginar as nullable logical) as list =>
let
    Ambiente = Text.Lower(Text.Trim(Parametros[Ambiente] ?? "")),
    // URLs fixas por ambiente (necessario para o refresh no Power BI)
    BaseUrl =
        if Ambiente = "producao" then "https://api.asaas.com"
        else if Ambiente = "sandbox" then "https://api-sandbox.asaas.com"
        else error Error.Record("Configuracao invalida", "Ambiente deve ser 'sandbox' ou 'producao'", Ambiente),
    ApiKey = Text.Trim(Parametros[ApiKey] ?? ""),
    ChaveValida =
        if ApiKey = "" or Text.StartsWith(ApiKey, "<<") then
            error Error.Record("Configuracao incompleta", "Preencha ApiKey na tabela tbConfig (chave do mesmo ambiente)", null)
        else ApiKey,
    UserAgentLido = Text.Trim(Record.FieldOrDefault(Parametros, "UserAgent", "") ?? ""),
    UserAgent = if UserAgentLido = "" then "kit-catalogo-powerquery/1.0" else UserAgentLido,
    DataInicial = Text.Trim(Record.FieldOrDefault(Parametros, "DataInicial", "") ?? ""),
    DataFinal = Text.Trim(Record.FieldOrDefault(Parametros, "DataFinal", "") ?? ""),

    // filtros fixos + periodo (so inclui datas preenchidas)
    Base = if consulta = null then [] else consulta,
    Periodo =
        if camposPeriodo = null then []
        else Record.Combine({
            if DataInicial = "" then [] else Record.AddField([], camposPeriodo{0}, DataInicial),
            if DataFinal = "" then [] else Record.AddField([], camposPeriodo{1}, DataFinal)
        }),
    Filtros = Record.Combine({Base, Periodo}),
    TamanhoPagina = 100,
    Paginar = if paginar = null then true else paginar,

    Chamar = (q as record) as record =>
        let
            Resposta = Web.Contents(
                BaseUrl,
                [
                    RelativePath = caminho,
                    Query = q,
                    Headers = [access_token = ChaveValida, #"User-Agent" = UserAgent, Accept = "application/json"],
                    ManualStatusHandling = {400, 401, 403, 404, 429, 500, 502, 503}
                ]
            ),
            // Em alguns caminhos de atualização o Excel intercepta o 401 e o status volta nulo
            Status = Record.FieldOrDefault(Value.Metadata(Resposta), "Response.Status", null),
            Mensagem =
                if Status = null then "Sem status HTTP: o Excel recusou a credencial. Confira ApiKey e Ambiente na tbConfig e use acesso Anonimo para a fonte web"
                else if Status = 401 then "HTTP 401: chave invalida, expirada ou de outro ambiente (ambiente atual: " & Ambiente & ")"
                else if Status = 403 then "HTTP 403: acesso negado (whitelist de IPs ou permissao)"
                else if Status = 404 then "HTTP 404: recurso nao encontrado nesta conta"
                else if Status = 429 then "HTTP 429: limite atingido (25.000 requisicoes/12h ou 50 GETs simultaneos); tente mais tarde"
                else "HTTP " & Text.From(Status),
            Resultado =
                if Status = null or Status >= 400 then
                    error Error.Record("Erro da API Asaas", Mensagem, Text.FromBinary(Resposta))
                else
                    Json.Document(Resposta)
        in
            Resultado,

    Pagina = (offset as number) as record =>
        Chamar(Record.Combine({Filtros, [limit = Text.From(TamanhoPagina), offset = Text.From(offset)]})),

    Paginas = List.Generate(
        () => [offset = 0, pagina = Pagina(0)],
        each [pagina] <> null,
        each if Record.FieldOrDefault([pagina], "hasMore", false) = true
             then [offset = [offset] + TamanhoPagina, pagina = Pagina([offset] + TamanhoPagina)]
             else [offset = [offset], pagina = null],
        each Record.FieldOrDefault([pagina], "data", {})
    ),

    // Value.Is força a avaliação: um erro na chamada única aparece na consulta em vez de virar linha vazia
    Unica = Chamar(Filtros),
    Resultado = if Paginar then List.Combine(Paginas) else if Value.Is(Unica, type record) then {Unica} else {}
in
    Resultado
