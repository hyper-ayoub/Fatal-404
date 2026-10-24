# SensePath Glasses

An assistive-glasses hackathon prototype built from the **Hackathon Ideas Generation** conversation: simulate embedded sensors in Wokwi, detect objects with a webcam, answer environment questions using Gemma 4, and demonstrate the complete pipeline in a browser-based 3D lab.

## Start here

Install **Node.js 22 or newer**, open a terminal in this folder, then run:

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

Open **http://127.0.0.1:3000**. No account, Python, broker or API key is needed for the simulator itself. Choose **Close obstacle** and watch the distances and haptic indicator. For the new voice assistant, install the Python service using [step 10](docs/10-voice-assistant.md), then run `npm run start:all` instead of `npm start`. It immediately acknowledges requests, analyzes the actual image and matched sensor readings with Gemma when a key is configured, and speaks through ElevenLabs or browser speech. Without keys, its replies are visibly labeled demo responses.

## Implement step by step

1. [00 — Scope, architecture and responsibilities](docs/00-architecture.md)
2. [01 — Install and run the local baseline](docs/01-local-setup.md)
3. [02 — 3D environment, distance rays and warning policy](docs/02-simulator.md)
4. [03 — ESP32 sensors, servo and Wokwi MQTT bridge](docs/03-wokwi.md)
5. [04 — Real webcam object detection](docs/04-vision.md)
6. [05 — Gemma questions and voice responses](docs/05-gemma-and-voice.md)
7. [06 — Tests, deployment and troubleshooting](docs/06-testing-and-deployment.md)
8. [07 — Final demonstration script](docs/07-demo.md)
9. [08 — Consume real-time camera frames and sensor measurements](docs/08-camera-integration.md)
10. [09 — Connect the simulator to a real MQTT broker](docs/09-live-mqtt.md)
11. [10 — Python voice assistant: acknowledgment, image analysis and spoken descriptions](docs/10-voice-assistant.md)

Each guide identifies the exact source files and a checkpoint. These are sequential milestones in one integrated codebase, rather than copies of the same project.

## Repository map

```text
backend/
  policy.js           Telemetry validation, freshness, proximity thresholds
  server.js           HTTP API, live WebSocket state, MQTT bridge, speech proxy
  assistant.js        Legacy Node text-only adapter (compatibility)
  main.py             New Python multimodal voice-assistant API
  services/           Scene snapshots, MQTT input, Gemma vision and ElevenLabs
  legacy/             Preserved local-model / hosted-agent prototypes
frontend/
  index.html          Accessible controls and lab layout
  style.css           Responsive visual design
  app.js              Live state, assistant and voice UI
  simulator.js        Walking, dual cameras and synchronized image capture
  world.js            Kenney neighborhood, lighting, props and raycast geometry
  movement.js         Collision-aware walking
  voice-assistant.js  Conversational listening, streamed turns and speech playback
  assets/kenney/      Local CC0 models, texture palette and original license
firmware/wokwi/
  sketch.ino          ESP32 sensor reads, local haptics, MQTT integration
  diagram.json        Three ultrasonic sensors and a servo wired to ESP32
  libraries.txt       Arduino libraries for Wokwi
vision/
  detect.py           Optional local YOLO webcam worker
  requirements.txt    Python dependencies
tests/                Built-in Node policy and pipeline tests
docs/                 Numbered implementation guides
Dockerfile            Optional container deployment
render.yaml           Optional Render service blueprint
```

## What is implemented

- Walkable neighborhood with Kenney CC0 houses and trees, street furniture, shadows and collision-aware movement.
- Simultaneous overview and first-person camera panels, mouse look, keyboard/touch walking and scenario presets.
- Live 640×360 JPEG and MJPEG camera feeds, with synchronized frame IDs, timestamps, pose and three range measurements.
- Server-owned sensor validation, active-source selection, 2.5-second freshness and deterministic warnings.
- Browser WebSocket telemetry and optional spoken warnings / microphone dictation.
- ESP32 firmware with local servo feedback even when the backend is disconnected.
- MQTT transport connecting Wokwi's internet access to the laptop backend.
- Optional **YOLO11n (`yolo11n.pt`)** detection from the simulator, webcam or a video. No camera depth is claimed.
- Real Gemma API adapter, default model **`gemma-4-26b-a4b-it`**, plus optional ElevenLabs output.

## Prototype boundaries

The 3D world and Wokwi are separate sensor producers. Selecting Wokwi does not automatically move Wokwi's distance sliders to match the scene. The simulator produces rendered images, not real camera footage. Its images and sensor rays can be consumed through the [camera integration API](docs/08-camera-integration.md); run the detector with `--source simulator` to process them. The new Python Gemma adapter receives the actual JPEG and sensor context; the retained Node adapter is text-only. Monocular labels do not measure metric distance. Walking uses horizontal footprint collisions and does not model stairs, physics or ultrasonic noise. Public MQTT is for non-sensitive demo values only. This prototype has not been validated for real navigation.

## Live camera and measurements

- [Latest JPEG](http://127.0.0.1:3000/api/camera/latest.jpg)
- [MJPEG video stream](http://127.0.0.1:3000/api/camera/stream.mjpg)
- [Synchronized image and metrics as JSON](http://127.0.0.1:3000/api/camera/frame)
- [Complete backend observation](http://127.0.0.1:3000/api/observation)
- [Live MQTT connection and topic names](http://127.0.0.1:3000/api/mqtt)

See [08 — Consume images and sensor metrics](docs/08-camera-integration.md) for payloads and a Python example. Keep the simulator tab open and visible to produce frames.

The simulator can also publish through an actual MQTT broker: sensor/pose messages at up to 5 Hz and optional rendered JPEG bundles at 1 Hz. Run `npm run mqtt:monitor` to subscribe using your `.env` settings. See [09 — Live MQTT](docs/09-live-mqtt.md) for topics and verification.

## Open-source and model attribution

Project source is licensed **AGPL-3.0-only**; see [LICENSE](LICENSE). Neighborhood models are from [Kenney City Kit Suburban](https://kenney.nl/assets/city-kit-suburban), licensed **CC0**, with their original license and [asset attribution](frontend/assets/ATTRIBUTION.md) included. The optional Ultralytics dependency and YOLO weights have their own [licensing terms](https://docs.ultralytics.com/license/). Gemma weights are governed by [Gemma terms](https://ai.google.dev/gemma/terms); using the hosted API also requires the provider's service terms. Do not redistribute weights or credentials accidentally. Dependency metadata is in `package-lock.json` and `vision/requirements.txt`.

## Reference documentation

- [Gemma through Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
- [Wokwi ESP32 networking](https://docs.wokwi.com/guides/esp32-wifi)
- [Wokwi ultrasonic sensor](https://docs.wokwi.com/parts/wokwi-hc-sr04)
- [Ultralytics prediction API](https://docs.ultralytics.com/modes/predict/)
- [ElevenLabs text to speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)

This folder is a local Git repository. Publishing to GitHub and obtaining a public submission link remain separate account actions.

## Spatial Studio

The upgraded walkable neighborhood, independent 3D temple haptics and conversational voice presets are documented in [Spatial Studio](docs/11-spatial-studio.md).
