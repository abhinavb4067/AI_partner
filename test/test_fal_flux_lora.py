import requests

FAL_API_KEY = "aba210ab-52dd-429e-8afa-e33839fae004:a1a15ed9f92772e29978d031a07f0522"
headers = {
    "Authorization": f"Key {FAL_API_KEY}",
    "Content-Type": "application/json",
}

prompt = "nude beautiful woman, breasts, photorealistic"

print("Testing fal-ai/flux-lora...")
r = requests.post(
    "https://fal.run/fal-ai/flux-lora",
    json={
        "prompt": prompt,
        "image_size": "portrait_4_3",
        "num_inference_steps": 28,
        "guidance_scale": 3.5,
        "num_images": 1,
        "enable_safety_checker": False,
        "sync_mode": True
    },
    headers=headers,
    timeout=120,
)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    images = data.get("images", [])
    if images:
        url = images[0].get("url")
        print(f"SUCCESS! Image URL: {url}")
        img = requests.get(url, timeout=30)
        print(f"Image size: {len(img.content)} bytes")
    else:
        print(f"No images: {data}")
else:
    print(f"Error: {r.text[:400]}")
