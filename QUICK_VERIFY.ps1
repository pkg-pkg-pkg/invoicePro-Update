# GST Billing Software - Quick Verification Script
# Run this script to check if everything is set up correctly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GST Billing Software - Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Node.js not found. Please install Node.js v18+" -ForegroundColor Red
    $allGood = $false
}

# Check PostgreSQL
Write-Host "Checking PostgreSQL..." -ForegroundColor Yellow
try {
    $pgVersion = psql --version 2>$null
    if ($pgVersion) {
        Write-Host "  ✅ PostgreSQL installed" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  PostgreSQL not found in PATH (may still be installed)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  PostgreSQL check skipped (may still be installed)" -ForegroundColor Yellow
}

# Check Backend .env
Write-Host "Checking Backend Configuration..." -ForegroundColor Yellow
if (Test-Path "backend\.env") {
    Write-Host "  ✅ Backend .env file exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ Backend .env file missing" -ForegroundColor Red
    Write-Host "     Creating .env.example... Run: Copy-Item backend\.env.example backend\.env" -ForegroundColor Yellow
    $allGood = $false
}

# Check Backend Dependencies
Write-Host "Checking Backend Dependencies..." -ForegroundColor Yellow
if (Test-Path "backend\node_modules") {
    Write-Host "  ✅ Backend dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Backend dependencies missing" -ForegroundColor Red
    Write-Host "     Run: cd backend && npm install" -ForegroundColor Yellow
    $allGood = $false
}

# Check Desktop Dependencies
Write-Host "Checking Desktop Dependencies..." -ForegroundColor Yellow
if (Test-Path "desktop\node_modules") {
    Write-Host "  ✅ Desktop dependencies installed" -ForegroundColor Green
} else {
    Write-Host "  ❌ Desktop dependencies missing" -ForegroundColor Red
    Write-Host "     Run: cd desktop && npm install" -ForegroundColor Yellow
    $allGood = $false
}

# Check Prisma Client
Write-Host "Checking Prisma Client..." -ForegroundColor Yellow
if (Test-Path "backend\node_modules\.prisma\client") {
    Write-Host "  ✅ Prisma client generated" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Prisma client not generated" -ForegroundColor Yellow
    Write-Host "     Run: cd backend && npm run generate" -ForegroundColor Yellow
}

# Check Controllers
Write-Host "Checking Implementation..." -ForegroundColor Yellow
$controllerCount = (Get-ChildItem "backend\src\controllers" -Filter "*.ts" | Measure-Object).Count
Write-Host "  ✅ Found $controllerCount controllers" -ForegroundColor Green

$pageCount = (Get-ChildItem "desktop\src\pages" -Recurse -Filter "*.tsx" | Measure-Object).Count
Write-Host "  ✅ Found $pageCount desktop pages" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ All critical checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Setup database: Create 'gst_billing' database in PostgreSQL" -ForegroundColor White
    Write-Host "2. Configure .env: Copy backend\.env.example to backend\.env and update DATABASE_URL" -ForegroundColor White
    Write-Host "3. Generate Prisma: cd backend && npm run generate" -ForegroundColor White
    Write-Host "4. Run migrations: cd backend && npm run migrate" -ForegroundColor White
    Write-Host "5. Start backend: cd backend && npm run dev" -ForegroundColor White
    Write-Host "6. Start desktop: cd desktop && npm run electron:dev" -ForegroundColor White
} else {
    Write-Host "⚠️  Some checks failed. Please fix the issues above." -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan

