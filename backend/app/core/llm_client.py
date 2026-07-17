# LLM 客户端封装文件 - 统一 LLM API 调用
import logging
import time
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# 最大重试次数
MAX_RETRIES = 2
# 请求超时时间（秒）
TIMEOUT = 15


async def call_llm(prompt: str) -> str | None:
    """调用 LLM API

    Args:
        prompt: 用户提示词

    Returns:
        LLM 返回的文本内容，失败返回 None
    """
    # 请求头
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    # 请求体
    payload = {
        "model": settings.LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
    }

    # 重试逻辑
    for attempt in range(1, MAX_RETRIES + 2):
        try:
            start_time = time.time()
            logger.info(f"调用 LLM (第 {attempt} 次), model={settings.LLM_MODEL}")

            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(
                    f"{settings.LLM_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()

            # 记录耗时
            elapsed = time.time() - start_time
            logger.info(f"LLM 调用成功, 耗时 {elapsed:.2f}s")

            # 解析响应
            result = response.json()
            return result["choices"][0]["message"]["content"]

        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"LLM 调用失败 (第 {attempt} 次), 耗时 {elapsed:.2f}s, 错误: {str(e)}")
            if attempt > MAX_RETRIES:
                return None
