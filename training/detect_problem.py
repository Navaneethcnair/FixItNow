from ultralytics import YOLO
import os
import sys

# Load all your trained models
print("Loading models...")
masonry_model = YOLO('runs/detect/train-2/weights/best.pt')          # single-class Masonry
plumbing_model = YOLO('runs/detect/train-4/weights/best.pt')         # single-class Plumbing (leak)
masonry_carpentry_model = YOLO('runs/detect/train-3/weights/best.pt')  # 2-class Masonry + Carpentry
print("Models loaded.\n")


def run_model_on_file(model, file_path, class_names, threshold_percent=20, conf=0.4):
    """Runs one model on a photo or video and returns which classes were detected."""
    ext = os.path.splitext(file_path)[1].lower()
    video_extensions = ['.mp4', '.mov', '.avi', '.mkv']

    detected_classes = {}  # class_name -> detection count / frame count

    if ext in video_extensions:
        results = model.predict(file_path, conf=conf, stream=True)
        total_frames = 0
        class_frame_counts = {name: 0 for name in class_names}

        for r in results:
            total_frames += 1
            seen_this_frame = set()
            for box in r.boxes:
                cls_id = int(box.cls[0])
                cls_name = model.names[cls_id]
                seen_this_frame.add(cls_name)
            for cls_name in seen_this_frame:
                class_frame_counts[cls_name] = class_frame_counts.get(cls_name, 0) + 1

        for cls_name, count in class_frame_counts.items():
            percent = (count / total_frames) * 100 if total_frames > 0 else 0
            if percent > threshold_percent:
                detected_classes[cls_name] = percent

    else:
        results = model.predict(file_path, conf=conf)
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                cls_name = model.names[cls_id]
                conf_score = float(box.conf[0]) * 100
                if cls_name not in detected_classes or conf_score > detected_classes[cls_name]:
                    detected_classes[cls_name] = conf_score

    return detected_classes


def check_problem(file_path):
    print(f"\nAnalyzing: {file_path}")
    print("=" * 50)

    all_detections = {}

    # Run Masonry-only model
    result1 = run_model_on_file(masonry_model, file_path, ['Masonry'])
    all_detections.update(result1)

    # Run Plumbing model
    result2 = run_model_on_file(plumbing_model, file_path, ['Plumbing'])
    all_detections.update(result2)

    # Run Masonry+Carpentry model (adds Carpentry detection capability)
    result3 = run_model_on_file(masonry_carpentry_model, file_path, ['Masonry', 'Carpentry'])
    for k, v in result3.items():
        if k not in all_detections or v > all_detections[k]:
            all_detections[k] = v

    print("=" * 50)
    if all_detections:
        # Only keep the single highest-confidence result
        best_class, best_score = max(all_detections.items(), key=lambda x: x[1])
        print(f"RESULT: {best_class} problem detected ({best_score:.1f}% confidence/frame-match)")
    else:
        print("RESULT: No problem detected")
    print("=" * 50)

    return all_detections


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python detect_problem.py <path_to_image_or_video>")
    else:
        file_path = sys.argv[1]
        check_problem(file_path)