# LLM 客户端封装文件 - 统一 LLM API 调用
from __future__ import annotations
import logging
import time
from contextlib import nullcontext

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# 最大重试次数
MAX_RETRIES = 1
# 请求超时时间（秒）
TIMEOUT = 60
# 训练场景输出结构固定，限制上限避免模型无必要地生成过长内容。
MAX_OUTPUT_TOKENS = 2048

# Langfuse 为可选依赖：未安装或未配置凭证时，LLM 调用仍可正常进行，仅跳过追踪上报。
langfuse_client = None
_propagate_attributes = None
try:
    from langfuse import Langfuse, propagate_attributes  # type: ignore

    _propagate_attributes = propagate_attributes
    if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
        try:
            langfuse_client = Langfuse(
                public_key=settings.LANGFUSE_PUBLIC_KEY,
                secret_key=settings.LANGFUSE_SECRET_KEY,
                base_url=settings.LANGFUSE_BASE_URL,
                environment=settings.LANGFUSE_TRACING_ENVIRONMENT,
            )
            logger.info("Langfuse Cloud tracing enabled")
        except Exception as exc:
            logger.warning(f"Langfuse 初始化失败，继续运行但不记录追踪: {exc}")
            langfuse_client = None
    else:
        logger.info("Langfuse tracing disabled: credentials are not configured")
except ImportError:
    logger.info("Langfuse 未安装，跳过 LLM 追踪")


async def call_llm(
    prompt: str,
    *,
    session_id: str | None = None,
    observation_name: str = "llm-call",
    max_tokens: int | None = None,
    temperature: float = 0.7,
) -> str | None:
    """调用 LLM API

    Args:
        prompt: 用户提示词
        max_tokens: 单次输出 token 上限，None 时使用默认 MAX_OUTPUT_TOKENS
        temperature: 采样温度，默认 0.7

    Returns:
        LLM 返回的文本内容，失败返回 None
    """
    # 请求地址
    url = f"{settings.LLM_BASE_URL}/chat/completions"

    # 请求头
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }

    # 实际 token 上限
    output_limit = max_tokens if max_tokens is not None else MAX_OUTPUT_TOKENS

    # 请求体
    payload = {
        "model": settings.LLM_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": output_limit,
        "response_format": {"type": "json_object"},
    }
    if settings.LLM_MODEL == "glm-5.2":
        payload["thinking"] = {"type": "disabled"}

    try:
        observation_context = (
            langfuse_client.start_as_current_observation(
                as_type="generation",
                name=observation_name,
                model=settings.LLM_MODEL,
                input={"prompt": prompt},
                model_parameters={
                    "temperature": temperature,
                    "max_tokens": output_limit,
                },
            )
            if langfuse_client
            else nullcontext()
        )
        attributes_context = (
            _propagate_attributes(session_id=session_id, trace_name=observation_name)
            if langfuse_client and _propagate_attributes and session_id
            else nullcontext()
        )
    except Exception as exc:
        logger.warning(f"Langfuse 追踪上下文初始化失败，继续调用 LLM: {exc}")
        observation_context = nullcontext()
        attributes_context = nullcontext()

    # 重试逻辑
    with attributes_context:
        with observation_context as generation:
            for attempt in range(1, MAX_RETRIES + 2):
                try:
                    start_time = time.time()
                    logger.info(f"调用 LLM (第 {attempt} 次), url={url}, model={settings.LLM_MODEL}")

                    # 构建 httpx 客户端参数
                    client_kwargs = {
                        "timeout": TIMEOUT,
                        "verify": settings.LLM_VERIFY_SSL,
                    }
                    if settings.LLM_HTTP_PROXY:
                        client_kwargs["proxy"] = settings.LLM_HTTP_PROXY

                    async with httpx.AsyncClient(**client_kwargs) as client:
                        response = await client.post(
                            url,
                            headers=headers,
                            json=payload,
                        )
                        response.raise_for_status()

                    # 记录耗时
                    elapsed = time.time() - start_time
                    logger.info(f"LLM 调用成功, 耗时 {elapsed:.2f}s")

                    # 解析响应并记录 Langfuse generation
                    result = response.json()
                    output = result["choices"][0]["message"]["content"]
                    if generation is not None:
                        update_kwargs = {"output": output, "metadata": {"attempt": attempt}}
                        usage = result.get("usage")
                        if usage:
                            update_kwargs["usage_details"] = {
                                "input": usage.get("prompt_tokens", 0),
                                "output": usage.get("completion_tokens", 0),
                            }
                        generation.update(**update_kwargs)
                    return output

                except httpx.ConnectError as e:
                    elapsed = time.time() - start_time
                    # 递归获取根本原因
                    cause = e
                    while cause.__cause__:
                        cause = cause.__cause__
                    cause_str = f"{type(cause).__name__}: {str(cause) or repr(cause)}"
                    logger.error(
                        f"LLM 调用失败 (第 {attempt} 次), 耗时 {elapsed:.2f}s, "
                        f"类型: 连接错误, "
                        f"地址: {url}, "
                        f"根本原因: {cause_str}, "
                        f"排查建议: 请检查网络连接、代理设置、SSL 证书或服务地址是否正确"
                    )
                    if attempt > MAX_RETRIES:
                        if generation is not None:
                            generation.update(level="ERROR", status_message="LLM connection failed")
                        return None

                except httpx.TimeoutException as e:
                    elapsed = time.time() - start_time
                    logger.error(
                        f"LLM 调用失败 (第 {attempt} 次), 耗时 {elapsed:.2f}s, "
                        f"类型: 请求超时, 超时时间: {TIMEOUT}s, url: {url}, "
                        f"详细信息: {repr(e)}"
                    )
                    if attempt > MAX_RETRIES:
                        if generation is not None:
                            generation.update(level="ERROR", status_message="LLM request timed out")
                        return None

                except httpx.HTTPStatusError as e:
                    elapsed = time.time() - start_time
                    try:
                        error_detail = e.response.text
                    except Exception:
                        error_detail = str(e)
                    logger.error(
                        f"LLM 调用失败 (第 {attempt} 次), 耗时 {elapsed:.2f}s, "
                        f"类型: HTTP 错误, 状态码: {e.response.status_code}, url: {url}, "
                        f"响应内容: {error_detail[:500]}"
                    )
                    if attempt > MAX_RETRIES:
                        if generation is not None:
                            generation.update(level="ERROR", status_message="LLM HTTP request failed")
                        return None

                except Exception as e:
                    elapsed = time.time() - start_time
                    logger.error(
                        f"LLM 调用失败 (第 {attempt} 次), 耗时 {elapsed:.2f}s, "
                        f"类型: {type(e).__name__}, 详细信息: {repr(e)}"
                    )
                    if attempt > MAX_RETRIES:
                        if generation is not None:
                            generation.update(level="ERROR", status_message="LLM call failed")
                        return None
