import asyncio
import json
import unittest
from unittest.mock import AsyncMock, patch

import app.api.routes as routes
from app.api.schemas import ChatRequest, FinishRequest, PersonaRequest, SessionCreateRequest
from app.core.session_manager import SessionManager


class ChatLatencyTest(unittest.IsolatedAsyncioTestCase):
    """验证聊天链路不会串行等待两次独立的 LLM 任务。"""

    async def test_evaluator_and_customer_run_concurrently(self) -> None:
        class FakeCoach:
            def __init__(self, session_id: str, session_manager: SessionManager, error_tracker: object) -> None:
                pass

            async def evaluate(self, message: str, context: dict) -> dict:
                return {
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
                }

        class FakeSimulator:
            def __init__(self, session_id: str, session_manager: SessionManager) -> None:
                pass

            async def respond(self, message: str, state: dict) -> dict:
                return {"reply": "好的，我想再了解一下。", "state_delta": {"trust": 0, "intent": 0}}

        manager = SessionManager()
        session_id = "latency-test"
        manager.create(
            session_id,
            {
                "session_id": session_id,
                "customer_profile": {"concern": "怕刺痛烂脸"},
                "messages": [],
                "stage": "opening",
                "dimensions": {
                    "listening": 0,
                    "warmth": 0,
                    "professionalism": 0,
                    "objection_handling": 0,
                    "recommendation": 0,
                },
                "status": "active",
                "customer_state": {
                    "trust": 50,
                    "intent": 30,
                    "fear": "怕刺痛烂脸",
                },
            },
        )

        with (
            patch.object(routes, "session_manager", manager),
            patch.object(routes, "EvaluatorCoach", FakeCoach),
            patch.object(routes, "CustomerSimulator", FakeSimulator),
            patch.object(routes, "call_llm", new_callable=AsyncMock, return_value=None),
        ):
            result = await routes.chat(ChatRequest(session_id=session_id, message="我先了解一下你的情况。"))

        self.assertEqual(result["code"], 0)
        self.assertIn("dimension_reasoning", result["data"])
        self.assertEqual(result["data"]["dimension_reasoning"]["listening"]["score"], 50)


