import asyncio
import base64
import json
import time

from fastapi.testclient import TestClient
import httpx
import pytest

from backend.main import create_app
from backend.settings import Settings
from backend.services.assistant import ACKNOWLEDGMENT, AssistantService
from backend.services.gemma import GemmaService, ProviderError
from backend.services.scene_state import SceneProvider, SceneState, SceneUnavailable, validate_frame
from backend.services.speech import SpeechService


def settings(**kwargs):
    return Settings(mode='demo', gemma_key='', openai_key='', eleven_key='', voice_id='', mqtt_enabled=False, **kwargs)


def frame():
    return {'frameId': 42, 'sessionId': 'test-camera', 'capturedAt': time.time()*1000,
            'distances': {'left': None, 'center': .4, 'right': 3},
            'image': base64.b64encode(b'\xff\xd8fake-test-image\xff\xd9').decode()}


def scene():
    return {**frame(), 'alert': {'level': 'danger', 'message': 'Stop. Obstacle center, 0.4 metres.'},
            'distanceSource': 'simulator', 'aligned': True, 'transport': 'mqtt', 'detections': []}


class FakeScene:
    def __init__(self, error=False):
        self.calls = 0
        self.error = error

    async def snapshot(self):
        self.calls += 1
        if self.error:
            raise SceneUnavailable('No fresh camera image')
        return scene()


class FakeGemma:
    async def describe(self, question, snapshot, history):
        return {'text': 'A crate is in front of you.', 'mode': 'demo', 'model': None}


def test_ack_is_yielded_before_scene_or_model_and_cancel_releases_session():
    async def exercise():
        source = FakeScene()
        service = AssistantService(settings(), source, FakeGemma())
        stream = service.stream('Describe the surroundings', 'test-client')
        ack = await anext(stream)
        assert ack['type'] == 'ack'
        assert ack['text'] == ACKNOWLEDGMENT
        assert source.calls == 0
        await stream.aclose()
        assert not service.active_sessions
    asyncio.run(exercise())


def test_turn_order_and_deterministic_danger_prefix():
    async def exercise():
        service = AssistantService(settings(), FakeScene(), FakeGemma())
        events = [event async for event in service.stream('What is ahead?', 'client')]
        assert [event['type'] for event in events] == ['ack', 'analyzing', 'answer']
        assert events[-1]['text'].startswith('Stop. Obstacle center, 0.4 metres.')
        assert events[-1]['frameId'] == events[1]['frameId'] == 42
        assert service.audio_text(events[-1]['turnId'], 'answer') == events[-1]['text']
        assert not service.active_sessions
    asyncio.run(exercise())


def test_stale_image_gets_ack_then_error_without_model_inference():
    async def exercise():
        service = AssistantService(settings(), FakeScene(error=True), FakeGemma())
        events = [event async for event in service.stream('What is ahead?', 'client')]
        assert [event['type'] for event in events] == ['ack', 'error']
        assert 'No fresh' in events[-1]['text']
    asyncio.run(exercise())


def test_frame_freshness_validation_and_mqtt_duplicate_rejection():
    data = frame()
    state = SceneState()
    assert state.update(data)
    assert not state.update(data)
    assert state.current()['frameId'] == 42
    with pytest.raises(SceneUnavailable):
        validate_frame({**data, 'capturedAt': 0})
    with pytest.raises(SceneUnavailable):
        validate_frame({**data, 'distances': {'left': -2, 'center': .4, 'right': None}})


def test_gemma_request_contains_actual_image_and_matched_metrics():
    async def exercise():
        config = settings()
        config.mode = 'gemma'
        config.gemma_key = 'test-key-only'
        captured = []
        def handler(request):
            captured.append(json.loads(request.content))
            return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': 'A crate is ahead.'}]}}]})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result = await GemmaService(client, config).describe('What is ahead?', scene())
        parts = captured[0]['contents'][-1]['parts']
        assert parts[0]['inlineData']['data'] == scene()['image']
        assert '0.4' in parts[1]['text'] and 'frameId' in parts[1]['text']
        assert result['mode'] == 'gemma'
    asyncio.run(exercise())


