import requests
import json

FAL_API_KEY = "aba210ab-52dd-429e-8afa-e33839fae004:a1a15ed9f92772e29978d031a07f0522"
headers = {
    "Authorization": f"Key {FAL_API_KEY}",
    "Content-Type": "application/json",
}

prompt = "RAW photo, ultra photorealistic, analog film, 8k uhd, 25 year old beautiful woman, 1girl, solo female, woman, feminine, female body, lying on bed, legs spread, full body nude, intimate boudoir pose, completely unclothed, artistic nude, explicit intimate photography, camera zoomed out, wide shot, , , luxury penthouse, expensive interior, soft cinematic lighting, bare skin, unclothed, nude body, natural bare breasts, real human skin with natural imperfections, visible skin pores, natural breast shape, realistic nipples, natural body proportions, soft natural lighting on skin, subsurface skin scattering, realistic skin tone, shot on Phase One XF IQ4 150MP, 85mm lens, f/2.0, studio strobe lighting, perfect skin texture, ultra sharp full body, masterpiece, professional boudoir photography, adult content"

negative = "man, male, boy, masculine, beard, mustache, chest hair, male face, male body, penis, testicles, muscular man, guy, 1boy, solo male, blurry face, out of focus face, blurry eyes, soft focus, unfocused, motion blur, gaussian blur, low detail face, smeared face, washed out face, muddy face, low res face, pixelated face, jpeg artifacts, plastic, cartoon, 3d render, doll, airbrushed, cgi, digital art, fake skin, clothes, underwear, lingerie, bikini, censored, mosaic, covered, cropped body, out of frame, bad anatomy, deformed, fake breasts, plastic skin, mannequin, doll, airbrushed skin, extra fingers, missing fingers, fused fingers, ugly, mutated, extra limbs, missing limbs, asymmetrical breasts, stiff pose, black image, solid color background, close up, portrait, face only, headshot"

print("Testing exact prompt...")
r = requests.post(
    "https://fal.run/fal-ai/fast-sdxl",
    json={
        "prompt": prompt,
        "negative_prompt": negative,
        "image_size": {"width": 832, "height": 1216},
        "num_inference_steps": 35,
        "guidance_scale": 7.5,
        "num_images": 1,
        "enable_safety_checker": False,
        "seed": 12345,
        "output_format": "jpeg",
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
