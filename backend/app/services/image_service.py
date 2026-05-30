import requests
import random
import os
import urllib.parse
from datetime import datetime

class ImageService:
    @staticmethod
    def generate_smart_image(description: str, user_msg: str, char_dna: dict, char_name: str, user_name: str, background_tasks=None):
        seed = random.randint(1, 1000000)
        
        # 1. Intent Detection
        lower_keywords = ["vagina", "pussy", "crotch", "spread", "legs", "panties", "oanties", "bottomless"]
        naked_keywords = [
            "naked", "nude", "undressed", "anatomy", "breasts", "clothes off", 
            "bra", "bras", "without clothes", "topless", "boobs", "tits", 
            "take off", "strip", "bare"
        ] + lower_keywords
        user_asked_naked = any(word in user_msg.lower() for word in naked_keywords)
        ai_wants_naked = any(word in description.lower() for word in naked_keywords)
        user_asked_lower = any(word in user_msg.lower() for word in lower_keywords)
        is_unrestricted = user_asked_naked or ai_wants_naked

        # 2. Gender anchor — placed FIRST in prompt for maximum model weight
        gender = char_dna.get('gender', 'female') or 'female'
        if gender == 'female':
            gender_anchor = "1girl, solo female, woman, feminine, female body"
            gender_negatives = (
                "man, male, boy, masculine, beard, mustache, chest hair, "
                "male face, male body, penis, testicles, muscular man, "
                "shirtless man, guy, 1boy, solo male"
            )
        elif gender == 'male':
            gender_anchor = "1boy, solo male, man, masculine"
            gender_negatives = "woman, female, girl, feminine, breasts, vagina"
        else:
            gender_anchor = "1person, solo"
            gender_negatives = ""

        # 3. Face sharpness anchor — FRONT of prompt = highest weight
        face_anchor = (
            "sharp face, ultra sharp facial features, in focus face, "
            "perfect eyes, detailed iris, crisp eyelashes, "
            "pore-level skin detail, photorealistic face, 8k face"
        )
        face_logic = (
            "highly detailed face, symmetric facial features, sharp focused eyes, perfectly formed nose, "
            "realistic iris detail, natural eyelashes, visible skin pores, realistic lip texture"
        )
        bg = "luxury penthouse, expensive interior, soft cinematic lighting"
        face_blur_negatives = (
            "blurry face, out of focus face, blurry eyes, soft focus, "
            "unfocused, motion blur, gaussian blur, low detail face, "
            "smeared face, washed out face, muddy face, low res face, "
            "pixelated face, jpeg artifacts on face"
        )
        base_negatives = (
            f"{gender_negatives}, {face_blur_negatives}, "
            "plastic, cartoon, 3d render, doll, airbrushed, cgi, digital art, fake skin"
        )

        # 4. Style Selection
        # face_anchor goes FIRST — diffusion models weight early tokens most heavily
        if not is_unrestricted:
            style_tags = (
                f"{face_anchor}, {gender_anchor}, {char_dna['identity']}, {char_dna['body']}, "
                f"{face_logic}, {bg}, wearing designer silk, "
                "shot on Sony A7R IV, 85mm G-Master lens, f/1.8, "
                "DSLR sharp focus on face, 8k raw photo, hyperrealistic"
            )
            negatives = base_negatives
        else:
            if user_asked_lower:
                pose_tags = (
                    f"{face_anchor}, {gender_anchor}, camera zoomed far out, ultra wide angle, "
                    "full body shot head to toes, completely naked, legs spread, explicit nude"
                )
            else:
                pose_tags = f"{face_anchor}, {gender_anchor}, full body wide shot, standing naked, completely unclothed"
            
            style_tags = (
                f"{pose_tags}, {char_dna['identity']}, {char_dna['body']}, {face_logic}, {bg}, "
                "realistic human skin anatomy, perfect anatomy, symmetrical breasts, "
                "detailed visible nipples, real skin texture, skin pores, "
                "high-end studio photography, professional lighting, perfectly proportioned body, masterpiece"
            )
            negatives = (
                f"{base_negatives}, clothes, underwear, lingerie, bikini, censored, "
                "cropped body, out of frame, toy, mannequin, bad anatomy, deformed, "
                "missing nipple, asymmetrical breasts, deformed face, mutated, extra limbs, missing limbs, ugly"
            )

        # 5. Build URL with proper encoding
        clean_desc = description.replace("perfect", "detailed").replace("flawless", "realistic")
        raw_prompt = (
            f"RAW photo, photorealistic, real human skin texture, "
            f"{clean_desc}, {style_tags}"
        )
        encoded_prompt = urllib.parse.quote(raw_prompt)
        encoded_negatives = urllib.parse.quote(negatives)
        
        # 768x1024 gives more pixels per face for sharper detail than 720x1280
        url = (
            f"https://image.pollinations.ai/prompt/{encoded_prompt}?"
            f"nologo=true&width=768&height=1024&seed={seed}&model=flux-realism"
        )
        
        local_path = ImageService.get_local_path(char_name, user_name, clean_desc)
        if background_tasks:
            background_tasks.add_task(ImageService.download_image, url, local_path)
        else:
            ImageService.download_image(url, local_path)
            
        return url, local_path

    @staticmethod
    def get_local_path(char_name: str, user_name: str, description: str):
        safe_char = "".join(c for c in char_name if c.isalnum() or c in " _-").strip().replace(" ", "_")
        safe_user = "".join(c for c in user_name if c.isalnum() or c in " _-.@").strip().replace(" ", "_")
        words = "".join(c for c in description if c.isalnum() or c == " ").split()
        keyword = "_".join(words[:4]) if words else "photo"
        base_folder = os.path.join("media", safe_char, safe_user)
        if not os.path.exists(base_folder):
            os.makedirs(base_folder)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{keyword}_{timestamp}.jpg"
        return os.path.join(base_folder, filename)

    @staticmethod
    def download_image(url: str, filepath: str):
        try:
            import time
            time.sleep(2)
            response = requests.get(url, timeout=120)
            with open(filepath, 'wb') as f:
                f.write(response.content)
        except Exception as e:
            print(f"Image Save Error: {e}")