"""ElevenLabs voice TTS endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
import io

from app.core.database import get_db
from app.models.all_models import Character, UserAccount
from app.api.deps import get_current_user
from app.services.voice_service import VoiceService

router = APIRouter()

# Credit cost per TTS request
VOICE_CREDIT_COST = 2


class TTSRequest(BaseModel):
    char_id: int
    text: str


@router.post("/tts")
async def text_to_speech(
    req: TTSRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    char = db.query(Character).filter(Character.id == req.char_id, Character.is_active == True).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    if not char.voice_enabled or not char.elevenlabs_voice_id:
        raise HTTPException(status_code=400, detail="Voice is not enabled for this character")

    # Credit check
    if not current_user.is_unlimited:
        if current_user.credits_remaining < VOICE_CREDIT_COST:
            raise HTTPException(
                status_code=402,
                detail={"code": "out_of_credits", "required": VOICE_CREDIT_COST, "available": current_user.credits_remaining}
            )

    audio_bytes = await VoiceService.text_to_speech(req.text, char.elevenlabs_voice_id)

    # Deduct credits
    if not current_user.is_unlimited:
        current_user.credits_remaining -= VOICE_CREDIT_COST
        db.commit()

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=voice.mp3"},
    )
