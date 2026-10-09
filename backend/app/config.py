from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Ready-made settings for the AI provider. Any other provider that speaks the OpenAI chat format
# works too: set AI_BASE_URL and the three model names yourself.
_AI_PRESETS: dict[str, dict[str, str]] = {
    "groq": {
        "base_url": "https://api.groq.com/openai/v1",
        "chat": "openai/gpt-oss-120b",
        "review": "openai/gpt-oss-120b",
        "completion": "openai/gpt-oss-20b",
    },
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # "development" on your computer, "production" on the server
    environment: str = "development"

    database_url: str
    frontend_origin: str = "http://localhost:5173"

    # Used to check login tokens with Supabase Auth. Empty means login is switched off.
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # Where the Piston sandbox listens. It is reached only by this backend, never by browsers.
    piston_url: str = "http://localhost:2000/api/v2"

    # GitHub export (a second OAuth app, separate from the Supabase login)
    github_client_id: str = ""
    github_client_secret: str = ""
    public_backend_url: str = "http://localhost:8000"

    # AI assistant: any provider that speaks the OpenAI chat format (Groq, Gemini, ...)
    ai_enabled: bool = True
    ai_provider: str = "groq"
    ai_api_key: str = ""
    ai_base_url: str = ""          # empty = the provider's default
    ai_chat_model: str = ""        # empty = the provider's default
    ai_review_model: str = ""
    ai_completion_model: str = ""
    ai_reasoning_effort: str = ""  # optional: "low", "medium", "high" or "none", for reasoning models only
    ai_token_headroom: int = 0     # extra tokens for models that "think" before answering

    # Free tiers are small, so these limits are low. Raise them if your plan allows.
    ai_chat_per_minute: int = 12
    ai_review_per_minute: int = 4
    ai_complete_per_minute: int = 24
    ai_daily_chat: int = 150       # per session, chat and review together
    ai_daily_complete: int = 600   # per session

    @model_validator(mode="after")
    def fill_ai_defaults(self) -> "Settings":
        preset = _AI_PRESETS.get(self.ai_provider.strip().lower(), {})
        if not self.ai_base_url:
            self.ai_base_url = preset.get("base_url", "")
        if not self.ai_chat_model:
            self.ai_chat_model = preset.get("chat", "")
        if not self.ai_review_model:
            self.ai_review_model = preset.get("review", "")
        if not self.ai_completion_model:
            self.ai_completion_model = preset.get("completion", "")
        self.ai_base_url = self.ai_base_url.strip().rstrip("/")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @property
    def _base_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        return url

    @property
    def async_database_url(self) -> str:
        return self._base_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    @property
    def sync_database_url(self) -> str:
        return self._base_url.replace("postgresql://", "postgresql+psycopg://", 1)


settings = Settings()