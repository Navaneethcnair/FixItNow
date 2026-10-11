"""
FixItNow YOLOv8 Training Script
---------------------------------
Downloads all 4 Roboflow datasets and trains YOLOv8n models locally.
NOTE: For faster training use Google Colab (scripts/FixItNow_YOLOv8_Training.ipynb)

Usage:
  python scripts/train_yolov8.py --api-key YOUR_ROBOFLOW_KEY
  python scripts/train_yolov8.py --api-key YOUR_KEY --epochs 30 --dataset mobile-damage
"""

import argparse, json, os, shutil, sys
from pathlib import Path

DATASETS = [
    {"workspace":"tirths-workspace-k51ep","project":"mobile-damage-segmentation","version":1,"slug":"mobile-damage","trade":"Phone Repair"},
    {"workspace":"bayram-grbz","project":"pipe-damage-detection-9eudj","version":1,"slug":"pipe-damage","trade":"Plumber"},
    {"workspace":"sairohith","project":"complaint-management","version":1,"slug":"complaint-management","trade":"AC/Electrical"},
    {"workspace":"bhoomikas-workspace-bdi6e","project":"smart-estate-carpentry","version":1,"slug":"smart-estate-carpentry","trade":"Carpentry"},
]

MODELS_DIR = Path(__file__).parent / "models"


def download_dataset(rf, ds, datasets_dir):
    slug = ds["slug"]
    for v in [ds["version"], ds["version"]+1, 1, 2, 3]:
        try:
            project = rf.workspace(ds["workspace"]).project(ds["project"])
            dataset = project.version(v).download("yolov8", location=str(datasets_dir / slug))
            print(f"  Downloaded v{v} -> {dataset.location}")
            return dataset.location
        except Exception as e:
            print(f"  v{v} failed: {e}")
    return None


def find_yaml(folder):
    for root, _, files in os.walk(folder):
        for f in files:
            if f == "data.yaml":
                return os.path.join(root, f)
    return None


def train(api_key, epochs, img_size, batch, only_slug=None):
    try:
        from roboflow import Roboflow
        from ultralytics import YOLO
        import torch
    except ImportError as e:
        print(f"Missing package: {e}")
        print("Run: pip install ultralytics roboflow torch")
        sys.exit(1)

    MODELS_DIR.mkdir(exist_ok=True)
    datasets_dir = Path(__file__).parent / "datasets"
    datasets_dir.mkdir(exist_ok=True)

    rf = Roboflow(api_key=api_key)
    training_results = {}

    for ds in DATASETS:
        slug = ds["slug"]
        if only_slug and slug != only_slug:
            continue

        print(f"\n{'='*60}")
        print(f"  Dataset: {slug} ({ds['trade']})")
        print(f"{'='*60}")

        # Download
        loc = download_dataset(rf, ds, datasets_dir)
        if not loc:
            print(f"  ERROR: Could not download {slug}")
            continue

        # Find data.yaml
        yaml_path = find_yaml(loc)
        if not yaml_path:
            print(f"  ERROR: data.yaml not found in {loc}")
            continue

        print(f"  data.yaml: {yaml_path}")
        print(f"  Training for {epochs} epochs...")

        # Train
        model = YOLO("yolov8n.pt")
        device = 0 if (torch.cuda.is_available()) else "cpu"
        print(f"  Using device: {'GPU' if device == 0 else 'CPU'}")

        results = model.train(
            data=yaml_path,
            epochs=epochs,
            imgsz=img_size,
            batch=batch,
            project=f"runs/{slug}",
            name="train",
            device=device,
            patience=10,
            verbose=False,
            save=True,
        )

        # Copy best weights
        best_pt = Path(f"runs/{slug}/train/weights/best.pt")
        output_pt = MODELS_DIR / f"{slug}.pt"
        if best_pt.exists():
            shutil.copy2(str(best_pt), str(output_pt))
            m2 = YOLO(str(output_pt))
            training_results[slug] = {
                "trade":      ds["trade"],
                "model_file": f"{slug}.pt",
                "classes":    list(m2.names.values()),
                "map50":      float(results.results_dict.get("metrics/mAP50(B)", 0)),
            }
            print(f"  Saved: {output_pt}")
            print(f"  Classes: {training_results[slug]['classes']}")
            print(f"  mAP50:   {training_results[slug]['map50']:.3f}")
        else:
            print(f"  WARNING: best.pt not found at {best_pt}")

    # Save metadata
    meta_path = MODELS_DIR / "models_metadata.json"
    existing = {}
    if meta_path.exists():
        with open(meta_path) as f:
            existing = json.load(f)
    existing.update(training_results)
    with open(meta_path, "w") as f:
        json.dump(existing, f, indent=2)

    print(f"\n{'='*60}")
    print(f"  Training complete: {len(training_results)}/{len(DATASETS)} models")
    print(f"  Models saved to: {MODELS_DIR}")
    print(f"  Metadata: {meta_path}")
    print(json.dumps(training_results, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="FixItNow YOLOv8 Training")
    p.add_argument("--api-key", required=True, help="Roboflow API key from app.roboflow.com")
    p.add_argument("--epochs",  type=int, default=40,  help="Training epochs (default 40)")
    p.add_argument("--imgsz",   type=int, default=640, help="Image size (default 640)")
    p.add_argument("--batch",   type=int, default=8,   help="Batch size (default 8 for CPU)")
    p.add_argument("--dataset", type=str, default=None, help="Train only one dataset slug")
    args = p.parse_args()
    train(args.api_key, args.epochs, args.imgsz, args.batch, args.dataset)
