# 03 — Wokwi sensors, servo and MQTT

**Source:** all three files under `firmware/wokwi/`; MQTT code in `backend/server.js`.

1. Create a new ESP32 Arduino project at https://wokwi.com/projects/new/esp32.
2. Replace its `sketch.ino` and `diagram.json` with this repository's files. Add `libraries.txt` (or use Wokwi's Library Manager to add PubSubClient, ArduinoJson and ESP32Servo).
3. Choose a unique random session string. Set `SESSION` in `sketch.ino` and `MQTT_SESSION` in the laptop's `.env` to the same string.
4. Set `MQTT_ENABLED=true` in `.env`. The broker host defaults to `broker.hivemq.com`, port 1883, on both sides. Restart the backend.
5. Start Wokwi. The ESP32 connects to Wokwi-GUEST and publishes sensor data. Confirm `MQTT connected` in its serial monitor.
6. In the browser lab, choose **Wokwi ESP32 / MQTT**. Confirm the backend broker is connected and sensor numbers arrive.
7. Click the center ultrasonic sensor in Wokwi and change its distance to **40 cm**. The local servo should tap more frequently and the browser should report about **0.40 m**.
8. Change to 100 cm, then 250 cm, and observe warning then no close return. Stop Wokwi and wait over 2.5 seconds: the browser must show unknown.

Wokwi and the browser 3D world are independent simulations. They do not share obstacle geometry. Select one distance source at a time. The Wokwi demo uses a public internet broker because the public Wokwi gateway cannot directly access your laptop's localhost. Both Wokwi and the laptop connect outward to the same broker. No port forwarding is needed. A private authenticated broker is preferable beyond this demonstration; firmware TLS/auth support is not included in this baseline.

## Pins

- Left HC-SR04: TRIG GPIO 5, ECHO GPIO 18.
- Center HC-SR04: TRIG GPIO 19, ECHO GPIO 21.
- Right HC-SR04: TRIG GPIO 22, ECHO GPIO 23.
- Servo signal: GPIO 13; idle 90°, tap 110°.

Diagram wiring is for simulation. Real HC-SR04 ECHO outputs require suitable level shifting to ESP32 logic voltage; a real servo needs an appropriate supply and common ground. Demonstrate servo movement on a stand rather than mounting a tapping mechanism against someone's head.

## MQTT contract

Topic `openpilot/<session>/telemetry`:

```json
{"source":"wokwi","distances":{"left":2.5,"center":0.4,"right":2.5}}
```

All values are metres; out-of-range/no-echo is `null`. Wokwi range is 2–400 cm. Topic `openpilot/<session>/haptic`:

```json
{"level":"danger","pulseMs":180}
```

Commands are non-retained and refreshed every second; firmware expires remote commands after 2.5 seconds. Firmware derives the pulse rate from the allowed level. The local proximity warning takes precedence whenever it is more urgent than a remote command. Simulator mode sends no remote warning, but local Wokwi sensing still operates.

**Checkpoint:** changing Wokwi sensor distance reaches the browser and servo; stop the backend and confirm local sensor-to-servo behavior continues.
