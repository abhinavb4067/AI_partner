import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Girlfriend"
    MEDIA_FOLDER: str = "maya_media"
    OLLAMA_URL: str = "http://localhost:11434/api/chat"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not os.path.exists(self.MEDIA_FOLDER):
            os.makedirs(self.MEDIA_FOLDER)

settings = Settings()