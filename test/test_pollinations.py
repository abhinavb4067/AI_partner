import requests
import urllib.parse

prompt = "RAW photo, beautiful woman, bare breasts, nude body, 8k, professional photography"
encoded_prompt = urllib.parse.quote(prompt)

url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=832&height=1216&nologo=true&seed=123"

print(f"Testing Pollinations.ai GET request...")
r = requests.get(url, timeout=30)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    print(f"SUCCESS! Image size: {len(r.content)} bytes, Content-Type: {r.headers.get('Content-Type')}")
else:
    print(f"Error: {r.text[:400]}")
