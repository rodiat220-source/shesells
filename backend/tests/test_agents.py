import json
import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("LLM_API_KEY", "test-key")

from app.agents.customer_simulator import CustomerSimulator
from app.agents.error_tracker import ErrorTracker
from app.agents.evaluator_coach import EvaluatorCoach
from app.core.session_manager import SessionManager
from app.prompts.templates import (
    CUSTOMER_SIMULATOR_PROMPT,
    EVALUATOR_COACH_PROMPT,
    SELF_CHECKER_PROMPT,
    SUMMARY_PROMPT,
)


class ErrorTrackerTest(unittest.IsolatedAsyncioTestCase):
    """验证错误升级规则。"""

    async def test_error_level_escalates_and_resets(self) -> None:
        tracker = ErrorTracker()

        self.assertEqual(await tracker.track("hard_push"), "probe")
        self.assertEqual(await tracker.track("hard_push"), "halt")
        self.assertEqual(await tracker.track("hard_push"), "halt_with_champion")
        self.assertEqual(await tracker.get_count("hard_push"), 3)

        await tracker.reset()
        self.assertEqual(await tracker.get_count("hard_push"), 0)

    async def test_error_level_isolated_by_session(self) -> None:
        tracker = ErrorTracker()

        self.assertEqual(await tracker.track("ignored_concerns", "session-1"), "probe")
        self.assertEqual(await tracker.track("ignored_concerns", "session-2"), "probe")
        self.assertEqual(await tracker.track("ignored_concerns", "session-1"), "halt")
        self.assertEqual(await tracker.get_count("ignored_concerns", "session-2"), 1)


class EvaluatorCoachTest(unittest.IsolatedAsyncioTestCase):
    """验证教练决策会遵循同类错误升级规则。"""

    @patch("app.agents.evaluator_coach.call_llm", new_callable=AsyncMock)
    async def test_tracker_level_overrides_premature_halt(self, call_llm: AsyncMock) -> None:
        result = json.dumps(
            {
                "dimensions": {
                    name: {
                        "score": 20,
                        "reasoning": "【观察】直接推荐。【对比】缺少探询。【原因】顾虑未被回应。【标杆】先确认顾虑。",
                    }
                    for name in ("listening", "warmth", "professionalism", "objection_handling", "recommendation")
                },
                "decision": "halt",
                "coach_message": "请先回应顾客的核心顾虑。",
                "error_type": "ignored_concerns",
            },
            ensure_ascii=False,
        )
        call_llm.side_effect = [
            result,
            result,
            json.dumps({"approved": True}, ensure_ascii=False),
            result,
            json.dumps({"approved": True}, ensure_ascii=False),
            result,
        ]
        tracker = ErrorTracker()
        context = {
            "concerns": "怕刺痛烂脸",
            "stage": "opening",
            "persona_profile": {"goal": "改善泛红", "concerns": ["怕刺痛烂脸"]},
            "last_customer_message": "我还是担心会刺痛。",
            "turn": 3,
        }

        first = await EvaluatorCoach("session-1", SessionManager(), tracker).evaluate("您好", context)
        second = await EvaluatorCoach("session-1", SessionManager(), tracker).evaluate("我推荐这款", context)
        third = await EvaluatorCoach("session-1", SessionManager(), tracker).evaluate("我再推荐一款", context)
        other_session = await EvaluatorCoach("session-2", SessionManager(), tracker).evaluate("您好", context)

        self.assertEqual(first["coach_decision"]["type"], "probe")
        self.assertFalse(first["coach_decision"]["requires_action"])
        self.assertEqual(second["coach_decision"]["type"], "halt")
        self.assertTrue(second["coach_decision"]["requires_action"])
        self.assertEqual(third["coach_decision"]["type"], "halt_with_champion")
        self.assertTrue(third["coach_decision"]["requires_action"])
        self.assertEqual(len(third["coach_decision"]["champion_replay"]["rounds"]), 1)
        self.assertIn("改善泛红", third["coach_decision"]["champion_replay"]["rounds"][0]["champion_reply"])
        self.assertEqual(other_session["coach_decision"]["type"], "probe")

    @patch("app.agents.evaluator_coach.call_llm", new_callable=AsyncMock)
    async def test_untracked_halt_downgrades_to_probe(self, call_llm: AsyncMock) -> None:
        call_llm.return_value = json.dumps(
            {
                "dimensions": {
                    name: {
                        "score": 50,
                        "reasoning": "【观察】回复信息有限。【对比】仍需探询。【原因】无法确认需求。【标杆】先问使用史。",
                    }
                    for name in ("listening", "warmth", "professionalism", "objection_handling", "recommendation")
                },
                "decision": "halt",
                "coach_message": "请回应顾客顾虑。",
                "error_type": None,
            },
            ensure_ascii=False,
        )

        result = await EvaluatorCoach(
            "session-1",
            SessionManager(),
            ErrorTracker(),
        ).evaluate("您好", {"concerns": "怕刺痛烂脸", "stage": "opening"})

        self.assertEqual(result["coach_decision"]["type"], "probe")
        self.assertFalse(result["coach_decision"]["requires_action"])

    @patch("app.agents.evaluator_coach.call_llm", new_callable=AsyncMock)
    async def test_invalid_output_falls_back_before_tracking_error(self, call_llm: AsyncMock) -> None:
        call_llm.return_value = json.dumps(
            {
                "dimensions": {"listening": 101},
                "decision": "unknown",
                "coach_message": "",
                "error_type": "not_a_valid_error",
            },
            ensure_ascii=False,
        )
        tracker = ErrorTracker()
        result = await EvaluatorCoach("invalid-session", SessionManager(), tracker).evaluate(
            "直接买这款吧。", {"concerns": "预算", "stage": "probing"}
        )

        self.assertEqual(result["dimensions"]["listening"], 50)
        self.assertEqual(result["coach_decision"]["type"], "none")
        self.assertEqual(await tracker.get_count("hard_push", "invalid-session"), 0)

    @patch("app.agents.evaluator_coach.call_llm", new_callable=AsyncMock)
    async def test_halt_message_is_checked_once_and_rewritten(self, call_llm: AsyncMock) -> None:
        evaluation = json.dumps(
            {
                "dimensions": {
                    name: {
                        "score": 20,
                        "reasoning": "【观察】直接推荐。【对比】缺少探询。【原因】顾虑未被回应。【标杆】先确认顾虑。",
                    }
                    for name in ("listening", "warmth", "professionalism", "objection_handling", "recommendation")
                },
                "decision": "halt",
                "coach_message": "你做得不对。",
                "error_type": "ignored_concerns",
            },
            ensure_ascii=False,
        )
        self_check = json.dumps(
            {"approved": False, "revised_message": "你愿意推荐方案很好，先回应她对刺激的担心，再问问使用史。"},
            ensure_ascii=False,
        )
        call_llm.side_effect = [evaluation, self_check]
        tracker = ErrorTracker()
        await tracker.track("ignored_concerns", "session-1")

        result = await EvaluatorCoach("session-1", SessionManager(), tracker).evaluate(
            "这款直接买就行。",
            {"concerns": "怕刺激", "stage": "objection"},
        )

        self.assertEqual(result["coach_decision"]["type"], "halt")
        self.assertEqual(result["coach_decision"]["content"], "你愿意推荐方案很好，先回应她对刺激的担心，再问问使用史。")
        self.assertIn("【观察】", result["dimension_reasoning"]["listening"]["reasoning"])
        self.assertEqual(call_llm.await_count, 2)


