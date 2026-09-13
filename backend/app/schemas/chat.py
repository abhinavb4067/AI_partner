from typing import Optional
from pydantic import BaseModel

class ChatRequest(BaseModel):
    char_id: str
    message: str
    user_public_key: Optional[str] = None
    encrypted_user_content: Optional[str] = None
    # NOTE: user_id is intentionally NOT a field here — the calling user is
    # always derived from the verified JWT (see routes/chat.py), never from
    # client-supplied data. A stray "user_id" the frontend still sends in the
    # body is simply ignored by pydantic (extra fields are dropped by default).