# 09 — Real MQTT broker connection

The simulator now publishes through an actual MQTT server. The current local configuration enables **HiveMQ's public broker** at `mqtt://broker.hivemq.com:1883` using an isolated `MQTT_SESSION`. Its session is also copied into `firmware/wokwi/sketch.ino`.

Check the current broker, exact topic prefix and message counters at http://127.0.0.1:3000/api/mqtt. The live UI reports connection state and the number of messages sent. Restart the server after editing `.env`; refresh the lab to load newly added UI controls.

## Topics

All topics are prefixed by `openpilot/<MQTT_SESSION>/`:

- **`simulator/telemetry`** — simulator distances in metres, frame ID, camera session ID and timestamps, up to 5 Hz.
- **`simulator/observation`** — synchronized pose/range metadata and deterministic alert, up to 5 Hz. No image bytes.
- **`simulator/camera/frame`** — full camera bundle: base64 JPEG plus its matching pose, distances, camera session ID, frame ID and timestamps. Up to 1 Hz when `MQTT_PUBLISH_IMAGES=true`. Decode the `image` field using base64; `mimeType` is `image/jpeg`.
- **`haptic`** — current warning level and pulse interval, immediately on changes and every second. Includes the selected sensor source. Simulator commands are forwarded when `MQTT_FORWARD_SIM_HAPTICS=true`.
- **`telemetry`** — inbound ESP32/Wokwi readings. Only valid messages with `source=wokwi` are ingested. They affect the warning when Wokwi is selected in the lab.
- **`status`** — retained online/offline backend presence, with an MQTT Last Will for unexpected disconnections.

Sensor data, camera data and haptic commands use non-retained QoS 0 publication to avoid presenting old samples as current. Backend presence uses retained QoS 1. When the connection is lost, live messages are skipped, not queued for later replay. The client reconnects automatically. A message counter records successful MQTT client writes; an independent subscriber is required to prove delivery.

## Receive live messages

From the repository folder:

```powershell
npm run mqtt:monitor
```

For a bounded verification that waits for all required topics:

```powershell
npm run mqtt:monitor -- --count 8
```

The script uses the same `.env` broker/session settings and prints concise metadata rather than dumping base64 images. It verifies camera, telemetry, observation and haptic topics when image publishing is enabled. Keep the simulator tab visible. Stop continuous monitoring with Ctrl+C.

To connect MQTT Explorer or another client, use the broker host/port and subscribe to the topic prefix displayed by `/api/mqtt`, followed by `/#`. The broker is shared and public: only synthetic simulation values and rendered images should be published here. A random session isolates the namespace but is not access control.

## Local configuration enabled for this demo

```dotenv
MQTT_ENABLED=true
MQTT_URL=mqtt://broker.hivemq.com:1883
MQTT_SESSION=your-unique-session
MQTT_PUBLISH_IMAGES=true
MQTT_FORWARD_SIM_HAPTICS=true
```

`.env.example` keeps the optional publishing flags off for a fresh installation. The actual local `.env` has them enabled. The frontend camera session ID is distinct from `MQTT_SESSION`: the former changes on page reload, while the latter is the shared broker namespace.

For a private broker, set `MQTT_URL` and optionally `MQTT_USERNAME`/`MQTT_PASSWORD`. The Node backend and monitor support MQTT over TLS using `mqtts://`. Credentials are never returned by `/api/mqtt`. The supplied ESP32 firmware currently uses a plaintext `WiFiClient`; private TLS broker support requires adapting its network client.

## Verification performed

On 24 October 2026, the actual HiveMQ server returned a successful connection acknowledgment. An independent MQTT client subscribed to the configured prefix and received eight non-retained live messages across all four required topics. One synchronized camera frame contained a 22,567-byte JPEG matching its sensor frame ID. This proves the browser → backend → internet broker → separate subscriber path. It does not claim a physical ESP32 or a running Wokwi session was connected.
