# 04 — Real object detection

**Source:** `vision/detect.py`, `vision/requirements.txt`.

This optional worker reads a local webcam or video, uses YOLO11n to detect objects, and posts label/confidence/direction to the Node backend. Frames stay in the local worker and preview window. Gemma receives labels only. Labels can describe objects farther away when visible, but cannot establish their metric distance.

With Python 3.11 or 3.12 installed, open a second terminal in the repository:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r vision/requirements.txt
.\.venv\Scripts\python.exe vision/detect.py
```

Use your installed Python version if 3.12 is unavailable. PyTorch/Ultralytics may download substantial dependencies. First execution also downloads `yolo11n.pt`; prepare this before presenting. Weights are excluded from Git. Pin a resolved Python environment for long-term reproduction after verifying it on your hardware; the supplied file constrains compatible major versions but is not a Python lockfile.

Options:

```powershell
.\.venv\Scripts\python.exe vision/detect.py --source 1
.\.venv\Scripts\python.exe vision/detect.py --source simulator
.\.venv\Scripts\python.exe vision/detect.py --source sample.mp4 --headless
.\.venv\Scripts\python.exe vision/detect.py --backend http://127.0.0.1:3001 --confidence 0.55
```

Use Q in the camera preview to stop, or Ctrl+C for headless mode. Camera indices depend on your device. Give Python camera permission and close applications that hold exclusive camera access. The model is configurable using `--model`, but changing the model also changes attribution and performance requirements.

Use `--source simulator` to process the first-person camera from the browser environment; keep its tab visible. This uses the synchronized JSON camera bundle described in [step 08](08-camera-integration.md). Simulated detections include the originating frame ID and capture time. The horizontal midpoint of the detection box determines left/center/right in the image. These directions are independent of the three sensor rays. Camera labels and distance readings are not matched into a single tracked object. Observations expire after 2.5 seconds, so slow inference can produce intermittent unknown camera state. YOLO's photo-trained categories may not reliably recognize stylized scene models.

**Checkpoint:** hold a recognizable object in front of the webcam and observe its label under Camera in the lab. Stop the worker; the label must disappear after expiry.
