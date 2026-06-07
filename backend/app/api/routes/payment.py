"""Payment routes supporting both Stripe and Razorpay."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import uuid

from app.core.database import get_db
from app.models.all_models import Payment, SubscriptionPlan, UserAccount
from app.schemas.payment import (
    CreateOrderRequest, CreateOrderResponse, VerifyPaymentRequest, PaymentHistoryItem,
)
from app.api.deps import get_current_user
from app.services.payment_service import RazorpayService, StripeService
from app.core.config import settings

router = APIRouter()

@router.get("/config")
async def get_payment_config():
    """Tells the frontend which gateway is active and its public key."""
    gateway = settings.ACTIVE_PAYMENT_GATEWAY.lower()
    if gateway == "stripe":
        return {"gateway": "stripe", "public_key": settings.STRIPE_PUBLISHABLE_KEY}
    return {"gateway": "razorpay", "public_key": settings.RAZORPAY_KEY_ID}

@router.get("/plans")
async def get_public_plans(db: Session = Depends(get_db)):
    return db.query(SubscriptionPlan).filter(SubscriptionPlan.is_active == True).all()


@router.post("/create-order")
async def create_order(
    req: CreateOrderRequest,
    request: Request,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    if plan.price_monthly <= 0:
        raise HTTPException(status_code=400, detail="Cannot purchase free plan")

    gateway = settings.ACTIVE_PAYMENT_GATEWAY.lower()
    
    # Check if origin is available
    origin = request.headers.get("origin", "http://localhost:5173")

    if gateway == "stripe":
        # Stripe Flow
        success_url = f"{origin}/payment-success"
        cancel_url = f"{origin}/pricing"
        
        session_data = StripeService.create_checkout_session(
            amount_inr=plan.price_monthly,
            plan_name=plan.display_name or plan.plan_name,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": current_user.id, "plan_id": plan.id}
        )
        
        payment = Payment(
            user_id=current_user.id,
            plan_id=plan.id,
            razorpay_order_id=session_data["id"], # We'll repurpose this column for session_id
            amount=plan.price_monthly,
            currency="INR",
            status="pending",
        )
        db.add(payment)
        db.commit()
        
        return {"gateway": "stripe", "checkout_url": session_data["url"]}
        
    else:
        # Razorpay Flow
        receipt = f"user_{current_user.id}_plan_{plan.id}"
        order = RazorpayService.create_order(plan.price_monthly, plan.plan_name, receipt)

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

        return {
            "gateway": "razorpay",
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": settings.RAZORPAY_KEY_ID,
            "plan_name": plan.display_name or plan.plan_name,
        }


@router.post("/verify")
async def verify_payment(
    req: VerifyPaymentRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    gateway = settings.ACTIVE_PAYMENT_GATEWAY.lower()

    if gateway == "stripe":
        session_id = req.razorpay_order_id
        is_valid = StripeService.verify_session(session_id)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Stripe session verification failed")
            
        payment = db.query(Payment).filter(
            Payment.razorpay_order_id == session_id,
            Payment.user_id == current_user.id,
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")
            
        payment.status = "success"
        payment.razorpay_payment_id = session_id
        
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payment.plan_id).first()
            
    else:
        is_valid = RazorpayService.verify_signature(
            req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail="Razorpay signature verification failed")

        payment = db.query(Payment).filter(
            Payment.razorpay_order_id == req.razorpay_order_id,
            Payment.user_id == current_user.id,
        ).first()
        
        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")
            
        payment.status = "success"
        payment.razorpay_payment_id = req.razorpay_payment_id
        
        plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payment.plan_id).first()

    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Upgrade user plan + add credits
    current_user.plan_id = plan.id
    current_user.credits_remaining = (current_user.credits_remaining or 0) + plan.monthly_credits
    current_user.is_unlimited = plan.is_unlimited

    from datetime import datetime, timedelta
    current_user.credits_reset_at = datetime.utcnow() + timedelta(days=30)

    db.commit()
    return {
        "message": f"Successfully upgraded to {plan.display_name}!",
        "plan": plan.plan_name,
        "credits": current_user.credits_remaining,
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
