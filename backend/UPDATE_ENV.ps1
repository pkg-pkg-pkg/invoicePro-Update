# Quick script to update .env with PostgreSQL password
param(
    [string]$Username = "postgres",
    [string]$Password = "postgres",
    [string]$Database = "gst_billing"
)

$envFile = ".env"

if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    $content = $content -replace "postgresql://postgres:YOUR_PASSWORD@localhost:5432/gst_billing", "postgresql://$Username`:$Password@localhost:5432/$Database"
    $content = $content -replace "postgresql://postgres:postgres@localhost:5432/gst_billing", "postgresql://$Username`:$Password@localhost:5432/$Database"
    Set-Content -Path $envFile -Value $content -NoNewline
    Write-Host "✅ Updated .env file with:" -ForegroundColor Green
    Write-Host "   Username: $Username" -ForegroundColor Cyan
    Write-Host "   Database: $Database" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  Make sure PostgreSQL password is correct!" -ForegroundColor Yellow
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
}

