from pydantic import BaseModel

class ChatRequest(BaseModel):
    user_id: str
    char_id: int  
    message: str