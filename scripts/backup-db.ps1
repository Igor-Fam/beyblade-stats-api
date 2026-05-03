# ============================================================
#  backup-db.ps1 - Backup automatico do banco Supabase
#  Uso: .\scripts\backup-db.ps1
#       .\scripts\backup-db.ps1 -MaxBackups 10
# ============================================================

param(
    [int]$MaxBackups = 7   # Quantos backups manter (apaga os mais antigos)
)

# -- Configuracao ---------------------------------------------
$DB_HOST     = "aws-1-sa-east-1.pooler.supabase.com"
$DB_PORT     = "5432"
$DB_USER     = "postgres.mbletyfpkszyfjxaabwz"
$DB_NAME     = "postgres"
$DB_PASSWORD = "Zk8YCHjgtXLQKkYx"

$BACKUP_DIR  = Join-Path $PSScriptRoot "..\backups"
# -------------------------------------------------------------

# Cria pasta de backups se nao existir
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    Write-Host "Pasta de backups criada em: $BACKUP_DIR" -ForegroundColor Cyan
}

# Timestamp para o nome do arquivo
$timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupFile = Join-Path $BACKUP_DIR "beyblade_$timestamp.dump"

# Verifica se pg_dump esta disponivel no PATH ou tenta localizar
$pgDumpCmd = Get-Command "pg_dump" -ErrorAction SilentlyContinue

if (-not $pgDumpCmd) {
    # Lista de caminhos comuns de instalacao do PostgreSQL no Windows
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $pgDumpCmd = $path
            break
        }
    }
}

if (-not $pgDumpCmd) {
    Write-Host ""
    Write-Host "Error: pg_dump nao encontrado!" -ForegroundColor Red
    Write-Host "Tente rodar este comando no PowerShell para corrigir o PATH nesta sessao:" -ForegroundColor Yellow
    Write-Host '$env:Path += ";C:\Program Files\PostgreSQL\17\bin"' -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Se voce instalou em outro local, verifique a pasta \bin do PostgreSQL." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Exporta senha via variavel de ambiente (evita prompt interativo)
$env:PGPASSWORD = $DB_PASSWORD

Write-Host ""
Write-Host "Iniciando backup..." -ForegroundColor Cyan
Write-Host "   Host    : $DB_HOST" -ForegroundColor Gray
Write-Host "   Database: $DB_NAME" -ForegroundColor Gray
Write-Host "   Arquivo : $backupFile" -ForegroundColor Gray
Write-Host ""

# Executa pg_dump (usa o caminho completo se encontrado manualmente)
& $pgDumpCmd `
    --host=$DB_HOST `
    --port=$DB_PORT `
    --username=$DB_USER `
    --dbname=$DB_NAME `
    --format=custom `
    --no-password `
    --file="$backupFile"

$exitCode = $LASTEXITCODE

# Limpa a senha do ambiente
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
    $sizeMB = [math]::Round((Get-Item $backupFile).Length / 1MB, 2)
    Write-Host "Backup concluido com sucesso!" -ForegroundColor Green
    Write-Host "   Arquivo : $(Split-Path $backupFile -Leaf)" -ForegroundColor Gray
    Write-Host "   Tamanho : $sizeMB MB" -ForegroundColor Gray
    Write-Host "   Data    : $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor Gray
} else {
    Write-Host "Erro ao realizar o backup (codigo: $exitCode)" -ForegroundColor Red
    # Remove arquivo incompleto, se existir
    if (Test-Path $backupFile) { Remove-Item $backupFile }
    exit 1
}

# -- Rotacao: apaga backups antigos ---------------------------
$allBackups = Get-ChildItem -Path $BACKUP_DIR -Filter "beyblade_*.dump" |
              Sort-Object LastWriteTime -Descending

if ($allBackups.Count -gt $MaxBackups) {
    $toDelete = $allBackups | Select-Object -Skip $MaxBackups
    foreach ($old in $toDelete) {
        Remove-Item $old.FullName
        Write-Host "Backup antigo removido: $($old.Name)" -ForegroundColor DarkGray
    }
}

Write-Host ""
$finalCount = [Math]::Min($allBackups.Count, $MaxBackups)
Write-Host "Total de backups armazenados: $finalCount" -ForegroundColor Cyan
Write-Host ""
