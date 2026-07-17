# API 路由定义文件 - 实现 5 个接口
import logging
import uuid
import json
from fastapi import APIRouter
from app.api.schemas import (
    SessionCreateRequest,
    SessionCreateResponse,
    CustomerProfile,
    DimensionScores,
    ChatRequest,
    ChatResponse,
    ChatContinueRequest,
    Message,
    FinishResponse,
    SessionResponse,
)
from app.core.session_manager import session_manager
from app.core.llm_client import call_llm
from app.agents.error_tracker import error_tracker
from app.agents.customer_simulator import CustomerSimulator
from app.agents.evaluator_coach import EvaluatorCoach
from app.prompts.templates import SUMMARY_PROMPT

logger = logging.getLogger(__name__)

router = APIRouter()


def success(data: dict, message: str = "success") -> dict:
    """成功响应"""
    return {"code": 0, "data": data, "message": message}


def error(message: str) -> dict:
    """错误响应"""
    return {"code": -1, "message": message}


@router.post("/session")
async def create_session(request: SessionCreateRequest) -> dict:
    """创建会话"""
    try:
        session_id = str(uuid.uuid4())
        logger.info(f"创建会话: {session_id}, scenario={request.scenario_id}")

        # 顾客信息
        customer_profile = CustomerProfile(
            name="林小姐",
            age=25,
            skin_type="敏感肌",
            experience="护肤新手",
            tolerance="低耐受",
            concern="怕刺痛烂脸",
        )

        # 初始雷达图全 0
        dimensions = DimensionScores(
            listening=0, warmth=0, professionalism=0,
            objection_handling=0, recommendation=0,
        )

        # 会话数据
        session_data = {
            "session_id": session_id,
            "customer_profile": customer_profile.model_dump(),
            "messages": [],
            "stage": "opening",
            "dimensions": dimensions.model_dump(),
            "status": "active",
            "history": [],
            "customer_state": {"trust": 50, "intent": 30, "fear": "怕刺痛烂脸"},
        }

        # 顾客开场消息
        initial_message = "你好，我最近看到早C晚A很火，但我皮肤有点敏感，怕用了会刺痛烂脸，你能帮我看看吗？"
        session_data["messages"].append(
            {"role": "customer", "content": initial_message, "type": None, "requires_action": False}
        )

        # 保存会话
        session_manager.create(session_id, session_data)

        response = SessionCreateResponse(
            session_id=session_id,
            customer_profile=customer_profile,
            stage="opening",
            initial_customer_message=initial_message,
            dimensions=dimensions,
        )

        return success(response.model_dump())

    except Exception as e:
        logger.error(f"创建会话失败: {str(e)}")
        return error(f"创建会话失败: {str(e)}")


@router.post("/chat")
async def chat(request: ChatRequest) -> dict:
    """发送消息，获取响应"""
    try:
        session_id = request.session_id
        logger.info(f"聊天请求: {session_id}")

        # 加载会话
        session_data = session_manager.load(session_id)
        if session_data is None:
            return error("会话不存在")

        # 检查会话状态
        if session_data["status"] == "halted":
            return error("会话已暂停，请先调用 /api/chat/continue 继续对话")

        # 记录 BA 消息
        session_data["messages"].append(
            {"role": "ba", "content": request.message, "type": None, "requires_action": False}
        )

        # 评估教练
        coach = EvaluatorCoach(session_id, session_manager, error_tracker)
        context = {
            "stage": session_data["stage"],
            "concerns": session_data["customer_profile"]["concern"],
        }
        eval_result = await coach.evaluate(request.message, context)

        # 更新雷达图
        session_data["dimensions"] = eval_result["dimensions"]

        new_messages = []

        # 教练决策
        coach_decision = eval_result["coach_decision"]
        if coach_decision["intervene"]:
            # 教练介入，添加教练消息
            coach_msg = Message(
                role="coach",
                content=coach_decision["content"],
                type=coach_decision["type"],
                requires_action=coach_decision["requires_action"],
            )
            session_data["messages"].append(coach_msg.model_dump())
            new_messages.append(coach_msg.model_dump())

            # halt 状态暂停会话
            if coach_decision["type"] == "halt":
                session_data["status"] = "halted"
        else:
            # 无介入，调用顾客模拟器
            simulator = CustomerSimulator(session_id, session_manager)
            customer_result = await simulator.respond(request.message, session_data["customer_state"])

            # 更新顾客状态
            state_delta = customer_result["state_delta"]
            session_data["customer_state"]["trust"] += state_delta.get("trust", 0)
            session_data["customer_state"]["intent"] += state_delta.get("intent", 0)

            # 添加顾客消息
            customer_msg = Message(
                role="customer",
                content=customer_result["reply"],
                type=None,
                requires_action=False,
            )
            session_data["messages"].append(customer_msg.model_dump())
            new_messages.append(customer_msg.model_dump())

        # 保存会话
        session_manager.save(session_id, session_data)

        response = ChatResponse(
            messages=new_messages,
            stage=session_data["stage"],
            dimensions=DimensionScores(**session_data["dimensions"]),
            status=session_data["status"],
        )

        return success(response.model_dump())

    except Exception as e:
        logger.error(f"聊天失败: {str(e)}")
        return error(f"聊天失败: {str(e)}")


