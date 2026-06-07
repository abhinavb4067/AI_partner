from huggingface_hub import snapshot_download

print("Downloading SG161222/Realistic_Vision_V5.1_noVAE...")
snapshot_download(
    repo_id="SG161222/Realistic_Vision_V5.1_noVAE", 
    allow_patterns=["*.safetensors", "*.json", "*.txt"],
    resume_download=True
)
print("Download successful!")
