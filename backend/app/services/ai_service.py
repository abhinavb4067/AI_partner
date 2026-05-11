import requests
import re

class AIService:
    @staticmethod
    def get_ollama_response(model: str, system_prompt: str, user_message: str, chat_history: list = None):
        url = "http://localhost:11434/api/chat"

        # Build message list: system prompt + history + current user message
        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            messages.extend(chat_history)
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 1.1}
        }
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()['message']['content']
        except Exception as e:
            return f"Error talking to AI: {str(e)}"

    @staticmethod
    def parse_image_description(content: str):
        match = re.search(r"\[\[(.*?)\]\]", content)
        return match.group(1) if match else None