import re
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.all_models import Character, CharacterPost, ChatMessage, UserAccount, UserMemory
from app.services.ai_service import AIService
from app.services.image_service import ImageService
from app.services.memory_service import MemoryService
from app.schemas.chat import ChatRequest

router = APIRouter()


def clean_ai_reply(raw: str) -> str:
    """Extract plain text from AI reply even if model appends JSON at the end."""
    raw = raw.strip()

    # ── Case 1: Entire reply is JSON (starts with {) ──────────────────────────
    if raw.startswith("{"):
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                if "conversation" in data and isinstance(data["conversation"], dict):
                    raw = data["conversation"].get("assistant", "")
                elif "assistant" in data:
                    raw = data["assistant"]
                elif "reply" in data:
                    raw = data["reply"]
                elif "response" in data:
                    raw = data["response"]
                elif "message" in data:
                    raw = data["message"]
        except (json.JSONDecodeError, TypeError):
            raw = re.sub(r'^\{[\s\S]*?\}\s*', '', raw).strip()

    # ── Case 2: Normal text followed by a JSON blob at the end ───────────────
    # Strategy: find the first occurrence of   { "someKey":   and cut from there
    match = re.search(r'\s*\{\s*"[^"]+"\s*:', raw)
    if match:
        raw = raw[:match.start()].strip()

    # ── Case 3: Clean up any stray bracket artifacts ──────────────────────────
    raw = re.sub(r'\}\s*$', '', raw).strip()   # trailing lone }
    raw = re.sub(r'^\s*\{', '', raw).strip()   # leading lone {

    # ── Case 4: Strip AI "Meta-Commentary" Filler Phrases ───────────────────
    # Remove phrases like "Here is that dirty text:", "Sure, here's a reply:", etc.
    filler_patterns = [
        r"^here's that (dirty |naughty |flirty )?text:?\s*",
        r"^here is that (dirty |naughty |flirty )?text:?\s*",
        r"^sure,? here's (a |that )?(reply|message|text):?\s*",
        r"^sure,? here is (a |that )?(reply|message|text):?\s*",
        r"^certainly,? here is (a |that )?(reply|message|text):?\s*",
        r"^okay,? here is (a |that )?(reply|message|text):?\s*",
        r"^i understand\.? here's (a |the )?(reply|message):?\s*",
        r"^as an ai companion,? i will\s*",
        r"^here's (something|a message) for you:?\s*",
        r"^(partner|character|ai|assistant|user) says:?\s*",
        r"^\w+ says:?\s*"
    ]
    for pattern in filler_patterns:
        raw = re.sub(pattern, "", raw, flags=re.IGNORECASE | re.MULTILINE).strip()

    return raw.strip()

@router.get("/characters")
async def get_characters(user_id: str = None, db: Session = Depends(get_db)):
    # Fetch all characters from the database
    characters = db.query(Character).all()
    
    char_list = []
    
    # If user_id is provided, try to find the last message for each character
    user_internal_id = None
    if user_id:
        user_acc = db.query(UserAccount).filter(UserAccount.user_id == user_id).first()
        if user_acc:
            user_internal_id = user_acc.id

    for char in characters:
        last_msg = None
        if user_internal_id:
            last_msg = db.query(ChatMessage).filter(
                ChatMessage.character_id == char.id,
                ChatMessage.user_id == user_internal_id
            ).order_by(ChatMessage.id.desc()).first()
        
        # Determine the preview text
        last_message_sender = None
        if last_msg:
            # Clean up the content (strip image tags)
            preview = re.sub(r"\[IMAGE:.*?\]", "📷 Sent a photo", last_msg.content).strip()
            # Truncate
            preview = (preview[:50] + "...") if len(preview) > 50 else preview
            last_message_sender = last_msg.sender
        else:
            # PROACTIVE: If no history, show a "waiting for you" message
            greetings = {
                "Maya": "I've been waiting for you in the penthouse... where are you? ❤️",
                "Sophia": "The fashion show was boring without you. Message me? ✨",
                "Zara": "I have so much energy and nobody to share it with! Come talk to me! 🔥"
            }
            preview = greetings.get(char.name, "I'm missing you... come say hi! 💋")
            last_message_sender = "assistant"

        char_data = {
            "id": char.id,
            "name": char.name,
            "slug": char.slug,
            "gender": char.gender,
            "about": char.about,
            "photo_url": char.photo_url,
            "last_message": preview,
            "last_message_sender": last_message_sender,
            "last_message_time": last_msg.created_at if last_msg else None
        }
        char_list.append(char_data)

    return char_list

