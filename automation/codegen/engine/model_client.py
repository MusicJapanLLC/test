"""
Model-agnostic LLM client.

Priority: GitHub Models (free, GITHUB_TOKEN) → Anthropic → fail loudly.
No Claude dependency required — GitHub Models works in every Action by default.
"""

import os
from typing import Protocol


class LLMClient(Protocol):
    def complete(self, prompt: str, max_tokens: int = 8192) -> str: ...


class GitHubModelsClient:
    """
    Uses GitHub Models API — free tier, available in every GitHub Action
    via GITHUB_TOKEN. No extra secrets needed.
    Models: gpt-4o-mini, Meta-Llama-3.1-70B-Instruct, etc.
    """

    ENDPOINT = "https://models.inference.ai.azure.com"
    DEFAULT_MODEL = "gpt-4o-mini"

    def __init__(self, token: str | None = None, model: str | None = None):
        self.token = token or os.environ["GITHUB_TOKEN"]
        self.model = model or os.environ.get("CODEGEN_MODEL", self.DEFAULT_MODEL)

    def complete(self, prompt: str, max_tokens: int = 8192) -> str:
        from openai import OpenAI
        client = OpenAI(base_url=self.ENDPOINT, api_key=self.token)
        response = client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()


class AnthropicClient:
    """Fallback: Anthropic Claude via API key."""

    DEFAULT_MODEL = "claude-sonnet-4-6"

    def __init__(self, api_key: str | None = None, model: str | None = None):
        import anthropic
        self.client = anthropic.Anthropic(api_key=api_key or os.environ["ANTHROPIC_API_KEY"])
        self.model = model or os.environ.get("CODEGEN_MODEL", self.DEFAULT_MODEL)

    def complete(self, prompt: str, max_tokens: int = 8192) -> str:
        msg = self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()


def get_client() -> LLMClient:
    """
    Auto-select the best available client.
    GitHub Models works in any Action without extra setup.
    """
    if os.environ.get("GITHUB_TOKEN"):
        try:
            import openai  # noqa: F401
            print("[model] using GitHub Models (GITHUB_TOKEN)")
            return GitHubModelsClient()
        except ImportError:
            pass

    if os.environ.get("ANTHROPIC_API_KEY"):
        print("[model] using Anthropic Claude")
        return AnthropicClient()

    raise RuntimeError(
        "No LLM available. Set GITHUB_TOKEN (for GitHub Models) "
        "or ANTHROPIC_API_KEY (for Claude)."
    )


def strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()
