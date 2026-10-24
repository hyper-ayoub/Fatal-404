import asyncio
import base64
import json

import httpx
import pytest

from backend.settings import Settings
from backend.services.gemma import GemmaService, ProviderError
from backend.services.vision_fallback import OpenAIVisionService, VisionFallbackService


def scene():
    return {'frameId': 7, 'image': base64.b64encode(b'jpeg-fixture').decode(),
            'distances': {'left': 3, 'center': .4, 'right': 3},
            'distanceSource': 'simulator', 'aligned': True,
            'alert': {'level': 'danger', 'message': 'Stop. Obstacle center, 0.4 metres.'}}


def settings():
    return Settings(mode='gemma', gemma_key='test-google', openai_key='test-openai',
                    openai_model='gpt-4.1-mini', mqtt_enabled=False)


def success():
    return httpx.Response(200, json={'output': [{'type': 'message', 'content': [
        {'type': 'output_text', 'text': 'A wooden box is ahead.'}]}]})


@pytest.mark.parametrize('failure', ['500', 'timeout', 'empty'])
def test_first_gemma_failure_immediately_uses_openai_with_same_pixels_and_metrics(failure):
    async def run():
        calls = []
        def handler(request):
            calls.append(request)
            if request.url.host == 'generativelanguage.googleapis.com':
                if failure == 'timeout':
                    raise httpx.ReadTimeout('timeout', request=request)
                return httpx.Response(500) if failure == '500' else httpx.Response(200, json={'candidates': []})
            assert request.url == 'https://api.openai.com/v1/responses'
            assert request.headers['authorization'] == 'Bearer test-openai'
            payload = json.loads(request.content)
            assert payload['model'] == 'gpt-4.1-mini'
            assert payload['store'] is False
            parts = payload['input'][-1]['content']
            assert parts[1]['image_url'] == 'data:image/jpeg;base64,' + scene()['image']
            assert '0.4' in parts[0]['text'] and 'frameId' in parts[0]['text']
            assert payload['input'][1]['role'] == 'assistant'
            return success()
        config = settings()
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            service = VisionFallbackService(GemmaService(client, config), OpenAIVisionService(client, config), config)
            answer = await service.describe('What is ahead?', scene(), [{'role': 'user', 'text': 'Hello'}, {'role': 'model', 'text': 'Hi'}])
        assert len(calls) == 2
        assert answer['mode'] == 'openai' and answer['fallback'] is True
    asyncio.run(run())


def test_successful_gemma_does_not_call_openai():
    async def run():
        calls = []
        def handler(request):
            calls.append(request)
            assert request.url.host == 'generativelanguage.googleapis.com'
            return httpx.Response(200, json={'candidates': [{'content': {'parts': [{'text': 'A box is ahead.'}]}}]})
        config = settings()
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            answer = await VisionFallbackService(GemmaService(client, config), OpenAIVisionService(client, config), config).describe('Describe', scene())
        assert len(calls) == 1 and answer['mode'] == 'gemma'
    asyncio.run(run())


def test_failed_openai_does_not_expose_provider_body_or_key():
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(401, json={'error': 'test-openai'}))) as client:
            with pytest.raises(ProviderError) as caught:
                await OpenAIVisionService(client, settings()).describe('Describe', scene())
        assert 'test-openai' not in str(caught.value)
        assert '401' in str(caught.value)
    asyncio.run(run())


def test_explicit_demo_mode_never_invokes_paid_fallback():
    async def run():
        class FailedPrimary:
            async def describe(self, *args):
                raise ProviderError('test')
        class UnexpectedFallback:
            async def describe(self, *args):
                pytest.fail('Demo mode must not invoke OpenAI')
        config = settings()
        config.mode = 'demo'
        with pytest.raises(ProviderError):
            await VisionFallbackService(FailedPrimary(), UnexpectedFallback(), config).describe('Describe', scene())
    asyncio.run(run())
