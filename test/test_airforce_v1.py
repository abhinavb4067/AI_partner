import requests

print("Testing api.airforce images/generations...")
r = requests.post(
    "https://api.airforce/v1/images/generations",
    json={
        "prompt": "nude beautiful woman, breasts, photorealistic",
        "size": "512x512",
        "model": "flux"
    },
    timeout=30
)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    url = data["data"][0]["url"]
    print(f"SUCCESS! URL: {url}")
else:
    print(f"Error: {r.text[:400]}")
