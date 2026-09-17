<#
Gera uma planilha Excel (.xlsx) com as consultas Power Query de um kit.

Uso:
  powershell -ExecutionPolicy Bypass -File scripts\gerar_planilha.ps1 -Kit sistemas\asaas\kit -Saida saida\Asaas.xlsx
  (opcional) -RespeitarPrivacidade  NAO grava a opcao 'ignorar niveis de privacidade' (FastCombine).
             Padrao: grava, porque a consulta precisa combinar a aba Config com a API (Formula.Firewall).
             Testado em 2026-09-17: sem FastCombine o Excel exige que o usuario configure privacidade.
  (opcional) -Atualizar           executa o refresh depois de montar (teste)
  (opcional) -ValoresTeste 'ApiKey=x;Outra=y'  substitui valores da tbConfig so para o teste com -Atualizar

A planilha contem:
  - aba "LEIA-ME" com instrucoes
  - aba "Config" com a tabela tbConfig (Chave | Valor | Descricao) - unico lugar a preencher
  - uma aba por consulta de entidade (10_*.pq ...), carregada como tabela
  - consultas Parametros e fnApi como "somente conexao"

Requer Excel para Windows (2016+). Arquivos .pq e .json sao lidos como UTF-8.
#>
param(
    [Parameter(Mandatory = $true)][string]$Kit,
    [Parameter(Mandatory = $true)][string]$Saida,
    [switch]$Atualizar,
    [switch]$RespeitarPrivacidade,
    [string]$ValoresTeste = ''
)

$ErrorActionPreference = 'Stop'
$teste = @{}
foreach ($par in ($ValoresTeste -split ';')) {
    if ($par -match '^\s*([^=]+?)\s*=(.*)$') { $teste[$Matches[1]] = $Matches[2] }
}
$pqDir = Join-Path (Resolve-Path $Kit) 'powerquery'
$cfg = Get-Content -Raw -Encoding UTF8 (Join-Path $pqDir 'tbConfig.json') | ConvertFrom-Json
$instrucoes = Get-Content -Encoding UTF8 (Join-Path $PSScriptRoot 'planilha_instrucoes.txt')
$saidaAbs = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $Saida))
New-Item -ItemType Directory -Force -Path (Split-Path $saidaAbs) | Out-Null

function Get-NomeConsulta([string]$arquivo) {
    return ([System.IO.Path]::GetFileNameWithoutExtension($arquivo) -replace '^\d+_', '')
}

$arquivos = Get-ChildItem $pqDir -Filter '*.pq' | Where-Object { $_.Name -notlike '*_PowerBI.pq' } | Sort-Object Name
$entidades = $arquivos | Where-Object { $_.Name -match '^[1-9]\d_' }

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    $wb = $xl.Workbooks.Add()
    while ($wb.Worksheets.Count -gt 1) { $wb.Worksheets.Item($wb.Worksheets.Count).Delete() }

    # --- LEIA-ME ---
    $leia = $wb.Worksheets.Item(1)
    $leia.Name = 'LEIA-ME'
    $linha = 1
    foreach ($t in $instrucoes) {
        $leia.Cells.Item($linha, 1).Value2 = ($t -replace '\{SISTEMA\}', $cfg.sistema)
        $linha++
    }
    $leia.Range('A1').Font.Bold = $true
    $leia.Range('A1').Font.Size = 14
    $leia.Columns.Item(1).ColumnWidth = 110

    # --- Config ---
    $ws = $wb.Worksheets.Add([Type]::Missing, $leia)
    $ws.Name = 'Config'
    $ws.Cells.Item(1, 1).Value2 = 'Chave'
    $ws.Cells.Item(1, 2).Value2 = 'Valor'
    $ws.Cells.Item(1, 3).Value2 = 'Descricao'
    $r = 2
    foreach ($l in $cfg.linhas) {
        $valor = $l.Valor
        if ($Atualizar -and $teste.ContainsKey($l.Chave)) { $valor = $teste[$l.Chave] }
        $ws.Cells.Item($r, 1).Value2 = $l.Chave
        $ws.Cells.Item($r, 2).NumberFormat = '@'
        $ws.Cells.Item($r, 2).Value2 = [string]$valor
        $ws.Cells.Item($r, 3).Value2 = $l.Descricao
        $r++
    }
    $tb = $ws.ListObjects.Add(1, $ws.Range("A1:C$($r - 1)"), $null, 1)
    $tb.Name = 'tbConfig'
    $ws.Columns.Item(1).ColumnWidth = 22
    $ws.Columns.Item(2).ColumnWidth = 45
    $ws.Columns.Item(3).ColumnWidth = 70

    # --- Consultas ---
    if (-not $RespeitarPrivacidade) { $wb.Queries.FastCombine = $true }
    foreach ($a in $arquivos) {
        $formula = Get-Content -Raw -Encoding UTF8 $a.FullName
        $null = $wb.Queries.Add((Get-NomeConsulta $a.Name), $formula)
    }

    # --- Uma aba por entidade, carregada como tabela ---
    $anterior = $ws
    foreach ($a in $entidades) {
        $nome = Get-NomeConsulta $a.Name
        $sh = $wb.Worksheets.Add([Type]::Missing, $anterior)
        $sh.Name = $nome.Substring(0, [Math]::Min(31, $nome.Length))
        $conexao = "OLEDB;Provider=Microsoft.Mashup.OleDb.1;Data Source=`$Workbook`$;Location=$nome;Extended Properties=`"`""
        $lo = $sh.ListObjects.Add(0, $conexao, $true, 1, $sh.Range('A1'))
        $lo.Name = "tb$nome"
        $qt = $lo.QueryTable
        $qt.CommandType = 2
        $qt.CommandText = "SELECT * FROM [$nome]"
        $qt.BackgroundQuery = $false
        $qt.RefreshOnFileOpen = $false
        if ($Atualizar) {
            try {
                $null = $qt.Refresh($false)
                Write-Output ("REFRESH OK  {0}: {1} linhas" -f $nome, $lo.ListRows.Count)
            } catch {
                Write-Output ("REFRESH ERRO {0}: {1}" -f $nome, $_.Exception.Message)
            }
        }
        $anterior = $sh
    }

    $leia.Activate()
    if (Test-Path $saidaAbs) { Remove-Item $saidaAbs -Force }
    $wb.SaveAs($saidaAbs, 51)
    Write-Output "PLANILHA: $saidaAbs"
    $wb.Close($false)
}
finally {
    $xl.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
