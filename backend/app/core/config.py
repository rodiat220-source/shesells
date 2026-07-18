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

    # 是否验证 SSL 证书（默认 True，代理环境下可设为 False）
    LLM_VERIFY_SSL: bool = True

    # HTTP 代理地址（可选，例如 http://127.0.0.1:7890）
    LLM_HTTP_PROXY: str = ""

    # Langfuse Cloud 配置，留空时关闭追踪
    LANGFUSE_PUBLIC_KEY: str = ""
    LANGFUSE_SECRET_KEY: str = ""
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"
    LANGFUSE_TRACING_ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(env_file=".env")


# 全局配置单例
settings = Settings()
