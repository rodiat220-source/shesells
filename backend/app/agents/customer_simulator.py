# 顾客模拟器 Agent - 模拟敏感肌顾客回应 BA 的消息
import json
import logging

from pydantic import BaseModel, Field, ValidationError

from app.core.llm_client import call_llm
from app.core.session_manager import SessionManager
from app.prompts.templates import CUSTOMER_SIMULATOR_PROMPT

logger = logging.getLogger(__name__)

# LLM 调用失败时按当前画像生成兜底回复。
DEFAULT_CONCERN = "使用效果和安全性"


class CustomerStateDelta(BaseModel):
    """顾客状态变化。"""

    trust: int = Field(ge=-15, le=15)
    intent: int = Field(ge=-15, le=15)


class CustomerReply(BaseModel):
    """顾客模拟器返回结果。"""

    reply: str = Field(min_length=1)
    state_delta: CustomerStateDelta


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

        Args:
            ba_message: BA 最新消息
            state: 顾客当前状态，包含 persona_profile 时按动态画像回复

        Returns:
            {
                "reply": "顾客说的话",
                "state_delta": {"trust": 5, "intent": 3}
            }
        """
        try:
            profile = state.get("persona_profile") or state.get("customer_profile") or {}
            profile_context = self._profile_context(profile, state)
            prompt = CUSTOMER_SIMULATOR_PROMPT.format(
                profile=json.dumps(profile_context, ensure_ascii=False),
                state=json.dumps(
                    {
                        "trust": state.get("trust", 50),
                        "intent": state.get("intent", 30),
                        "fear": self._primary_concern(profile_context, state),
                        "irritation_fear": state.get("irritation_fear", 40),
                        "addressed_concerns": state.get("addressed_concerns", []),
                        "collected_info": state.get("collected_info", []),
                        "current_stage": state.get("current_stage", "opening"),
                    },
                    ensure_ascii=False,
                ),
                history=state.get("conversation_history", "（暂无历史对话）"),
                ba_message=ba_message,
            )
            logger.info(f"[{self.session_id}] 顾客模拟器调用 LLM")
            result = await call_llm(
                prompt,
                session_id=self.session_id,
                observation_name="customer-simulator",
            )

            if result is None:
                logger.warning(f"[{self.session_id}] LLM 返回 None，使用兜底回复")
                return self._fallback_result(profile_context, state)

            parsed = CustomerReply.model_validate_json(result)
            
            # 限制状态变化范围在 -15 到 15
            trust_delta = max(-15, min(15, parsed.state_delta.trust))
            intent_delta = max(-15, min(15, parsed.state_delta.intent))
            
            logger.info(f"[{self.session_id}] 顾客回复生成成功")
            return {
                "reply": parsed.reply,
                "state_delta": {"trust": trust_delta, "intent": intent_delta},
            }

        except ValidationError as e:
            logger.error(f"[{self.session_id}] 顾客回复解析失败: {str(e)}")
            return self._fallback_result(profile_context, state)

        except Exception as e:
            logger.error(f"[{self.session_id}] 顾客模拟器异常: {str(e)}")
            return self._fallback_result(locals().get("profile_context", {}), state)

    @staticmethod
    def _profile_context(profile: dict, state: dict) -> dict:
        """补齐旧默认会话所需的最小画像上下文。"""
        raw_concerns = profile.get("concerns")
        concerns = raw_concerns if isinstance(raw_concerns, list) else [raw_concerns]
        concerns = [concern for concern in concerns if concern]
        if not concerns:
            concerns = [profile.get("concern") or state.get("fear") or DEFAULT_CONCERN]
        return {
            "persona": profile.get("persona") or profile.get("name") or "顾客",
            "skin_type": profile.get("skin_type", "未知肤质"),
            "goal": profile.get("goal", "了解适合自己的护肤方案"),
            "concerns": concerns,
            "tolerance": profile.get("tolerance", "medium"),
            "background": profile.get("background", ""),
            "tags": profile.get("tags", {}),
            "display_line": profile.get("display_line", ""),
        }

    @staticmethod
    def _primary_concern(profile: dict, state: dict) -> str:
        concerns = profile.get("concerns") or []
        return concerns[0] if concerns else state.get("fear", DEFAULT_CONCERN)

    @classmethod
    def _fallback_result(cls, profile: dict, state: dict) -> dict:
        concern = cls._primary_concern(profile, state)
        goal = profile.get("goal", "了解适合自己的护肤方案")
        return {
            "reply": f"我主要想解决{goal}，但还是比较在意{concern}，能先说说适合我的使用方式吗？",
            "state_delta": {"trust": 0, "intent": 0},
        }
