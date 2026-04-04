# Check if services are running
Write-Host "Checking backend server (port 3000)..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend is responding: $($response.Content)"
} catch {
    Write-Host "❌ Backend not responding: $($_.Exception.Message)"
}

Write-Host "`nChecking Vite dev server (port 5173)..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 5
    Write-Host "✅ Vite dev server is accessible"
} catch {
    Write-Host "❌ Vite dev server not accessible: $($_.Exception.Message)"
}

# Check for node_modules
Write-Host "`nChecking dependencies..."
if (Test-Path "desktop\node_modules") {
    Write-Host "✅ Desktop dependencies are installed"
} else {
    Write-Host "❌ Desktop dependencies not found"
    Write-Host "Installing desktop dependencies..."
    cd desktop
    npm install
    cd ..
}

Write-Host "`nTrying to start Electron..."
cd desktop
npx electron -r ts-node/register .