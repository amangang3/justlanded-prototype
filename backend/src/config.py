from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    http_proxy: str = ""
    scraper_rate_limit_rps: float = 1.0
    log_level: str = "INFO"


settings = Settings()
