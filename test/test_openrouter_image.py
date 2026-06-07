import requests
import json

r = requests.get("https://openrouter.ai/api/v1/models")
data = r.json()

free_image_models = []
for model in data["data"]:
    if "image" in model.get("architecture", {}).get("modality", "") or "image" in str(model):
        # We need to see if it generates images or only consumes images (vision).
        # We also need to check pricing.
        prompt_price = float(model.get("pricing", {}).get("prompt", -1))
        completion_price = float(model.get("pricing", {}).get("completion", -1))
        if prompt_price == 0 and completion_price == 0:
            free_image_models.append(model["id"])

print("Free models mentioning 'image':", free_image_models)
