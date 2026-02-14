$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "[1/3] Setting up backend virtual environment..."
Set-Location $backend
if (-not (Test-Path ".venv\Scripts\python.exe")) {
  py -m venv .venv
}

Write-Host "[2/3] Installing backend dependencies..."
& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

Write-Host "[3/3] Installing frontend dependencies..."
Set-Location $frontend
npm install

Write-Host "Setup complete."
Write-Host "Run backend: .\scripts\run-backend.ps1"
Write-Host "Run frontend: .\scripts\run-frontend.ps1"
Write-Host "Run both:    .\scripts\run-all.ps1"
