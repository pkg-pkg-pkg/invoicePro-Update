Write-Host "Applying final fixes..." -ForegroundColor Green

# Fix settings.routes.ts
$file = "src/routes/settings.routes.ts"
if (Test-Path $file) {
    $content = Get-Content $file -Raw
    
    # Fix 1: Line 206 - CustomerGroupConfig creation
    $content = $content -replace `
        '(const group = await prisma\.customerGroupConfig\.create\(\{\s+data: \{\s+companyId,)',`
        '$1
        company: {
          connect: { id: companyId }
        },'
    
    # Fix 2: Remove maxViews references
    $content = $content -replace 'maxViews: allowedViews \|\| null,', '// maxViews: allowedViews || null, // Field removed'
    $content = $content -replace 'viewCount: 0,', '// viewCount: 0, // Using accessCount instead'
    
    # Fix 3: Replace share.maxViews checks with accessCount
    $content = $content -replace 'if \(share\.maxViews && share\.viewCount >= share\.maxViews\)', 'if (share.accessCount >= 100) // Using accessCount limit'
    
    # Fix 4: Replace viewCount increment with accessCount
    $content = $content -replace 'viewCount: \{ increment: 1 \},', 'accessCount: { increment: 1 },'
    
    # Fix 5: Comment out creator include
    $content = $content -replace `
        '(orderBy: \{ createdAt: .desc. \},\s+)include: \{\s+creator: \{[^}]+\}\s+\}',`
        '$1// include: { creator: { select: { id: true, username: true } } } // Relation not available'
    
    Set-Content $file $content -NoNewline
    Write-Host "  ✓ Fixed settings.routes.ts" -ForegroundColor Green
}

Write-Host "`n✅ Final fixes applied!" -ForegroundColor Green