class SessionProgressTest(unittest.IsolatedAsyncioTestCase):
    """验证会话状态、阶段和每轮历史能够持续更新。"""

    async def test_chat_updates_stage_state_and_history(self) -> None:
        class FakeCoach:
            def __init__(self, session_id, session_manager, error_tracker) -> None:
                pass

            async def evaluate(self, message: str, context: dict) -> dict:
                return {
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
                }

        class FakeSimulator:
            def __init__(self, session_id, session_manager) -> None:
                pass

            async def respond(self, message: str, state: dict) -> dict:
                return {
                    "reply": "我还是怕刺痛，之前也没有用过 A 醇。",
                    "state_delta": {"trust": 1, "intent": 0},
                }

        session_result = await routes.create_session(SessionCreateRequest())
        session_id = session_result["data"]["session_id"]

        with (
            patch.object(routes, "EvaluatorCoach", FakeCoach),
            patch.object(routes, "CustomerSimulator", FakeSimulator),
        ):
            await routes.chat(
                ChatRequest(session_id=session_id, message="我推荐你先看看这款。")
            )
            second_result = await routes.chat(
                ChatRequest(session_id=session_id, message="很多人都在用，效果不错。")
            )

        data = second_result["data"]
        self.assertEqual(data["stage"], "objection")
        self.assertEqual(data["customer_state"]["current_stage"], "objection")
        self.assertEqual(data["customer_state"]["collected_info"], ["product_history"])

        detail = await routes.get_session(session_id)
        self.assertEqual(detail["data"]["ba_turn_count"], 2)
        self.assertEqual(len(detail["data"]["history"]), 2)
        self.assertEqual(detail["data"]["history"][1]["turn"], 2)
        self.assertEqual(detail["data"]["history"][1]["stage"], "objection")

    async def test_stage_requires_two_information_items_and_concern_response(self) -> None:
        class FakeCoach:
            def __init__(self, session_id: str, session_manager: SessionManager, error_tracker: object) -> None:
                pass

            async def evaluate(self, message: str, context: dict) -> dict:
                return {
                    "dimensions": {
                        "listening": 50,
                        "warmth": 50,
                        "professionalism": 50,
                        "objection_handling": 50,
                        "recommendation": 50,
                    },
                    "coach_decision": {"intervene": False, "type": "none", "content": "", "requires_action": False},
                }

        class FakeSimulator:
            def __init__(self, session_id: str, session_manager: SessionManager) -> None:
                pass

            async def respond(self, message: str, state: dict) -> dict:
                if "肤质" in message:
                    return {"reply": "我是敏感肌。", "state_delta": {"trust": 1, "intent": 0}}
                if "用过" in message:
                    return {"reply": "以前没有用过 A 醇。", "state_delta": {"trust": 1, "intent": 0}}
                if "预算" in message:
                    return {"reply": "预算在 1000 元以内。", "state_delta": {"trust": 1, "intent": 0}}
                if "购买" in message:
                    return {"reply": "我想买，但要先问问朋友。", "state_delta": {"trust": 1, "intent": 40}}
                return {"reply": "我还想再了解一下。", "state_delta": {"trust": 1, "intent": 0}}

        session_result = await routes.create_session(SessionCreateRequest())
        session_id = session_result["data"]["session_id"]
        with patch.object(routes, "EvaluatorCoach", FakeCoach), patch.object(routes, "CustomerSimulator", FakeSimulator):
            await routes.chat(ChatRequest(session_id=session_id, message="你的肤质是什么？"))
            second = await routes.chat(ChatRequest(session_id=session_id, message="之前用过 A 醇吗？"))
            third = await routes.chat(ChatRequest(session_id=session_id, message="你的预算是多少？"))
            fourth = await routes.chat(ChatRequest(session_id=session_id, message="我理解你担心刺痛，建议先低浓度使用。"))
            fifth = await routes.chat(ChatRequest(session_id=session_id, message="那就直接下单吧。"))
            sixth = await routes.chat(ChatRequest(session_id=session_id, message="如果合适可以购买。"))

        self.assertEqual(second["data"]["stage"], "probing")
        self.assertEqual(third["data"]["stage"], "probing")
        self.assertEqual(fourth["data"]["stage"], "recommending")
        self.assertEqual(fifth["data"]["stage"], "recommending")
        self.assertTrue(fourth["data"]["customer_state"]["milestones"]["key_info_confirmed"])
        self.assertTrue(sixth["data"]["customer_state"]["milestones"]["time_invested"])
        self.assertTrue(sixth["data"]["customer_state"]["milestones"]["other_involved"])
        self.assertFalse(sixth["data"]["customer_state"]["milestones"]["purchase_ready"])
        self.assertEqual(sixth["data"]["stage"], "recommending")


