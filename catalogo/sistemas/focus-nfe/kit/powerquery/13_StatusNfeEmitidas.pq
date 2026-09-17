// StatusNfeEmitidas: situacao das NF-e emitidas cujas referencias (ref) estao na chave Refs da aba Config,
// separadas por virgula. Somente leitura: GET /v2/nfe/{ref}. Cada ref gasta 1 das 100 requisicoes por minuto.
let
    Texto = Record.FieldOrDefault(Parametros, "Refs", ""),
    Refs = List.Select(List.Transform(Text.Split(if Texto = null then "" else Texto, ","), Text.Trim), each _ <> ""),
    Consultar = (ref as text) as record =>
        let
            Tentativa = try fnApi("v2/nfe/" & ref)
        in
            if Tentativa[HasError] then [ref = ref, status = "erro_consulta", mensagem_sefaz = Tentativa[Error][Message]]
            else Tentativa[Value],
    Colunas = {"ref", "status", "status_sefaz", "mensagem_sefaz", "chave_nfe", "numero", "serie",
               "cnpj_emitente", "caminho_xml_nota_fiscal", "caminho_danfe"},
    Tabela = Table.FromRecords(List.Transform(Refs, Consultar), Colunas, MissingField.UseNull),
    Tipos = Table.TransformColumnTypes(Tabela, List.Transform(Colunas, each {_, type text}))
in
    Tipos
