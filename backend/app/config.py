from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    frontend_origin: str = "http://localhost:5173"

    supabase_url: str = ""
    supabase_anon_key: str = ""
    piston_url: str = "http://localhost:2000/api/v2"
    github_client_id: str = ""
    github_client_secret: str = ""
    public_backend_url: str = "http://localhost:8000"
    
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