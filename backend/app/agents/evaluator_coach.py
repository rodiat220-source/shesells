import json
import logging
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.llm_client import call_llm
from app.core.session_manager import SessionManager
from app.agents.error_tracker import ErrorTracker
from app.prompts.templates import EVALUATOR_COACH_PROMPT, SELF_CHECKER_PROMPT

logger = logging.getLogger(__name__)

VALID_ERROR_TYPES = Literal[
    "skipped_probing",
    "ignored_concerns",
    "shallow_reply",
    "negative_response",
    "hard_push",
]


class DimensionScore(BaseModel):
    """单维实时评分及依据。"""

    score: int = Field(ge=0, le=100)
    reasoning: str

    @field_validator("reasoning")
    @classmethod
    def validate_reasoning(cls, value: str) -> str:
        """确保实时评分依据包含四步。"""
        if not all(marker in value for marker in ("【观察】", "【对比】", "【原因】", "【标杆】")):
            raise ValueError("评分依据必须包含观察、对比、原因和标杆")
        return value


class EvaluatorDimensions(BaseModel):
    """教练单轮五维评分。"""

    listening: DimensionScore
    warmth: DimensionScore
    professionalism: DimensionScore
    objection_handling: DimensionScore
    recommendation: DimensionScore


class EvaluatorResult(BaseModel):
    """EvaluatorCoach 的 LLM 输出契约。"""

    dimensions: EvaluatorDimensions
    decision: Literal["probe", "halt", "feedback", "none"] = "none"
    coach_message: str = ""
    error_type: VALID_ERROR_TYPES | None = None


class SelfCheckResult(BaseModel):
    """教练喊停消息的自检结果。"""

    approved: bool
    revised_message: str = ""

# LLM 调用失败时的降级数据
FALLBACK_DIMENSION_REASONING = {
    "listening": {"score": 50, "reasoning": "【观察】模型未给出有效评分依据。【对比】无法完整对照当前阶段。【原因】本轮使用降级评分。【标杆】下一轮先收集关键信息。"},
    "warmth": {"score": 50, "reasoning": "【观察】模型未给出有效评分依据。【对比】无法完整对照当前阶段。【原因】本轮使用降级评分。【标杆】下一轮先回应顾客感受。"},
    "professionalism": {"score": 50, "reasoning": "【观察】模型未给出有效评分依据。【对比】无法完整对照当前阶段。【原因】本轮使用降级评分。【标杆】下一轮按阶段补全信息。"},
    "objection_handling": {"score": 50, "reasoning": "【观察】模型未给出有效评分依据。【对比】无法完整对照当前阶段。【原因】本轮使用降级评分。【标杆】下一轮先接住顾客顾虑。"},
    "recommendation": {"score": 50, "reasoning": "【观察】模型未给出有效评分依据。【对比】无法完整对照当前阶段。【原因】本轮使用降级评分。【标杆】下一轮确认需求后再推荐。"},
}

FALLBACK_RESULT = {
    "dimensions": {
        "listening": 50,
        "warmth": 50,
        "professionalism": 50,
        "objection_handling": 50,
        "recommendation": 50,
    },
    "dimension_reasoning": FALLBACK_DIMENSION_REASONING,
    "coach_decision": {
        "intervene": False,
        "type": "none",
        "content": "",
        "requires_action": False,
    },
    "detected_errors": [],
}


