import os
import tempfile
import imageio_ffmpeg
from faster_whisper import WhisperModel

# Inject imageio-ffmpeg's static ffmpeg binary into PATH so whisper can use it
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
ffmpeg_dir = os.path.dirname(ffmpeg_exe)
if ffmpeg_dir not in os.environ["PATH"]:
    os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ["PATH"]

_model = None

def get_whisper_model():
    global _model
    if _model is None:
        print("🎙️ Loading Local Whisper model (base)...")
        # Use 'base' model for fast transcription. 'device="auto"' will pick GPU if available.
        _model = WhisperModel("base", device="auto", compute_type="default")
    return _model

class STTService:
    @staticmethod
    def transcribe(audio_bytes: bytes) -> str:
        """
        Transcribes raw audio bytes (e.g. from webm) into text using faster-whisper.
        """
        model = get_whisper_model()
        
        # Save bytes to a temp file because ffmpeg needs a real file path to decode easily
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_path = temp_audio.name
            
        try:
            # Transcribe
            segments, info = model.transcribe(temp_path, beam_size=5)
            text = " ".join([segment.text for segment in segments])
            return text.strip()
        finally:
            # Clean up the temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
