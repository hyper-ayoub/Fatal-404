# 10 — Python multimodal voice assistant

The new Python backend owns the voice assistant. Node continues to serve the 3D studio, live sensor policy and MQTT bridge. Same-origin browser requests under `/api/assistant/` are streamed to Python on port 8000.

## Conversation flow

1. Click **Start voice conversation** and allow microphone access in your browser.
2. Say “What is in front of me?” or another request.
3. As soon as the utterance is recognized, Python emits **“Okay, I'll assist you with that.”** The acknowledgment can play while analysis runs.
4. Python obtains one fresh rendered JPEG and its matching range readings. If Wokwi is selected, it distinguishes those readings from the simulated camera.
5. In live mode, Gemma receives the **actual image**, range measurements, deterministic warning and recent conversation text. It returns a brief description, normally no more than two sentences.
6. The UI displays the description and plays streamed ElevenLabs speech, then listens again. **Stop** cancels the current microphone, request and playback. **Mic** captures one request. Typed questions use the same acknowledgment/analysis flow.

This is a turn-based conversational interface with an early acknowledgment and streamed speech. It is not the OpenAI Realtime API or a full-duplex audio model. Recognition pauses during replies to avoid transcribing the assistant's own speech. Stop or Mic can interrupt a turn.

## Install and run

From the repository root, using Python 3.11+:

```powershell
py -3.12 -m venv .venv-assistant
.\.venv-assistant\Scripts\python.exe -m pip install -r backend/requirements.txt
npm run start:all
```

Stop older servers on ports 3000/8000 before starting the pair. If the studio is already running, use `npm run assistant` to start only Python. The launcher selects `.venv-assistant/Scripts/python.exe` on Windows or `.venv-assistant/bin/python` on Unix; `ASSISTANT_PYTHON` overrides it. Direct invocation:

```powershell
.\.venv-assistant\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Use the lean `backend/requirements.txt`, not the older full environment export at `backend/services/requirements.txt`. `backend/requirements-lock.txt` records the verified environment, including test dependencies. The API-based assistant needs no GPU, local Gemma weights, Torch or ElevenLabs hosted agent ID.

## Add your keys later

Edit **the repository-root `.env`**, preserving existing MQTT settings:

```dotenv
ASSISTANT_MODE=auto
GEMMA_API_KEY=your-real-gemini-api-key
GEMMA_MODEL=gemma-4-26b-a4b-it
ELEVENLABS_API_KEY=your-real-elevenlabs-api-key
# Optional voice override; the API example voice is used by default
ELEVENLABS_VOICE_ID=
ELEVENLABS_TTS_MODEL=eleven_flash_v2_5
ELEVENLABS_STT_MODEL=scribe_v2
PYTHON_ASSISTANT_URL=http://127.0.0.1:8000
STUDIO_URL=http://127.0.0.1:3000
```

`GEMINI_API_KEY` is also accepted; either Gemma key name is sufficient. Restart Python after editing keys and refresh the page to reload its capability flags. `ASSISTANT_MODE=auto` uses a visibly labeled demo without a Gemma key, and actual Gemma when a key is present. `ASSISTANT_MODE=gemma` reports missing/invalid provider access without silently substituting demo output. `ASSISTANT_MODE=demo` deliberately avoids model calls.

ElevenLabs defaults to `JBFqnCBsd6RMkjVDRZzb`, the voice ID shown in its API examples. Override it if your account uses another voice. A voice failure is reported and falls back to browser speech. Without an ElevenLabs key, browser speech handles acknowledgment and descriptions. Keys remain server-side.

## Microphone and playback

**Automatic microphone** uses browser speech recognition where available, submitting its transcript automatically. Browser support and recognition services vary by platform.

Choose **ElevenLabs transcription** to record an utterance with `MediaRecorder`. A short silence ends recording; Python sends it to Scribe, then runs the Gemma flow. This requires an ElevenLabs key but not a voice ID. Recordings are limited to 15 seconds / 5 MB. Use localhost or HTTPS and normal browser microphone permissions. Typing remains available when speech recognition is unsupported.

**Speak replies** controls acknowledgment and description audio; uncheck it for silent tests. **Read answer** replays the last description. Spoken obstacle warnings pause during an active voice turn, while visual/haptic warnings continue independently.

## Camera and MQTT integration

Python subscribes to the real broker's `openpilot/<MQTT_SESSION>/simulator/camera/frame` topic. The scene store rejects retained, duplicate, malformed and stale frames. It prefers the fresher local HTTP image when available, with fresh MQTT camera data as an independent fallback. Each image carries its matching frame ID and range readings.

The answer describes one captured snapshot. It does not establish a continuously safe walking route. Camera labels do not supply metric depth, and generated prose does not replace the haptic policy.

## Routes

- `GET /api/assistant/config`: mode, readiness and MQTT status, without secrets.
- `POST /api/assistant/turn`: `{ "question": "What is ahead?", "sessionId": "client-id", "history": [] }`. Streaming NDJSON events: `ack`, `analyzing`, then `answer` or `error`.
- `POST /api/assistant/transcribe`: multipart field `audio`; returns a transcript.
- `GET /api/assistant/audio/<turnId>/ack` and `/answer`: streamed MP3 replies.

Audio URLs reference short-lived in-memory turns. Voice data is not published to the public MQTT broker or recorded to project files. In live mode, image/question data goes to Google's API and speech/audio goes to ElevenLabs as applicable. Keep this baseline local; no multi-user authentication was added. The existing Node-only Docker/Render setup does not host Python automatically; remote deployment needs both services.

## Source and checks

- `backend/main.py`: FastAPI routes and streaming transport.
- `backend/services/assistant.py`: acknowledgment-first orchestration.
- `backend/services/gemma.py`: real multimodal request.
- `backend/services/speech.py`: transcription and streamed TTS.
- `backend/services/scene_state.py` and `mqtt_bridge.py`: fresh scene inputs.
- `frontend/voice-assistant.js`: microphone, speech queue, listening and Stop controls.
- `backend/legacy/`: preserved earlier local-model / hosted-agent prototypes.

```powershell
.\.venv-assistant\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv-assistant\Scripts\python.exe -m pytest backend/tests -q
npm test
npm run check
```

Tests cover acknowledgment before scene retrieval, image/metric payload pairing, stale-frame failures, provider errors, MQTT fallback, secret isolation and speech adapters. A Node proxy test confirms acknowledgment bytes arrive while the answer provider is blocked. Provider tests use mocked HTTP responses. Live provider success and microphone behavior need verification with your keys/device.

Official references: [Gemma multimodal API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api), [transcription](https://elevenlabs.io/docs/api-reference/speech-to-text/convert), [streamed speech](https://elevenlabs.io/docs/api-reference/text-to-speech/stream), [voice model selection](https://elevenlabs.io/docs/eleven-api/choosing-the-right-model).

## Immediate OpenAI fallback

Set `OPENAI_API_KEY` and optionally `OPENAI_FALLBACK_MODEL` (default `gpt-4.1-mini`) in the root `.env`. With a fallback key present, Gemma gets one attempt with a five-second request timeout. Any provider error, timeout or empty description immediately invokes OpenAI Responses using the same camera JPEG, range readings, question and conversation context. There is no retry delay before fallback. OpenAI uses a 15-second request timeout, low-detail image input and `store: false`. The UI labels the actual answer provider, including in immersive mode. Explicit demo mode does not invoke paid fallback. If both providers fail, a fresh sensor-only warning is labeled as image analysis unavailable.

References: https://developers.openai.com/api/docs/models/gpt-4.1-mini and https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses.
