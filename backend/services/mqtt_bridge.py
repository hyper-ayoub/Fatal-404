"""Subscribe to the real simulator camera topic without publishing voice data."""
import json
from urllib.parse import unquote, urlparse
import uuid

import paho.mqtt.client as mqtt

from .scene_state import SceneUnavailable


class AssistantMqttBridge:
    def __init__(self, settings, state):
        self.settings, self.state = settings, state
        self.connected = False
        self.received = 0
        self.last_error = None
        self.client = None
        self.topic = f'openpilot/{settings.mqtt_session}/simulator/camera/frame'

    def start(self):
        if not self.settings.mqtt_enabled:
            return
        endpoint = urlparse(self.settings.mqtt_url)
        if endpoint.scheme not in ('mqtt', 'mqtts', 'ws', 'wss'):
            self.last_error = 'Unsupported MQTT URL scheme'
            return
        websocket = endpoint.scheme in ('ws', 'wss')
        secure = endpoint.scheme in ('mqtts', 'wss')
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                                  client_id='openpilot-assistant-' + uuid.uuid4().hex,
                                  transport='websockets' if websocket else 'tcp')
        username = self.settings.mqtt_username or unquote(endpoint.username or '')
        password = self.settings.mqtt_password or unquote(endpoint.password or '')
        if username:
            self.client.username_pw_set(username, password)
        if secure:
            self.client.tls_set()
        if websocket:
            self.client.ws_set_options(path=endpoint.path or '/mqtt')
        self.client.reconnect_delay_set(min_delay=1, max_delay=10)
        self.client.on_connect = self._connected
        self.client.on_disconnect = self._disconnected
        self.client.on_message = self._message
        self.client.connect_async(endpoint.hostname, endpoint.port or (443 if secure and websocket else 80 if websocket else 8883 if secure else 1883), keepalive=30)
        self.client.loop_start()

    def _connected(self, client, userdata, flags, reason_code, properties):
        self.connected = reason_code == 0
        if self.connected:
            self.last_error = None
            client.subscribe(self.topic)
        else:
            self.last_error = 'MQTT connection refused'

    def _disconnected(self, client, userdata, flags, reason_code, properties):
        self.connected = False

    def _message(self, client, userdata, message):
        if message.retain or len(message.payload) > 768000:
            return
        try:
            if self.state.update(json.loads(message.payload)):
                self.received += 1
                self.last_error = None
        except (ValueError, TypeError, SceneUnavailable):
            self.last_error = 'Ignored invalid or stale camera observation'

    def status(self):
        return {'connected': self.connected, 'receivedFrames': self.received,
                'topic': self.topic, 'lastError': self.last_error}

    def stop(self):
        if self.client:
            self.client.disconnect()
            self.client.loop_stop()
