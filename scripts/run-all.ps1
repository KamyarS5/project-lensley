$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

$backendCmd = "Set-Location '$backend'; if (-not (Test-Path '.venv\\Scripts\\python.exe')) { Write-Host 'Run .\\scripts\\setup.ps1 first'; exit 1 }; .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
$frontendCmd = "Set-Location '$frontend'; if (-not (Test-Path 'node_modules')) { Write-Host 'Installing frontend dependencies...'; npm install }; npm run dev"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd | Out-Null
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd | Out-Null

Write-Host "Opened backend and frontend in separate terminals."
