import torch
from diffusers import StableDiffusionPipeline, EulerAncestralDiscreteScheduler
import os
import sys

# Define model ID (uncensored photorealistic SD 1.5 model)
MODEL_ID = "SG161222/Realistic_Vision_V5.1_noVAE"

class LocalImageGenerator:
    _pipeline = None

    @classmethod
    def get_pipeline(cls):
        if cls._pipeline is None:
            print("Loading Local Stable Diffusion Pipeline (this may take a minute if downloading)...")
            try:
                # Path to the single safetensors model file
                model_path = os.path.join(os.path.dirname(__file__), "..", "..", "models", "Realistic_Vision_V5.1_fp16-no-ema.safetensors")
                
                print(f"Loading single file model from: {model_path} ...")
                pipe = StableDiffusionPipeline.from_single_file(
                    model_path,
                    torch_dtype=torch.float16,
                    safety_checker=None, # Explicitly disable safety checker for uncensored generation
                    requires_safety_checker=False
                )
                
                # Replace scheduler with Euler Ancestral
                pipe.scheduler = EulerAncestralDiscreteScheduler.from_config(pipe.scheduler.config)
                
                # Optimizations for 6GB VRAM
                pipe = pipe.to("cuda")
                pipe.enable_attention_slicing()
                
                cls._pipeline = pipe
                print("Pipeline loaded successfully on CUDA!")
            except Exception as e:
                print(f"Error loading pipeline: {e}")
                raise e
        return cls._pipeline

    @classmethod
    def generate(cls, prompt: str, negative_prompt: str, seed: int = -1):
        pipe = cls.get_pipeline()
        
        generator = torch.Generator(device="cuda")
        if seed != -1:
            generator.manual_seed(seed)
        else:
            generator.seed()
            
        print(f"Generating local image on GPU... (Prompt: {prompt[:50]}...)")
        
        # Inference settings for SD 1.5
        # 25 steps is usually enough for Euler A
        # 512x768 is good portrait resolution for 6GB VRAM
        image = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=25,
            guidance_scale=7.0,
            width=512,
            height=768,
            generator=generator
        ).images[0]
        
        return image

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "download":
        print("Pre-downloading the model weights to cache...")
        LocalImageGenerator.get_pipeline()
        print("Download complete.")
