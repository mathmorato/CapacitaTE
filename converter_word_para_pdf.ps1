# ==============================================================================
# AutoReport CECATE - Conversor Automático de Relatório Word (.docx) para PDF
# Utiliza o motor oficial do Microsoft Word para gerar PDF 100% idêntico
# ==============================================================================

param(
    [string[]]$FilePath
)

$ErrorActionPreference = "Stop"

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
} catch {
    Write-Host "Erro: O Microsoft Word não está disponível nesta máquina." -ForegroundColor Red
    exit 1
}

try {
    $filesToConvert = @()
    if ($FilePath -and $FilePath.Count -gt 0) {
        foreach ($p in $FilePath) {
            if (Test-Path $p) {
                $filesToConvert += (Get-Item $p)
            }
        }
    }
    
    if ($filesToConvert.Count -eq 0) {
        # 1. Verificar pasta output do projeto
        $outputDir = Join-Path $PSScriptRoot "output"
        if (Test-Path $outputDir) {
            $filesToConvert += (Get-ChildItem -Path "$outputDir\*.docx" | Where-Object { $_.Name -notlike "~$*" })
        }

        # 2. Verificar pasta Downloads recente do usuário para relatórios CTE / Relatório
        $downloadsDir = [System.IO.Path]::Combine($env:USERPROFILE, "Downloads")
        if (Test-Path $downloadsDir) {
            $recentDownloads = Get-ChildItem -Path "$downloadsDir\*.docx" -ErrorAction SilentlyContinue | 
                               Where-Object { ($_.Name -like "*CTE*" -or $_.Name -like "*Relat*") -and $_.LastWriteTime -gt (Get-Date).AddHours(-24) -and $_.Name -notlike "~$*" }
            $filesToConvert += $recentDownloads
        }
    }

    if ($filesToConvert.Count -eq 0) {
        Write-Host "Nenhum arquivo de relatório Word (.docx) encontrado para converter." -ForegroundColor Yellow
        Write-Host "Dica: Baixe o arquivo Word pelo AutoReport CECATE ou coloque-o na pasta 'output/' e execute novamente." -ForegroundColor Gray
        exit 0
    }

    # Remover duplicatas pelo caminho completo
    $filesToConvert = $filesToConvert | Sort-Object -Property FullName -Unique

    Write-Host "Encontrados $($filesToConvert.Count) relatório(s) para converter em PDF:" -ForegroundColor Cyan
    foreach ($file in $filesToConvert) {
        $pdfPath = [System.IO.Path]::ChangeExtension($file.FullName, ".pdf")
        Write-Host "  -> Convertendo $($file.Name) para PDF oficial..." -NoNewline
        
        $doc = $word.Documents.Open($file.FullName, $false, $true)
        # Atualizar automaticamente todos os sumários e campos com base nos títulos
        try {
            if ($doc.TablesOfContents.Count -gt 0) {
                for ($i = 1; $i -le $doc.TablesOfContents.Count; $i++) {
                    $doc.TablesOfContents.Item($i).Update()
                }
            }
            $doc.Fields.Update()
        } catch {
            # Se algum campo protegido falhar, prossegue com a exportação
        }
        # 17 = wdFormatPDF (Salvar nativamente em PDF no Word)
        $doc.SaveAs([ref]$pdfPath, [ref]17)
        $doc.Close([ref]0) # wdDoNotSaveChanges
        
        $pdfSize = (Get-Item $pdfPath).Length
        $pdfSizeMb = [Math]::Round($pdfSize / 1MB, 2)
        Write-Host " [OK] ($pdfSizeMb MB)" -ForegroundColor Green
    }

    Write-Host "`nTodos os arquivos foram transformados em PDF com sucesso!" -ForegroundColor Green
} catch {
    Write-Host "`nErro durante a conversão: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($word) {
        $word.Quit([ref]0)
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
}