class CustomerSimulatorTest(unittest.IsolatedAsyncioTestCase):
    """验证顾客模拟器正常和降级返回。"""

    @patch("app.agents.customer_simulator.call_llm", new_callable=AsyncMock)
    async def test_respond_parses_llm_json(self, call_llm: AsyncMock) -> None:
        call_llm.return_value = json.dumps(
            {
                "reply": "那敏感肌应该怎么开始用呢？",
                "state_delta": {"trust": 5, "intent": 2},
            },
            ensure_ascii=False,
        )
        simulator = CustomerSimulator("session-1", SessionManager())

        result = await simulator.respond(
            "可以先建立耐受。",
            {"trust": 50, "intent": 30, "fear": "怕刺痛烂脸"},
        )

        self.assertEqual(result["reply"], "那敏感肌应该怎么开始用呢？")
        self.assertEqual(result["state_delta"], {"trust": 5, "intent": 2})

    @patch("app.agents.customer_simulator.call_llm", new_callable=AsyncMock)
    async def test_respond_falls_back_when_llm_fails(self, call_llm: AsyncMock) -> None:
        call_llm.return_value = None
        simulator = CustomerSimulator("session-1", SessionManager())

        result = await simulator.respond(
            "这款现在很划算。",
            {"trust": 50, "intent": 30, "fear": "怕刺痛烂脸"},
        )

        self.assertTrue(result["reply"])
        self.assertEqual(result["state_delta"], {"trust": 0, "intent": 0})

    @patch("app.agents.customer_simulator.call_llm", new_callable=AsyncMock)
    async def test_respond_falls_back_for_invalid_state_delta(
        self,
        call_llm: AsyncMock,
    ) -> None:
        call_llm.return_value = json.dumps(
            {
                "reply": "我想直接买。",
                "state_delta": {"trust": 100, "intent": 100},
            },
            ensure_ascii=False,
        )
        simulator = CustomerSimulator("session-1", SessionManager())

        result = await simulator.respond(
            "现在就买吧。",
            {"trust": 50, "intent": 30, "fear": "怕刺痛烂脸"},
        )

        self.assertEqual(result["state_delta"], {"trust": 0, "intent": 0})


