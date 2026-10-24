import os
import torch
from pathlib import Path
from dotenv import load_dotenv
from transformers import pipeline

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

MODEL_ID = os.getenv("GEMMA_MODEL", "google/gemma-3-4b-it")

gemma = pipeline(
    task="image-text-to-text",
    model=MODEL_ID,
    device_map="auto",
    model_kwargs={"torch_dtype": "auto"}
)

def answer_question(question, image_path=None, scene=None):
    prompt = (
        "You are SensePath, an assistant for a visually impaired person. "
        "Describe the scene clearly, mention nearby obstacles, and give "
        "short, practical answers. Never invent details.\n"
        f"Scene detections: {scene or 'not available'}\n"
        f"User question: {question}"
    )

    messages = [{"role": "user", "content": []}]

    if image_path:
        messages[0]["content"].append({
            "type": "image",
            "url": str(Path(image_path).resolve())
        })

    messages[0]["content"].append({"type": "text", "text": prompt})

    result = gemma(text=messages, max_new_tokens=120)
    return result[0]["generated_text"][-1]["content"][0]["text"]
