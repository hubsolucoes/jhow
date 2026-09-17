// Parametros (versao Power BI): use esta consulta no lugar de "Parametros".
// Melhor ainda: crie parametros do Power BI (Pagina Inicial > Gerenciar Parametros) chamados
// Ambiente, Token, Cnpj, UF e Refs e troque cada valor abaixo pelo nome do parametro correspondente.
let
    Registro = [
        Ambiente = "sandbox",              // sandbox (homologacao) ou producao
        Token = "<<SEU_TOKEN_FOCUS_NFE>>", // token da empresa no painel Focus NFe (do mesmo ambiente)
        Cnpj = "<<CNPJ_DA_EMPRESA>>",      // 14 digitos, sem pontuacao
        UF = "SP",                         // filtro da consulta MunicipiosNfse
        Refs = ""                          // referencias de NF-e emitidas, separadas por virgula
    ]
in
    Registro
