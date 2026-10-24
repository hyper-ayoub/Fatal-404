# Verification – 24 October 2026

Completed in the development workspace:

- `npm install`: installed the Node dependencies and generated `package-lock.json`; audit reported zero vulnerabilities at installation time.
- `npm test`: all 9 tests passed, including the local telemetry/WebSocket/demo-answer flow, synchronized image/metric transport, collision handling and expiry.
- `npm run check`: backend and frontend JavaScript syntax checks passed.
- Parsed `vision/detect.py` with Python's AST parser and `firmware/wokwi/diagram.json` with its JSON parser successfully.
- Opened the lab in a browser, selected Close obstacle, observed 0.40 m center and the danger warning, submitted a question and observed a clearly labeled scripted response grounded in that reading.
- Inspected the rendered 3D scene and saved `docs/images/lab-preview.png`.
- Initialized local Git with branch `main`; `.env` and installed dependencies are ignored.

Environment Studio upgrade verified:

- Loaded local Kenney models and the referenced palette texture, inspected the colored neighborhood and simultaneous first-person panel.
- Observed camera publication around 5 Hz after batching static geometry and caching shadow maps.
- Held the walking key in the browser: position changed from (5.70, 14.00) to (5.70, 11.76), stopping at the crate; center range changed from 2.50 m to about 0.26 m and triggered danger.
- Used the standard-library consumer to save three consecutive frame/metric pairs from the running browser. Decoded a JPEG with Pillow: 640×360, valid color image with nonconstant pixels.
- Camera routes, matching frame IDs, image byte transport and malformed/out-of-order rejection are covered by the pipeline and frame tests.
- Opened the live MJPEG endpoint and verified its multipart JPEG header; live camera and sensor frame IDs matched in `/api/observation`.
- Saved updated screenshots as `docs/images/environment-studio.png` and `docs/images/camera-and-sensors.png`.

Live MQTT upgrade verified:

- Connected to the actual HiveMQ public broker at `broker.hivemq.com:1883`.
- An independent subscriber received 8 non-retained messages spanning simulator telemetry, observations, camera frames and haptic commands.
- Confirmed the camera payload contained 22,567 JPEG bytes and shared the frame ID of the corresponding sensor observation.
- All 9 automated tests and JavaScript syntax checks still passed after integrating the MQTT bridge.

Not verified in this workspace: Arduino compilation, a running Wokwi project, a physical ESP32/servo, webcam inference/model download, real Gemma credentials and quota, ElevenLabs playback, microphone dictation, Docker build, or remote hosting. Source code and setup guides are included for these integrations; they are not represented as tested external services.

Python voice-assistant upgrade verified:

- Installed the lean Python runtime in the Git-ignored `.venv-assistant` and started FastAPI on 127.0.0.1:8000, alongside the existing simulator on port 3000.
- Python connected to the actual HiveMQ camera topic and received simulator frames; `/api/assistant/config` exposes readiness without provider secrets.
- A live typed request through the Node proxy returned `ack`, `analyzing`, `answer` in that order. It reported its exact image frame ID and matched range readings. The browser displayed the same Python demo answer and frame reference.
- All 9 Python tests passed. They verify acknowledgment timing, cancellation cleanup, actual-image inclusion in the provider request, stale-frame handling, MQTT fallback, provider errors and speech adapter transport using mocked providers.
- All 9 Node tests and JavaScript syntax checks passed. The proxy test proved acknowledgment bytes arrive while answer generation is still blocked.
- Microphone recording and live paid providers were not exercised because device permissions and real API keys were not supplied. Browser testing used a typed request with spoken replies temporarily disabled, then restored that setting.

Gemma key and request fix verified after keys were supplied:

- Google accepted the updated key and listed the configured `gemma-4-26b-a4b-it` model.
- The earlier full prompt repeatedly reached the 25-second inference timeout. A concise image request succeeded, so the adapter now sends shorter rules and only relevant range/source context instead of internal transport metadata.
- A live multimodal call through the updated Python adapter returned an actual scene description in approximately 1.8 seconds.
- Added a bounded retry for transient provider errors and redacted provider error details. All 10 Python tests passed, including retry and secret-redaction coverage.

![Local browser preview](images/lab-preview.png)

## Spatial Studio upgrade — 24 October 2026

- All 12 Node tests and 11 Python tests passed, including independent left/right temple mapping, stale-data silence, camera ownership and voice-specific preview caching. JavaScript syntax checks passed.
- Browser checks confirmed the textured neighborhood, complete responsive first-person frame, independent left pulse, right pulse, and both strong pulses for a close center obstacle.
- A second simulator session was observed overwriting live frames. The focused studio now claims ownership; subsequent sampled frames all came from its session with the expected right-side warning.
- A real ElevenLabs request using the new Sarah preset returned an 80,292-byte MP3, saved at `audio/sarah-preview.mp3`. Audio generation was verified; subjective listening quality and microphone capture were not assessed.
- The running servers use the new root environment voice settings. Existing physical firmware remains a single-servo prototype; bilateral vibration is visualized and exposed as MQTT fields.
- A live Gemma turn against the upgraded scene returned: "Caution. An obstacle is 1.03 metres to your right. Ahead is a street with a crosswalk, buildings, and a car in the distance." The UI reported matched frame 68 via HTTP.
- Final browser check: touch Walk forward moved the pose from 5.70, 14.00 to 5.70, 13.56 m; Golden hour changed successfully. A close center obstacle produced 0.46 / 0.40 / 0.46 m readings and both strong temple pulses. The live camera reported approximately 4.2-4.7 fps in that check. No browser console errors were reported.

## Immersive mode verification

- JavaScript syntax checks and all 12 Node tests passed, including the updated rule preventing incidental focus events from displacing a fresh camera session.
- Browser checks confirmed native full screen, the viewport layout, live first-person frames, corner world view with Perspective/Map toggle, independent haptic indicators and the nearby existing assistant controls.
- Touch Walk left moved x from 5.70 to 5.26 m. Escape and the Exit button restored all panels and controls to the studio. The full-screen canvas uses 960 x 540 in balanced mode and returns to 640 x 360 after exit; the exported image remains 640 x 360 throughout.
- Typed assistant requests from the full-screen panel received acknowledgment and matched live frame context. The external Gemma provider timed out on one test and returned HTTP 500 on the retry; successful scene inference was not verified in this turn. Microphone permission was not requested during testing. Speak replies was restored afterward.
