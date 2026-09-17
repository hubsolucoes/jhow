<#
Simula o uso de uma planilha gerada: abre o arquivo, preenche valores na tbConfig,
executa "Atualizar Tudo" e informa quantas linhas cada tabela recebeu. NAO salva o arquivo.

Uso:
  powershell -ExecutionPolicy Bypass -File scripts\testar_planilha.ps1 -Arquivo saida\X.xlsx -Valores 'ApiKey=abc;Ambiente=sandbox'
#>
param(
    [Parameter(Mandatory = $true)][string]$Arquivo,
    [string]$Valores = ''
)
$ErrorActionPreference = 'Stop'
$caminho = (Resolve-Path $Arquivo).Path
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
    $wb = $xl.Workbooks.Open($caminho)
    Write-Output ("FastCombine salvo no arquivo: {0}" -f $wb.Queries.FastCombine)
    $tb = $wb.Worksheets.Item('Config').ListObjects.Item('tbConfig')
    $antes = @()
    foreach ($row in $tb.ListRows) { $antes += ('{0}={1}' -f $row.Range.Cells.Item(1, 1).Text, $row.Range.Cells.Item(1, 2).Text) }
    Write-Output ("Config original: {0}" -f ($antes -join '; '))
    foreach ($par in ($Valores -split ';')) {
        if ($par -notmatch '^\s*([^=]+?)\s*=(.*)$') { continue }
        foreach ($row in $tb.ListRows) {
            if ($row.Range.Cells.Item(1, 1).Text -eq $Matches[1]) { $row.Range.Cells.Item(1, 2).Value2 = $Matches[2] }
        }
    }
    $wb.RefreshAll()
    $xl.CalculateUntilAsyncQueriesDone()
    foreach ($ws in $wb.Worksheets) {
        foreach ($lo in $ws.ListObjects) {
            if ($lo.Name -ne 'tbConfig') { Write-Output ("{0}: {1} linhas" -f $lo.Name, $lo.ListRows.Count) }
        }
    }
    $wb.Close($false)
}
finally {
    $xl.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
