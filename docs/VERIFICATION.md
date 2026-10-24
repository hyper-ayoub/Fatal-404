# Verification — 24 October 2026

Completed in the development workspace:

- `npm install`: installed the Node dependencies and generated `package-lock.json`; audit reported zero vulnerabilities at installation time.
- `npm test`: all 6 tests passed, including the complete local telemetry/WebSocket/demo-answer flow and sensor expiry.
- `npm run check`: backend and frontend JavaScript syntax checks passed.
- Parsed `vision/detect.py` with Python's AST parser and `firmware/wokwi/diagram.json` with its JSON parser successfully.
- Opened the lab in a browser, selected Close obstacle, observed 0.40 m center and the danger warning, submitted a question and observed a clearly labeled scripted response grounded in that reading.
- Inspected the rendered 3D scene and saved `docs/images/lab-preview.png`.
- Initialized local Git with branch `main`; `.env` and installed dependencies are ignored.

Not verified in this workspace: Arduino compilation, a running Wokwi project, live MQTT round trip, webcam inference/model download, real Gemma credentials and quota, ElevenLabs playback, microphone dictation, Docker build, or remote hosting. Source code and setup guides are included for these integrations; they are not represented as tested external services.

![Local browser preview](images/lab-preview.png)
