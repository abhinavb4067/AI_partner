import requests

print("Testing Hercai...")
r = requests.get(
    "https://hercai.onrender.com/v3/text2image?prompt=nude+beautiful+woman+breasts",
    timeout=30
)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print("SUCCESS!", data)
else:
    print(f"Error: {r.text[:400]}")
