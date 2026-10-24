"""Optional webcam -> YOLO -> backend worker. No metric depth is inferred."""
import argparse
import base64
import json
import time
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='0', help='Camera index, video file, or simulator')
    parser.add_argument('--backend', default='http://127.0.0.1:3000')
    parser.add_argument('--model', default='yolo11n.pt', help='Downloads weights on first run')
    parser.add_argument('--confidence', type=float, default=0.45)
    parser.add_argument('--headless', action='store_true')
    args = parser.parse_args()
    import cv2
    from ultralytics import YOLO
    model = YOLO(args.model)
    source = int(args.source) if args.source.isdigit() else args.source
    simulated = args.source == 'simulator'
    capture = None if simulated else cv2.VideoCapture(source)
    if capture is not None and not capture.isOpened():
        raise SystemExit('Cannot open webcam/video. Check permissions or --source.')
    last_publish = 0
    last_frame = None
    try:
        while True:
            if simulated:
                try:
                    with urllib.request.urlopen(args.backend.rstrip('/') + '/api/camera/frame', timeout=3) as response:
                        observation = json.load(response)
                    identity = (observation['sessionId'], observation['frameId'])
                    if identity == last_frame:
                        time.sleep(0.05)
                        continue
                    last_frame = identity
                    import numpy as np
                    frame = cv2.imdecode(np.frombuffer(base64.b64decode(observation['image']), dtype=np.uint8), cv2.IMREAD_COLOR)
                    if frame is None:
                        continue
                except (urllib.error.URLError, TimeoutError, ValueError) as error:
                    print('Waiting for simulator camera:', error)
                    time.sleep(0.5)
                    continue
            else:
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
                message = {'source': 'vision', 'detections': detections[:100],
                           'cameraSource': 'simulator' if simulated else 'webcam' if isinstance(source, int) else 'video'}
                if simulated:
                    message['frameRef'] = {'sessionId': observation['sessionId'], 'frameId': observation['frameId']}
                    message['capturedAt'] = observation['capturedAt']
                payload = json.dumps(message).encode()
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
        if capture is not None:
            capture.release()
        cv2.destroyAllWindows()


if __name__ == '__main__':
    main()
