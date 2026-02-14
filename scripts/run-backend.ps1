$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"

Set-Location $backend
if (-not (Test-Path ".venv\Scripts\python.exe")) {
  Write-Error "Backend venv is missing. Run .\scripts\setup.ps1 first."
}

& ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
