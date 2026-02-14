$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$backendVenvPython = Join-Path $backend ".venv\Scripts\python.exe"

Write-Host "[1/3] Setting up backend virtual environment..."
if (-not (Test-Path $backendVenvPython)) {
  Set-Location $backend
  py -m venv .venv
}

Write-Host "[2/3] Installing backend dependencies..."
& $backendVenvPython -m pip install --upgrade pip
& $backendVenvPython -m pip install -r (Join-Path $backend "requirements.txt")

Write-Host "[3/3] Installing frontend dependencies..."
Set-Location $frontend
npm install

Write-Host "Setup complete."
Write-Host "Run backend: .\scripts\run-backend.ps1"
Write-Host "Run frontend: .\scripts\run-frontend.ps1"
Write-Host "Run both:    .\scripts\run-all.ps1"
