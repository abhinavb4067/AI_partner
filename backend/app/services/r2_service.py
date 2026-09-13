"""
Cloudflare R2 storage for AI-companion chat-generated photos.

R2 is S3-API-compatible, so this uses boto3's S3 client pointed at R2's
endpoint — no Cloudflare-specific SDK needed. The bucket is kept PRIVATE
(never made public); access still goes through the ownership check in
app/api/routes/media.py, which — once R2_ENABLED — issues a short-lived
presigned URL instead of streaming a local file. That keeps bandwidth off
the app server entirely (important on a 512MB droplet) while preserving the
same "only the owning user can fetch this" guarantee as local-disk serving.

Object keys mirror the old local folder layout exactly
(<char_name>/<sanitized_user_id>/<filename>) so the rest of the app (DB rows
storing "/media/<char>/<user>/<file>" as image URLs, the media route's
ownership check) needs no other changes.
"""
from __future__ import annotations

import io

from app.core.config import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        import boto3
        from botocore.config import Config as BotoConfig

        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=BotoConfig(signature_version="s3v4"),
            region_name="auto",
        )
    return _client


class R2Service:
    @staticmethod
    def upload_bytes(key: str, data: bytes, content_type: str = "image/jpeg") -> bool:
        try:
            _get_client().put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=io.BytesIO(data),
                ContentType=content_type,
            )
            return True
        except Exception as e:
            print(f"R2 upload failed for {key}: {e}")
            return False

    @staticmethod
    def presigned_get_url(key: str, expires_in: int = 300) -> str | None:
        """5-minute link by default — long enough for the browser to load the
        image, short enough that a leaked link (referrer headers, logs) isn't
        useful for long."""
        try:
            return _get_client().generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
                ExpiresIn=expires_in,
            )
        except Exception as e:
            print(f"R2 presign failed for {key}: {e}")
            return None

    @staticmethod
    def object_exists(key: str) -> bool:
        try:
            _get_client().head_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
            return True
        except Exception:
            return False
