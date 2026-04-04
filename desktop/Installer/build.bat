@echo off
echo ========================================
echo InvoicePro Installer Build Script
echo ========================================
echo.

REM Check if Inno Setup is installed
where ISCC.exe >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Inno Setup not found!
    echo Please install Inno Setup 6.3 Unicode from:
    echo https://jrsoftware.org/download.php/is.php
    pause
    exit /b 1
)

echo Inno Setup found. Starting compilation...
echo.

REM Compile the installer
ISCC.exe InvoiceProSetup.iss

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================
    echo BUILD SUCCESSFUL!
    echo ========================================
    echo Installer created: output\InvoiceProInstaller.exe
    echo.
    echo To test the installer:
    echo 1. Run output\InvoiceProInstaller.exe
    echo 2. Follow the installation steps
    echo 3. Verify all features work correctly
    echo.
    echo For silent installation test:
    echo output\InvoiceProInstaller.exe /SILENT
    echo.
) else (
    echo.
    echo ========================================
    echo BUILD FAILED!
    echo ========================================
    echo Please check the error messages above.
    echo.
)

pause
