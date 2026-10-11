"""
Merge and remap datasets into a 2-class YOLOv8 dataset.
Final classes:
  0 = Masonry
  1 = Carpentry
"""

import os
import shutil
from pathlib import Path

DATASET_CLASS_MAPS = {
    "Masonry-Crack-4": {
        0: 0, 1: 0, 2: 0,
    },
    "smart-estate-carpentry-1": {
        0: 1, 1: 1, 2: 1, 3: 1,
        4: 0, 5: 0, 6: 0, 7: 0, 8: 0,
    },
}

NEW_CLASS_NAMES = ["Masonry", "Carpentry"]
OUTPUT_DIR = Path("merged_dataset_masonry_carpentry")
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
    per_class_counts = {0: 0, 1: 0}

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
                new_name = f"{dataset_name}_{img_file.name}"
                new_label_name = f"{dataset_name}_{img_file.stem}.txt"
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