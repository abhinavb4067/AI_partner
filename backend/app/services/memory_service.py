import json
import re
from sqlalchemy.orm import Session
from app.models.all_models import UserMemory, UserAccount
from app.services.ai_service import AIService
from app.core.database import SessionLocal

class MemoryService:
    @staticmethod
    def get_user_memories_string(db: Session, user_internal_id: int):
        """Fetch all memories for a user and return as a concise string for the system prompt."""
        memories = db.query(UserMemory).filter(UserMemory.user_id == user_internal_id).all()
        if not memories:
            return "No previous information known about the user yet."
        
        fact_list = [f"{m.key}: {m.value}" for m in memories]
        return "Memory of User: " + ", ".join(fact_list)

    @staticmethod
    def update_user_memory(user_internal_id: int, char_model: str, last_messages: list):
        """
        Background task to extract facts from recent messages and update the DB.
        last_messages should be a list of dicts: [{'role': 'user', 'content': '...'}, ...]
        """
        db = SessionLocal()
        try:
            context = "\n".join([f"{m['role']}: {m['content']}" for m in last_messages])
            
            extraction_prompt = (
                "You are a memory extraction assistant. Analyze the conversation below and extract key facts "
                "about the user (like age, job, education, hobbies, relationship details, name, etc.).\n\n"
                "Rules:\n"
                "1. Only extract new or updated facts.\n"
                "2. Respond ONLY with a JSON object where keys are the fact type and values are the fact itself.\n"
                "3. Example: {\"age\": \"25\", \"job\": \"Engineer\"}\n"
                "4. If no new facts, return {}.\n\n"
                "Conversation:\n" + context
            )

            # Use Ollama to extract facts
            raw_response = AIService.get_ollama_response(char_model, "You are a helpful JSON assistant.", extraction_prompt)
            
            # Find JSON in response
            json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if not json_match:
                return

            new_facts = json.loads(json_match.group(0))
            if not isinstance(new_facts, dict):
                return

            for key, value in new_facts.items():
                # Clean up key/value
                clean_key = str(key).lower().strip()
                clean_value = str(value).strip()

                # Check if fact already exists
                existing_fact = db.query(UserMemory).filter(
                    UserMemory.user_id == user_internal_id,
                    UserMemory.key == clean_key
                ).first()

                if existing_fact:
                    existing_fact.value = clean_value
                else:
                    new_memory = UserMemory(
                        user_id=user_internal_id,
                        key=clean_key,
                        value=clean_value
                    )
                    db.add(new_memory)
            
            db.commit()
        except Exception as e:
            print(f"Memory Update Error: {e}")
            db.rollback()
        finally:
            db.close()