class PromptTemplateTest(unittest.IsolatedAsyncioTestCase):
    """验证 Prompt 占位符可被现有调用方填充。"""

    async def test_templates_format_without_missing_fields(self) -> None:
        customer_prompt = CUSTOMER_SIMULATOR_PROMPT.format(
            profile='{"goal": "改善泛红", "concerns": ["担心刺激"]}',
            state='{"trust": 50, "intent": 30, "current_stage": "probing"}',
            history="[customer] 我有点担心",
            ba_message="可以先建立耐受。",
        )
        coach_prompt = EVALUATOR_COACH_PROMPT.format(
            profile='{"goal": "改善泛红", "concerns": ["担心刺激"]}',
            ba_message="可以先建立耐受。",
            concerns="怕刺痛烂脸",
            stage="probing",
            state='{"trust": 50}',
            history="[customer] 我有点担心",
        )
        summary_prompt = SUMMARY_PROMPT.format(
            profile='{"goal": "改善泛红", "concerns": ["担心刺激"]}',
            conversation_history="[ba] 你好",
            concerns="担心刺激",
            addressed_concerns="暂无",
            current_stage="probing",
            customer_state='{"trust": 50}',
        )
        self_check_prompt = SELF_CHECKER_PROMPT.format(
            coach_message="先回应顾虑。",
            ba_message="直接推荐。",
            concerns="担心刺激",
        )

        self.assertIn("可以先建立耐受。", customer_prompt)
        self.assertIn("probing", coach_prompt)
        self.assertIn("[ba] 你好", summary_prompt)
        self.assertIn("先回应顾虑。", self_check_prompt)

    @patch("app.agents.customer_simulator.call_llm", new_callable=AsyncMock)
    async def test_dynamic_profile_is_used_for_customer_fallback(self, call_llm: AsyncMock) -> None:
        call_llm.return_value = None
        profile = {
            "persona": "预算敏感的油皮顾客",
            "skin_type": "非敏感+油皮",
            "goal": "改善出油和毛孔",
            "concerns": ["担心厚重闷痘"],
            "tolerance": "high",
        }
        result = await CustomerSimulator("oily-session", SessionManager()).respond(
            "这款现在很划算。",
            {
                "trust": 50,
                "intent": 30,
                "fear": "担心厚重闷痘",
                "current_stage": "probing",
                "addressed_concerns": [],
                "collected_info": ["skin_type"],
                "conversation_history": "[customer] 我最近 T 区很容易出油。",
                "persona_profile": profile,
            },
        )

        prompt = call_llm.await_args.args[0]
        self.assertIn("改善出油和毛孔", prompt)
        self.assertIn("担心厚重闷痘", prompt)
        self.assertIn("非敏感+油皮", prompt)
        self.assertIn("我最近 T 区很容易出油", prompt)
        self.assertIn('"current_stage": "probing"', prompt)
        self.assertIn("担心厚重闷痘", result["reply"])
        self.assertNotIn("敏感肌", result["reply"])

    @patch("app.agents.evaluator_coach.call_llm", new_callable=AsyncMock)
    async def test_dynamic_profile_is_used_for_evaluator(self, call_llm: AsyncMock) -> None:
        call_llm.return_value = json.dumps(
            {
                "dimensions": {
                    name: {
                        "score": 60,
                        "reasoning": "【观察】主动了解出油情况。【对比】符合探询阶段。【原因】需求信息增加。【标杆】继续确认使用史。",
                    }
                    for name in ("listening", "warmth", "professionalism", "objection_handling", "recommendation")
                },
                "decision": "none",
                "coach_message": "",
                "error_type": None,
            },
            ensure_ascii=False,
        )
        profile = {
            "goal": "改善出油和毛孔",
            "concerns": ["担心厚重闷痘"],
            "skin_type": "非敏感+油皮",
        }
        await EvaluatorCoach("oily-session", SessionManager(), ErrorTracker()).evaluate(
            "我先了解你的出油情况。",
            {
                "stage": "probing",
                "concerns": "担心厚重闷痘",
                "persona_profile": profile,
                "customer_state": {"trust": 50},
                "conversation_history": "[customer] 我怕产品太厚重",
            },
        )

        prompt = call_llm.await_args.args[0]
        self.assertIn("改善出油和毛孔", prompt)
        self.assertIn("担心厚重闷痘", prompt)
        self.assertIn("我怕产品太厚重", prompt)


if __name__ == "__main__":
    unittest.main()
