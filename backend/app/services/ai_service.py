import os
import httpx
import re
import asyncio

from app.core.config import settings

class AIService:
    @staticmethod
    async def get_ollama_response(model: str, system_prompt: str, user_message: str, chat_history: list = None):
        url = "https://openrouter.ai/api/v1/chat/completions"

        # Build message list: system prompt + history + current user message
        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            messages.extend(chat_history)
        messages.append({"role": "user", "content": user_message})

        # Using Hermes 3 which we know works (the bad request was because of an invalid model name)
        payload = {
            "model": "nousresearch/hermes-3-llama-3.1-70b",
            "messages": messages,
            "temperature": 0.85,
            "max_tokens": 300,
            "top_p": 0.9,
            "top_k": 20,
            "repetition_penalty": 1.15
        }
        
        # Pulling the key securely from settings
        api_key = settings.OPENROUTER_API_KEY
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        print("\n" + "="*50)
        print("🚀 SENDING MESSAGE TO OPENROUTER (HERMES 3 70B)...")
        print("="*50 + "\n")
        
        async with httpx.AsyncClient() as client:
            try:
                # Use a reasonable timeout
                response = await client.post(url, headers=headers, json=payload, timeout=60.0)
                response.raise_for_status()
                # OpenRouter uses the standard OpenAI response format
                return response.json()['choices'][0]['message']['content']
            except Exception as e:
                print(f"OpenRouter Error: {str(e)}")
                if 'response' in locals() and hasattr(response, 'text'):
                    print(f"Response body: {response.text}")
                return f"Error talking to AI: {str(e)}"

    @staticmethod
    def parse_image_description(content: str):
        # Match [[description]] or [description]
        match = re.search(r"\[+([^\[\]]+)\]+", content)
        return match.group(1).strip() if match else None