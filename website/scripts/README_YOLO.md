# FixItNow YOLOv8 — Setup Guide

## Architecture

```
FixItNow Custom AI (Online)  →  Roboflow Inference API (cloud)
FixItNow Custom AI (Offline) →  Local YOLOv8 server (127.0.0.1:8000)
                               → Heuristic fallback (if server offline)
```

---

## Step 1: Train Models on Google Colab (FREE GPU)

1. Open `scripts/FixItNow_YOLOv8_Training.ipynb` in Colab:
   - Go to https://colab.research.google.com/
   - Upload the notebook file

2. Change Runtime → T4 GPU

3. Get your Roboflow API key:
   - https://app.roboflow.com → Settings → Roboflow API

4. Paste key in Cell 2: `ROBOFLOW_API_KEY = "rf_xxxx"`

5. Run All Cells (Ctrl+F9) — training takes ~20-40 min on GPU

6. Download `fixitnow_yolov8_models.zip` from last cell

7. Extract these files to `scripts/models/`:
   - `mobile-damage.pt`
   - `pipe-damage.pt`
   - `complaint-management.pt`
   - `smart-estate-carpentry.pt`
   - `models_metadata.json`

---

## Step 2: Start the Inference Server

```powershell
.\scripts\start_yolo_server.ps1
```

Server starts at: http://127.0.0.1:8000

---

## Step 3: Use FixItNow

1. Start Next.js: `npm run dev`
2. Open: http://localhost:3000/upload
3. Select **FixItNow Custom AI** model
4. Upload any damage photo
5. AI will use real YOLOv8 inference!

---

## Trained Datasets

| Model File | Dataset | Trade |
|---|---|---|
| `mobile-damage.pt` | tirths-workspace-k51ep/mobile-damage-segmentation | Phone Repair |
| `pipe-damage.pt` | bayram-grbz/pipe-damage-detection-9eudj | Plumber |
| `complaint-management.pt` | sairohith/complaint-management | AC/Electrical |
| `smart-estate-carpentry.pt` | bhoomikas-workspace-bdi6e/smart-estate-carpentry | Carpentry |

---

## How It Works

```
Upload Image
    │
    ▼
FixItNow Custom AI (gemini.ts)
    │
    ├─ Detect trade category (filename + edge density heuristic)
    │
    ├─ Try: POST http://127.0.0.1:8000/predict?model=<slug>
    │         → Real YOLOv8 inference on trained .pt model
    │         → Returns: class names, confidence, bounding boxes
    │
    └─ Fallback: Offline heuristic classifier (no server needed)
```

---

## Local Training (Alternative to Colab)

```powershell
# Takes 2-4 hours on CPU
.\scripts\setup_and_train.ps1 -ApiKey "rf_your_key_here"

# Or train individual datasets:
& "C:\Users\mfazi\AppData\Local\Programs\Python\Python312\python.exe" scripts/train_yolov8.py --api-key "rf_xxx" --dataset mobile-damage
```
