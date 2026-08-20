import json
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.core.database import SessionLocal, get_db
from app.core.security import decode_token
from app.models.all_models import UserAccount, HumanMessage
from app.api.deps import get_current_user
import firebase_admin
from firebase_admin import messaging

def send_push_notification(fcm_token: str, title: str, body: str, data: dict = None):
    if not fcm_token:
        return
    try:
        # Convert all values in data to strings, FCM requires string values
        str_data = {}
        if data:
            for k, v in data.items():
                str_data[str(k)] = str(v)
        
        is_call = data and data.get("type") == "call"
        is_missed_call = data and data.get("type") == "missed_call"
        caller_id = data.get("caller_id", "") if (is_call or is_missed_call) else ""

        # WebPush specific config for browsers
        if is_call:
            webpush_actions = [
                messaging.WebpushNotificationAction(action="answer", title="📞 Answer Call"),
                messaging.WebpushNotificationAction(action="decline", title="❌ Decline")
            ]
        elif is_missed_call:
            webpush_actions = [
                messaging.WebpushNotificationAction(action="call_back", title="📞 Call Back"),
                messaging.WebpushNotificationAction(action="view_chat", title="💬 View Chat")
            ]
        else:
            webpush_actions = None

        webpush = messaging.WebpushConfig(
            headers={"Urgency": "high"},
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon="/icon-192.png",
                badge="/favicon.svg",
                tag=f"incoming_call_{caller_id}" if is_call else (f"missed_call_{caller_id}" if is_missed_call else "chat_msg"),
                renotify=True,
                require_interaction=True if is_call else False,
                vibrate=[500, 250, 500, 250, 500, 250, 500, 250, 500, 250, 1000] if is_call else [200, 100, 200],
                actions=webpush_actions,
                data=str_data
            ),
            data=str_data
        )

        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=str_data,
            token=fcm_token,
            webpush=webpush,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    sound='default',
                    channel_id='call_channel' if (is_call or is_missed_call) else 'chat_channel',
                    priority='max',
                    visibility='public'
                ),
            ),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound='default',
                        content_available=True
                    ),
                ),
            )
        )
        messaging.send(message)
    except Exception as e:
        print(f"Failed to send FCM: {e}")


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

