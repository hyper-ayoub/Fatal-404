"""All credentials are loaded on the server from the repository-root .env."""
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')


def credential(value):
    value = (value or '').strip()
    return '' if value.lower().startswith(('your_', 'your-', 'replace_', 'placeholder')) else value


@dataclass
class Settings:
    mode: str = field(default_factory=lambda: os.getenv('ASSISTANT_MODE', 'auto'))
    gemma_key: str = field(default_factory=lambda: credential(os.getenv('GEMMA_API_KEY')) or credential(os.getenv('GEMINI_API_KEY')))
    gemma_model: str = field(default_factory=lambda: os.getenv('GEMMA_MODEL', 'gemma-4-26b-a4b-it'))
    openai_key: str = field(default_factory=lambda: credential(os.getenv('OPENAI_API_KEY')))
    openai_model: str = field(default_factory=lambda: os.getenv('OPENAI_FALLBACK_MODEL', 'gpt-4.1-mini'))
    eleven_key: str = field(default_factory=lambda: credential(os.getenv('ELEVENLABS_API_KEY')))
    voice_id: str = field(default_factory=lambda: credential(os.getenv('ELEVENLABS_VOICE_ID')) or 'EXAVITQu4vr4xnSDxMaL')
    speech_model: str = field(default_factory=lambda: os.getenv('ELEVENLABS_TTS_MODEL', 'eleven_multilingual_v2'))
    transcription_model: str = field(default_factory=lambda: os.getenv('ELEVENLABS_STT_MODEL', 'scribe_v2'))
    studio_url: str = field(default_factory=lambda: os.getenv('STUDIO_URL', 'http://127.0.0.1:3000').rstrip('/'))
    mqtt_enabled: bool = field(default_factory=lambda: os.getenv('MQTT_ENABLED', 'false') == 'true')
    mqtt_url: str = field(default_factory=lambda: os.getenv('MQTT_URL', 'mqtt://broker.hivemq.com:1883'))
    mqtt_session: str = field(default_factory=lambda: os.getenv('MQTT_SESSION', 'um6p-change-me-2026'))
    mqtt_username: str = field(default_factory=lambda: os.getenv('MQTT_USERNAME', ''))
    mqtt_password: str = field(default_factory=lambda: os.getenv('MQTT_PASSWORD', ''))

    @property
    def effective_mode(self):
        if self.mode not in ('auto', 'demo', 'gemma'):
            raise ValueError('ASSISTANT_MODE must be auto, demo or gemma')
        return ('gemma' if self.gemma_key else 'demo') if self.mode == 'auto' else self.mode

    def public(self):
        return {'mode': self.effective_mode, 'gemmaConfigured': bool(self.gemma_key),
                'model': self.gemma_model, 'fallbackConfigured': bool(self.openai_key),
                'fallbackModel': self.openai_model, 'voiceConfigured': bool(self.eleven_key and self.voice_id),
                'transcriptionConfigured': bool(self.eleven_key), 'backend': 'python',
                'acknowledgment': "Of course. Let me take a look."}
