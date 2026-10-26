"""Centralized Claude service.

Single place that knows how to talk to Claude. Supports:
- Direct Anthropic API key, OR a corporate gateway (base URL + key helper + CA cert).
- Structured output via Pydantic.
- Graceful degradation: if nothing is configured, `available` is False and callers
  fall back to deterministic behavior. No separate client is created per route.
"""
from __future__ import annotations

import logging
import os
import shlex
import subprocess
import time
from functools import lru_cache
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger("driveedge.claude")

T = TypeVar("T", bound=BaseModel)


class ClaudeUnavailable(RuntimeError):
    """Raised when an AI call is attempted but Claude is not configured/reachable."""


def _resolve_api_key() -> Optional[str]:
    if settings.anthropic_api_key:
        return settings.anthropic_api_key
    if settings.anthropic_api_key_helper:
        try:
            parts = shlex.split(settings.anthropic_api_key_helper)
            result = subprocess.run(parts, capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                token = result.stdout.strip()
                return token or None
            logger.warning("Claude key helper exited %s: %s", result.returncode, result.stderr.strip())
        except (OSError, subprocess.SubprocessError) as exc:
            logger.warning("Claude key helper failed: %s", exc)
    return None


class ClaudeService:
    def __init__(self) -> None:
        self._model = None
        self._init_error: Optional[str] = None
        self._configured = settings.ai_configured
        if self._configured:
            self._init_model()

    def _init_model(self) -> None:
        try:
            from langchain_anthropic import ChatAnthropic

            api_key = _resolve_api_key()
            if not api_key:
                self._init_error = "No Anthropic credentials resolved"
                self._configured = False
                return
            if settings.anthropic_ca_cert and os.path.exists(settings.anthropic_ca_cert):
                os.environ.setdefault("SSL_CERT_FILE", settings.anthropic_ca_cert)
                os.environ.setdefault("REQUESTS_CA_BUNDLE", settings.anthropic_ca_cert)

            kwargs = {
                "model": settings.claude_model,
                "max_tokens": settings.claude_max_tokens,
                "temperature": settings.claude_temperature,
                "api_key": api_key,
                "timeout": settings.ai_request_timeout_seconds,
                "max_retries": 2,
            }
            if settings.anthropic_base_url:
                kwargs["base_url"] = settings.anthropic_base_url
            self._model = ChatAnthropic(**kwargs)
        except Exception as exc:  # pragma: no cover - defensive init
            self._init_error = str(exc)
            self._configured = False
            logger.warning("Claude init failed: %s", exc)

    @property
    def available(self) -> bool:
        return self._configured and self._model is not None

    @property
    def status(self) -> dict:
        return {
            "configured": settings.ai_configured,
            "available": self.available,
            "model": settings.claude_model if self.available else None,
            "error": self._init_error,
        }

    def invoke(self, system: str, user: str) -> str:
        if not self.available:
            raise ClaudeUnavailable(self._init_error or "Claude is not configured")
        start = time.time()
        try:
            resp = self._model.invoke([("system", system), ("human", user)])
        except Exception as exc:  # network/timeout/rate-limit/etc.
            logger.warning("Claude invoke failed: %s", exc)
            raise ClaudeUnavailable(str(exc)) from exc
        logger.info("Claude invoke ok in %.2fs", time.time() - start)
        return resp.content if isinstance(resp.content, str) else str(resp.content)

    def structured(self, system: str, user: str, schema: Type[T]) -> T:
        if not self.available:
            raise ClaudeUnavailable(self._init_error or "Claude is not configured")
        try:
            model = self._model.with_structured_output(schema)
            return model.invoke([("system", system), ("human", user)])
        except Exception as exc:
            logger.warning("Claude structured call failed: %s", exc)
            raise ClaudeUnavailable(str(exc)) from exc


@lru_cache
def get_claude() -> ClaudeService:
    return ClaudeService()
