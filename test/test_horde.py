import requests
import time

prompt = "nude beautiful woman, breasts, photorealistic"

print("Testing AI Horde...")
r = requests.post(
    "https://stablehorde.net/api/v2/generate/async",
    json={
        "prompt": prompt,
        "params": {
            "sampler_name": "k_euler_a",
            "cfg_scale": 7,
            "height": 512,
            "width": 512,
            "steps": 20,
        },
        "nsfw": True,
        "censor_nsfw": False,
        "models": ["Deliberate"]
    },
    headers={"apikey": "0000000000"}
)

print(r.status_code)
if r.status_code == 202:
    job_id = r.json()["id"]
    print(f"Job ID: {job_id}")
    while True:
        status = requests.get(f"https://stablehorde.net/api/v2/generate/status/{job_id}")
        data = status.json()
        if data["done"]:
            print("Done!")
            print(data["generations"][0]["img"])
            break
        print("Waiting...")
        time.sleep(3)
else:
    print(r.text)
