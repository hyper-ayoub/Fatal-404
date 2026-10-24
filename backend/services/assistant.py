"""Turn orchestration: acknowledge before fetching a scene or calling any model."""
import time
import uuid
from collections import OrderedDict

from .gemma import ProviderError
from .scene_state import SceneUnavailable

ACKNOWLEDGMENT = "Of course. Let me take a look."


class AssistantService:
    def __init__(self, settings, scene, gemma):
        self.settings, self.scene, self.gemma = settings, scene, gemma
        self.turns = OrderedDict()
        self.active_sessions = set()

    def _prune(self):
        now = time.time()
        for key in list(self.turns):
            if now - self.turns[key]['created'] > 180:
                del self.turns[key]
        while len(self.turns) > 32:
            self.turns.popitem(last=False)

    def audio_text(self, turn_id, phase):
        self._prune()
        record = self.turns.get(turn_id)
        if not record:
            return None
        return ACKNOWLEDGMENT if phase == 'ack' else record.get('text') if phase == 'answer' else None

    async def stream(self, question, session_id, history=()):
        if session_id in self.active_sessions or len(self.active_sessions) >= 4:
            yield {'type': 'error', 'text': 'An assistant turn is already running. Stop it or wait for the reply.'}
            return
        self.active_sessions.add(session_id)
        turn_id = uuid.uuid4().hex
        started = time.monotonic()
        self._prune()
        self.turns[turn_id] = {'created': time.time(), 'text': None}
        try:
            # The first bytes leave the server before scene retrieval or AI inference.
            yield {'type': 'ack', 'turnId': turn_id, 'text': ACKNOWLEDGMENT,
                   'mode': self.settings.effective_mode,
                   'audioUrl': f'/api/assistant/audio/{turn_id}/ack'}
            scene = await self.scene.snapshot()
            yield {'type': 'analyzing', 'turnId': turn_id,
                   'text': 'Looking at the image and obstacle readings…',
                   'frameId': scene['frameId'], 'cameraSessionId': scene['sessionId'],
                   'transport': scene['transport'], 'capturedAt': scene['capturedAt'],
                   'distanceSource': scene['distanceSource'], 'distances': scene['distances'],
                   'aligned': scene['aligned']}
            result = await self.gemma.describe(question, scene, history)
            if scene['alert']['level'] == 'danger' and not result['text'].lower().startswith('stop'):
                result['text'] = scene['alert']['message'] + ' ' + result['text']
            self.turns[turn_id]['text'] = result['text']
            yield {'type': 'answer', 'turnId': turn_id, **result,
                   'frameId': scene['frameId'], 'cameraSessionId': scene['sessionId'],
                   'sceneAgeMs': max(0, int(time.time()*1000-scene['capturedAt'])),
                   'elapsedMs': round((time.monotonic()-started)*1000),
                   'audioUrl': f'/api/assistant/audio/{turn_id}/answer'}
        except (SceneUnavailable, ProviderError) as error:
            self.turns[turn_id]['text'] = str(error)
            yield {'type': 'error', 'turnId': turn_id, 'text': str(error),
                   'audioUrl': f'/api/assistant/audio/{turn_id}/answer'}
        finally:
            self.active_sessions.discard(session_id)
