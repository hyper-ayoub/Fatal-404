# 07 — Three-minute presentation

## Before presenting

Run the checks, start the server, open one lab tab, test the camera worker if using it, and confirm an actual Gemma call succeeds. Prepare Wokwi in another tab with the matching MQTT session. Do not describe scripted demo mode as a real model integration.

## Demonstration sequence

1. **Problem (20 seconds):** explain the need for timely obstacle awareness plus brief, question-driven descriptions. Present this as a controlled assistive-technology prototype.
2. **3D loop (40 seconds):** select the simulator. Click Open corridor, then Approaching obstacle, then Close obstacle. Point out measured distances, warning level and changing haptic pulse speed. Show the first-person view.
3. **Embedded loop (40 seconds):** select Wokwi. Change center sensor from 250 cm to 100 cm to 40 cm. Show the servo and matching browser measurement. Explain that local warnings work independently from the AI request.
4. **AI loop (40 seconds):** show real camera labels, ask “What is ahead of me?”, show the GEMMA badge and read the answer aloud. Explain that the model receives structured context; sensor distance and camera labels remain distinct.
5. **Failure behavior (20 seconds):** stop Wokwi, wait three seconds, show unknown readings. Describe how stale readings are removed from the next model context.
6. **Close (20 seconds):** show your public repository link and exact model name. Mention the next engineering milestone: calibrated depth estimation, improved haptics and usability evaluation.

## Truthful fallback demonstration

If an external API or broker is unavailable, use the local simulator and scripted answers to show the orchestration, and explicitly identify the missing live component. The implementation contains the real adapters; an adapter alone is not evidence of a successful real-key demonstration.
