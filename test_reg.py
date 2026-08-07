import urllib.request
import json

url = "https://avoigabackend.ectama.com/api/auth/register"
data = {"name": "Test", "email": "testuser4@avoiga.ectama.com", "password": "Test@123", "age": 18}
req = urllib.request.Request(url, json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as res:
        print("Success:", res.read().decode())
except urllib.error.HTTPError as e:
    print("Error:", e.read().decode())
