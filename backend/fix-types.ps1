Write-Host "Fixing TypeScript errors..." -ForegroundColor Green

# Fix 1: Add type casting for search parameters in all controllers
$searchFiles = @(
    "src/controllers/banks.ts",
    "src/controllers/customers.ts",
    "src/controllers/payments.ts",
    "src/controllers/products.ts",
    "src/controllers/suppliers.ts"
)

foreach ($file in $searchFiles) {
    if (Test-Path $file) {
        Write-Host "Processing: $file"
        $content = Get-Content $file -Raw
        
        # Replace search parameter without type casting with typed version
        $content = $content -replace 'contains: search,', 'contains: search as string,'
        
        Set-Content $file $content -NoNewline
        Write-Host "  ✓ Fixed search parameters" -ForegroundColor Green
    }
}

Write-Host "`n✅ Search parameter fixes complete!" -ForegroundColor Green
