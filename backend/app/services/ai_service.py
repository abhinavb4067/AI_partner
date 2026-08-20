import os
import httpx
import re
import asyncio
from typing import Optional

from app.core.config import settings


class AIService:
    _client: Optional[httpx.AsyncClient] = None

    # Ultra-fast model ranking on OpenRouter for instant replies
    FAST_MODELS = [
        "meta-llama/llama-3.3-70b-instruct",
        "meta-llama/llama-3.1-8b-instruct",
        "nousresearch/hermes-3-llama-3.1-8b",
        "nousresearch/hermes-3-llama-3.1-70b",
    ]

    @classmethod
    def get_http_client(cls) -> httpx.AsyncClient:
        """Reuse a persistent connection pool to eliminate SSL/TCP handshake latency on every request."""
        if cls._client is None or cls._client.is_closed:
            limits = httpx.Limits(max_keepalive_connections=20, max_connections=50, keepalive_expiry=60.0)
            cls._client = httpx.AsyncClient(limits=limits, timeout=25.0)
        return cls._client

    @classmethod
    async def get_ollama_response(
        cls,
        model: str,
        system_prompt: str,
        user_message: str,
        chat_history: list = None
    ) -> str:
        url = "https://openrouter.ai/api/v1/chat/completions"

        # Build message list: system prompt + recent history + current user message
        messages = [{"role": "system", "content": system_prompt}]
        if chat_history:
            # Keep only the most recent 10 messages to minimize token count & speed up processing
            messages.extend(chat_history[-10:])
        messages.append({"role": "user", "content": user_message})

        # Prefer high-speed models with sub-second response times
        chosen_model = "meta-llama/llama-3.3-70b-instruct"

        payload = {
            "model": chosen_model,
            "messages": messages,
            "temperature": 0.8,
            "max_tokens": 250,      # concise, realistic conversational replies
            "top_p": 0.9,
            "frequency_penalty": 0.2,
        }

        api_key = settings.OPENROUTER_API_KEY
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://ai-girlfriend.app",
            "X-Title": "AI Companion",
        }

        client = cls.get_http_client()

        # Try fast model with automatic fallback
        for target_model in [chosen_model, "meta-llama/llama-3.1-8b-instruct", "nousresearch/hermes-3-llama-3.1-70b"]:
            payload["model"] = target_model
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=15.0)
                if response.status_code == 200:
                    data = response.json()
                    reply = data['choices'][0]['message']['content']
                    return reply
                else:
                    print(f"⚠️ Model {target_model} returned {response.status_code}, trying fallback...")
            except Exception as e:
                print(f"⚠️ Model {target_model} error: {e}, falling back...")

        return "I'm right here with you baby. What's on your mind? ❤️"

    @staticmethod
    def parse_image_description(content: str):
        # Match [[description]] or [description]
        match = re.search(r"\[+([^\[\]]+)\]+", content)
        return match.group(1).strip() if match else None