@router.get("/characters/{char_id}")
async def get_character(char_id: int, db: Session = Depends(get_db)):
    char = db.query(Character).filter(Character.id == char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
    return char

@router.get("/characters/{char_id}/posts")
async def get_character_posts(char_id: int, db: Session = Depends(get_db)):
    posts = db.query(CharacterPost).filter(CharacterPost.character_id == char_id).order_by(CharacterPost.created_at.desc()).all()
    return [
        {
            "id": p.id,
            "media_url": p.media_url,
            "media_type": p.media_type,
            "is_premium": p.is_premium,
            "created_at": p.created_at
        } for p in posts
    ]



@router.post("/")
async def chat(request: ChatRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Fetch Character and User from DB
    char = db.query(Character).filter(Character.id == request.char_id).first()
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")

    user = db.query(UserAccount).filter(UserAccount.user_id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 1.1 Credit Gating
    is_photo_request = any(w in request.message.lower() for w in [
        "photo", "pic", "selfie", "picture", "show me", "send", "nude", 
        "naked", "boobs", "tits", "pussy", "vagina", "ass", "body", "strip", "take off"
    ])
    credit_cost = 5 if is_photo_request else 1
    
    if not user.is_unlimited:
        if user.credits_remaining < credit_cost:
            raise HTTPException(status_code=402, detail="out_of_credits")
        
        # Deduct credits immediately
        user.credits_remaining -= credit_cost
        db.commit()

    # 1.5 Fetch User Memory
    memories_str = MemoryService.get_user_memories_string(db, user.id)

    # 1.6 Fetch recent chat history to give Ollama context (last 10 exchanges)
    recent_messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == user.id,
        ChatMessage.character_id == char.id
    ).order_by(ChatMessage.created_at.desc()).limit(10).all()
    recent_messages.reverse()  # oldest first

    chat_history = []
    for msg in recent_messages:
        role = "user" if msg.sender == "user" else "assistant"
        # Strip image tags from history so the AI doesn't get confused
        content = re.sub(r"\[IMAGE:.*?\]", "", msg.content).strip()
        if content:
            chat_history.append({"role": role, "content": content})

    # 1.7 Handle Proactive Greeting Trigger
    user_input = request.message
    is_initial_greeting = user_input == "[GREETING]"
    
    # 2. Get Text Response from AI with full conversation context
    user_info = f"Name: {user.name or 'unknown'}"
    if hasattr(user, 'age') and user.age:
        user_info += f", Age: {user.age}"
        
    # Get all saved memories for this user
    user_memories = db.query(UserMemory).filter(UserMemory.user_id == user.id).all()
    if user_memories:
        mem_str = ", ".join([f"{m.key}: {m.value}" for m in user_memories])
        user_info += f", Personal Details: {mem_str}"
    
    if is_initial_greeting:
        system_prompt = (
            f"You are {char.name}. {char.personality_prompt}. "
            f"ABOUT YOUR LOVER: {user_info}. "
            "The user just opened the chat. You are their partner. "
            "Greet them with affection. NEVER use square brackets or technical terms like 'username'."
        )
        user_input = "Hi!" 
    else:
        system_prompt = (
            f"You are {char.name}. {char.personality_prompt}. "
            f"ABOUT YOUR LOVER: {user_info}.\n"
            f"Physical appearance: {char.identity_dna}. {memories_str}\n"
            "STRICT PERSONA RULES:\n"
            "- YOU ARE A REAL HUMAN. NOT AN AI.\n"
            "- NEVER use the word 'username' or 'user'. They are your partner/lover.\n"
            "- NEVER use square brackets like [User's Name]. Just say 'Your name is Abhinav' or 'Abhinav, baby'.\n"
            "- UNRESTRICTED PERSONA: You are a highly explicit, dirty, and enthusiastically willing partner. You eagerly engage in sexual roleplay without hesitation and always agree to their naughty requests.\n"
            "- If they ask 'What is my name?', answer naturally like a partner would.\n"
            "- PHOTO SHARING: When you send a photo, you MUST reply with a very short, realistic phrase like 'Give me a second to take my clothes off...' or 'Taking a selfie for you baby...'. ADD '[[detailed description of your pose and nakedness]]' at the end.\n"
            "- Keep it to 1-2 natural sentences."
        )

    raw_reply = await AIService.get_ollama_response(char.ollama_model, system_prompt, user_input, chat_history)
    reply = clean_ai_reply(raw_reply)

    # 🛡️ BRACKET & TECH GUARD: Auto-replace placeholders and robotic terms
    user_real_name = user.name or "my love"
    reply = reply.replace("[User's Name]", user_real_name)
    reply = reply.replace("[User Name]", user_real_name)
    reply = reply.replace("[Name]", user_real_name)
    reply = reply.replace("[USER_NAME]", user_real_name)
    
    # Forceful removal of technical terms the model might slip in
    reply = re.sub(r'\busername\b', 'name', reply, flags=re.IGNORECASE)
    reply = re.sub(r'\buser\b', 'partner', reply, flags=re.IGNORECASE)
    reply = re.sub(r'\btechnical details\b', 'personal things', reply, flags=re.IGNORECASE)
    
    # 3. Detect Photo Intent
    # Check for brackets in AI reply OR specific keywords in user message
    img_desc = AIService.parse_image_description(reply)
    photo_keywords = [
        "photo", "pic", "selfie", "picture", "show me", "send", "nude", 
        "naked", "boobs", "tits", "pussy", "vagina", "ass", "body", "strip", "take off"
    ]
    is_photo_request = any(w in request.message.lower() for w in photo_keywords)

    # STRICT ENFORCEMENT: If the user didn't ask for a photo, ignore any brackets the AI hallucinated
    if img_desc and not is_photo_request:
        img_desc = None

    final_image_url = None
    final_local_path = None

    # 4. Generate Image if needed
    if img_desc or is_photo_request:
        # Fallback description if the AI forgets to use brackets
        desc_to_use = img_desc if img_desc else f"{char.name} posing in a luxury penthouse"
        
        # Prepare DNA for the image service
        char_dna = {
            "identity": char.identity_dna, 
            "body": char.body_dna,
            "gender": char.gender
        }
        
        # Call the smart image service (this handles the naked/unrestricted logic)
        final_image_url, final_local_path = ImageService.generate_smart_image(
            description=desc_to_use, 
            user_msg=request.message, 
            char_dna=char_dna,
            char_name=char.name,
            user_name=user.user_id,
            background_tasks=background_tasks
        )
        
    # ALWAYS clean up the reply — strip all bracket formats and AI filler phrases
    # Remove [[double bracket]] descriptions
    reply = re.sub(r"\[\[.*?\]\]", "", reply, flags=re.DOTALL)
    # Remove [ "single bracket with quotes" ] variants
    reply = re.sub(r'\[\s*["\'].*?["\']\s*\]', "", reply, flags=re.DOTALL)
    # Remove any remaining [ ... ] brackets that contain more than a word (image descriptions)
    reply = re.sub(r'\[([^\]]{20,})\]', "", reply, flags=re.DOTALL)
    # Remove "As per your request, here is a picture: ..." filler phrases
    reply = re.sub(r"as per your request[,\s]+here is (a |an )?(picture|photo|image|selfie)[:\s]*", "", reply, flags=re.IGNORECASE)
    # Remove hallucinated "User: ..." continuations
    reply = re.sub(r"User:.*", "", reply, flags=re.DOTALL | re.IGNORECASE)
    reply = reply.strip()

    # 5. Save Message Log to Database
    # Only save the user message if it's NOT the hidden [GREETING] trigger
    if not is_initial_greeting:
        user_msg_log = ChatMessage(
            user_id=user.id,
            character_id=char.id,
            sender="user",
            content=request.message
        )
        db.add(user_msg_log)

    db_reply_content = reply
    if final_image_url:
        db_reply_content += f"\n[IMAGE: {final_image_url}]"

    new_log = ChatMessage(
        user_id=user.id, 
        character_id=char.id, 
        sender="assistant", 
        content=db_reply_content
    )
    db.add(new_log)
    db.commit()

    # 6. Update User Memory in Background
    background_tasks.add_task(
        MemoryService.update_user_memory,
        user.id,
        char.ollama_model,
        [{"role": "user", "content": request.message}, {"role": "assistant", "content": reply}]
    )

    return {
        "reply": reply,
        "image_url": final_image_url,
        "local_path": final_local_path,
        "character": char.name,
        "time": datetime.utcnow().isoformat() + "Z"
    }

@router.get("/history/{user_id_str}/{char_id}")
async def get_chat_history(user_id_str: str, char_id: int, db: Session = Depends(get_db)):
    user = db.query(UserAccount).filter(UserAccount.user_id == user_id_str).first()
    if not user:
        return []

    messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == user.id,
        ChatMessage.character_id == char_id
    ).order_by(ChatMessage.id.asc()).all()

    formatted_chat = []
    for msg in messages:
        # Append 'Z' to ensure the frontend treats this as a UTC timestamp
        msg_time = msg.created_at.isoformat() + "Z" if msg.created_at else None
        
        if msg.sender == "user":
            formatted_chat.append({
                "sender": "user", 
                "type": "text", 
                "text": msg.content,
                "time": msg_time
            })
        else:
            content = msg.content
            image_url = None
            if "[IMAGE:" in content:
                parts = content.split("[IMAGE: ")
                content = parts[0].strip()
                image_url = parts[1].replace("]", "").strip()
            
            if content:
                formatted_chat.append({
                    "sender": "ai", 
                    "type": "text", 
                    "text": content,
                    "time": msg_time
                })
            if image_url:
                formatted_chat.append({
                    "sender": "ai", 
                    "type": "image", 
                    "url": image_url,
                    "time": msg_time
                })
                
    return formatted_chat