def test_real_provider_failure_is_not_replaced_with_demo_output():
    async def exercise():
        config = settings()
        config.mode, config.gemma_key = 'gemma', 'test-key-only'
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(401))) as client:
            with pytest.raises(ProviderError, match='401'):
                await GemmaService(client, config).describe('Hello', scene())
    asyncio.run(exercise())


def test_transient_provider_error_is_retried_once_and_keys_are_redacted():
    async def exercise():
        config = settings()
        config.mode, config.gemma_key = 'gemma', 'test-key-only'
        calls = []
        def handler(request):
            calls.append(request)
            if len(calls) == 1:
                return httpx.Response(500, json={'error': {'message': 'Internal error encountered.'}})
            return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': 'A crate is ahead.'}]}}]})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result = await GemmaService(client, config).describe('What is ahead?', scene())
            assert result['mode'] == 'gemma'
        assert len(calls) == 2
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(403, json={'error': {'message': 'Denied test-key-only'}}))) as client:
            with pytest.raises(ProviderError) as caught:
                await GemmaService(client, config).describe('Hello', scene())
            assert 'test-key-only' not in str(caught.value)
            assert '[redacted]' in str(caught.value)
    asyncio.run(exercise())


def test_http_scene_failure_uses_fresh_mqtt_image():
    async def exercise():
        state = SceneState()
        state.update(frame())
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(503))) as client:
            snapshot = await SceneProvider(client, settings(), state).snapshot()
        assert snapshot['transport'] == 'mqtt'
        assert snapshot['image'] == frame()['image']
        assert snapshot['distances']['center'] == .4
    asyncio.run(exercise())


def test_api_stream_config_and_invalid_questions():
    config = settings()
    config.gemma_key = 'test-secret-not-for-browser'
    with TestClient(create_app(config, FakeScene(), FakeGemma())) as client:
        public = client.get('/api/assistant/config')
        assert 'test-secret' not in public.text
        result = client.post('/api/assistant/turn', json={'question': 'What is ahead?', 'sessionId': 'test'})
        assert result.status_code == 200
        events = [json.loads(line) for line in result.text.splitlines()]
        assert [e['type'] for e in events] == ['ack', 'analyzing', 'answer']
        assert client.post('/api/assistant/turn', json={'question': '   '}).status_code == 400
        assert client.get('/api/assistant/audio/not-a-turn/answer').status_code == 404


def test_speech_provider_uses_keys_server_side_and_streams_audio():
    async def exercise():
        config = settings()
        config.eleven_key, config.voice_id = 'test-eleven-key', 'test-voice'
        def handler(request):
            assert request.headers['xi-api-key'] == 'test-eleven-key'
            if '/speech-to-text' in str(request.url):
                assert b'scribe_v2' in request.content
                return httpx.Response(200, json={'text': 'Describe the scene'})
            assert '/text-to-speech/test-voice/stream' in str(request.url)
            body = json.loads(request.content)
            assert body['voice_settings']['stability'] == .38
            assert body['voice_settings']['style'] == .18
            return httpx.Response(200, content=b'test-audio', headers={'content-type': 'audio/mpeg'})
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = SpeechService(client, config)
            assert await service.transcribe(b'audio', 'sample.webm', 'audio/webm') == 'Describe the scene'
            response = await service.open_audio('Okay, I will assist you')
            assert b''.join([chunk async for chunk in response.aiter_bytes()]) == b'test-audio'
            await response.aclose()
    asyncio.run(exercise())


def test_voice_profiles_and_preview_cache_are_independent():
    class FakeSpeech:
        def __init__(self):
            self.voices = []

        async def open_audio(self, text, profile='warm'):
            self.voices.append(profile)
            return httpx.Response(200, content=profile.encode())

    speech = FakeSpeech()
    with TestClient(create_app(settings(), FakeScene(), FakeGemma(), speech)) as client:
        assert client.get('/api/assistant/voice-preview?voice=warm').content == b'warm'
        assert client.get('/api/assistant/voice-preview?voice=gentle').content == b'gentle'
        assert client.get('/api/assistant/voice-preview?voice=warm').content == b'warm'
        assert speech.voices == ['warm', 'gentle']
        assert client.get('/api/assistant/voice-preview?voice=invalid').status_code == 422
