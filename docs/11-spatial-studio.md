# Spatial Studio upgrade

Run `npm run start:all` from the repository root and open http://127.0.0.1:3000/.

The neighborhood now combines locally stored CC0 photographic surfaces and sky lighting with detailed procedural buildings, balconies, shopfronts, planters, cafe seating, parked cars and walking figures. Use WASD to move, Q/E to turn, or drag the first-person camera. Solid objects have collision footprints. Daylight and rendering quality are adjustable. The camera always exports the complete 640 × 360 image regardless of its UI size.

`frontend/glasses.js` renders the interactive glasses model. `frontend/haptics-policy.js` maps the nearest side or center range reading to each temple. Side obstacles excite the corresponding temple; a center obstacle excites both. Warning readings below 1.5 m use a 600 ms pulse period; danger readings below 0.7 m use 180 ms, with increasing amplitude. Missing or stale samples produce no vibration. This is a visual hardware preview; existing single-servo firmware does not implement independent physical temple motors.

The HTTP state and MQTT observation payloads expose `haptics.left` and `haptics.right`, each containing `level`, `distance`, `intensity` and `pulseMs`. MQTT haptic commands include the same values under `temples` when forwarding is enabled. The focused studio claims its camera session so a second simulator tab cannot mix its frames into the active scene.

The Python speech service defaults to Sarah (`EXAVITQu4vr4xnSDxMaL`) with `eleven_multilingual_v2`. Per-request settings use stability 0.38, similarity 0.72 and style 0.18 for a more conversational delivery. The UI also offers Roger and Lily; selection persists locally. The Hear voice button plays a clearly labeled fixed sample, not a live scene observation. Preview and acknowledgment audio caches are separate per voice. Provider keys remain in the root `.env`.

Important files: `frontend/index.html`, `style.css`, `world.js`, `simulator.js`, `glasses.js`, `haptics-policy.js`, `voice-assistant.js`, `backend/services/speech.py`, `backend/main.py`.

## Immersive walking mode

Select Full screen in the camera panel. The first-person scene fills the display, with the live world overview at bottom left and glasses plus voice assistant on the right. Perspective/Map, touch movement, drag-to-look, voice selection, microphone conversation and typed requests reuse the existing live controls. The right panel scrolls on smaller displays. Exit full screen or Escape returns the same panels and conversation to the studio. Browser fullscreen is used when available, with an immersive viewport fallback otherwise.

The main view renders at 960 x 540 in balanced mode, or 1280 x 720 with enhanced detail, while the synchronized API image stays 640 x 360. Opening a studio or entering immersive mode explicitly takes camera ownership; incidental focus events cannot replace another fresh camera session.
