"""Immediate provider failover, keeping the same image and sensor context."""
import json
import logging
import re

import httpx

from .gemma import ProviderError, RULES

logger = logging.getLogger(__name__)


class OpenAIVisionService:
    def __init__(self, client, settings):
        self.client, self.settings = client, settings

    async def describe(self, question, scene, history=()):
        context = {key: scene[key] for key in ('frameId', 'distances', 'distanceSource', 'aligned', 'alert')}
        messages = [{'role': 'assistant' if item['role'] == 'model' else 'user',
                     'content': item['text']} for item in history[-6:]]
        messages.append({'role': 'user', 'content': [
            {'type': 'input_text', 'text': f'Sensor context: {json.dumps(context)}\nRequest: {question}'},
            {'type': 'input_image', 'image_url': 'data:image/jpeg;base64,' + scene['image'], 'detail': 'low'}]})
        try:
            response = await self.client.post('https://api.openai.com/v1/responses',
                headers={'Authorization': 'Bearer ' + self.settings.openai_key},
                json={'model': self.settings.openai_model, 'instructions': RULES,
                      'input': messages, 'max_output_tokens': 180, 'store': False}, timeout=15)
            if response.status_code != 200:
                logger.warning('OpenAI vision fallback returned HTTP %s', response.status_code)
                raise ProviderError(f'OpenAI fallback is unavailable ({response.status_code}).')
            body = response.json()
            text = ''.join(part.get('text', '') for item in body.get('output', [])
                           if item.get('type') == 'message' for part in item.get('content', [])
                           if part.get('type') == 'output_text').strip()
            if not text:
                raise ProviderError('OpenAI returned no image description.')
            text = re.sub(r'[*#`]', '', text)
            words = text.split()
            if len(words) > 60:
                text = ' '.join(words[:60]).rstrip(' ,;:') + '.'
            return {'text': text, 'mode': 'openai', 'model': self.settings.openai_model,
                    'provider': 'openai', 'fallback': True}
        except (httpx.HTTPError, ValueError, TypeError) as error:
            logger.warning('OpenAI vision fallback failed: %s', type(error).__name__)
            raise ProviderError('OpenAI image analysis is unavailable or timed out.') from error


class VisionFallbackService:
    def __init__(self, primary, fallback, settings):
        self.primary, self.fallback, self.settings = primary, fallback, settings

    async def describe(self, question, scene, history=()):
        try:
            return await self.primary.describe(question, scene, history)
        except ProviderError:
            if not self.settings.openai_key or self.settings.effective_mode == 'demo':
                raise
            return await self.fallback.describe(question, scene, history)
