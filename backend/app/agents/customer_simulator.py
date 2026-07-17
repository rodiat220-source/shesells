# 顾客模拟器 Agent - 模拟敏感肌顾客回应 BA 的消息
import logging

from app.core.session_manager import SessionManager

logger = logging.getLogger(__name__)

# LLM 调用失败时的兜底回复（待填充）
FALLBACK_REPLY = ""


class CustomerSimulator:
    """顾客模拟器，根据 BA 消息生成顾客回应"""

    def __init__(self, session_id: str, session_manager: SessionManager) -> None:
        """初始化顾客模拟器

        Args:
            session_id: 会话 ID
            session_manager: 会话管理器
        """
        self.session_id = session_id
        self.session_manager = session_manager

    async def respond(self, ba_message: str, state: dict) -> dict:
        """生成顾客回应

        需要实现的逻辑：
        - 从 templates 导入 CUSTOMER_SIMULATOR_PROMPT
        - 用 state 中的 trust, intent, fear 填充占位符
        - 调用 call_llm() 获取回复
        - 如果 call_llm 返回 None，返回 FALLBACK_REPLY 兜底
        - 用 logging 记录日志

        Args:
            ba_message: BA 最新消息
            state: 顾客当前状态（含 trust, intent, fear）

        Returns:
            {
                "reply": "顾客说的话",
                "state_delta": {"trust": 5, "intent": 3, "fear": -2}
            }
        """
        pass
