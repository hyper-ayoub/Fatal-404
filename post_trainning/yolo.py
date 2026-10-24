
from pathlib import Path
import json
import cv2
import shutil

def get_images(folder):
    return sorted(p for p in Path(folder).rglob("*")
                  if p.suffix.lower() in {".jpg", ".jpeg", ".png", "web"})

def save_frame(image_path, output, frame_id):
    image = cv2.imread(str(image_path))
    if image is None:
        return False

    h, w = image.shape[:2]
    name = f"{frame_id:06d}"

    if image_path.suffix.lower() in {".jpg", ".jpeg"}:
        shutil.copy2(image_path, output / f"{name}.jpg")
    else:
        cv2.imwrite(str(output / f"{name}.jpg"), image)

    metadata = {
        "frame_id": frame_id,
        "camera": {"hfov_deg": 90, "width": w, "height": h},
        "pose": {"x": 0, "y": 0, "z": 0, "yaw_deg": 0},
        "speed_mps": 0,
        "rays": []
    }
    (output / f"{name}.json").write_text(json.dumps(metadata, indent=2))
    return True

def convert_dataset(source, destination="dataset/scene01"):
    output = Path(destination)
    output.mkdir(parents=True, exist_ok=True)

    count = sum(save_frame(p, output, i)
                for i, p in enumerate(get_images(source), 1))
    print(f"Converted {count} images.")

if __name__ == "__main__":
    convert_dataset("downloaded_dataset/images")
