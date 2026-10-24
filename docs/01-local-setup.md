# 01 — Local baseline

**Source:** `package.json`, `.env.example`, `backend/server.js`, `frontend/`.

1. Install Node.js 22+ and Git. Python is optional until step 04.
2. Open a PowerShell terminal inside the repository folder.
3. Install the locked dependencies:

   ```powershell
   npm ci
   Copy-Item .env.example .env
   npm start
   ```

4. Visit http://127.0.0.1:3000. Use the served address rather than opening `index.html` directly.
5. Select **Close obstacle**. The center readout should be approximately 0.40 m and show a danger warning.
6. To use the assistant controls, install/start the Python service using [step 10](10-voice-assistant.md), then ask “What is in front of me?” Without a model key the response is explicitly marked as demo mode.

If PowerShell blocks the npm launcher, use `npm.cmd` in place of `npm`. If port 3000 is occupied, set `PORT=3001` in `.env` and restart. Stop with Ctrl+C.

Configuration is loaded on startup. Restart after changing `.env`. Never commit `.env`; `.env.example` documents the supported settings. Node serves the installed Three.js module locally. Fonts are optional remote Google Fonts with local fallbacks; the demo remains usable when font loading is blocked.

**Checkpoint:** synthetic sensors, warnings, live state and local question responses work without external services.
