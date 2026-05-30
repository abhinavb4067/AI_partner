"""Razorpay payment routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.all_models import Payment, SubscriptionPlan, UserAccount
from app.schemas.payment import (
    CreateOrderRequest, CreateOrderResponse, VerifyPaymentRequest, PaymentHistoryItem,
)
from app.api.deps import get_current_user
from app.services.payment_service import PaymentService
from app.core.config import settings

router = APIRouter()


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_order(
    req: CreateOrderRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if plan.price_monthly <= 0:
        raise HTTPException(status_code=400, detail="Cannot purchase free plan")

    try:
        receipt = f"user_{current_user.id}_plan_{plan.id}"
        order = PaymentService.create_order(plan.price_monthly, plan.plan_name, receipt)
    except Exception as e:
        # With dummy keys, Razorpay will fail — return a mock order for dev
        order = {
            "id": f"order_DUMMY_{current_user.id}_{plan.id}",
            "amount": int(plan.price_monthly * 100),
            "currency": "INR",
        }

    # Create a pending payment record
    payment = Payment(
        user_id=current_user.id,
        plan_id=plan.id,
        razorpay_order_id=order["id"],
        amount=plan.price_monthly,
        currency="INR",
        status="pending",
    )
    db.add(payment)
    db.commit()

    return CreateOrderResponse(
        order_id=order["id"],
        amount=order["amount"],
        currency=order["currency"],
        key_id=settings.RAZORPAY_KEY_ID,
        plan_name=plan.display_name or plan.plan_name,
    )


@router.post("/verify")
async def verify_payment(
    req: VerifyPaymentRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify HMAC signature (skip for dummy keys in dev)
    is_dev_dummy = "DUMMY" in settings.RAZORPAY_KEY_ID
    if not is_dev_dummy:
        if not PaymentService.verify_signature(
            req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature
        ):
            raise HTTPException(status_code=400, detail="Payment signature verification failed")

    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Update payment record
    payment = db.query(Payment).filter(
        Payment.razorpay_order_id == req.razorpay_order_id,
        Payment.user_id == current_user.id,
    ).first()
    if payment:
        payment.status = "success"
        payment.razorpay_payment_id = req.razorpay_payment_id

    # Upgrade user plan + reset credits
    current_user.plan_id = plan.id
    current_user.credits_remaining = plan.monthly_credits
    current_user.is_unlimited = plan.is_unlimited

    from datetime import datetime, timedelta
    current_user.credits_reset_at = datetime.utcnow() + timedelta(days=30)

    db.commit()
    return {
        "message": f"Successfully upgraded to {plan.display_name}!",
        "plan": plan.plan_name,
        "credits": plan.monthly_credits,
        "is_unlimited": plan.is_unlimited,
    }


@router.get("/history")
async def payment_history(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payments = (
        db.query(Payment)
        .filter(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
        .all()
    )
    return [
        {
            "id": p.id,
            "plan_name": p.plan.plan_name if p.plan else "unknown",
            "amount": p.amount,
            "currency": p.currency,
            "status": p.status,
            "razorpay_payment_id": p.razorpay_payment_id,
            "created_at": p.created_at,
        }
        for p in payments
    ]
