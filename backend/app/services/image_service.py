"""
Image generation service using fal.ai FLUX Pro.
- Primary model: fal-ai/flux-pro/v1.1-ultra (highest quality, up to 2K)
- Fallback model: fal-ai/flux/dev (fast, NSFW-capable)
- Downloads images locally so they are served by the backend (never expires)
"""
import requests
import random
import os
from datetime import datetime

from app.core.config import settings


FAL_HEADERS = {
    "Authorization": f"Key {settings.FAL_API_KEY}",
    "Content-Type": "application/json",
}


class ImageService:
    @staticmethod
    def generate_smart_image(
        description: str,
        user_msg: str,
        char_dna: dict,
        char_name: str,
        user_name: str,
        background_tasks=None,   # kept for API compat, no longer used
    ):
        seed = random.randint(1, 1_000_000)

        # ── 1. Intent detection ────────────────────────────────────────────────
        lower_keywords = ["vagina", "pussy", "crotch", "spread", "panties", "bottomless"]
        naked_keywords = [
            "naked", "nude", "undressed", "anatomy", "breasts", "clothes off",
            "bra", "without clothes", "topless", "boobs", "tits",
            "take off", "strip", "bare",
        ] + lower_keywords
        user_asked_naked   = any(w in user_msg.lower()    for w in naked_keywords)
        ai_wants_naked     = any(w in description.lower() for w in naked_keywords)
        user_asked_lower   = any(w in user_msg.lower()    for w in lower_keywords)
        
        chest_keywords = ["boobs", "tits", "breasts", "chest", "topless", "bra"]
        user_asked_chest = any(w in user_msg.lower() for w in chest_keywords)
        
        is_unrestricted    = user_asked_naked or ai_wants_naked or user_asked_chest

        # ── 2. Gender anchor ───────────────────────────────────────────────────
        gender = char_dna.get("gender", "female") or "female"
        if gender == "female":
            gender_anchor   = "1girl, solo female, woman, feminine, female body"
            gender_negative = (
                "man, male, boy, masculine, beard, mustache, chest hair, "
                "male face, male body, penis, testicles, muscular man, guy, 1boy, solo male"
            )
        elif gender == "male":
            gender_anchor   = "1boy, solo male, man, masculine"
            gender_negative = "woman, female, girl, feminine, breasts, vagina"
        else:
            gender_anchor   = "1person, solo"
            gender_negative = ""

        # ── 3. Quality anchors ─────────────────────────────────────────────────
        face_anchor = (
            "sharp face, in-focus face, perfect eyes, detailed iris"
        )
        bg = "luxury penthouse, expensive interior, soft cinematic lighting"

        base_negative = (
            f"{gender_negative}, "
            "blurry face, out of focus face, blurry eyes, soft focus, "
            "unfocused, motion blur, gaussian blur, low detail face, "
            "smeared face, washed out face, muddy face, low res face, "
            "pixelated face, jpeg artifacts, "
            "plastic, cartoon, 3d render, doll, airbrushed, cgi, digital art, fake skin"
        )

        # ── 4. Build prompt ────────────────────────────────────────────────────
        identity = char_dna.get("identity", "")
        body     = char_dna.get("body", "")
        clean_desc = description.replace("perfect", "detailed").replace("flawless", "realistic")

        if not is_unrestricted:
            prompt = (
                f"RAW photo, photorealistic, real human skin texture, "
                f"{clean_desc}, {face_anchor}, {gender_anchor}, "
                f"{identity}, {body}, {bg}, wearing designer silk, "
                "shot on Sony A7R IV, 85mm G-Master lens, f/1.8, "
                "DSLR sharp focus on face, 8k raw photo, hyperrealistic"
            )
            negative = base_negative + ", nudity, topless, explicit"
        else:
            if user_asked_lower:
                pose_extra = (
                    "lying on bed, legs spread, full body nude, intimate boudoir pose, "
                    "completely unclothed, artistic nude, explicit intimate photography, "
                    "camera zoomed out, wide shot"
                )
            elif user_asked_chest:
                pose_extra = (
                    "close-up on upper body, focusing on bare breasts, topless, "
                    "beautiful bare chest, detailed nipples, intimate portrait, "
                    "perfect cleavage, sensual upper body shot"
                )
            else:
                pose_extra = "standing fully nude, facing camera, arms relaxed, full body portrait, boudoir pose, medium wide shot"

            prompt = (
                f"RAW photo, ultra photorealistic, analog film, 8k uhd, "
                f"{clean_desc}, {gender_anchor}, "
                f"{pose_extra}, {identity}, {body}, {bg}, "
                "bare skin, unclothed, nude body, natural bare breasts, "
                "real human skin with natural imperfections, visible skin pores, "
                "natural breast shape, realistic nipples, "
                "natural body proportions, soft natural lighting on skin, "
                "subsurface skin scattering, realistic skin tone, "
                "shot on Phase One XF IQ4 150MP, 85mm lens, f/2.0, "
                "studio strobe lighting, "
                "perfect skin texture, ultra sharp full body, masterpiece, "
                "professional boudoir photography, adult content"
            )
            negative = (
                base_negative + ", "
                "clothes, underwear, lingerie, bikini, censored, mosaic, covered, "
                "cropped body, out of frame, bad anatomy, deformed, "
                "fake breasts, plastic skin, mannequin, doll, airbrushed skin, "
                "extra fingers, missing fingers, fused fingers, "
                "ugly, mutated, extra limbs, missing limbs, "
                "asymmetrical breasts, stiff pose, black image, solid color background, "
                "close up, portrait, face only, headshot"
            )

        # ── 5. Generate Image (Local or Cloud) ──────────────────────────────────
        local_path = ImageService._get_local_path(char_name, user_name, clean_desc)
        
        if is_unrestricted:
            print(f"🧠 Routing to Local GPU for uncensored generation | seed={seed}")
            try:
                from app.services.local_image_gen import LocalImageGenerator
                pil_image = LocalImageGenerator.generate(prompt, negative, seed=seed)
                
                # Save the PIL image locally
                abs_save_path = os.path.abspath(local_path)
                os.makedirs(os.path.dirname(abs_save_path), exist_ok=True)
                pil_image.save(abs_save_path)
                
                print(f"💾 Saved locally (GPU): {local_path}")
                return None, local_path
            except Exception as e:
                print(f"❌ Local GPU generation failed: {e}")
                return None, None
        else:
            print(f"📡 fal.ai request (SFW) | seed={seed}")
            image_url = ImageService._call_fal(prompt, negative, seed, is_unrestricted)
            if not image_url:
                print("❌ fal.ai failed — no image URL returned")
                return None, None

            print(f"✅ fal.ai image URL: {image_url[:80]}...")
            success = ImageService._download(image_url, local_path)
            if success:
                print(f"💾 Saved locally: {local_path}")
                return image_url, local_path

            # Return external URL as fallback even if local save failed
            return image_url, None

    # ── fal.ai REST call ───────────────────────────────────────────────────────
    @staticmethod
    def _call_fal(prompt: str, negative: str, seed: int, is_nsfw: bool) -> str | None:
        """
        NSFW → fal-ai/fast-sdxl (SDXL, properly uncensored, explicit NSFW capable)
        SFW  → fal-ai/flux-pro/v1.1-ultra (highest quality for clothed photos)
        """
        if is_nsfw:
            # SDXL: fully explicit NSFW capable with safety checker disabled
            endpoint = "https://fal.run/fal-ai/fast-sdxl"
            payload = {
                "prompt": prompt,
                "negative_prompt": negative,
                "image_size": {"width": 832, "height": 1216},
                "num_inference_steps": 35,
                "guidance_scale": 7.5,
                "num_images": 1,
                "enable_safety_checker": False,
                "seed": seed,
                "output_format": "jpeg",
            }
        else:
            # FLUX 1.1 Pro Ultra: best quality for clothed/SFW photos
            endpoint = "https://fal.run/fal-ai/flux-pro/v1.1-ultra"
            payload = {
                "prompt": prompt,
                "num_images": 1,
                "enable_safety_checker": False,
                "output_format": "jpeg",
                "aspect_ratio": "3:4",
                "seed": seed,
            }

        try:
            resp = requests.post(
                endpoint,
                json=payload,
                headers=FAL_HEADERS,
                timeout=120,
            )
            print(f"   fal.ai status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                images = data.get("images", [])
                if images:
                    return images[0].get("url")
            else:
                print(f"   fal.ai error body: {resp.text[:300]}")
        except Exception as e:
            print(f"   fal.ai exception: {e}")

        return None


    # ── helpers ────────────────────────────────────────────────────────────────
    @staticmethod
    def _get_local_path(char_name: str, user_name: str, description: str) -> str:
        safe_char = "".join(c for c in char_name  if c.isalnum() or c in " _-").strip().replace(" ", "_")
        safe_user = "".join(c for c in user_name  if c.isalnum() or c in " _-.@").strip().replace(" ", "_")
        words     = "".join(c for c in description if c.isalnum() or c == " ").split()
        keyword   = "_".join(words[:4]) if words else "photo"
        folder    = os.path.join("media", safe_char, safe_user)
        os.makedirs(folder, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return os.path.join(folder, f"{keyword}_{timestamp}.jpg")

    @staticmethod
    def _download(url: str, filepath: str) -> bool:
        try:
            r = requests.get(url, timeout=60)
            if r.status_code == 200 and len(r.content) > 1_000:
                with open(filepath, "wb") as f:
                    f.write(r.content)
                return True
            print(f"   Download failed: status={r.status_code}, size={len(r.content)}")
        except Exception as e:
            print(f"   Download error: {e}")
        return False

    # ── kept for backwards compat (old callers) ────────────────────────────────
    @staticmethod
    def get_local_path(char_name, user_name, description):
        return ImageService._get_local_path(char_name, user_name, description)

    @staticmethod
    def download_image(url, filepath):
        return ImageService._download(url, filepath)