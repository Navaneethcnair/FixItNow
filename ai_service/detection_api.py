from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import shutil
import os
import tempfile
import base64
import cv2
import uvicorn

app = FastAPI()

print("Loading models...")
masonry_model = YOLO('../runs/detect/train-2/weights/best.pt')
plumbing_model = YOLO('../runs/detect/train-4/weights/best.pt')
masonry_carpentry_model = YOLO('../runs/detect/train-3/weights/best.pt')
mobile_model = YOLO('../runs/detect/train8/weights/best.pt')
print("Models loaded.\n")

CONF_THRESHOLD = 0.4
VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv']


def compute_sharpness(image):
    """Returns a sharpness score using Laplacian variance. Higher = sharper/clearer."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def encode_annotated_frame(result):
    """Takes one YOLO result and returns a base64 JPEG of the annotated (boxed) image."""
    annotated = result.plot()
    success, buffer = cv2.imencode('.jpg', annotated)
    if not success:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')


def run_model_on_file(model, file_path, class_names, threshold_percent=20, conf=CONF_THRESHOLD):
    """Runs one model on a photo or video. Returns (detected_classes, best_annotated_image)."""
    ext = os.path.splitext(file_path)[1].lower()
    detected_classes = {}
    best_annotated_image = None
    best_frame_score = -1

    if ext in VIDEO_EXTENSIONS:
        results = model.predict(file_path, conf=conf, stream=True)
        total_frames = 0
        class_frame_counts = {name: 0 for name in class_names}

        for r in results:
            total_frames += 1
            seen_this_frame = set()
            if len(r.boxes) > 0:
                frame_conf = float(r.boxes.conf.max())
                if frame_conf >= 0.4:
                    sharpness = compute_sharpness(r.orig_img)
                    normalized_sharpness = min(sharpness / 500.0, 1.0)
                    combined_score = (frame_conf * 0.75) + (normalized_sharpness * 0.25)
                    if combined_score > best_frame_score:
                        best_frame_score = combined_score
                        best_annotated_image = encode_annotated_frame(r)

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
            if len(r.boxes) > 0:
                best_annotated_image = encode_annotated_frame(r)
            for box in r.boxes:
                cls_id = int(box.cls[0])
                cls_name = model.names[cls_id]
                conf_score = float(box.conf[0]) * 100
                if cls_name not in detected_classes or conf_score > detected_classes[cls_name]:
                    detected_classes[cls_name] = conf_score

    return detected_classes, best_annotated_image


def check_problem(file_path):
    all_detections = {}
    images_by_model = {}

    result1, img1 = run_model_on_file(masonry_model, file_path, ['Masonry'])
    all_detections.update(result1)
    if img1:
        images_by_model['Masonry'] = img1

    result2, img2 = run_model_on_file(plumbing_model, file_path, ['Plumbing'])
    all_detections.update(result2)
    if img2:
        images_by_model['Plumbing'] = img2

    result3, img3 = run_model_on_file(masonry_carpentry_model, file_path, ['Masonry', 'Carpentry'])
    for k, v in result3.items():
        if k not in all_detections or v > all_detections[k]:
            all_detections[k] = v
    if img3:
        for cls in ['Masonry', 'Carpentry']:
            if cls in result3 and cls not in images_by_model:
                images_by_model[cls] = img3

    result4, img4 = run_model_on_file(mobile_model, file_path, ['Mobile_Damage'])
    all_detections.update(result4)
    if img4:
        images_by_model['Mobile_Damage'] = img4

    if all_detections:
        best_class, best_score = max(all_detections.items(), key=lambda x: x[1])
        annotated_image = images_by_model.get(best_class)
        return best_class, best_score, annotated_image
    else:
        return None, 0.0, None


@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        best_class, best_score, annotated_image = check_problem(tmp_path)
        return {
            "detected_class": best_class,
            "confidence": round(best_score / 100, 3) if best_class else 0.0,
            "annotated_image": annotated_image
        }
    finally:
        os.remove(tmp_path)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)