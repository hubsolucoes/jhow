// Parametros (versao Power BI): mesmo record da versao Excel, sem tabela tbConfig.
// No Power BI Desktop: crie esta consulta com o nome "Parametros" e, de preferencia,
// troque os textos abaixo por parametros do Power BI (Pagina Inicial > Gerenciar parametros),
// por exemplo: AccessToken = pAccessToken.
// Ambiente: "sandbox" = conta Bling de TESTE (o Bling nao tem sandbox separado; mesma URL),
//           "producao" = conta real da empresa.
// O AccessToken expira (exemplo oficial: 6 horas). Para atualizacao agendada no servico do
// Power BI, leia o README (secao Power BI): o caminho viavel e um script agendado.
let
    Registro = [
        Ambiente = "sandbox",
        AccessToken = "<<SEU_ACCESS_TOKEN>>",
        DataInicial = "2026-01-01",
        DataFinal = "2026-12-31"
    ]
in
    Registro
