# 05 — Gemma 4 and voice

The new assistant UI uses the Python multimodal flow documented in [step 10](10-voice-assistant.md). It sends the actual JPEG and its sensor context to Gemma, acknowledges first, then speaks the description. The text-only Node routes below remain for compatibility and direct API use.

**Source:** `backend/assistant.js`, `/api/ask` and `/api/speech` in `backend/server.js`, voice controls in `frontend/app.js`.

## Enable real Gemma

Obtain a Gemini API key from https://aistudio.google.com/ and edit `.env`:

```dotenv
AI_MODE=gemma
GEMINI_API_KEY=your-real-key
GEMMA_MODEL=gemma-4-26b-a4b-it
```

Restart the backend. The badge must read **GEMMA · LIVE API**. Ask “What can you tell me about my surroundings?” with sensor data active and, optionally, the camera worker running. The real adapter calls Gemini's REST `generateContent` endpoint with the configured Gemma model. Current supported model identifiers are documented at https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api; access and quota depend on your account. This implementation never silently substitutes another model or a demo answer when a real request fails.

The prompt contains one timestamped snapshot: active sensor source, fresh distances, a deterministic warning and any fresh camera labels. It tells Gemma to acknowledge uncertainty, answer briefly in the question's language and avoid inferring camera depth or giving a safe-route guarantee. Gemma is advisory; warning thresholds and servo decisions remain independent of generated prose.

No image upload or raw video understanding is implemented. Add multimodal input later only after confirming the selected model supports it and deciding what image data should leave the device.

## Browser voice

Click **Read answer** for browser speech synthesis. Enable **Speak obstacle warnings** for repeated warning announcements. Voices depend on the operating system and browser. The **Mic** button uses the browser's speech recognition API when available; recognition may use a browser vendor's remote service. If microphone access or recognition is unsupported, type the question. Dictation fills the text field; click Ask to submit it.

## Optional ElevenLabs

In `.env`, set `ELEVENLABS_API_KEY` and an actual `ELEVENLABS_VOICE_ID` from your account, then restart. Check **ElevenLabs voice** and click Read answer. The backend calls the text-to-speech endpoint using `eleven_multilingual_v2`. If it fails, the UI reports the error and tries browser speech. Voice keys stay on the server. Spoken text is sent to ElevenLabs when this option is selected.

**Checkpoint:** a successful response names mode `gemma` and the configured model in the `/api/ask` JSON result. This live call must succeed before claiming actual Gemma use in the challenge submission. API adapters are provided, but real-key verification is a team setup step.
