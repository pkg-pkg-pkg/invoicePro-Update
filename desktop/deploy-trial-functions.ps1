# Deploy trial Cloud Functions to invoicepro-105ba
# Console: https://console.firebase.google.com/project/invoicepro-105ba/overview

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Firebase account:" -ForegroundColor Cyan
firebase login:list

Write-Host "`nTarget project: invoicepro-105ba" -ForegroundColor Cyan
Get-Content .firebaserc

Write-Host "`nBuilding functions..." -ForegroundColor Yellow
npm --prefix functions run build

Write-Host "`nDeploying trial functions..." -ForegroundColor Yellow
firebase deploy --only functions:createTrial,functions:validateTrial,functions:extendTrial,functions:adminTrialAction --project invoicepro-105ba

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nDone. Functions live on invoicepro-105ba (us-central1)." -ForegroundColor Green
} else {
  Write-Host @"

Deploy failed. Common fixes:
  1. firebase logout
  2. firebase login
     (use the Google account that owns invoicepro-105ba)
  3. Run this script again

Firebase Console:
  https://console.firebase.google.com/project/invoicepro-105ba/functions
"@ -ForegroundColor Red
  exit $LASTEXITCODE
}
