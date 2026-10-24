"""Run with: python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000."""
from contextlib import aclosing, asynccontextmanager
import json
from typing import Literal
from urllib.parse import urlparse

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import Response, StreamingResponse
import httpx
from pydantic import BaseModel, Field

from .settings import Settings
from .services.assistant import AssistantService
from .services.gemma import GemmaService, ProviderError
from .services.mqtt_bridge import AssistantMqttBridge
from .services.scene_state import SceneProvider, SceneState
from .services.speech import SpeechService
from .services.vision_fallback import OpenAIVisionService, VisionFallbackService


class HistoryItem(BaseModel):
    role: Literal['user', 'model']
    text: str = Field(min_length=1, max_length=1000)


class TurnInput(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    sessionId: str = Field(default='default', min_length=1, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    history: list[HistoryItem] = Field(default_factory=list, max_length=6)


def create_app(settings=None, scene_provider=None, gemma_service=None, speech_service=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        async with httpx.AsyncClient(timeout=25) as client:
            state = SceneState()
            bridge = AssistantMqttBridge(settings, state)
            app.state.bridge = bridge
            vision = gemma_service or VisionFallbackService(GemmaService(client, settings), OpenAIVisionService(client, settings), settings)
            app.state.assistant = AssistantService(settings, scene_provider or SceneProvider(client, settings, state), vision)
            app.state.speech = speech_service or SpeechService(client, settings)
            app.state.ack_audio = {}
            bridge.start()
            try:
                yield
            finally:
                bridge.stop()

    app = FastAPI(title='OpenPilot Python Voice Assistant', lifespan=lifespan)

    @app.middleware('http')
    async def local_request_policy(request: Request, call_next):
        origin = request.headers.get('origin')
        allowed = {settings.studio_url, str(request.base_url).rstrip('/')}
        studio = urlparse(settings.studio_url)
        if studio.hostname in ('localhost', '127.0.0.1'):
            allowed.update(f'{studio.scheme}://{host}:{studio.port or 80}' for host in ('localhost', '127.0.0.1'))
        if origin and origin.rstrip('/') not in allowed:
            return Response('Cross-origin requests are disabled', status_code=403)
        if int(request.headers.get('content-length', '0')) > 6 * 1024 * 1024:
            return Response('Request is too large', status_code=413)
        return await call_next(request)

    @app.get('/api/assistant/config')
    @app.get('/health')
    async def configuration():
        return {**settings.public(), 'mqtt': app.state.bridge.status()}

    @app.post('/api/assistant/turn')
    async def turn(body: TurnInput, request: Request):
        if not body.question.strip():
            raise HTTPException(400, 'Please say or type a request.')
        async def events():
            try:
                history = [item.model_dump() for item in body.history]
                async with aclosing(app.state.assistant.stream(body.question.strip(), body.sessionId, history)) as stream:
                    async for event in stream:
                        if await request.is_disconnected():
                            break
                        yield json.dumps(event, ensure_ascii=False) + '\n'
            except Exception:
                # Never expose provider bodies, transcripts, credentials or stack traces.
                yield json.dumps({'type': 'error', 'text': 'The assistant could not complete this turn. Please try again.'}) + '\n'
        return StreamingResponse(events(), media_type='application/x-ndjson',
            headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})

    @app.post('/api/assistant/transcribe')
    async def transcribe(audio: UploadFile = File(...)):
        data = await audio.read(5 * 1024 * 1024 + 1)
        await audio.close()
        if not data or len(data) > 5 * 1024 * 1024:
            raise HTTPException(413, 'Record a shorter utterance (maximum 5 MB).')
        try:
            text = await app.state.speech.transcribe(data, audio.filename or 'utterance.webm', audio.content_type or 'audio/webm')
            return {'text': text}
        except ProviderError as error:
            raise HTTPException(502, str(error)) from error

    async def speech_response(text, voice, cache_key=None):
        if cache_key and cache_key in app.state.ack_audio:
            return Response(app.state.ack_audio[cache_key], media_type='audio/mpeg', headers={'Cache-Control': 'no-store'})
        try:
            upstream = await app.state.speech.open_audio(text, voice)
        except ProviderError as error:
            raise HTTPException(503, str(error)) from error
        async def chunks():
            saved = bytearray()
            try:
                async for chunk in upstream.aiter_bytes():
                    if cache_key and len(saved) < 1024 * 1024:
                        saved.extend(chunk)
                    yield chunk
                if cache_key and saved:
                    app.state.ack_audio[cache_key] = bytes(saved)
            finally:
                await upstream.aclose()
        return StreamingResponse(chunks(), media_type='audio/mpeg', headers={'Cache-Control': 'no-store'})

    @app.get('/api/assistant/audio/{turn_id}/{phase}')
    async def audio(turn_id: str, phase: Literal['ack', 'answer'], voice: Literal['warm', 'casual', 'gentle'] = 'warm'):
        text = app.state.assistant.audio_text(turn_id, phase)
        if not text:
            raise HTTPException(404, 'This voice reply is unavailable or expired.')
        return await speech_response(text, voice, ('ack', voice) if phase == 'ack' else None)

    @app.get('/api/assistant/voice-preview')
    async def voice_preview(voice: Literal['warm', 'casual', 'gentle'] = 'warm'):
        return await speech_response("Of course. Let me take a look. There's a wooden box just ahead, slightly to your left.", voice, ('preview', voice))

    return app


app = create_app()
