// Parametros: le a tabela tbConfig da aba Config e devolve um record Chave -> Valor.
// E a UNICA fonte de credenciais no Excel. Nao coloque credenciais em outras consultas.
// Chaves usadas pelo kit Asaas: Ambiente, ApiKey, DataInicial, DataFinal, UserAgent (ver Config_layout.md).
let
    Fonte = Excel.CurrentWorkbook(){[Name = "tbConfig"]}[Content],
    Tipado = Table.TransformColumnTypes(Fonte, {{"Chave", type text}, {"Valor", type text}}),
    Registro = Record.FromList(Tipado[Valor], Tipado[Chave])
in
    Registro
