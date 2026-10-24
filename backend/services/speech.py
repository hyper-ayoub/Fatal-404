"""ElevenLabs transcription and low-latency streamed voice, with server-only keys."""
from urllib.parse import quote

import httpx

from .gemma import ProviderError


class SpeechService:
    def __init__(self, client, settings):
        self.client, self.settings = client, settings

    async def transcribe(self, data, filename, content_type):
        if not self.settings.eleven_key:
            raise ProviderError('ElevenLabs is not configured. Use browser recognition or type your request.')
        try:
            response = await self.client.post('https://api.elevenlabs.io/v1/speech-to-text',
                headers={'xi-api-key': self.settings.eleven_key},
                data={'model_id': self.settings.transcription_model},
                files={'file': (filename, data, content_type)}, timeout=25)
            if response.status_code != 200:
                raise ProviderError(f'Transcription failed ({response.status_code}). Check your ElevenLabs key and quota.')
            text = response.json().get('text', '').strip()
            if not text:
                raise ProviderError('No speech was detected. Please try again.')
            return text[:1000]
        except httpx.HTTPError as error:
            raise ProviderError('Speech transcription is unavailable or timed out.') from error

    async def open_audio(self, text, profile='warm'):
        if not self.settings.eleven_key or not self.settings.voice_id:
            raise ProviderError('ElevenLabs voice is not configured. Browser speech is available.')
        voice_id = {'warm': self.settings.voice_id, 'casual': 'CwhRBWXzGAHq8TQ4Fs17',
                    'gentle': 'pFZP5JQG7iQjIQuC4Bku'}.get(profile, self.settings.voice_id)
        url = f'https://api.elevenlabs.io/v1/text-to-speech/{quote(voice_id, safe="")}/stream'
        request = self.client.build_request('POST', url,
            headers={'xi-api-key': self.settings.eleven_key},
            json={'text': text, 'model_id': self.settings.speech_model,
                  'voice_settings': {'stability': .38, 'similarity_boost': .72,
                                     'style': .18, 'use_speaker_boost': True, 'speed': 1.0}},
            params={'output_format': 'mp3_44100_128'}, timeout=25)
        try:
            response = await self.client.send(request, stream=True)
            if response.status_code != 200:
                await response.aclose()
                raise ProviderError(f'Voice generation failed ({response.status_code}). Check the key, voice ID and quota.')
            return response
        except httpx.HTTPError as error:
            raise ProviderError('Voice generation is unavailable or timed out.') from error
