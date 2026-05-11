from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.ai_service import AIService
from app.services.image_service import ImageService
from app.schemas.chat import ChatRequest

router = APIRouter()

@router.post("/")
async def chat_with_char(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Fetch character from DB (using character_id from request)
    # 2. Fetch User Memory/History from DB
    # 3. Get AI Response from AIService
    # 4. If [[brackets]] found, call ImageService
    # 5. Save message to ChatMessage table
    # 6. Return response
    return {"status": "success"}