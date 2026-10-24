"""Extract frames from a walking video (egocentric footage works best).

Usage:
    python video_to_frames.py walk.mp4
    python video_to_frames.py walk.mp4 --every 6 --max 300
"""
import argparse
from pathlib import Path

import cv2


def write_jpg(path, image):
    ok, buf = cv2.imencode(".jpg", image)
    if ok:
        buf.tofile(str(path))


def extract(video, out="downloaded_dataset/images", every=6, max_frames=300):
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise SystemExit(f"Cannot open video: {video}")

    index = saved = 0
    while saved < max_frames:
        ok, frame = cap.read()
        if not ok:
            break
        if index % every == 0:
            frame = cv2.resize(frame, (640, int(frame.shape[0] * 640 / frame.shape[1])))
            write_jpg(out_dir / f"frame_{saved:06d}.jpg", frame)
            saved += 1
        index += 1

    cap.release()
    print(f"Saved {saved} frames to {out_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--out", default="downloaded_dataset/images")
    parser.add_argument("--every", type=int, default=6, help="keep every Nth frame")
    parser.add_argument("--max", type=int, default=300)
    args = parser.parse_args()

    extract(args.video, args.out, args.every, args.max)