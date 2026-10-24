# 02 — 3D world and deterministic warnings

**Source:** `frontend/world.js`, `frontend/simulator.js`, `frontend/movement.js`, `backend/frames.js`, `backend/policy.js`.

The frontend uses a Three.js neighborhood built with locally stored Kenney CC0 models: houses, fences, trees and planters, plus generated roads, benches, lamps and a garden square. Static meshes are batched by material and shadows are refreshed when the test obstacle moves. Three rays originate at sensor height (1.25 m), pointing left 30°, straight ahead and right 30° relative to the user's heading. Each returns the nearest detailed mesh intersection up to 8 m. No hit is `null`. These ideal rays do not model ultrasonic cones, noise or reflections.

1. Start in **3D simulator** source mode.
2. Click **Clear path**, **Approaching**, then **Close obstacle**.
3. Adjust the center obstacle slider; its distance is relative to your current position and heading when adjusted.
4. Move using W/A/S/D or arrow keys. Turn with Q/E; hold Shift to run. Hold the on-screen movement/turn buttons on touch devices. Collision footprints prevent walking through solid props and buildings.
5. Watch the dedicated first-person panel while the overview remains visible. Drag in the camera to look around, or use Enter walk mode for pointer lock and Esc to exit. The overview supports orbit, zoom and Top view.
6. Open the camera/data links or follow [step 08](08-camera-integration.md) to consume matching JPEG frames, pose and measurements in another component.

`policy.js` selects the nearest valid measurement. Under 0.7 m gives a danger pulse every 180 ms; 0.7 to under 1.5 m gives warning every 600 ms. At 1.5 m or more the result says no close obstacle in the measured rays. Missing or stale data produces `unknown`. A `null` ray can miss an object, so no result promises a safe route.

The server validates messages and overwrites receipt timestamps. Selecting Wokwi makes the simulator's telemetry irrelevant to the policy. Each browser tab has its own simulator, but all share backend state: use one demo tab to avoid competing synthetic producers.

**Checkpoint:** changing geometry changes distances and pulses without any AI or MQTT connection.
