# FixItNow — Start YOLOv8 Inference Server
# Usage: .\scripts\start_yolo_server.ps1

$ErrorActionPreference = "Continue"
$ROOT = Split-Path -Parent $PSScriptRoot

# ── Find Python ───────────────────────────────────────────────────────────────
$PYTHON = $null
$candidates = @(
    "C:\Users\mfazi\AppData\Local\Programs\Python\Python312\python.exe",
    "C:\Python312\python.exe",
    "C:\Python311\python.exe",
    "C:\Python310\python.exe"
)
foreach ($c in $candidates) {
    if (Test-Path $c) { $PYTHON = $c; break }
}
if (-not $PYTHON) {
    foreach ($cmd in @("python", "python3", "py")) {
        try {
            $v = & $cmd --version 2>&1
            if ("$v" -match "Python 3") { $PYTHON = $cmd; break }
        } catch {}
    }
}
if (-not $PYTHON) {
    Write-Host "Python not found." -ForegroundColor Red
    Write-Host "Run: winget install Python.Python.3.12" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  FixItNow YOLOv8 Inference Server v2.0" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Python: $PYTHON" -ForegroundColor Gray

# ── Check for trained models ──────────────────────────────────────────────────
$modelsDir = "$ROOT\scripts\models"
$models = Get-ChildItem "$modelsDir\*.pt" -ErrorAction SilentlyContinue

if ($models.Count -eq 0) {
    Write-Host ""
    Write-Host "  ⚠️  No trained models found in scripts/models/" -ForegroundColor Red
    Write-Host ""
    Write-Host "  ══ OPTION A: Free GPU on Google Colab (RECOMMENDED) ══" -ForegroundColor Yellow
    Write-Host "  1. Go to: https://colab.research.google.com/" -ForegroundColor White
    Write-Host "  2. Upload: scripts/FixItNow_YOLOv8_Training.ipynb" -ForegroundColor White
    Write-Host "  3. Runtime > Change runtime type > T4 GPU" -ForegroundColor White
    Write-Host "  4. Paste your Roboflow API key in Cell 2" -ForegroundColor White
    Write-Host "     Get key at: https://app.roboflow.com > Settings > API" -ForegroundColor White
    Write-Host "  5. Run All Cells (Ctrl+F9)" -ForegroundColor White
    Write-Host "  6. Download fixitnow_yolov8_models.zip from last cell" -ForegroundColor White
    Write-Host "  7. Extract .pt files to: scripts\models\" -ForegroundColor White
    Write-Host "  8. Re-run this script" -ForegroundColor White
    Write-Host ""
    Write-Host "  ══ OPTION B: Train locally (slow, CPU only) ══" -ForegroundColor Yellow
    Write-Host "  .\scripts\setup_and_train.ps1 -ApiKey YOUR_ROBOFLOW_KEY" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "  Loaded models ($($models.Count)):" -ForegroundColor Green
$models | ForEach-Object {
    $mb = [math]::Round($_.Length / 1MB, 1)
    Write-Host "    $($_.Name)  ($mb MB)" -ForegroundColor White
}

# ── Install packages ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Checking packages..." -ForegroundColor Yellow
& $PYTHON -m pip install ultralytics fastapi uvicorn pillow --quiet
Write-Host "  Packages OK" -ForegroundColor Green

# ── Start server ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Starting server at http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

Set-Location $ROOT
& $PYTHON scripts/yolo_server.py
