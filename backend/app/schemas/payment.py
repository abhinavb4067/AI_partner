"""Pydantic schemas for payment endpoints."""
from __future__ import annotations
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class CreateOrderRequest(BaseModel):
    plan_id: int


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int           # paise
    currency: str
    key_id: str
    plan_name: str


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: int


class PaymentHistoryItem(BaseModel):
    id: int
    plan_name: str
    amount: float
    currency: str
    status: str
    razorpay_payment_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
