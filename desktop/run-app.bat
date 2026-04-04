@echo off
echo Starting GST Billing Software...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dist folder exists
if not exist "dist" (
    echo Error: Application not built. Please run 'npm run build' first
    pause
    exit /b 1
)

REM Start the application
echo Starting application in production mode...
cd dist
start "" "http://localhost:8080" || (
    echo Starting local server...
    python -m http.server 8080 2>nul || (
        echo Python not found, trying Node.js server...
        npx serve -s . -l 8080 2>nul || (
            echo No server available. Please open dist/index.html manually in your browser.
            start "" "index.html"
        )
    )
)

echo.
echo Application should be opening in your browser...
echo If not, please open: http://localhost:8080
echo.
pause
