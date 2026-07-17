# 配置管理文件 - 从 .env 读取环境变量
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置类，从 .env 文件读取配置"""

    # LLM 服务 API 密钥
    LLM_API_KEY: str

    # LLM 服务基础 URL
    LLM_BASE_URL: str = "https://api.example.com/v1"

    # 使用的模型名称
    LLM_MODEL: str = "qwen-turbo"

    model_config = SettingsConfigDict(env_file=".env")


# 全局配置单例
settings = Settings()
