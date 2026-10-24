# SensePath Glasses
## See through intelligence. Navigate through confidence.

**An assistive vision prototype that brings together multimodal AI, spatial sensing, conversational audio, and directional haptic feedback.**

**Team:** Amine hamouchi · Ibrahim Tanjaoui · ayoub bouagna  
**Context:** UM6P Hackathon

---

## Our vision

Understanding a street involves more than recognizing objects. It means knowing what is nearby, deciding which information matters, and receiving that information without overwhelming attention.

SensePath Glasses explores how smart glasses could make that experience more accessible for people with visual impairments. The project combines a camera view, three directional obstacle measurements, an AI assistant, and tactile cues into one connected experience. A user can ask about their surroundings, hear a concise description, and see how the glasses would communicate nearby obstacles through independent left and right haptic signals.

Our ambition is simple: **turn visual and spatial information into guidance people can hear and feel.**

## The experience

The demonstration takes place in a walkable 3D neighborhood with textured streets, shopfronts, balconies, trees, parked cars, and moving pedestrians. A first-person camera represents the glasses’ view, while a world overview makes the surrounding scene easier to understand.

In immersive mode, the first-person view fills the screen. A small world view sits in one corner, with an interactive glasses model and the voice assistant together on the opposite side. Keyboard, touch, and mouse controls let the user explore the environment while watching camera frames, obstacle measurements, and haptic feedback respond together.

The interaction follows a clear sequence:

1. **Ask naturally.** Speak a request or type a question about the surroundings.
2. **Receive acknowledgment.** The Python assistant immediately acknowledges the request before image analysis begins.
3. **Understand the scene.** Gemma receives a fresh camera image and the associated sensor context to generate a brief description.
4. **Hear the response.** ElevenLabs turns the answer into conversational speech, with selectable Sarah, Roger, and Lily voice presets.
5. **Feel proximity.** A left-side obstacle activates the left temple, a right-side obstacle activates the right, and a center obstacle activates both. Closer measurements produce stronger, faster visual pulses.

## The AI behind SensePath

### Multimodal scene understanding: Gemma 4

The project’s configured vision-language model is **`gemma-4-26b-a4b-it`**, accessed through Google’s Gemini API by the Python backend.

Gemma interprets the actual camera JPEG alongside the user’s question and relevant distance readings. Its role is to turn scene context into short, useful language. Metric distances come from the range sensors or simulation rays; they are not inferred from a single image. The assistant also distinguishes camera and sensor sources when they differ.

### Automatic vision fallback: OpenAI GPT-4.1 mini

If Gemma fails, **`gpt-4.1-mini`** immediately receives the same camera image, sensor readings, question and conversation context through the OpenAI Responses API. A stalled Gemma call is limited to five seconds, and the UI identifies fallback answers. This adds a second vision provider while retaining the same ElevenLabs voice experience.

### Conversational speech: ElevenLabs

Speech output uses **`eleven_multilingual_v2`**, with Sarah as the default voice and per-request settings tuned for a warmer, more expressive delivery. The interface also offers Roger and Lily. Optional audio transcription uses **`scribe_v2`**; compatible browsers can provide speech recognition directly.

### Optional object detection: YOLO11n

An optional **Ultralytics YOLO11n** worker, using **`yolo11n.pt`**, can detect objects from simulator frames, a webcam, or video. It supplies object labels and image directions as a separate perception component. These detections do not establish metric depth.

## Key technologies and dependencies

### Interactive simulation and interface

- **Three.js 0.180** — 3D rendering, lighting, cameras, raycasting, and the interactive glasses model.
- **OrbitControls and Three.js loaders** — world inspection, model interaction, and HDR environment lighting.
- **HTML, CSS, and JavaScript ES modules** — responsive studio layout, immersive mode, and live controls.
- **Poly Haven CC0 assets** — photographic surface materials and HDR sky lighting stored locally. The original Kenney CC0 neighborhood assets are also retained in the repository.
- **Browser speech recognition, Web Audio, and MediaRecorder APIs** — voice input, recording, and audio playback where supported.

### Connected application backend

- **Node.js 22+ and Express 5** — application hosting, camera endpoints, telemetry validation, and service integration.
- **`ws` 8** — live WebSocket updates for the interface.
- **MQTT.js 5 and Eclipse Paho MQTT 2** — message transport between the simulator, backend, Python service, and embedded prototype.
- **FastAPI and Uvicorn** — the Python assistant API and streamed conversation events.
- **HTTPX** — asynchronous requests to the model and speech providers.
- **`dotenv`, `python-dotenv`, and `python-multipart`** — server-side configuration and recorded-audio uploads.

### Embedded and optional vision components

- **ESP32 and Wokwi** — an embedded prototype with three ultrasonic distance inputs and servo feedback.
- **PubSubClient, ArduinoJson, and ESP32Servo** — firmware messaging, payload handling, and actuator control.
- **Ultralytics and OpenCV** — the optional local object-detection pipeline.

## What makes the project distinctive

**One scene, connected signals.** Camera frames carry frame identifiers, timestamps, pose, and matching simulated range measurements. Other components can consume this context through HTTP camera APIs and MQTT topics.

**Complementary feedback.** Spoken descriptions communicate scene context, while directional pulses communicate proximity. The two channels serve different needs within the same interaction.

**Immediate proximity logic.** Deterministic distance rules control the obstacle warning and haptic visualization independently of language-model response time. Stale readings stop producing haptic pulses.

**A visible bridge to hardware.** The interactive glasses model makes the intended tactile interaction understandable, while the ESP32/Wokwi code provides a starting point for embedded integration.

**A demonstration people can explore.** The immersive interface lets an audience walk through the scenario and observe the complete interaction rather than watching a fixed presentation.

## Prototype scope and next steps

SensePath Glasses is a hackathon research prototype. The neighborhood and its camera are simulated, independent physical left/right temple actuators remain future hardware work, and the current embedded example uses a single servo. Model and speech responses depend on external provider availability. The system has not been validated for real-world navigation.

The next stage is to integrate a wearable camera and calibrated range sensors, implement dual haptic actuators, and evaluate latency, comfort, and information clarity with accessibility-focused user testing.

---

**Built by Amine hamouchi, Ibrahim Tanjaoui, and ayoub bouagna.**

*SensePath Glasses — making surroundings easier to understand, one question and one pulse at a time.*
