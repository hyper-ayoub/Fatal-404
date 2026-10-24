# backend/services/vision.py

import json
import torch
from PIL import Image
from unsloth import FastVisionModel

MODEL_ID = "unsloth/gemma-3-4b-pt"


def load_model():
    model, processor = FastVisionModel.from_pretrained(
        model_name=MODEL_ID,
        load_in_4bit=True,
    )
    FastVisionModel.for_inference(model)
    return model, processor


def load_image(image_path):
    return Image.open(image_path).convert("RGB")


def build_prompt():
    return """
    Identify obstacles in the image.
    Divide them into left, center, and right zones.
    Return JSON only:
    {"left": [], "center": [], "right": []}
    Each item should contain an object's name.
    """


def analyze_image(model, processor, image):
    messages = [{
        "role": "user",
        "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": build_prompt()},
        ],
    }]

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)

    with torch.inference_mode():
        output = model.generate(**inputs, max_new_tokens=150)

    tokens = output[0][inputs["input_ids"].shape[-1]:]
    return processor.decode(tokens, skip_special_tokens=True)


def parse_result(response):
    start, end = response.find("{"), response.rfind("}") + 1
    if start < 0 or end <= start:
        raise ValueError("Gemma returned no JSON.")
    return json.loads(response[start:end])


def analyze_frame(image_path, model, processor):
    image = load_image(image_path)
    response = analyze_image(model, processor, image)
    return parse_result(response)