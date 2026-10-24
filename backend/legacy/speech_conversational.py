
import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from elevenlabs.conversational_ai.conversation import Conversation
from elevenlabs.conversational_ai.default_audio_interface import DefaultAudioInterface

load_dotenv("backend/.env")

def create_client():
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise ValueError("ELEVENLABS_API_KEY is missing")
    return ElevenLabs(api_key=key)

def start_conversation(agent_id=None):
    agent_id = agent_id or os.getenv("ELEVENLABS_AGENT_ID")
    if not agent_id:
        raise ValueError("ELEVENLABS_AGENT_ID is missing")

    conversation = Conversation(
        client=create_client(),
        agent_id=agent_id,
        requires_auth=True,
        audio_interface=DefaultAudioInterface()
    )
    conversation.start_session()
    return conversation

def end_conversation(conversation):
    if conversation:
        conversation.end_session()