class EvaluatorCoach:
    """评估教练，评估 BA 表现并决定是否干预"""

    def __init__(
        self,
        session_id: str,
        session_manager: SessionManager,
        error_tracker: ErrorTracker,
    ) -> None:
        """初始化评估教练

        Args:
            session_id: 会话 ID
            session_manager: 会话管理器
            error_tracker: 错误追踪器
        """
        self.session_id = session_id
        self.session_manager = session_manager
        self.error_tracker = error_tracker

    async def evaluate(self, ba_message: str, context: dict) -> dict:
        """评估 BA 消息并做出教练决策

        Args:
            ba_message: BA 最新消息
            context: 上下文（含 stage, concerns）

        Returns:
            {
                "dimensions": {五维评分},
                "coach_decision": {intervene, type, content, requires_action},
                "detected_errors": [错误类型列表]
            }
        """
        try:
            profile = context.get("persona_profile") or context.get("customer_profile") or {}
            prompt = EVALUATOR_COACH_PROMPT.format(
                profile=json.dumps(profile, ensure_ascii=False),
                ba_message=ba_message,
                concerns=context.get("concerns", "当前顾虑"),
                stage=context.get("stage", "opening"),
                state=json.dumps(context.get("customer_state", {}), ensure_ascii=False),
                history=context.get("conversation_history", "暂无历史对话"),
            )

            logger.info(f"[{self.session_id}] 评估教练调用 LLM")
            result = await call_llm(
                prompt,
                session_id=self.session_id,
                observation_name="evaluator-coach",
            )

            # LLM 返回 None，使用降级数据
            if result is None:
                logger.warning(f"[{self.session_id}] LLM 返回 None，使用降级数据")
                return FALLBACK_RESULT.copy()

            # 解析并校验 JSON，避免非法分数或未知决策进入会话状态。
            parsed = json.loads(result)
            if not isinstance(parsed, dict):
                raise ValueError("EvaluatorCoach 输出必须是 JSON 对象")
            raw_error_type = parsed.get("error_type")
            if raw_error_type == "null":
                raw_error_type = None
            validated = EvaluatorResult.model_validate(
                {
                    "dimensions": {
                        **FALLBACK_DIMENSION_REASONING,
                        **(parsed.get("dimensions") or {}),
                    },
                    "decision": parsed.get("decision", "none"),
                    "coach_message": parsed.get("coach_message", ""),
                    "error_type": raw_error_type,
                }
            )
            logger.info(f"[{self.session_id}] 评估教练解析成功, decision={validated.decision}")

            # 提取错误类型，并按会话追踪同类错误升级级别。
            error_type = validated.error_type
            detected_errors = []
            level = "none"
            if error_type and error_type != "null":
                detected_errors.append(error_type)
                level = await self.error_tracker.track(error_type, self.session_id)
                logger.info(f"[{self.session_id}] 错误升级级别: {level}")

            # 解析教练决策
            decision = validated.decision
            coach_message = validated.coach_message
            champion_replay = None

            # 累计错误级别优先于单轮 LLM 判断，避免第一轮错误直接喊停。
            if level == "probe":
                decision = "probe"
            elif level == "halt":
                decision = "halt"
            elif level == "halt_with_champion":
                decision = "halt_with_champion"
                champion_replay = self._build_champion_replay(ba_message, context)
            elif decision == "halt":
                # 缺少可追踪错误时降为 probe，避免模型单轮误判直接锁死会话。
                decision = "probe"

            # 判断是否需要干预
            intervene = decision in ("probe", "halt", "halt_with_champion", "feedback")
            # halt 需要用户确认
            requires_action = decision in ("halt", "halt_with_champion")
            if intervene and not coach_message:
                coach_message = "请先接住顾客的核心顾虑，再继续推进。"
            if requires_action:
                coach_message = await self._self_check_message(coach_message, ba_message, context)

            dimension_reasoning = validated.dimensions.model_dump()
            dimensions = {
                name: value["score"]
                for name, value in dimension_reasoning.items()
            }

            return {
                "dimensions": dimensions,
                "dimension_reasoning": dimension_reasoning,
                "coach_decision": {
                    "intervene": intervene,
                    "type": decision,
                    "content": coach_message,
                    "requires_action": requires_action,
                    "champion_replay": champion_replay,
                },
                "detected_errors": detected_errors,
            }

        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            logger.error(f"[{self.session_id}] 评估教练 JSON 解析失败: {str(e)}")
            return FALLBACK_RESULT.copy()

        except Exception as e:
            logger.error(f"[{self.session_id}] 评估教练异常: {str(e)}")
            return FALLBACK_RESULT.copy()

    async def _self_check_message(self, coach_message: str, ba_message: str, context: dict) -> str:
        """仅在喊停时自检一次，失败时保留原消息。"""
        try:
            prompt = SELF_CHECKER_PROMPT.format(
                coach_message=coach_message,
                ba_message=ba_message,
                concerns=context.get("concerns", "当前顾虑"),
            )
            result = await call_llm(
                prompt,
                session_id=self.session_id,
                observation_name="coach-self-check",
            )
            if result is None:
                return coach_message
            checked = SelfCheckResult.model_validate_json(result)
            if not checked.approved and checked.revised_message.strip():
                return checked.revised_message.strip()
            return coach_message
        except (ValidationError, ValueError) as exc:
            logger.warning(f"[{self.session_id}] 教练消息自检失败，保留原消息: {exc}")
            return coach_message
        except Exception as exc:
            logger.warning(f"[{self.session_id}] 教练消息自检异常，保留原消息: {exc}")
            return coach_message

    @staticmethod
    def _build_champion_replay(ba_message: str, context: dict) -> dict:
        """第三次同类错误时生成一轮动态销冠示范。"""
        profile = context.get("persona_profile") or {}
        concerns = context.get("concerns") or "当前顾虑"
        goal = profile.get("goal", "解决当前护肤诉求")
        customer_message = context.get("last_customer_message") or f"我主要担心{concerns}。"
        champion_reply = (
            f"我先理解您对{concerns}的顾虑，再确认您想解决的是{goal}。"
            "我们先从适合您的基础方案开始，再根据反馈逐步调整，可以吗？"
        )
        return {
            "title": "本轮销冠示范",
            "rounds": [
                {
                    "turn": context.get("turn", 1),
                    "customer_message": customer_message,
                    "ba_reply": ba_message,
                    "champion_reply": champion_reply,
                    "skill_tags": ["先接住顾虑", "确认真实诉求", "降低决策成本"],
                }
            ],
        }
