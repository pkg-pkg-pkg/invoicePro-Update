# InvoicePro Admin — clean reinstall (fixes broken main.cjs in old install)
$ErrorActionPreference = 'Stop'

$installer = Join-Path $PSScriptRoot '..\dist-electron\InvoicePro-Admin-Setup-1.3.4.exe'
if (-not (Test-Path $installer)) {
  Write-Error "Installer not found: $installer`nRun: npm run build:win"
}

Write-Host 'Closing InvoicePro Admin if running...'
Get-Process 'InvoicePro Admin', electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$uninstallKeys = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

foreach ($key in $uninstallKeys) {
  Get-ItemProperty $key -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like '*InvoicePro Admin*' } |
    ForEach-Object {
      if ($_.UninstallString) {
        Write-Host "Uninstalling: $($_.DisplayName)"
        $cmd = $_.UninstallString -replace '/ALLUSERS','' -replace '"',''
        if ($cmd -match 'Uninstall\.exe') {
          Start-Process 'cmd.exe' -ArgumentList '/c', "`"$($_.UninstallString)`" /S" -Wait -ErrorAction SilentlyContinue
        }
      }
    }
}

Start-Sleep -Seconds 2
Write-Host "Installing: $installer"
Start-Process -FilePath $installer -Wait
Write-Host 'Done. Launch InvoicePro Admin from Start menu.'
