$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$backendVenvPython = Join-Path $backend ".venv\Scripts\python.exe"

Set-Location $backend
if (-not (Test-Path $backendVenvPython)) {
  Write-Error "Backend venv is missing. Run .\scripts\setup.ps1 first."
}

& $backendVenvPython -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
