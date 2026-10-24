# 06 — Tests, deployment and troubleshooting

## Local checks

```powershell
npm test
npm run check
```

Policy tests cover thresholds, missing/stale sensor data, source separation and malformed input. Pipeline tests start a separate server on an available port and verify telemetry ingestion, WebSocket broadcasts, demo answers, source switching, expiry and private-file isolation. They do not consume API credits.

Manual checks still required on your hardware/accounts: Wokwi compilation and MQTT round trip, physical camera throughput, live Gemini key/model access, microphone permissions, speech playback and optional ElevenLabs. The UI handles unsupported WebGL by displaying an error. A disconnected UI clears sensor readouts.

## API reference

- `GET /api/state`: current selected sensor snapshot, recent vision observations, warning, broker state and AI mode.
- `POST /api/telemetry`: structured `simulator`, `wokwi` or `vision` observations.
- `POST /api/source`: `{"source":"wokwi"}` or `{"source":"simulator"}`.
- `POST /api/ask`: `{"question":"What is ahead?"}`; response includes `mode`, `model` and `text`.
- `POST /api/speech`: `{"text":"Obstacle ahead."}`; configured ElevenLabs audio response.
- `WS /ws`: broadcasts current state every 100 ms.

Vision payload example:

```json
{"source":"vision","detections":[{"label":"chair","confidence":0.93,"direction":"center"}]}
```

## Container

```powershell
docker build -t openpilot-glasses .
docker run --rm -p 3000:3000 --env-file .env -e HOST=0.0.0.0 openpilot-glasses
```

The container hosts the Node service and frontend; it does not run your camera worker or Wokwi. A local camera worker can post to the mapped port. On a remote host, set `--backend` to that service's URL.

## Render or another hosting provider

`render.yaml` is an optional blueprint for a single Node service, not a deployment already performed. Set keys as provider secrets, use one instance, and set MQTT session to match firmware. The server listens on the provider's PORT and `HOST=0.0.0.0`. Ephemeral memory holds current readings; a restart resets them. Run the camera worker on the laptop and point it to the hosted backend.

The application is a local hackathon baseline with **no user authentication**. Remote users could inject telemetry or trigger paid API calls. Add authentication to HTTP and WebSocket connections, access control, quotas and a private broker before exposing a credit-backed instance publicly. The included origin check prevents ordinary cross-origin browser writes but does not authenticate direct HTTP clients. Use local presentation mode unless your team adds those controls.

## Troubleshooting

- **Page loads but no scene:** check WebGL support and browser console, and ensure `npm ci` completed.
- **Unknown after selecting Wokwi:** verify both sessions and broker hosts match, restart after `.env` edits, start Wokwi, inspect serial logs, and check network access to broker port 1883.
- **MQTT disconnected in simulator mode:** expected when MQTT is disabled; the simulator does not require it.
- **API 502:** read the visible error. Check key, model access and quota; the provider call has a 25-second timeout.
- **No camera labels:** ensure the worker is running, webcam opened and inference produces detections within the freshness window.
- **Conflicting distances:** keep one simulator tab open and select the intended sensor producer.
- **Spoken answers unavailable:** enable local OS speech voices or configure ElevenLabs. Dictation support varies by browser.

## Git and submission

The local repository is initialized, and dependencies/secrets are ignored. Before publishing, review the files and add your team's names and event submission details to the README. For a new GitHub repository, create an empty repository in your account and then use its exact remote URL:

```powershell
git add .
git commit -m "Build OpenPilot assistive glasses prototype"
git remote add origin YOUR_REPOSITORY_URL
git push -u origin main
```

No hosted repository, paid service or deployment is created by the local setup.
