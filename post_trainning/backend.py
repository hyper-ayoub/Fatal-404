"""SensePath backend: dataset images -> YOLO -> zones/distances -> MQTT -> Wokwi.

Usage:
    python backend.py
    python backend.py --dataset dataset/scene01 --fps 2 --smooth 1 --annotate annotated
"""
import argparse
import json
import math
import statistics
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np
import paho.mqtt.client as mqtt
from ultralytics import YOLO

# ---------------- Config (must match the Wokwi sketch) ----------------
BROKER = "broker.hivemq.com"
PORT = 1883
PREFIX = "sensepath-yourname"  # CHANGE: same unique prefix as in the sketch
TOPIC_DIST = f"{PREFIX}/sensors/distance"
TOPIC_DET = f"{PREFIX}/vision/detections"

MAX_D = 3.0          # equals MAX_VALID_DISTANCE in the sketch
CONF = 0.4           # YOLO confidence threshold
HFOV_DEFAULT = 90.0  # used when the sidecar has no camera info

# Typical real object heights in meters (used for the size-based estimate).
REAL_HEIGHT = {
    "person": 1.7, "bicycle": 1.1, "car": 1.5, "motorcycle": 1.2,
    "bus": 3.0, "truck": 3.0, "traffic light": 0.9, "fire hydrant": 0.7,
    "stop sign": 0.75, "bench": 0.8, "chair": 0.9, "couch": 0.9,
    "potted plant": 0.6, "dining table": 0.75, "dog": 0.5, "cat": 0.3,
    "suitcase": 0.6, "backpack": 0.5, "bottle": 0.25, "tv": 0.6,
    "refrigerator": 1.7, "toilet": 0.4, "bed": 0.6, "door": 2.0,
}


def read_image(path):
    """cv2.imread fails silently on non-ASCII Windows paths (e.g. 'année')."""
    try:
        data = np.fromfile(str(path), dtype=np.uint8)
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception:
        return None


def write_image(path, image):
    ok, buf = cv2.imencode(".jpg", image)
    if ok:
        buf.tofile(str(path))


def focal_px(width, hfov):
    return (width / 2) / math.tan(math.radians(hfov) / 2)


def zone_of(cx, width, hfov):
    bearing = math.degrees(math.atan((cx - width / 2) / focal_px(width, hfov)))
    if bearing < -hfov / 6:
        return "left"
    if bearing > hfov / 6:
        return "right"
    return "front"


def distance_for(box, cls_name, width, hfov, meta):
    x1, y1, x2, y2 = box
    fx = focal_px(width, hfov)

    rays = meta.get("rays") if meta else None
    if rays:
        a1 = math.degrees(math.atan((x1 - width / 2) / fx))
        a2 = math.degrees(math.atan((x2 - width / 2) / fx))
        inside = [r["distance"] for r in rays if a1 <= r["angle_deg"] <= a2]
        if inside:
            return min(inside), "ray"

    real_h = REAL_HEIGHT.get(cls_name)
    box_h = y2 - y1
    if real_h and box_h > 0:
        return fx * real_h / box_h, "estimate"
    return None, "none"


def clamp(d):
    return round(max(0.0, min(MAX_D, d)), 2)


def ground_truth_zones(meta, hfov):
    rays = meta.get("rays") if meta else None
    if not rays:
        return None
    ranges = {
        "left": (-hfov / 2, -hfov / 6),
        "front": (-hfov / 6, hfov / 6),
        "right": (hfov / 6, hfov / 2),
    }
    out = {}
    for zone, (lo, hi) in ranges.items():
        vals = [r["distance"] for r in rays if lo <= r["angle_deg"] <= hi]
        out[zone] = clamp(min(vals)) if vals else MAX_D
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default="dataset/scene01")
    parser.add_argument("--fps", type=float, default=2.0, help="frames published per second")
    parser.add_argument("--smooth", type=int, default=1,
                        help="median window; use 1 for unrelated photos, 3-5 for video frames")
    parser.add_argument("--model", default="yolov8n.pt")
    parser.add_argument("--once", action="store_true", help="go through the dataset once and stop")
    parser.add_argument("--annotate", default=None,
                        help="folder to save images with YOLO boxes drawn (for checking)")
    args = parser.parse_args()

    images = sorted(Path(args.dataset).glob("*.jpg"))
    if not images:
        raise SystemExit(f"No .jpg images in {args.dataset}. Run convert_dataset.py first.")

    annotate_dir = Path(args.annotate) if args.annotate else None
    if annotate_dir:
        annotate_dir.mkdir(parents=True, exist_ok=True)

    model = YOLO(args.model)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = lambda c, u, f, rc, p=None: print(f"MQTT connected (rc={rc})")
    client.connect(BROKER, PORT)
    client.loop_start()

    history = {z: deque(maxlen=max(1, args.smooth)) for z in ("left", "front", "right")}

    print(f"{len(images)} images | topic: {TOPIC_DIST}")

    while True:
        for path in images:
            start = time.time()

            img = read_image(path)
            if img is None:
                continue
            height, width = img.shape[:2]

            meta_path = path.with_suffix(".json")
            meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
            hfov = meta.get("camera", {}).get("hfov_deg", HFOV_DEFAULT)

            result = model(img, conf=CONF, verbose=False)[0]

            nearest = {"left": MAX_D, "front": MAX_D, "right": MAX_D}
            detections = []

            for b in result.boxes:
                x1, y1, x2, y2 = [float(v) for v in b.xyxy[0]]
                cls_name = model.names[int(b.cls[0])]
                zone = zone_of((x1 + x2) / 2, width, hfov)
                dist, source = distance_for((x1, y1, x2, y2), cls_name, width, hfov, meta)
                if dist is None:
                    continue
                dist = clamp(dist)
                nearest[zone] = min(nearest[zone], dist)
                detections.append({
                    "class": cls_name,
                    "confidence": round(float(b.conf[0]), 2),
                    "zone": zone,
                    "bbox": [round(x1), round(y1), round(x2), round(y2)],
                    "distance_m": dist,
                    "distance_source": source,
                })

            smoothed = {}
            for zone in nearest:
                history[zone].append(nearest[zone])
                smoothed[zone] = clamp(statistics.median(history[zone]))

            # 1) Strict payload the ESP32 reads
            client.publish(TOPIC_DIST, json.dumps(smoothed), qos=0)

            # 2) Rich payload for analysis
            client.publish(TOPIC_DET, json.dumps({
                "frame_id": meta.get("frame_id"),
                "image": path.name,
                "timestamp": meta.get("timestamp", time.time()),
                "latency_ms": round((time.time() - start) * 1000),
                "detections": detections,
                "zones": smoothed,
                "ground_truth": ground_truth_zones(meta, hfov),
            }))

            if annotate_dir:
                write_image(annotate_dir / path.name, result.plot())

            print(f"{path.name}: {smoothed} ({len(detections)} detections)")

            time.sleep(max(0, 1 / args.fps - (time.time() - start)))

        if args.once:
            break

    client.loop_stop()
    client.disconnect()


if __name__ == "__main__":
    main()