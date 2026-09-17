// Parametros (POWER BI): devolve o mesmo record da versao Excel, com valores de parametros do Power BI.
// Use este arquivo NO LUGAR de 00_Parametros.pq no Power BI; o nome da consulta continua "Parametros".
// Antes, crie em Transformar dados > Gerenciar Parametros (tipo Texto):
//   AsaasApiKey       = <<SUA_API_KEY>>   (sandbox: $aact_hmlg_... | producao: $aact_prod_...)
//   AsaasAmbiente     = sandbox           (ou producao)
//   AsaasDataInicial  = 2026-01-01        (AAAA-MM-DD; vazio = sem filtro)
//   AsaasDataFinal    =                   (AAAA-MM-DD; vazio = sem filtro)
// Depois de publicar, altere os valores em Configuracoes do modelo semantico > Parametros.
let
    Registro = [
        Ambiente = AsaasAmbiente,
        ApiKey = AsaasApiKey,
        DataInicial = AsaasDataInicial,
        DataFinal = AsaasDataFinal,
        UserAgent = "kit-catalogo-powerbi/1.0"
    ]
in
    Registro
