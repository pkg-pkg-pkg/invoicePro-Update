@echo off
echo ========================================
echo InvoicePro Installer Test Script
echo ========================================
echo.

REM Check if installer exists
if not exist "output\InvoiceProInstaller.exe" (
    echo ERROR: Installer not found!
    echo Please run build.bat first to create the installer.
    pause
    exit /b 1
)

echo Installer found: output\InvoiceProInstaller.exe
echo.

REM Display installer info
echo Installer Information:
echo --------------------
for %%F in ("output\InvoiceProInstaller.exe") do (
    echo File: %%~nxF
    echo Size: %%~zZ bytes
    echo Modified: %%~tF
)
echo.

echo Testing Options:
echo ================
echo 1. Normal Installation Test
echo 2. Silent Installation Test
echo 3. Very Silent Installation Test
echo 4. Exit
echo.
set /p choice="Choose test option (1-4): "

if "%choice%"=="1" (
    echo.
    echo Starting normal installation...
    echo Follow the on-screen instructions to test all features.
    echo.
    start "" "output\InvoiceProInstaller.exe"
) else if "%choice%"=="2" (
    echo.
    echo Starting silent installation...
    echo This will install without user interface.
    echo.
    "output\InvoiceProInstaller.exe" /SILENT
    echo.
    echo Silent installation completed.
    echo Check C:\Program Files\InvoicePro for installation.
) else if "%choice%"=="3" (
    echo.
    echo Starting very silent installation...
    echo This will install without any user interaction or messages.
    echo.
    "output\InvoiceProInstaller.exe" /VERYSILENT /SUPPRESSMSGBOXES
    echo.
    echo Very silent installation completed.
    echo Check C:\Program Files\InvoicePro for installation.
) else if "%choice%"=="4" (
    echo Exiting test script.
    exit /b 0
) else (
    echo Invalid choice. Please run the script again.
)

echo.
echo ========================================
echo Test completed!
echo ========================================
echo.
echo Verification Steps:
echo 1. Check if InvoicePro is installed in Program Files
echo 2. Verify desktop shortcut was created (if selected)
echo 3. Check Start Menu entries
echo 4. Test application launch
echo 5. Verify uninstallation works correctly
echo.
pause
