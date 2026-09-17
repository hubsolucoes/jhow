// fnApi: funcao generica de LEITURA (GET) na API Focus NFe.
//   caminho   : rota sem barra inicial, ex. "v2/nfes_recebidas"
//   consulta  : record com a query string, ex. [cnpj = "..."]
//   paginacao : null (uma chamada), "offset" (tabelas e empresas, 50 por pagina)
//               ou "versao" (documentos recebidos; o proximo ponto e o maior campo "versao" da pagina,
//               porque o Power Query do Excel nao expoe o cabecalho X-Max-Version)
// Autenticacao: HTTP Basic com o token como usuario e senha vazia.
(caminho as text, optional consulta as nullable record, optional paginacao as nullable text) as any =>
let
    Ambiente = Parametros[Ambiente],
    BaseUrl =
        if Ambiente = "producao" then "https://api.focusnfe.com.br"
        else if Ambiente = "sandbox" then "https://homologacao.focusnfe.com.br"
        else error Error.Record("Configuracao invalida", "Ambiente deve ser 'sandbox' ou 'producao'", Ambiente),
    Token = Parametros[Token],
    Autorizacao = "Basic " & Binary.ToText(Text.ToBinary(Token & ":"), BinaryEncoding.Base64),
    Base = if consulta = null then [] else consulta,

    Chamar = (q as record) as record =>
        let
            Resposta = Web.Contents(
                BaseUrl,
                [
                    RelativePath = caminho,
                    Query = q,
                    Headers = [Authorization = Autorizacao, Accept = "application/json"],
                    // 401 e 403 nao podem ser tratados manualmente no Power Query: viram erro de credencial (tratado abaixo)
                    ManualStatusHandling = {400, 404, 415, 422, 429, 500, 502, 503}
                ]
            ),
            Conteudo = try Binary.Buffer(Resposta),
            Metadados = if Conteudo[HasError] then [] else Value.Metadata(Resposta),
            Status = Record.FieldOrDefault(Metadados, "Response.Status", 200),
            Mensagem =
                if Conteudo[HasError] then
                    "Acesso negado (HTTP 401/403). Confira se o Token e do mesmo Ambiente da aba Config e se o CNPJ esta habilitado nesse token. "
                    & "Evite atualizar varias vezes com token errado: a Focus NFe bloqueia o IP por alguns segundos. Detalhe: " & Conteudo[Error][Message]
                else if Status = 429 then
                    "HTTP 429: limite de 100 requisicoes por minuto ou de tentativas de autenticacao. Aguarde um minuto e atualize de novo. Detalhe: "
                    & Text.FromBinary(Conteudo[Value])
                else
                    "HTTP " & Text.From(Status) & ": " & Text.FromBinary(Conteudo[Value]),
            Dados =
                if Conteudo[HasError] or Status >= 400 then error Error.Record("Erro da API Focus NFe", Mensagem, caminho)
                else Json.Document(Conteudo[Value]),
            Versoes = if Dados is list then List.RemoveNulls(List.Transform(Dados, each try Number.From(Record.FieldOrDefault(_, "versao", null)) otherwise null)) else {},
            MaxVersao = if List.IsEmpty(Versoes) then null else List.Max(Versoes)
        in
            [dados = Dados, maxv = MaxVersao],

    ComoLista = (x as any) as list => if x is list then x else {x},

    PorOffset =
        List.Combine(
            List.Generate(
                () => [offset = 0, pagina = ComoLista(Chamar(Base & [offset = "0"])[dados])],
                each List.Count([pagina]) > 0,
                each [
                    offset = [offset] + List.Count([pagina]),
                    pagina = ComoLista(Chamar(Base & [offset = Text.From([offset] + List.Count([pagina]))])[dados])
                ],
                each [pagina]
            )
        ),

    VersaoInicial = try Number.From(Record.FieldOrDefault(Base, "versao", "0")) otherwise 0,
    PorVersao =
        List.Combine(
            List.Generate(
                () => [versao = VersaoInicial, r = Chamar(Base & [versao = Text.From(VersaoInicial)])],
                each List.Count(ComoLista([r][dados])) > 0,
                each
                    if [r][maxv] = null or [r][maxv] <= [versao] then [versao = [versao], r = [dados = {}, maxv = null]]
                    else [versao = [r][maxv], r = Chamar(Base & [versao = Text.From([r][maxv])])],
                each ComoLista([r][dados])
            )
        ),

    Resultado =
        if paginacao = "offset" then PorOffset
        else if paginacao = "versao" then PorVersao
        else Chamar(Base)[dados]
in
    Resultado
