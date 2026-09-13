"""
Shared rate limiter (slowapi/limits, in-process token bucket keyed by client IP).

This is a stopgap floor of protection at the app layer — it complements, not
replaces, edge-level rate limiting (e.g. Cloudflare WAF rules), which should
still be configured since it blocks traffic before it ever reaches this
process and survives even if this process is restarted/scaled out.

Endpoints that trigger a paid third-party API call (LLM/image-gen/TTS/STT) or
that gate account security (login/OTP) MUST be decorated with a limit here —
those were previously reachable at unlimited scripted rate.
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
