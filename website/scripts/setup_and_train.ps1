# FixItNow — One-Click Setup & Training Script
# Run: .\scripts\setup_and_train.ps1 -ApiKey YOUR_ROBOFLOW_KEY

param(
    [Parameter(Mandatory=$true)]
    [string]$ApiKey,
    [int]$Epochs = 40
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  FixItNow YOLOv8 Setup & Training" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Find Python ──────────────────────────────────────────────────────
Write-Host "[1/4] Locating Python..." -ForegroundColor Yellow
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3") {
            $pythonCmd = $cmd
            Write-Host "  Python found: $ver ($cmd)" -ForegroundColor Green
            break
        }
    } catch {}
}
if (-not $pythonCmd) {
    Write-Host "  Python not found. Installing Python 3.12..." -ForegroundColor Red
    winget install -e --id Python.Python.3.12 --silent --accept-source-agreements --accept-package-agreements
    $pythonCmd = "python"
}

# ── Step 2: Install packages ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Installing Python packages..." -ForegroundColor Yellow
& $pythonCmd -m pip install ultralytics roboflow torch torchvision fastapi uvicorn pillow --quiet
Write-Host "  Packages installed" -ForegroundColor Green

# ── Step 3: Train models ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Training YOLOv8 models (this may take 2-4 hours on CPU)..." -ForegroundColor Yellow
Write-Host "      TIP: Use Google Colab for 10x faster GPU training!" -ForegroundColor Magenta
Write-Host "           Open: scripts/FixItNow_YOLOv8_Training.ipynb on colab.research.google.com" -ForegroundColor Magenta
Write-Host ""

Set-Location $ROOT
& $pythonCmd scripts/train_yolov8.py --api-key $ApiKey --epochs $Epochs --batch 8

# ── Step 4: List trained models ──────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Trained models:" -ForegroundColor Yellow
Get-ChildItem "$ROOT\scripts\models\*.pt" | ForEach-Object {
    $sizeMB = [math]::Round($_.Length / 1MB, 1)
    Write-Host "  $($_.Name)  ($sizeMB MB)" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  All done! Start inference server with:" -ForegroundColor Cyan
Write-Host "  .\scripts\start_yolo_server.ps1" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
