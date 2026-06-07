"""ElevenLabs voice TTS endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
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


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: UserAccount = Depends(get_current_user),
):
    from app.services.stt_service import STTService
    import os
    import uuid
    import tempfile
    import subprocess
    import imageio_ffmpeg
    try:
        audio_bytes = await file.read()
        
        # Save audio file permanently
        os.makedirs("media/voice_notes", exist_ok=True)
        base_name = uuid.uuid4().hex
        mp3_filename = f"{base_name}.mp3"
        mp3_path = f"media/voice_notes/{mp3_filename}"
        
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_webm = temp_audio.name
            
        try:
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            # Convert WebM to MP3 at 128k bit rate. This ensures correct duration metadata.
            subprocess.run([ffmpeg_exe, "-y", "-i", temp_webm, "-vn", "-ab", "128k", mp3_path], 
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        finally:
            if os.path.exists(temp_webm):
                os.remove(temp_webm)
            
        text = STTService.transcribe(audio_bytes)
        return {"text": text, "audio_url": f"/{mp3_path}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
