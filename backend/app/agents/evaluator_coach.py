# 评估教练 Agent - 评估 BA 表现并做出教练决策
import logging
import json
from app.core.llm_client import call_llm
from app.core.session_manager import SessionManager
from app.agents.error_tracker import ErrorTracker
from app.prompts.templates import EVALUATOR_COACH_PROMPT

logger = logging.getLogger(__name__)

# LLM 调用失败时的降级数据
FALLBACK_RESULT = {
    "dimensions": {
        "listening": 50,
        "warmth": 50,
        "professionalism": 50,
        "objection_handling": 50,
        "recommendation": 50,
    },
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
            # 填充 Prompt 占位符
            prompt = EVALUATOR_COACH_PROMPT.format(
                ba_message=ba_message,
                concerns=context.get("concerns", "怕刺痛烂脸"),
                stage=context.get("stage", "opening"),
            )

            logger.info(f"[{self.session_id}] 评估教练调用 LLM")
            result = await call_llm(prompt)

            # LLM 返回 None，使用降级数据
            if result is None:
                logger.warning(f"[{self.session_id}] LLM 返回 None，使用降级数据")
                return FALLBACK_RESULT.copy()

            # 解析 JSON
            parsed = json.loads(result)
            logger.info(f"[{self.session_id}] 评估教练解析成功, decision={parsed.get('decision')}")

            # 提取错误类型，通过 error_tracker 追踪升级级别
            error_type = parsed.get("error_type")
            detected_errors = []
            if error_type and error_type != "null":
                detected_errors.append(error_type)
                # 追踪错误并获取升级级别
                level = self.error_tracker.track(error_type)
                logger.info(f"[{self.session_id}] 错误升级级别: {level}")

            # 解析教练决策
            decision = parsed.get("decision", "none")
            coach_message = parsed.get("coach_message", "")

            # 判断是否需要干预
            intervene = decision in ("probe", "halt", "feedback")
            # halt 需要用户确认
            requires_action = decision == "halt"

            return {
                "dimensions": parsed.get("dimensions", FALLBACK_RESULT["dimensions"]),
                "coach_decision": {
                    "intervene": intervene,
                    "type": decision,
                    "content": coach_message,
                    "requires_action": requires_action,
                },
                "detected_errors": detected_errors,
            }

        except json.JSONDecodeError as e:
            logger.error(f"[{self.session_id}] 评估教练 JSON 解析失败: {str(e)}")
            return FALLBACK_RESULT.copy()

        except Exception as e:
            logger.error(f"[{self.session_id}] 评估教练异常: {str(e)}")
            return FALLBACK_RESULT.copy()
