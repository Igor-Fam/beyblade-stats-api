# ============================================================
#  restore-db.ps1 - Restaura um backup no Supabase
#  Uso: .\scripts\restore-db.ps1 -File .\backups\arquivo.dump
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$File
)

# -- Configuracao (Mesma do backup) ---------------------------
$DB_HOST     = "aws-1-sa-east-1.pooler.supabase.com"
$DB_PORT     = "5432"
$DB_USER     = "postgres.mbletyfpkszyfjxaabwz"
$DB_NAME     = "postgres"
$DB_PASSWORD = "Zk8YCHjgtXLQKkYx"
# -------------------------------------------------------------

if (-not (Test-Path $File)) {
    Write-Host "Erro: Arquivo de backup nao encontrado: $File" -ForegroundColor Red
    exit 1
}

# Localiza pg_restore
$pgRestoreCmd = Get-Command "pg_restore" -ErrorAction SilentlyContinue
if (-not $pgRestoreCmd) {
    $pgRestoreCmd = "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
}

if (-not (Test-Path $pgRestoreCmd)) {
    Write-Host "Erro: pg_restore nao encontrado em $pgRestoreCmd" -ForegroundColor Red
    exit 1
}

$env:PGPASSWORD = $DB_PASSWORD

Write-Host "!!! ATENCAO !!!" -ForegroundColor Yellow
Write-Host "Isso ira restaurar os dados no banco Supabase."
Write-Host "Arquivo: $File"
Write-Host ""
$confirm = Read-Host "Tem certeza que deseja continuar? (S/N)"

if ($confirm -ne "S" -and $confirm -ne "s") {
    Write-Host "Operacao cancelada."
    exit 0
}

Write-Host "Iniciando restauracao..." -ForegroundColor Cyan

# Executa pg_restore
# --clean: Remove objetos antes de criar (opcional)
# --no-owner: Ignora definicoes de dono originais (importante no Supabase)
& $pgRestoreCmd `
    --host=$DB_HOST `
    --port=$DB_PORT `
    --username=$DB_USER `
    --dbname=$DB_NAME `
    --verbose `
    --no-owner `
    --no-privileges `
    --clean `
    --if-exists `
    "$File"

$exitCode = $LASTEXITCODE
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
    Write-Host "Restauracao concluida com sucesso!" -ForegroundColor Green
} else {
    Write-Host "Houve alguns avisos ou erros durante a restauracao (Codigo: $exitCode)." -ForegroundColor Yellow
    Write-Host "Dica: Avisos sobre permissoes sao comuns e geralmente podem ser ignorados."
}