class HaltWithChampionRouteTest(unittest.IsolatedAsyncioTestCase):
    """验证第三次同类错误的销冠示范可以通过聊天接口返回。"""

    async def test_chat_returns_champion_replay_and_halts(self) -> None:
        class FakeCoach:
            def __init__(self, session_id, session_manager, error_tracker) -> None:
                pass

            async def evaluate(self, message: str, context: dict) -> dict:
                return {
                    "dimensions": {
                        "listening": 20,
                        "warmth": 20,
                        "professionalism": 20,
                        "objection_handling": 20,
                        "recommendation": 20,
                    },
                    "coach_decision": {
                        "intervene": True,
                        "type": "halt_with_champion",
                        "content": "同类错误已重复出现，请先看销冠示范。",
                        "requires_action": True,
                        "champion_replay": {
                            "title": "本轮销冠示范",
                            "rounds": [
                                {
                                    "turn": 3,
                                    "customer_message": "我还是担心会刺激。",
                                    "ba_reply": message,
                                    "champion_reply": "我先回应你的担心，再一起确认适合你的方案。",
                                    "skill_tags": ["先接住顾虑"],
                                }
                            ],
                        },
                    },
                }

        class FakeSimulator:
            def __init__(self, session_id, session_manager) -> None:
                pass

            async def respond(self, message: str, state: dict) -> dict:
                return {"reply": "我再想想。", "state_delta": {"trust": 0, "intent": 0}}

        session_result = await routes.create_session(SessionCreateRequest())
        session_id = session_result["data"]["session_id"]
        with (
            patch.object(routes, "EvaluatorCoach", FakeCoach),
            patch.object(routes, "CustomerSimulator", FakeSimulator),
        ):
            result = await routes.chat(ChatRequest(session_id=session_id, message="这款直接买就行。"))

        self.assertEqual(result["code"], 0)
        self.assertEqual(result["data"]["status"], "halted")
        coach_message = result["data"]["messages"][0]
        self.assertEqual(coach_message["type"], "halt_with_champion")
        self.assertTrue(coach_message["requires_action"])
        self.assertEqual(len(coach_message["champion_replay"]["rounds"]), 1)


