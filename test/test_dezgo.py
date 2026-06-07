import requests

print("Testing Dezgo...")
r = requests.post(
    "https://api.dezgo.com/text2image",
    data={
        "prompt": "nude beautiful woman, breasts, photorealistic",
        "model": "epicrealism_1_4",
        "guidance": 7.0,
        "steps": 20
    },
    timeout=30
)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"SUCCESS! Image size: {len(r.content)} bytes")
else:
    print(f"Error: {r.text[:400]}")
