"""
Merge datasets into a single-class "Mobile_Damage" YOLOv8 dataset.

Sources:
  - Mobile-Damage-Diagnosis-10: dead pixel, scratch, screen crack -> Mobile_Damage
  - combined-dataset-3: glass_crack, in-display-pixel-defect -> Mobile_Damage
                        (mobile class DROPPED - it's a whole-phone box, not damage)

Final class: 0 = Mobile_Damage
"""

import os
import shutil
from pathlib import Path

DATASET_CLASS_MAPS = {
    "Mobile-Damage-Diagnosis-10": {
        0: 0,  # dead pixel
        1: 0,  # scratch
        2: 0,  # screen crack
    },
    "combined-dataset-3": {
        0: 0,  # glass_crack
        1: 0,  # in-display-pixel-defect
        # 2: mobile -> DROPPED (whole-phone bounding box, not damage)
    },
}

NEW_CLASS_NAMES = ["Mobile_Damage"]
OUTPUT_DIR = Path("merged_mobile_damage")
SPLITS = ["train", "valid", "test"]


def remap_label_file(src_path, dst_path, class_map):
    lines_out = []
    if not os.path.exists(src_path):
        return False
    with open(src_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if not parts:
                continue
            old_cls = int(parts[0])
            if old_cls not in class_map:
                continue
            new_cls = class_map[old_cls]
            parts[0] = str(new_cls)
            lines_out.append(" ".join(parts))
    if not lines_out:
        return False
    with open(dst_path, "w") as f:
        f.write("\n".join(lines_out) + "\n")
    return True


def merge():
    for split in SPLITS:
        (OUTPUT_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

    total_copied = 0
    per_class_counts = {0: 0}
    global_counter = 0

    for dataset_name, class_map in DATASET_CLASS_MAPS.items():
        dataset_path = Path(dataset_name)
        if not dataset_path.exists():
            print(f"WARNING: {dataset_name} folder not found, skipping.")
            continue

        dataset_copied = 0
        for split in SPLITS:
            img_dir = dataset_path / split / "images"
            lbl_dir = dataset_path / split / "labels"
            if not img_dir.exists():
                continue
            for img_file in img_dir.iterdir():
                if img_file.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
                    continue
                label_file = lbl_dir / (img_file.stem + ".txt")

                # Short auto-incrementing filenames to avoid Windows path-length limits
                global_counter += 1
                short_id = f"img{global_counter:06d}"
                new_name = f"{short_id}{img_file.suffix.lower()}"
                new_label_name = f"{short_id}.txt"

                dst_label_path = OUTPUT_DIR / split / "labels" / new_label_name
                wrote_label = remap_label_file(label_file, dst_label_path, class_map)
                if wrote_label:
                    dst_img_path = OUTPUT_DIR / split / "images" / new_name
                    shutil.copy(img_file, dst_img_path)
                    total_copied += 1
                    dataset_copied += 1
                    with open(dst_label_path) as f:
                        for line in f:
                            cls_id = int(line.split()[0])
                            per_class_counts[cls_id] = per_class_counts.get(cls_id, 0) + 1
        print(f"Processed {dataset_name}: {dataset_copied} images copied")

    yaml_content = f"""train: train/images
val: valid/images
test: test/images

nc: {len(NEW_CLASS_NAMES)}
names: {NEW_CLASS_NAMES}
"""
    with open(OUTPUT_DIR / "data.yaml", "w") as f:
        f.write(yaml_content)

    print(f"\nDone. Total images copied: {total_copied}")
    print(f"Merged dataset ready at: {OUTPUT_DIR}/")
    print(f"\nPer-class box counts:")
    for cls_id, name in enumerate(NEW_CLASS_NAMES):
        print(f"  {name}: {per_class_counts.get(cls_id, 0)} boxes")


if __name__ == "__main__":
    merge()