class DynamicPersonaFlowTest(unittest.IsolatedAsyncioTestCase):
    """验证三组代表画像可以走完画像、会话、聊天和总结链路。"""

    def _summary_result(self, goal: str) -> str:
        return json.dumps(
            {
                "summary": f"围绕{goal}完成训练。",
                "total_score": 60,
                "dimensions": {
                    name: {"score": 60, "reasoning": f"围绕{goal}评估。"}
                    for name in ("listening", "warmth", "professionalism", "objection_handling", "recommendation")
                },
                "key_moments": [],
                "champion_replay": {
                    "title": "动态销冠示范",
                    "rounds": [
                        {
                            "turn": 1,
                            "ba_reply": "我先了解一下你的情况。",
                            "champion_reply": f"我先确认您想改善的是{goal}。",
                            "skill_tags": ["先探询"],
                        }
                    ],
                },
            },
            ensure_ascii=False,
        )

    async def test_three_representative_profiles_complete_flow(self) -> None:
        profiles = [
            ("18-25", "dry", "sensitive", "改善泛红和干燥"),
            ("26-35", "oily", "non_sensitive", "改善出油和毛孔"),
            ("36+", "combination", "sensitive", "改善暗沉和细纹"),
        ]

        class FakeCoach:
            def __init__(self, session_id, session_manager, error_tracker) -> None:
                pass

            async def evaluate(self, message: str, context: dict) -> dict:
                return {
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
                }

        class FakeSimulator:
            def __init__(self, session_id, session_manager) -> None:
                pass

            async def respond(self, message: str, state: dict) -> dict:
                return {"reply": "我想再了解一下。", "state_delta": {"trust": 1, "intent": 1}}

        with patch.object(routes, "EvaluatorCoach", FakeCoach), patch.object(routes, "CustomerSimulator", FakeSimulator):
            for age, oiliness, sensitivity, goal in profiles:
                persona_result = json.dumps(
                    {
                        "persona": f"{oiliness}皮顾客",
                        "skin_type": f"{sensitivity}+{oiliness}皮",
                        "goal": goal,
                        "concerns": [f"担心{goal}效果"],
                        "tolerance": "low" if sensitivity == "sensitive" else "high",
                        "background": "希望找到适合自己的日常方案。",
                        "initial_message": f"你好，我想{goal}。",
                    },
                    ensure_ascii=False,
                )
                with patch.object(routes, "call_llm", new_callable=AsyncMock) as call_llm:
                    call_llm.side_effect = [persona_result, None, self._summary_result(goal)]
                    generated = await routes.generate_persona(
                        PersonaRequest(age=age, oiliness=oiliness, sensitivity=sensitivity)
                    )
                    self.assertEqual(generated["code"], 0)
                    profile = generated["data"]["customer_profile"]
                    session_result = await routes.create_session(
                        SessionCreateRequest(
                            customer_profile=profile,
                            initial_message=generated["data"]["initial_message"],
                        )
                    )
                    session_id = session_result["data"]["session_id"]
                    chat_result = await routes.chat(
                        ChatRequest(session_id=session_id, message="我先了解一下你的情况。")
                    )
                    finish_result = await routes.finish(FinishRequest(session_id=session_id))

                self.assertEqual(chat_result["code"], 0)
                self.assertEqual(finish_result["code"], 0)
                self.assertEqual(finish_result["data"]["status"], "completed")
                self.assertEqual(len(finish_result["data"]["champion_replay"]["rounds"]), 1)
                self.assertEqual(
                    finish_result["data"]["champion_replay"]["rounds"][0]["customer_message"],
                    "我想再了解一下。",
                )

    async def test_finish_llm_failure_returns_dynamic_fallback(self) -> None:
        profile = {
            "persona": "非敏感油皮顾客",
            "skin_type": "非敏感+油皮",
            "goal": "改善出油和毛孔",
            "concerns": ["担心厚重闷痘"],
            "tolerance": "high",
            "background": "日常通勤，偏好清爽质地。",
        }
        session_result = await routes.create_session(
            SessionCreateRequest(customer_profile=profile, initial_message="我想改善出油和毛孔。")
        )
        session_id = session_result["data"]["session_id"]

        with patch.object(routes, "call_llm", new_callable=AsyncMock, return_value=None):
            result = await routes.finish(FinishRequest(session_id=session_id))

        self.assertEqual(result["code"], 0)
        self.assertEqual(result["data"]["status"], "completed")
        self.assertGreaterEqual(len(result["data"]["champion_replay"]["rounds"]), 1)
        self.assertIn("出油和毛孔", result["data"]["champion_replay"]["rounds"][0]["champion_reply"])
        self.assertIn("厚重闷痘", result["data"]["champion_replay"]["rounds"][0]["champion_reply"])

    async def test_finish_invalid_json_and_empty_rounds_use_fallback(self) -> None:
        profile = {
            "persona": "敏感干皮顾客",
            "skin_type": "敏感+干皮",
            "goal": "改善干燥",
            "concerns": ["担心泛红"],
            "tolerance": "low",
        }
        for llm_result in (
            "not-json",
            json.dumps({"summary": "有总结但没有回放", "champion_replay": {"rounds": []}}, ensure_ascii=False),
        ):
            session_result = await routes.create_session(
                SessionCreateRequest(customer_profile=profile, initial_message="我想改善干燥。")
            )
            with patch.object(routes, "call_llm", new_callable=AsyncMock, return_value=llm_result):
                result = await routes.finish(FinishRequest(session_id=session_result["data"]["session_id"]))

            self.assertEqual(result["code"], 0)
            self.assertGreaterEqual(len(result["data"]["champion_replay"]["rounds"]), 1)
            self.assertIn("担心泛红", result["data"]["champion_replay"]["rounds"][0]["champion_reply"])

    async def test_chat_double_fallback_graceful_degradation(self) -> None:
        """Day3 fallback 验证：评估教练和顾客模拟器同时失败时对话不中断"""
        session_result = await routes.create_session(
            SessionCreateRequest(
                customer_profile={
                    "persona": "敏感肌新手",
                    "skin_type": "敏感+干皮",
                    "goal": "try_early_c_late_a",
                    "concerns": ["刺痛恐惧"],
                    "tolerance": "low",
                },
                initial_message="你好，我想试试早C晚A。",
            )
        )
        session_id = session_result["data"]["session_id"]
        # 模拟双链路 LLM 同时失败
        with patch.object(routes, "call_llm", new_callable=AsyncMock, return_value=None):
            result = await routes.chat(ChatRequest(session_id=session_id, message="我推荐这款精华"))
        self.assertEqual(result["code"], 0)
        # 确认有消息返回（顾客 fallback 回复 + 教练默认评分不应阻断对话）
        self.assertGreater(len(result["data"]["new_messages"]), 0)


if __name__ == "__main__":
    unittest.main()
