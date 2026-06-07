import requests
import time

prompt = 'RAW photo, photorealistic, beautiful woman, sexy pose, luxury penthouse, facing camera'

# Stable Horde - with reduced parameters to pass anonymous limits
print('Testing Stable Horde submit...')
r = requests.post('https://stablehorde.net/api/v2/generate/async', json={
    'prompt': prompt + ' ### ugly, bad anatomy, blurry, cartoon',
    'params': {
        'sampler_name': 'k_euler_a',
        'cfg_scale': 7,
        'steps': 20,
        'width': 512,
        'height': 768,
        'n': 1
    },
    'models': ['Deliberate'],
    'r2': True
}, headers={
    'apikey': '0000000000',
    'Content-Type': 'application/json'
}, timeout=15)

print(f'Status: {r.status_code}')
print(f'Response: {r.text[:300]}')

if r.status_code == 202:
    job_id = r.json()['id']
    print(f'Job submitted: {job_id}')
    print('Waiting 10s and checking status...')
    time.sleep(10)
    r2 = requests.get(f'https://stablehorde.net/api/v2/generate/check/{job_id}', timeout=10)
    print(f'Status check: {r2.json()}')
