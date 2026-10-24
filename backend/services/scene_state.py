"""Fresh, synchronized camera/range snapshots from MQTT or the local studio."""
import base64
import copy
import math
import threading
import time

import httpx

MAX_AGE_MS = 2500


class SceneUnavailable(ValueError):
    pass


def validate_frame(frame, now=None):
    now = now or time.time() * 1000
    if not isinstance(frame, dict):
        raise SceneUnavailable('Invalid camera observation')
    captured = frame.get('capturedAt')
    if not isinstance(captured, (int, float)) or not math.isfinite(captured) or not -1000 <= now - captured <= MAX_AGE_MS:
        raise SceneUnavailable('Camera observation is stale')
    image = frame.get('image', '')
    if not isinstance(image, str) or len(image) > 500000:
        raise SceneUnavailable('Invalid camera image')
    try:
        jpeg = base64.b64decode(image, validate=True)
    except ValueError as error:
        raise SceneUnavailable('Invalid image encoding') from error
    if not jpeg.startswith(b'\xff\xd8') or not jpeg.endswith(b'\xff\xd9'):
        raise SceneUnavailable('Camera image is not JPEG')
    distances = frame.get('distances')
    if not isinstance(distances, dict):
        raise SceneUnavailable('Missing range readings')
    for direction in ('left', 'center', 'right'):
        if direction not in distances:
            raise SceneUnavailable('Incomplete range readings')
        value = distances[direction]
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not .02 <= value <= 10):
            raise SceneUnavailable('Invalid range reading')
    if not isinstance(frame.get('frameId'), int) or not isinstance(frame.get('sessionId'), str):
        raise SceneUnavailable('Missing frame identity')
    return frame


def proximity(distances):
    valid = [(direction, value) for direction, value in distances.items() if value is not None]
    if not valid:
        return {'level': 'unknown', 'message': 'No valid range readings.'}
    direction, distance = min(valid, key=lambda pair: pair[1])
    level = 'danger' if distance < .7 else 'warning' if distance < 1.5 else 'clear'
    message = (f'Stop. Obstacle {direction}, {distance:.1f} metres.' if level == 'danger' else
               f'Caution. Obstacle {direction}, {distance:.1f} metres.' if level == 'warning' else
               'No close return in the measured sensor rays.')
    return {'level': level, 'direction': direction, 'distance': distance, 'message': message}


class SceneState:
    def __init__(self):
        self._lock = threading.Lock()
        self._frame = None

    def update(self, frame):
        validate_frame(frame)
        with self._lock:
            if self._frame and frame['sessionId'] == self._frame['sessionId'] and frame['frameId'] <= self._frame['frameId']:
                return False
            self._frame = copy.deepcopy(frame)
        return True

    def current(self):
        with self._lock:
            frame = copy.deepcopy(self._frame)
        if frame:
            try:
                return validate_frame(frame)
            except SceneUnavailable:
                pass
        return None


class SceneProvider:
    def __init__(self, client, settings, state):
        self.client, self.settings, self.state = client, settings, state

    async def snapshot(self):
        frame = self.state.current()
        transport = 'mqtt' if frame else 'http'
        control = None
        # The local endpoint is fresher than the 1 Hz broker image. Prefer it when
        # reachable; MQTT remains a fully independent input if HTTP is unavailable.
        try:
            response = await self.client.get(self.settings.studio_url + '/api/camera/frame', timeout=2)
            response.raise_for_status()
            local = validate_frame(response.json())
            if not frame or local['capturedAt'] >= frame['capturedAt']:
                frame, transport = local, 'http'
        except (httpx.HTTPError, ValueError):
            pass
        if not frame:
            raise SceneUnavailable('No fresh camera image. Keep the simulator tab visible and try again.')
        try:
            response = await self.client.get(self.settings.studio_url + '/api/observation', timeout=1)
            response.raise_for_status()
            control = response.json()
        except (httpx.HTTPError, ValueError):
            pass
        validate_frame(frame)
        source = control.get('activeSource', 'simulator') if control else 'simulator'
        aligned = source == 'simulator'
        distances = frame['distances'] if aligned else (control.get('sensors') or {}).get('distances')
        distances = distances or {'left': None, 'center': None, 'right': None}
        return {'frameId': frame['frameId'], 'sessionId': frame['sessionId'],
                'capturedAt': frame['capturedAt'], 'image': frame['image'],
                'distances': distances, 'distanceSource': source, 'aligned': aligned,
                'alert': proximity(distances), 'transport': transport,
                'detections': (control.get('vision') or {}).get('detections', []) if control else []}
