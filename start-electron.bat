@echo off
echo Checking and installing dependencies...

cd desktop
if not exist node_modules (
    echo Installing desktop dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
)

echo Starting Electron...
npx electron -r ts-node/register .
pause