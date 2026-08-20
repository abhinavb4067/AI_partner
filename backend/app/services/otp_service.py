"""
OTP Service — Rate-limited, secure 6-digit OTP generation, validation, and email delivery.
Protects against spam, bot abuse, and brute-force guessing.
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
import resend

from app.core.config import settings
from app.models.all_models import EmailOTP


class OTPService:
    COOLDOWN_SECONDS = 60      # 1 minute between requests
    EXPIRATION_MINUTES = 5     # 5 minutes TTL
    MAX_HOURLY_REQUESTS = 5    # Max 5 OTP requests per hour per email
    MAX_VERIFY_ATTEMPTS = 5    # Max 5 failed verification attempts before invalidation

    @classmethod
    def generate_and_send_otp(
        cls,
        db: Session,
        email: str,
        purpose: str, # 'register' | 'forgot_password'
    ) -> dict:
        now = datetime.utcnow()
        clean_email = email.lower().strip()

        # ── 1. Spam Protection: Cooldown Check (60s) ──────────────────────────
        latest_otp = (
            db.query(EmailOTP)
            .filter(EmailOTP.email == clean_email, EmailOTP.purpose == purpose)
            .order_by(EmailOTP.created_at.desc())
            .first()
        )

        if latest_otp:
            time_since_last = (now - latest_otp.created_at).total_seconds()
            if time_since_last < cls.COOLDOWN_SECONDS:
                remaining = int(cls.COOLDOWN_SECONDS - time_since_last)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Please wait {remaining} seconds before requesting another code."
                )

        # ── 2. Spam Protection: Hourly Request Cap (Max 5/hr) ─────────────────
        one_hour_ago = now - timedelta(hours=1)
        recent_count = (
            db.query(EmailOTP)
            .filter(EmailOTP.email == clean_email, EmailOTP.created_at >= one_hour_ago)
            .count()
        )
        if recent_count >= cls.MAX_HOURLY_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many verification requests. Please try again after 1 hour."
            )

        # ── 3. Clean up older OTPs for this email/purpose ─────────────────────
        db.query(EmailOTP).filter(
            EmailOTP.email == clean_email,
            EmailOTP.purpose == purpose
        ).delete()

        # ── 4. Generate 6-digit cryptographically secure OTP ──────────────────
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        expires_at = now + timedelta(minutes=cls.EXPIRATION_MINUTES)

        otp_record = EmailOTP(
            email=clean_email,
            otp_code=otp_code,
            purpose=purpose,
            expires_at=expires_at,
            attempts=0,
            is_verified=False,
            created_at=now,
        )
        db.add(otp_record)
        db.commit()

        # ── 5. Send Email via Resend ──────────────────────────────────────────
        cls._send_email(clean_email, otp_code, purpose)

        return {
            "message": f"Verification code sent to {clean_email}",
            "cooldown_seconds": cls.COOLDOWN_SECONDS,
            "expires_in_seconds": cls.EXPIRATION_MINUTES * 60,
        }

    @classmethod
    def verify_otp(
        cls,
        db: Session,
        email: str,
        otp_code: str,
        purpose: str,
        consume: bool = True
    ) -> bool:
        now = datetime.utcnow()
        clean_email = email.lower().strip()
        clean_otp = otp_code.strip()

        otp_record = (
            db.query(EmailOTP)
            .filter(EmailOTP.email == clean_email, EmailOTP.purpose == purpose)
            .order_by(EmailOTP.created_at.desc())
            .first()
        )

        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verification code found. Please request a new code."
            )

        # Check Expiration (5 minutes)
        if now > otp_record.expires_at:
            db.delete(otp_record)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired (5-minute limit). Please request a new code."
            )

        # Check Brute Force attempts
        if otp_record.attempts >= cls.MAX_VERIFY_ATTEMPTS:
            db.delete(otp_record)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect attempts. This code has been invalidated. Please request a new code."
            )

        # Validate Code
        if otp_record.otp_code != clean_otp:
            otp_record.attempts += 1
            db.commit()
            remaining_attempts = cls.MAX_VERIFY_ATTEMPTS - otp_record.attempts
            if remaining_attempts <= 0:
                db.delete(otp_record)
                db.commit()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Too many incorrect attempts. Please request a new code."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid verification code. {remaining_attempts} attempts remaining."
            )

        # Successful verification
        if consume:
            db.delete(otp_record)
            db.commit()
        else:
            otp_record.is_verified = True
            db.commit()

        return True

    @classmethod
    def _send_email(cls, email: str, otp_code: str, purpose: str):
        project_name = settings.PROJECT_NAME or "Avoiga"
        current_year = str(datetime.utcnow().year)

        template_filename = "register_otp.html" if purpose == "register" else "reset_password_otp.html"
        template_path = os.path.join(os.path.dirname(__file__), "..", "templates", "emails", template_filename)

        subject = f"{otp_code} is your {project_name} verification code" if purpose == "register" else f"{otp_code} is your {project_name} password reset code"

        try:
            with open(template_path, "r", encoding="utf-8") as f:
                html_content = f.read()
            html_content = html_content.replace("{{ otp_code }}", otp_code)
            html_content = html_content.replace("{{ project_name }}", project_name)
            html_content = html_content.replace("{{ current_year }}", current_year)
        except Exception as e:
            # Fallback simple HTML
            html_content = f"""
            <div style="font-family:sans-serif;padding:20px;background:#12121a;color:#fff;border-radius:10px;">
                <h2>{project_name} Verification Code</h2>
                <p>Your 6-digit code is:</p>
                <h1 style="letter-spacing:5px;color:#ff4081;">{otp_code}</h1>
                <p style="color:#ffa726;">⏱️ This code is valid for 5 minutes only.</p>
            </div>
            """

        if settings.RESEND_API_KEY:
            resend.api_key = settings.RESEND_API_KEY
            from_email = getattr(settings, "EMAILS_FROM_EMAIL", "noreply@ectama.com") or "noreply@ectama.com"
            try:
                res = resend.Emails.send({
                    "from": f"{project_name} <{from_email}>",
                    "to": [email],
                    "subject": subject,
                    "html": html_content
                })
                print(f"📧 [Resend] OTP email ({purpose}) successfully delivered to {email}. Resend ID: {res}")
            except Exception as e:
                print(f"❌ [Resend] Failed to send email to {email}: {e}")
                print(f"\n🔑 [FALLBACK CONSOLE OTP] Email: {email} | OTP: {otp_code} | Purpose: {purpose} (Valid 5 mins)\n")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to deliver email: {str(e)}"
                )
        else:
            print(f"\n🔑 [TEST CONSOLE OTP] Email: {email} | OTP: {otp_code} | Purpose: {purpose} (Valid 5 mins)\n")
