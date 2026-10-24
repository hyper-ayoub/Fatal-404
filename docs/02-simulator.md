# 02 — 3D world and deterministic warnings

**Source:** `frontend/app.js`, `backend/policy.js`.

The frontend uses a Three.js scene with boxes and walls. Three rays originate at sensor height (1.25 m), pointing left 30°, straight ahead and right 30° relative to the user's heading. Each returns the nearest mesh intersection up to 6 m. No hit is represented as `null`, never as a fabricated large distance. These ideal rays do not model ultrasonic cones, noise or reflections.

1. Start in **3D simulator** source mode.
2. Click **Open corridor**, **Approaching obstacle**, then **Close obstacle**.
3. Adjust the center obstacle slider; its distance is relative to your current position and heading when adjusted.
4. Move using W/A/S/D or arrow keys. Turn with Q/E. Use the on-screen buttons on touch devices.
5. Switch to first-person view. The scene is visual context; warning logic still receives the same ray measurements.

`policy.js` selects the nearest valid measurement. Under 0.7 m gives a danger pulse every 180 ms; 0.7 to under 1.5 m gives warning every 600 ms. At 1.5 m or more the result says no close obstacle in the measured rays. Missing or stale data produces `unknown`. A `null` ray can miss an object, so no result promises a safe route.

The server validates messages and overwrites receipt timestamps. Selecting Wokwi makes the simulator's telemetry irrelevant to the policy. Each browser tab has its own simulator, but all share backend state: use one demo tab to avoid competing synthetic producers.

**Checkpoint:** changing geometry changes distances and pulses without any AI or MQTT connection.
