import requests

FAL_API_KEY = "aba210ab-52dd-429e-8afa-e33839fae004:a1a15ed9f92772e29978d031a07f0522"
headers = {
    "Authorization": f"Key {FAL_API_KEY}",
    "Content-Type": "application/json",
}

print("Testing fal.ai fast-sdxl (NSFW)...")
r = requests.post(
    "https://fal.run/fal-ai/fast-sdxl",
    json={
        "prompt": "RAW photo, photorealistic, beautiful woman, nude, bare breasts, boudoir photography, 8k, sharp face",
        "negative_prompt": "clothes, underwear, blurry, cartoon, deformed, ugly, bad anatomy",
        "image_size": {"width": 832, "height": 1216},
        "num_inference_steps": 30,
        "guidance_scale": 7.5,
        "num_images": 1,
        "enable_safety_checker": False,
        "seed": 42,
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
        # Download and check
        img = requests.get(url, timeout=30)
        print(f"Image size: {len(img.content)} bytes, Content-Type: {img.headers.get('Content-Type')}")
        if len(img.content) > 10000:
            print("REAL IMAGE CONFIRMED!")
        else:
            print("WARNING: Image too small, might be black/empty")
    else:
        print(f"No images: {data}")
else:
    print(f"Error: {r.text[:400]}")
