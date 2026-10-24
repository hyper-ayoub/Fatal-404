# OpenPilot Glasses

An assistive-glasses hackathon prototype built from the **Hackathon Ideas Generation** conversation: simulate embedded sensors in Wokwi, detect objects with a webcam, answer environment questions using Gemma 4, and demonstrate the complete pipeline in a browser-based 3D lab.

## Start here

Install **Node.js 22 or newer**, open a terminal in this folder, then run:

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

Open **http://127.0.0.1:3000**. No account, Python, broker or API key is needed for the default simulator. Choose **Close obstacle**, watch the distances and haptic indicator, then ask a question. Default answers are explicitly **scripted demo responses**. To use actual Gemma, follow step 05.

## Implement step by step

1. [00 — Scope, architecture and responsibilities](docs/00-architecture.md)
2. [01 — Install and run the local baseline](docs/01-local-setup.md)
3. [02 — 3D environment, distance rays and warning policy](docs/02-simulator.md)
4. [03 — ESP32 sensors, servo and Wokwi MQTT bridge](docs/03-wokwi.md)
5. [04 — Real webcam object detection](docs/04-vision.md)
6. [05 — Gemma questions and voice responses](docs/05-gemma-and-voice.md)
7. [06 — Tests, deployment and troubleshooting](docs/06-testing-and-deployment.md)
8. [07 — Final demonstration script](docs/07-demo.md)

Each guide identifies the exact source files and a checkpoint. These are sequential milestones in one integrated codebase, rather than copies of the same project.

## Repository map

```text
backend/
  policy.js           Telemetry validation, freshness, proximity thresholds
  server.js           HTTP API, live WebSocket state, MQTT bridge, speech proxy
  assistant.js        Scripted demo or real Gemma 4 API adapter
frontend/
  index.html          Accessible controls and lab layout
  style.css           Responsive visual design
  app.js              Three.js world, ray distances, live state and voice UI
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

- Local 3D scene, first-person view, movement, scenario presets and three ray measurements.
- Server-owned sensor validation, active-source selection, 2.5-second freshness and deterministic warnings.
- Browser WebSocket telemetry and optional spoken warnings / microphone dictation.
- ESP32 firmware with local servo feedback even when the backend is disconnected.
- MQTT transport connecting Wokwi's internet access to the laptop backend.
- Optional real webcam labels using **YOLO11n (`yolo11n.pt`)**. No camera depth is claimed.
- Real Gemma API adapter, default model **`gemma-4-26b-a4b-it`**, plus optional ElevenLabs output.

## Prototype boundaries

The 3D world and Wokwi are separate sensor producers. Selecting Wokwi does not automatically move Wokwi's distance sliders to match the 3D scene. No simulator image is sent through YOLO: the optional detector uses a real webcam or video file. Gemma receives fresh structured measurements and detection labels, not raw images. Monocular object labels cannot determine the distance of far obstacles; that would require calibrated depth/stereo or another range sensor. Movement in the visual simulator is free exploration, without collision prevention. Public MQTT is for non-sensitive demo values only. This is not a certified mobility aid and has not been validated for real navigation.

## Open-source and model attribution

Project source is licensed **AGPL-3.0-only**; see [LICENSE](LICENSE). The optional Ultralytics dependency and YOLO weights have their own [licensing terms](https://docs.ultralytics.com/license/). Gemma weights are governed by [Gemma terms](https://ai.google.dev/gemma/terms); using the hosted API also requires the provider's service terms. Do not redistribute weights or credentials accidentally. Dependency metadata is in `package-lock.json` and `vision/requirements.txt`.

## Reference documentation

- [Gemma through Gemini API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
- [Wokwi ESP32 networking](https://docs.wokwi.com/guides/esp32-wifi)
- [Wokwi ultrasonic sensor](https://docs.wokwi.com/parts/wokwi-hc-sr04)
- [Ultralytics prediction API](https://docs.ultralytics.com/modes/predict/)
- [ElevenLabs text to speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)

This folder is a local Git repository. Publishing to GitHub and obtaining a public submission link remain separate account actions.
