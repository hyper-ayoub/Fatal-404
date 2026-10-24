"""Convert any folder of images into the SensePath dataset format.

Usage:
    python convert_dataset.py downloaded_dataset/images
    python convert_dataset.py downloaded_dataset/images --limit 200 --hfov 70
"""
import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def read_image(path):
    """cv2.imread fails silently on non-ASCII Windows paths (e.g. 'année'); this does not."""
    try:
        data = np.fromfile(str(path), dtype=np.uint8)
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception:
        return None


def write_image(path, image):
    ok, buf = cv2.imencode(".jpg", image)
    if ok:
        buf.tofile(str(path))
    return ok


def get_images(folder):
    return sorted(
        p for p in Path(folder).rglob("*")
        if p.suffix.lower() in IMAGE_SUFFIXES
    )


def save_frame(image_path, output, frame_id, hfov):
    image = read_image(image_path)
    if image is None:
        return False

    h, w = image.shape[:2]
    name = f"{frame_id:06d}"

    if image_path.suffix.lower() in {".jpg", ".jpeg"}:
        shutil.copy2(image_path, output / f"{name}.jpg")
    else:
        write_image(output / f"{name}.jpg", image)

    metadata = {
        "frame_id": frame_id,
        "camera": {"hfov_deg": hfov, "width": w, "height": h},
        "pose": {"x": 0, "y": 0, "z": 0, "yaw_deg": 0},
        "speed_mps": 0,
        "rays": [],  # empty = backend estimates distance from box size
    }
    (output / f"{name}.json").write_text(json.dumps(metadata, indent=2))
    return True


def convert_dataset(source, destination="dataset/scene01", limit=None, hfov=70):
    output = Path(destination)
    output.mkdir(parents=True, exist_ok=True)

    if not Path(source).exists():
        raise SystemExit(f"Source folder not found: {Path(source).resolve()}")

    images = get_images(source)
    print(f"Found {len(images)} image files in {Path(source).resolve()}")
    if not images:
        raise SystemExit("No images found. Put .jpg/.png files in that folder (subfolders are fine).")

    if limit:
        images = images[:limit]

    count = 0
    for p in images:
        # Number only successful frames so there are no gaps.
        if save_frame(p, output, count + 1, hfov):
            count += 1

    skipped = len(images) - count
    print(f"Converted {count} images into {output}" + (f" ({skipped} unreadable, skipped)" if skipped else ""))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="folder containing the downloaded images")
    parser.add_argument("--dest", default="dataset/scene01")
    parser.add_argument("--limit", type=int, default=None, help="max images to convert")
    parser.add_argument("--hfov", type=float, default=70, help="camera horizontal FOV in degrees")
    args = parser.parse_args()

    convert_dataset(args.source, args.dest, args.limit, args.hfov)