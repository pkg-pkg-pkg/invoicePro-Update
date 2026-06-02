# Deploy Firestore rules to invoicepro-105ba
# Requires: firebase login with an account that OWNS or has Editor on invoicepro-105ba

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Firebase account:" -ForegroundColor Cyan
firebase login:list

Write-Host "`nTarget project (from .firebaserc):" -ForegroundColor Cyan
Get-Content .firebaserc

Write-Host "`nDeploying firestore.rules ..." -ForegroundColor Yellow
firebase deploy --only firestore:rules --project invoicepro-105ba

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nDone. Refresh Admin: http://127.0.0.1:5180/login" -ForegroundColor Green
} else {
  Write-Host @"

Deploy failed. Common fixes:
  1. firebase logout
  2. firebase login
     (use the Google account that owns invoicepro-105ba in Firebase Console)
  3. Run this script again

Or paste firestore.rules manually:
  https://console.firebase.google.com/project/invoicepro-105ba/firestore/rules
"@ -ForegroundColor Red
  exit $LASTEXITCODE
}
