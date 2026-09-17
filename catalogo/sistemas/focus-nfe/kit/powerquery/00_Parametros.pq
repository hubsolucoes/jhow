// Parametros: le a tabela tbConfig da aba Config e devolve um record Chave -> Valor.
// E a UNICA fonte de credenciais e configuracoes no Excel. Nao coloque o token em outras consultas.
let
    Fonte = Excel.CurrentWorkbook(){[Name = "tbConfig"]}[Content],
    Tipado = Table.TransformColumnTypes(Fonte, {{"Chave", type text}, {"Valor", type text}}),
    SemNulos = Table.ReplaceValue(Tipado, null, "", Replacer.ReplaceValue, {"Valor"}),
    Registro = Record.FromList(List.Transform(SemNulos[Valor], Text.Trim), SemNulos[Chave])
in
    Registro
