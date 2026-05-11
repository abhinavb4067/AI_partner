from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.all_models import UserAccount, SubscriptionPlan
from pydantic import BaseModel, EmailStr

router = APIRouter()

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    age: int
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/register")
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # 1. Check if user exists
    existing = db.query(UserAccount).filter(UserAccount.user_id == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 2. Get the default 'free' plan ID
    free_plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.plan_name == "free").first()
    
    # 3. Create User
    new_user = UserAccount(
        user_id=req.email, # Using email as the unique ID for now
        name=req.name,
        plan_id=free_plan.id,
        tokens_left=50
    )
    # Note: In a real app, you would hash the password here.
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully", "user_id": req.email}

@router.post("/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.user_id == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Add your password check logic here
    return {"message": "Login successful", "user_id": user.user_id, "name": user.name}