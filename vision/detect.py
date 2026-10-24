"""Optional webcam -> YOLO -> backend worker. No metric depth is inferred."""
import argparse
import json
import time
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='0', help='Camera index or video file')
    parser.add_argument('--backend', default='http://127.0.0.1:3000')
    parser.add_argument('--model', default='yolo11n.pt', help='Downloads weights on first run')
    parser.add_argument('--confidence', type=float, default=0.45)
    parser.add_argument('--headless', action='store_true')
    args = parser.parse_args()
    import cv2
    from ultralytics import YOLO
    model = YOLO(args.model)
    source = int(args.source) if args.source.isdigit() else args.source
    capture = cv2.VideoCapture(source)
    if not capture.isOpened():
        raise SystemExit('Cannot open webcam/video. Check permissions or --source.')
    last_publish = 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            result = model.predict(frame, conf=args.confidence, imgsz=640, verbose=False)[0]
            detections = []
            for box in result.boxes:
                x1, _, x2, _ = box.xyxy[0].tolist()
                center = (x1 + x2) / 2 / frame.shape[1]
                direction = 'left' if center < 1/3 else 'right' if center > 2/3 else 'center'
                detections.append({'label': result.names[int(box.cls[0])],
                                   'confidence': float(box.conf[0]), 'direction': direction})
            if time.monotonic() - last_publish >= 0.2:
                payload = json.dumps({'source': 'vision', 'detections': detections[:100]}).encode()
                request = urllib.request.Request(args.backend.rstrip('/') + '/api/telemetry', payload,
                                                 {'Content-Type': 'application/json'}, method='POST')
                try:
                    with urllib.request.urlopen(request, timeout=2) as response:
                        response.read()
                except (urllib.error.URLError, TimeoutError) as error:
                    print('Backend unavailable:', error)
                last_publish = time.monotonic()
            if not args.headless:
                cv2.imshow('OpenPilot camera - Q to quit', result.plot())
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
    finally:
        capture.release()
        cv2.destroyAllWindows()


if __name__ == '__main__':
    main()
