// Parametros: le a tabela tbConfig da aba Config e devolve um record Chave -> Valor.
// E a UNICA fonte de credenciais no Excel. Nao coloque credenciais em outras consultas.
let
    Fonte = Excel.CurrentWorkbook(){[Name = "tbConfig"]}[Content],
    Tipado = Table.TransformColumnTypes(Fonte, {{"Chave", type text}, {"Valor", type text}}),
    Registro = Record.FromList(Tipado[Valor], Tipado[Chave])
in
    Registro
