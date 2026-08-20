from typing import Optional
from pydantic import BaseModel

class ChatRequest(BaseModel):
    user_id: str
    char_id: str  
    message: str
    user_public_key: Optional[str] = None
    encrypted_user_content: Optional[str] = None