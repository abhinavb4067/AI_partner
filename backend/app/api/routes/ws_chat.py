import json
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.core.database import SessionLocal, get_db
from app.core.security import decode_token
from app.models.all_models import UserAccount, HumanMessage
from app.api.deps import get_current_user

router = APIRouter()

# Connection Manager for WebSockets
class ConnectionManager:
    def __init__(self):
        # Maps user_id to their active WebSocket
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_text(message)
            except Exception:
                self.disconnect(user_id)

manager = ConnectionManager()


async def get_user_from_token(token: str, db: Session) -> UserAccount:
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(UserAccount).filter(UserAccount.user_id == user_id).first()
    except Exception:
        return None


@router.websocket("/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    db = SessionLocal()
    user = await get_user_from_token(token, db)
    
    if not user:
        await websocket.close(code=1008)
        db.close()
        return
        
    user_id = user.id
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                msg_type = payload.get("type")
                target_id = payload.get("target_id")
                
                # Handling WebRTC Signaling
                if msg_type in ["call_request", "call_accept", "call_reject", "offer", "answer", "ice_candidate"]:
                    if target_id:
                        # Forward the exact signaling message to the target user
                        payload["sender_id"] = user_id
                        await manager.send_personal_message(json.dumps(payload), target_id)
                        
                # Handling Text / Photo Messages
                elif msg_type in ["text", "image", "view_once"]:
                    content = payload.get("content")
                    if target_id and content:
                        # Save to DB
                        new_msg = HumanMessage(
                            sender_id=user_id,
                            receiver_id=target_id,
                            content=content,
                            message_type=msg_type
                        )
                        db.add(new_msg)
                        db.commit()
                        db.refresh(new_msg)
                        
                        # Forward to target
                        out_msg = {
                            "type": "new_message",
                            "message": {
                                "id": new_msg.id,
                                "sender_id": user_id,
                                "receiver_id": target_id,
                                "content": content if msg_type != "view_once" else "[HIDDEN]",
                                "message_type": msg_type,
                                "created_at": new_msg.created_at.isoformat() + "Z"
                            }
                        }
                        await manager.send_personal_message(json.dumps(out_msg), target_id)
                        
                        # Send ack back to sender
                        out_msg["message"]["content"] = content # Sender can always see what they sent
                        await manager.send_personal_message(json.dumps(out_msg), user_id)
                        
                # Handling View-Once View Receipt
                elif msg_type == "viewed":
                    msg_id = payload.get("message_id")
                    if msg_id:
                        msg = db.query(HumanMessage).filter(HumanMessage.id == msg_id).first()
                        if msg and msg.receiver_id == user_id and msg.message_type == "view_once":
                            msg.is_viewed = True
                            db.commit()
                            # Notify sender that it was viewed
                            ack = {
                                "type": "message_viewed",
                                "message_id": msg_id,
                                "receiver_id": user_id
                            }
                            await manager.send_personal_message(json.dumps(ack), msg.sender_id)

            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"WS Error: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    finally:
        db.close()


@router.get("/history/{target_id}")
async def get_human_history(
    target_id: str,
    current_user: UserAccount = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    messages = db.query(HumanMessage).filter(
        or_(
            and_(HumanMessage.sender_id == current_user.id, HumanMessage.receiver_id == target_id),
            and_(HumanMessage.sender_id == target_id, HumanMessage.receiver_id == current_user.id)
        )
    ).order_by(HumanMessage.created_at.asc()).all()
    
    result = []
    for m in messages:
        # Hide view_once content if it was already viewed by the receiver
        # (Actually, view_once should be heavily restricted)
        content = m.content
        if m.message_type == "view_once":
            if m.sender_id == current_user.id:
                pass # Sender can see they sent a view once (maybe just show "Photo")
            else:
                if m.is_viewed:
                    content = "[VIEWED]"
                    
        result.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "receiver_id": m.receiver_id,
            "content": content,
            "message_type": m.message_type,
            "is_viewed": m.is_viewed,
            "created_at": m.created_at
        })
        
    return result
