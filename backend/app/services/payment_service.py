"""
Payment services for Stripe and Razorpay.

Mock mode (settings.PAYMENT_MOCK_MODE) lets you develop locally without real
gateway keys. It is an explicit, server-operator-controlled switch — it must
NEVER be inferred from the shape/contents of a secret key. The previous
implementation treated any key containing the substring "DUMMY" as "not
configured yet" and auto-approved every payment — which meant a production
deployment that simply forgot to replace the shipped placeholder keys was
silently handing out free premium/credits to anyone who called the API.
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
        if settings.PAYMENT_MOCK_MODE:
            return {
                "id": f"order_MOCK_{uuid.uuid4().hex[:8]}",
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
        if settings.PAYMENT_MOCK_MODE:
            return True

        if not settings.RAZORPAY_KEY_SECRET:
            # Fail CLOSED: an unconfigured/missing secret must never verify a
            # payment as legitimate.
            return False

        body = f"{order_id}|{payment_id}"
        expected = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature or "")


# ── STRIPE ───────────────────────────────────────────────────────────────
class StripeService:
    @staticmethod
    def _init_stripe():
        import stripe
        stripe.api_key = settings.STRIPE_SECRET_KEY

    @staticmethod
    def create_checkout_session(amount_inr: float, plan_name: str, success_url: str, cancel_url: str, metadata: dict) -> Dict[str, Any]:
        """Creates a Stripe Checkout Session. Mocked only when PAYMENT_MOCK_MODE is on."""
        if settings.PAYMENT_MOCK_MODE:
            mock_session_id = f"cs_mock_{uuid.uuid4().hex}"
            return {
                "id": mock_session_id,
                "url": f"{success_url}?session_id={mock_session_id}",  # Auto-redirect to success for dev
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
        if settings.PAYMENT_MOCK_MODE:
            return True

        if not settings.STRIPE_SECRET_KEY:
            # Fail CLOSED: no key configured means we cannot verify anything.
            return False

        StripeService._init_stripe()
        import stripe

        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return session.payment_status == "paid"
        except Exception as e:
            print(f"Stripe Verify Error: {e}")
            return False
