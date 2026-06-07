"""
Payment services for Stripe and Razorpay.
Supports mock modes for local development without real keys.
"""
from __future__ import annotations

import hashlib
import hmac
import uuid
from typing import Dict, Any

from app.core.config import settings

# ── RAZORPAY ─────────────────────────────────────────────────────────────
class RazorpayService:
    @staticmethod
    def _get_client():
        import razorpay
        return razorpay.Client(
            auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
        )

    @staticmethod
    def create_order(amount_inr: float, plan_name: str, receipt: str) -> dict:
        if "DUMMY" in settings.RAZORPAY_KEY_ID:
            return {
                "id": f"order_DUMMY_{uuid.uuid4().hex[:8]}",
                "amount": int(amount_inr * 100),
                "currency": "INR",
            }
        
        client = RazorpayService._get_client()
        amount_paise = int(amount_inr * 100)
        return client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "notes": {"plan": plan_name},
        })

    @staticmethod
    def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
        if "DUMMY" in settings.RAZORPAY_KEY_ID:
            return True
        
        body = f"{order_id}|{payment_id}"
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


# ── STRIPE ───────────────────────────────────────────────────────────────
class StripeService:
    @staticmethod
    def _init_stripe():
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

    @staticmethod
    def create_checkout_session(amount_inr: float, plan_name: str, success_url: str, cancel_url: str, metadata: dict) -> Dict[str, Any]:
        """Creates a Stripe Checkout Session. Falls back to mock if keys are dummy."""
        if "DUMMY" in settings.STRIPE_SECRET_KEY:
            mock_session_id = f"cs_test_{uuid.uuid4().hex}"
            return {
                "id": mock_session_id,
                "url": f"{success_url}?session_id={mock_session_id}", # Auto-redirect to success for dev
            }

        StripeService._init_stripe()
        import stripe
        
        # Stripe expects amount in smallest currency unit (paise)
        amount_paise = int(amount_inr * 100)
        
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[{
                    "price_data": {
                        "currency": "inr",
                        "product_data": {
                            "name": plan_name,
                        },
                        "unit_amount": amount_paise,
                    },
                    "quantity": 1,
                }],
                mode="payment",
                success_url=f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=cancel_url,
                metadata=metadata,
            )
            return {
                "id": session.id,
                "url": session.url
            }
        except Exception as e:
            print(f"Stripe Session Error: {e}")
            raise

    @staticmethod
    def verify_session(session_id: str) -> bool:
        if "DUMMY" in settings.STRIPE_SECRET_KEY:
            return True

        StripeService._init_stripe()
        import stripe
        
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return session.payment_status == "paid"
        except Exception as e:
            print(f"Stripe Verify Error: {e}")
            return False
