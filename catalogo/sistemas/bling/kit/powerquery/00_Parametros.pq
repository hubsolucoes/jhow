// Parametros: le a tabela tbConfig da aba Config e devolve um record Chave -> Valor.
// E a UNICA fonte de credenciais no Excel. Nao coloque credenciais em outras consultas.
// Chaves usadas: Ambiente, AccessToken, DataInicial, DataFinal (ver Config_layout.md).
// O AccessToken do Bling expira: o script kit/python/cliente.py (comando "renovar --excel")
// grava um token novo nesta tabela. O Power Query nao renova token sozinho.
let
    Fonte = Excel.CurrentWorkbook(){[Name = "tbConfig"]}[Content],
    Tipado = Table.TransformColumnTypes(Fonte, {{"Chave", type text}, {"Valor", type text}}),
    Registro = Record.FromList(Tipado[Valor], Tipado[Chave])
in
    Registro
