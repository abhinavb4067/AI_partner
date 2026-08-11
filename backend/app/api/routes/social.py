from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from pydantic import BaseModel
from fastapi import UploadFile, File

from app.core.database import get_db
from app.models.all_models import UserAccount, HumanSwipe, HumanMatch
from app.api.deps import get_current_user
from app.utils.file_upload import save_chat_image

router = APIRouter()

class SwipeRequest(BaseModel):
    target_id: str
    is_like: bool

@router.get("/discover")
async def discover_humans(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get humans the user hasn't swiped on yet."""
    # IDs we have already swiped on
    swiped_ids = db.query(HumanSwipe.target_id).filter(HumanSwipe.swiper_id == current_user.id).all()
    swiped_ids = [s[0] for s in swiped_ids]
    
    # Base query: everyone except ourselves and people we swiped on
    query = db.query(UserAccount).filter(
        UserAccount.id != current_user.id,
        ~UserAccount.id.in_(swiped_ids),
        UserAccount.is_active == True,
        UserAccount.username.isnot(None) # Only people who set a username
    ).limit(20)
    
    users = query.all()
    
    return [
        {
            "id": u.id,
            "username": u.username,
            "name": u.name,
            "avatar_url": u.avatar_url,
            "age": u.age
        } for u in users
    ]

@router.post("/swipe")
async def swipe_human(
    req: SwipeRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a swipe. If mutual like, create a match."""
    if req.target_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot swipe yourself")
        
    target_user = db.query(UserAccount).filter(UserAccount.id == req.target_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if already swiped
    existing = db.query(HumanSwipe).filter(
        HumanSwipe.swiper_id == current_user.id,
        HumanSwipe.target_id == req.target_id
    ).first()
    
    if existing:
        return {"message": "Already swiped", "match": False}
        
    # Record swipe
    swipe = HumanSwipe(swiper_id=current_user.id, target_id=req.target_id, is_like=req.is_like)
    db.add(swipe)
    
    is_match = False
    if req.is_like:
        # Check if they liked us back
        mutual = db.query(HumanSwipe).filter(
            HumanSwipe.swiper_id == req.target_id,
            HumanSwipe.target_id == current_user.id,
            HumanSwipe.is_like == True
        ).first()
        
        if mutual:
            # Create a match
            match = HumanMatch(user1_id=current_user.id, user2_id=req.target_id)
            db.add(match)
            is_match = True
            
    db.commit()
    
    return {"message": "Swiped successfully", "is_match": is_match}

@router.get("/matches")
async def get_matches(
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all human matches for the current user."""
    matches = db.query(HumanMatch).filter(
        or_(HumanMatch.user1_id == current_user.id, HumanMatch.user2_id == current_user.id)
    ).all()
    
    result = []
    for m in matches:
        other_id = m.user2_id if m.user1_id == current_user.id else m.user1_id
        other_user = db.query(UserAccount).filter(UserAccount.id == other_id).first()
        if other_user:
            result.append({
                "match_id": m.id,
                "user_id": other_user.id,
                "username": other_user.username,
                "name": other_user.name,
                "avatar_url": other_user.avatar_url,
                "matched_at": m.created_at
            })
            
    return result

@router.get("/search/{username}")
async def search_user(
    username: str,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Direct search by username."""
    user = db.query(UserAccount).filter(UserAccount.username == username.lower().strip()).first()
    if not user or user.id == current_user.id:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "avatar_url": user.avatar_url
    }

@router.get("/user/{user_id}")
async def get_user_by_id(
    user_id: str,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Direct fetch by ID."""
    user = db.query(UserAccount).filter(UserAccount.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    from app.api.routes.ws_chat import manager
    is_online = user_id in manager.active_connections
        
    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "is_online": is_online,
        "last_seen": user.last_seen.isoformat() + "Z" if getattr(user, 'show_last_seen', True) and user.last_seen else None,
        "show_last_seen": getattr(user, 'show_last_seen', True)
    }

@router.post("/chat-image")
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: UserAccount = Depends(get_current_user)
):
    """Upload a chat image to GCS."""
    url = await save_chat_image(file, current_user.id)
    return {"url": url}
