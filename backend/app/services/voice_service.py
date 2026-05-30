"""
ElevenLabs voice synthesis service.
Key is read from settings (.env). The voice_id is per-character (stored in DB).
Audio is streamed directly — never written to disk.
"""
from __future__ import annotations

import httpx
from fastapi import HTTPException, status

from app.core.config import settings


class VoiceService:

    @staticmethod
    async def text_to_speech(text: str, voice_id: str) -> bytes:
        """
        Call ElevenLabs TTS API and return raw MP3 bytes.
        Raises HTTP 503 if the API call fails.
        """
        url = f"{settings.ELEVENLABS_BASE_URL}/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": settings.ELEVENLABS_API_KEY,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": text[:500],          # cap at 500 chars per request
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.content
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"ElevenLabs API error: {e.response.status_code}",
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Voice service temporarily unavailable",
            )