@router.post("/chat/continue")
async def chat_continue(request: ChatContinueRequest) -> dict:
    """继续对话（教练喊停后确认继续）"""
    try:
        session_id = request.session_id
        logger.info(f"继续对话: {session_id}")

        # 加载会话
        session_data = session_manager.load(session_id)
        if session_data is None:
            return error("会话不存在")

        # 检查状态
        if session_data["status"] != "halted":
            return error("会话未暂停，无需继续")

        # 恢复会话状态
        session_data["status"] = "active"
        session_manager.save(session_id, session_data)

        response = ChatResponse(
            messages=[],
            stage=session_data["stage"],
            dimensions=DimensionScores(**session_data["dimensions"]),
            status=session_data["status"],
        )

        return success(response.model_dump())

    except Exception as e:
        logger.error(f"继续对话失败: {str(e)}")
        return error(f"继续对话失败: {str(e)}")


@router.post("/finish")
async def finish(request: dict) -> dict:
    """结束会话，生成总结"""
    try:
        session_id = request.get("session_id", "")
        logger.info(f"结束会话: {session_id}")

        # 加载会话
        session_data = session_manager.load(session_id)
        if session_data is None:
            return error("会话不存在")

        # 构建对话历史文本
        history_text = "\n".join(
            f"[{msg['role']}] {msg['content']}" for msg in session_data["messages"]
        )

        # 调用 LLM 生成总结
        prompt = SUMMARY_PROMPT.format(conversation_history=history_text)
        result = await call_llm(prompt)

        if result is None:
            return error("总结生成失败，请重试")

        # 解析总结数据
        parsed = json.loads(result)

        # 更新会话状态
        session_data["status"] = "completed"
        session_manager.save(session_id, session_data)

        response = FinishResponse(
            summary=parsed.get("summary", ""),
            total_score=parsed.get("total_score", 0),
            dimensions=parsed.get("dimensions", {}),
            key_moments=parsed.get("key_moments", []),
            champion_replay=parsed.get("champion_replay", {}),
            status="completed",
        )

        return success(response.model_dump())

    except json.JSONDecodeError as e:
        logger.error(f"总结 JSON 解析失败: {str(e)}")
        return error("总结数据格式错误")

    except Exception as e:
        logger.error(f"结束会话失败: {str(e)}")
        return error(f"结束会话失败: {str(e)}")


@router.get("/session/{session_id}")
async def get_session(session_id: str) -> dict:
    """获取会话详情"""
    try:
        logger.info(f"获取会话: {session_id}")

        # 加载会话
        session_data = session_manager.load(session_id)
        if session_data is None:
            return error("会话不存在")

        response = SessionResponse(
            session_id=session_data["session_id"],
            customer_profile=CustomerProfile(**session_data["customer_profile"]),
            messages=session_data["messages"],
            stage=session_data["stage"],
            dimensions=DimensionScores(**session_data["dimensions"]),
            status=session_data["status"],
            history=session_data.get("history", []),
        )

        return success(response.model_dump())

    except Exception as e:
        logger.error(f"获取会话失败: {str(e)}")
        return error(f"获取会话失败: {str(e)}")
