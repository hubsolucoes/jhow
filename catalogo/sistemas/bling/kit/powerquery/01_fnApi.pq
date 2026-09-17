// fnApi: leitura (GET) na API v3 do Bling.
// Uso:
//   fnApi("pedidos/vendas", [dataInicial = "2026-01-01"], true)   -> lista com todos os registros (campo data), paginando
//   fnApi("estoques/saldos", [#"idsProdutos[]" = {"1", "2"}])     -> corpo JSON completo (sem paginar)
// Autenticacao: Bearer com Parametros[AccessToken] + header enable-jwt: 1.
// Este arquivo NAO chama /oauth/token: renovar token dentro do Power Query invalidaria o refresh_token
// guardado fora dele e pode bloquear o IP (20 chamadas em 60 s). Use kit/python/cliente.py.
// Paginacao do Bling: parametros pagina/limite (padrao 100), sem total na resposta;
// para quando a pagina vem com menos de 100 itens. Espera 0,4 s entre paginas (limite: 3 req/s).
(caminho as text, optional consulta as nullable record, optional paginar as nullable logical) as any =>
let
    Ambiente = Parametros[Ambiente],
    // O Bling nao tem sandbox: "sandbox" significa usar o token de uma conta Bling de teste.
    BaseUrl =
        if Ambiente = "producao" then "https://api.bling.com.br"
        else if Ambiente = "sandbox" then "https://api.bling.com.br"
        else error Error.Record("Configuracao invalida", "Ambiente deve ser 'sandbox' ou 'producao'", Ambiente),
    Token = Parametros[AccessToken],
    // remove filtros vazios (celula em branco na tbConfig)
    Filtros =
        if consulta = null then []
        else Record.FromTable(Table.SelectRows(Record.ToTable(consulta), each [Value] <> null and [Value] <> "")),
    Limite = 100,
    Chamar = (q as record) as any =>
        let
            Resposta = Web.Contents(
                BaseUrl,
                [
                    RelativePath = "Api/v3/" & caminho,
                    Query = q,
                    Headers = [Authorization = "Bearer " & Token, Accept = "application/json", #"enable-jwt" = "1"],
                    ManualStatusHandling = {400, 401, 403, 404, 429, 500, 502, 503}
                ]
            ),
            // Com token invalido/expirado (HTTP 401/403) o Excel nao entrega o status: vem null.
            Status = Record.FieldOrDefault(Value.Metadata(Resposta), "Response.Status", null),
            Corpo = if Status = null then null else try Json.Document(Resposta) otherwise null,
            Tipo = try Corpo[error][type] otherwise "",
            Detalhe = try Corpo[error][description] otherwise "",
            Dica =
                if Status = 401 then " - token expirado ou invalido: rode 'python cliente.py renovar --excel' e atualize de novo"
                else if Status = 403 then " - o aplicativo nao tem o escopo deste modulo (ou o usuario nao tem permissao)"
                else if Status = 429 then " - limite do Bling (3 req/s ou 120 mil/dia): aguarde e atualize de novo"
                else if Status = 400 then " - confira os filtros (periodo maximo de 1 ano, datas AAAA-MM-DD)"
                else "",
            Resultado =
                if Status = null then
                    error Error.Record(
                        "Erro da API Bling",
                        "Credencial recusada (HTTP 401/403): o AccessToken da aba Config expirou, foi revogado ou nao tem o escopo deste modulo. Rode 'python cliente.py renovar --excel' com a planilha fechada e atualize de novo.",
                        caminho
                    )
                else if Status >= 400 then
                    error Error.Record("Erro da API Bling", "HTTP " & Text.From(Status) & " " & Tipo & Dica, Detalhe)
                else
                    Corpo
        in
            Resultado,
    Pagina = (n as number) as list =>
        Chamar(Record.Combine({Filtros, [pagina = Text.From(n), limite = Text.From(Limite)]}))[data],
    Paginado = List.Combine(
        List.Generate(
            () => [n = 1, d = Pagina(1)],
            each [d] <> null,
            each
                if List.Count([d]) < Limite then [n = [n], d = null]
                else [n = [n] + 1, d = Function.InvokeAfter(() => Pagina([n] + 1), #duration(0, 0, 0, 0.4))],
            each [d]
        )
    ),
    Saida = if paginar = true then Paginado else Chamar(Filtros)
in
    Saida