# In-memory tracking for active call sessions
active_call_sessions: Dict[str, dict] = {}


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
                
                # Handling WebRTC Signaling & Calls
                if msg_type in ["call_request", "call_accept", "call_reject", "offer", "answer", "ice_candidate", "call_end", "call_cancel"]:
                    if target_id:
                        payload["sender_id"] = user_id

                        # 1. Call Request (Live Calling Push)
                        if msg_type == "call_request":
                            is_video = payload.get("video", False)
                            call_type = "Video" if is_video else "Voice"
                            session_key = f"{user_id}_{target_id}"
                            active_call_sessions[session_key] = {
                                "caller_id": user_id,
                                "target_id": target_id,
                                "caller_name": user.name or "User",
                                "video": is_video,
                                "state": "ringing",
                                "started_at": datetime.utcnow()
                            }
                            # Send live ringing push notification
                            target_user = db.query(UserAccount).filter(UserAccount.id == target_id).first()
                            if target_user and target_user.fcm_token:
                                send_push_notification(
                                    fcm_token=target_user.fcm_token,
                                    title=f"Incoming {call_type} Call",
                                    body=f"{user.name or 'User'} is calling you...",
                                    data={"type": "call", "caller_id": user_id, "caller_name": user.name or "User", "video": str(is_video)}
                                )

                        # 2. Call Accepted
                        elif msg_type == "call_accept":
                            for k in [f"{target_id}_{user_id}", f"{user_id}_{target_id}"]:
                                if k in active_call_sessions:
                                    active_call_sessions[k]["state"] = "active"

                        # 3. Call Ended / Rejected / Cancelled (Missed Call Handling)
                        elif msg_type in ["call_reject", "call_end", "call_cancel"]:
                            session = active_call_sessions.pop(f"{user_id}_{target_id}", None) or active_call_sessions.pop(f"{target_id}_{user_id}", None)
                            if session and session.get("state") == "ringing":
                                # Call was missed / unanswered
                                s_caller_id = session["caller_id"]
                                s_callee_id = session["target_id"]
                                s_caller_name = session.get("caller_name", "User")
                                s_is_video = session.get("video", False)
                                s_call_type = "Video" if s_is_video else "Voice"

                                # Save Missed Call in DB
                                missed_msg = HumanMessage(
                                    sender_id=s_caller_id,
                                    receiver_id=s_callee_id,
                                    content=f"Missed {s_call_type} call",
                                    message_type="missed_call"
                                )
                                db.add(missed_msg)
                                db.commit()
                                db.refresh(missed_msg)

                                # Broadcast message to both users
                                out_missed = {
                                    "type": "new_message",
                                    "message": {
                                        "id": missed_msg.id,
                                        "sender_id": s_caller_id,
                                        "receiver_id": s_callee_id,
                                        "content": missed_msg.content,
                                        "message_type": "missed_call",
                                        "created_at": missed_msg.created_at.isoformat() + "Z",
                                        "is_viewed": False,
                                        "is_delivered": s_callee_id in manager.active_connections
                                    }
                                }
                                await manager.send_personal_message(json.dumps(out_missed), s_caller_id)
                                await manager.send_personal_message(json.dumps(out_missed), s_callee_id)

                                # Send Missed Call FCM Push Notification to Callee
                                callee_user = db.query(UserAccount).filter(UserAccount.id == s_callee_id).first()
                                if callee_user and callee_user.fcm_token:
                                    send_push_notification(
                                        fcm_token=callee_user.fcm_token,
                                        title="📞 Missed Call",
                                        body=f"You missed a {s_call_type} call from {s_caller_name}",
                                        data={"type": "missed_call", "caller_id": s_caller_id, "caller_name": s_caller_name, "video": str(s_is_video)}
                                    )

                        # Forward signaling payload to the peer
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
                        
                        is_delivered = target_id in manager.active_connections
                        
                        # Forward to target
                        out_msg = {
                            "type": "new_message",
                            "message": {
                                "id": new_msg.id,
                                "sender_id": user_id,
                                "receiver_id": target_id,
                                "content": content if msg_type != "view_once" else "[HIDDEN]",
                                "message_type": msg_type,
                                "created_at": new_msg.created_at.isoformat() + "Z",
                                "is_viewed": False,
                                "is_delivered": is_delivered
                            }
                        }
                        if is_delivered:
                            await manager.send_personal_message(json.dumps(out_msg), target_id)
                        
                        # Push notification for chat messages if disconnected
                        if target_id not in manager.active_connections:
                            target_user = db.query(UserAccount).filter(UserAccount.id == target_id).first()
                            if target_user and target_user.fcm_token:
                                msg_text = "Sent you a photo" if msg_type == "view_once" else content
                                send_push_notification(
                                    fcm_token=target_user.fcm_token,
                                    title=f"New message from {user.name}",
                                    body=msg_text,
                                    data={"type": "chat", "sender_id": user_id}
                                )
                        
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

                # Handling Read Receipt for standard messages
                elif msg_type == "read":
                    msg_id = payload.get("message_id")
                    if msg_id:
                        msg = db.query(HumanMessage).filter(HumanMessage.id == msg_id).first()
                        if msg and msg.receiver_id == user_id:
                            msg.is_viewed = True
                            db.commit()
                            ack = {
                                "type": "message_read",
                                "message_id": msg_id,
                                "receiver_id": user_id
                            }
                            await manager.send_personal_message(json.dumps(ack), msg.sender_id)

            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"WS Error: {e}")
                
    except Exception as e:
        print(f"WebSocket closed with error: {e}")
    finally:
        manager.disconnect(user_id)
        # update last seen
        db_session = SessionLocal()
        u = db_session.query(UserAccount).filter(UserAccount.id == user_id).first()
        if u:
            from datetime import datetime, timezone
            u.last_seen = datetime.now(timezone.utc)
            db_session.commit()
        db_session.close()
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
