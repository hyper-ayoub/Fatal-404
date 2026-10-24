# 08 — Consume real-time images and obstacle metrics

The simulator renders two simultaneous views. The overview is for the operator; the first-person panel is the glasses camera. The exported camera image contains only the first-person world, without UI overlays, survey avatar or sensor rays. It is **synthetic rendered RGB**, not physical webcam footage.

## Walk and look

- W/A/S/D or arrow keys: move; Q/E: turn; hold Shift: run.
- Drag in the first-person panel: change yaw and pitch. Enter walk mode captures the mouse when supported; Esc releases it. Dragging works when mouse capture is unavailable.
- Drag in the overview: orbit. Scroll: zoom. Top view gives a survey perspective.
- On-screen arrow and turn buttons work with mouse, keyboard or touch. Hold them for continuous movement.
- Reset walk restores the start; the three scenarios position the test crate. Walls, buildings, tree trunks and street furniture have horizontal collision footprints.

## Data endpoints

All examples assume `http://127.0.0.1:3000`.

1. **`GET /api/camera/latest.jpg`**: latest fresh JPEG, 640×360. Headers include `X-Frame-Id`, `X-Session-Id`, `X-Captured-At` and `X-Received-At`. No caching.
2. **`GET /api/camera/stream.mjpg`**: multipart MJPEG stream. Each part has its frame ID. Suitable for an `<img>` element, VLC or an OpenCV network capture; use the JSON endpoint when exact sensor pairing matters.
3. **`GET /api/camera/frame`**: a single atomic JSON bundle with base64 JPEG, matching range readings, pose, session ID and frame ID. Prefer this for AI and data-processing components.
4. **`GET /api/observation`**: selected sensor state, haptic warning, recent detections and simulator camera metadata. Selecting Wokwi changes the sensor source here, while the camera remains the simulator camera. Use the camera bundle for matched simulator measurements.
5. **`WS /ws`**: live metadata and warning updates, without image bytes, at up to 10 Hz.

`/api/camera/frame` shape:

```json
{
  "source": "simulator",
  "sessionId": "browser-session-uuid",
  "frameId": 42,
  "capturedAt": 1792843200000,
  "receivedAt": 1792843200020,
  "width": 640,
  "height": 360,
  "pose": {"x": 5.7, "y": 1.72, "z": 14, "yaw": 0, "pitch": 0},
  "distances": {"left": null, "center": 2.5, "right": null},
  "kind": "rendered-simulator-camera",
  "imageUrl": "/api/camera/latest.jpg",
  "streamUrl": "/api/camera/stream.mjpg",
  "image": "BASE64_JPEG_BYTES"
}
```

Distances are metres along horizontal rays at height 1.25 m, with an 8 m limit. `null` means no return within range. Yaw and pitch are radians, and the world uses +Y up. At yaw zero, the camera looks toward −Z; +yaw turns left. The camera sits at 1.72 m; its pitch does not tilt the horizontal sensor array. Capture and receipt timestamps are Unix milliseconds. A frame ID is unique only together with its browser session ID.

Each upload pairs rendered pixels and the ray measurements from the same animation tick. The server accepts them atomically; out-of-order frames in one session are rejected. Publication targets 5 Hz and depends on hardware/network speed. Rendering runs independently at the browser's available frame rate. Keep one simulator tab open and visible: background tabs can be throttled. Frames expire after 2.5 seconds; JPEG/JSON return 404 when stale. The MJPEG connection waits for fresh frames rather than replaying old frames. Pixel buffers remain only in memory and are not recorded by default.

## Python integration without extra dependencies

```powershell
python examples/consume_simulator.py --count 5 --output observations
```

This saves paired `.jpg` and `.json` files with the same session/frame name. See `examples/consume_simulator.py` for a reusable read/decode pattern. The data directory is Git-ignored.

For YOLO detection from the rendered camera:

```powershell
.\.venv\Scripts\python.exe vision/detect.py --source simulator
```

The worker polls `/api/camera/frame`, decodes its JPEG and posts detections with `cameraSource=simulator`, the originating frame reference and capture time. Those labels remain distinct from range measurements. Old inference results are excluded from assistant state once their capture time is stale. A model trained on photographs may perform poorly on stylized game assets; no ground-truth scene labels are passed off as model detections.

To inspect the stream with OpenCV directly:

```python
capture = cv2.VideoCapture('http://127.0.0.1:3000/api/camera/stream.mjpg')
ok, image = capture.read()
```

For an image-aware model, pass the decoded JPEG to its supported image-input API and use `distances` as the range context. The current Gemma adapter still uses structured labels and metrics; adding a frame source does not silently change that adapter into a multimodal integration.
