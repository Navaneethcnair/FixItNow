from ultralytics import YOLO
import os
import sys

model = YOLO('runs/detect/train-4/weights/best.pt')


def check_plumbing(file_path, threshold_percent=20):
    ext = os.path.splitext(file_path)[1].lower()
    video_extensions = ['.mp4', '.mov', '.avi', '.mkv']

    if ext in video_extensions:
        results = model.predict(file_path, conf=0.4, stream=True)
        total_frames = 0
        frames_with_detection = 0
        for r in results:
            total_frames += 1
            if len(r.boxes) > 0:
                frames_with_detection += 1
        percent = (frames_with_detection / total_frames) * 100 if total_frames > 0 else 0
        detected = percent > threshold_percent
        print(f"\nAnalyzed {total_frames} frames, {frames_with_detection} showed a detection ({percent:.1f}%)")
    else:
        results = model.predict(file_path, conf=0.4)
        detected = any(len(r.boxes) > 0 for r in results)

    print("=" * 40)
    if detected:
        print("RESULT: Plumbing issue detected")
    else:
        print("RESULT: No detection")
    print("=" * 40)

    return detected


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_plumbing.py <path_to_image_or_video>")
    else:
        file_path = sys.argv[1]
        check_plumbing(file_path)