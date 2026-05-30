"""
Razorpay payment service wrapper.
Uses dummy keys from .env for now — replace before going live.
"""
from __future__ import annotations

import hashlib
import hmac
import razorpay

from app.core.config import settings

# Lazily create client so startup doesn't fail with dummy keys
def _get_client() -> razorpay.Client:
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )


class PaymentService:

    @staticmethod
    def create_order(amount_inr: float, plan_name: str, receipt: str) -> dict:
        """
        Create a Razorpay order.
        amount_inr: amount in Indian Rupees (will be converted to paise).
        Returns the full Razorpay order dict.
        """
        client = _get_client()
        amount_paise = int(amount_inr * 100)
        order = client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "notes": {"plan": plan_name},
        })
        return order

    @staticmethod
    def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
        """
        Verify Razorpay HMAC-SHA256 signature.
        Returns True if valid, False if tampered.
        """
        body = f"{order_id}|{payment_id}"
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
