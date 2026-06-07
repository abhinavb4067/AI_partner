import requests

print("Testing api.airforce...")
r = requests.get(
    "https://api.airforce/v1/imagine2?prompt=beautiful+naked+woman+full+body+photorealistic",
    timeout=30
)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"SUCCESS! Image size: {len(r.content)} bytes")
else:
    print(f"Error: {r.text[:400]}")
