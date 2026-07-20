# API 路由定义文件 - 实现 5 个接口
from __future__ import annotations
import logging
import uuid
import json
import asyncio
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
    CustomerState,
    FinishResponse,
    FinishRequest,
    SessionResponse,
    FinalDimensions,
    DimensionWithReasoning,
    ChampionReplay,
    ChampionRound,
    KeyMoment,
    CaseAnalysisRequest,
    CaseAnalysisData,
    CasePracticeRequest,
    CasePracticeData,
    PersonaRequest,
    PersonaResponse,
    PersonaTags,
    PersonaCustomerProfile,
)
from app.core.session_manager import session_manager
from app.core.llm_client import call_llm
from app.agents.error_tracker import error_tracker
from app.agents.customer_simulator import CustomerSimulator
from app.agents.evaluator_coach import EvaluatorCoach
from app.prompts.templates import (
    SUMMARY_PROMPT,
    CASE_ANALYSIS_PROMPT,
    CASE_CHAMPION_REPLAY_PROMPT,
    CHAMPION_PRACTICE_PROMPT,
    PERSONA_GENERATOR_PROMPT,
    COACH_SELF_REVIEW_PROMPT,
)

logger = logging.getLogger(__name__)

router = APIRouter()

CONCERN_KEYWORDS = ("刺痛", "烂脸", "过敏", "泛红", "不耐受", "敏感")
INFO_KEYWORDS = {
    "skin_type": ("肤质", "敏感肌", "干皮", "油皮", "混合皮"),
    "product_history": ("用过", "使用过", "护肤习惯", "A醇", "酸类", "VC"),
    "budget": ("预算", "价格", "多少钱", "贵"),
}
BUYING_SIGNAL_KEYWORDS = ("多少钱", "能试试", "适合我", "想买", "购买", "下单")
EFFECT_KEYWORDS = ("没效果", "担心效果", "长期", "反弹")
OTHER_PARTY_KEYWORDS = ("朋友", "家人", "老公", "妈妈", "同事")
RECOMMENDATION_INFO = {"skin_type", "product_history", "budget"}
DIMENSION_NAMES = ("listening", "warmth", "professionalism", "objection_handling", "recommendation")
MAX_CASE_PRACTICE_TURNS = 10
# 训练对话最大轮数：到达后 BA 发完本轮消息直接触发结局，不再生成顾客回复
MAX_TRAINING_TURNS = 12
# 打断专项校验：同一问题连续未通过次数上限，超过自动放行
HALT_MAX_ATTEMPTS = 3
COACH_STYLE_CONFIG = {
    "strict": {"label": "严格模式", "score_bias": -3, "halt_offset": 0},
    "gentle": {"label": "温和模式", "score_bias": 0, "halt_offset": -1},
}


def parse_reasoning(text: str) -> dict:
    import re
    return {
        "observation": (re.search(r"【观察】([^【]*)", text) or [None, ""])[1].strip(),
        "comparison": (re.search(r"【对比】([^【]*)", text) or [None, ""])[1].strip(),
        "reason": (re.search(r"【原因】([^【]*)", text) or [None, ""])[1].strip(),
        "benchmark": (re.search(r"【标杆】([^【]*)", text) or [None, ""])[1].strip(),
    }


def persona_context(session_data: dict) -> dict:
    """返回当前会话使用的完整画像，旧会话使用兼容画像。"""
    profile = session_data.get("persona_profile")
    if profile:
        return profile

    legacy = session_data.get("customer_profile", {})
    tolerance = legacy.get("tolerance", "medium")
    return {
        "persona": legacy.get("name", "顾客"),
        "skin_type": legacy.get("skin_type", "未知肤质"),
        "goal": "了解适合自己的护肤方案",
        "concerns": [legacy.get("concern", "当前顾虑")],
        "tolerance": "low" if "低" in tolerance else "high" if "高" in tolerance else "medium",
        "background": legacy.get("experience", ""),
        "tags": {},
        "display_line": "",
    }


def profile_concerns(profile: dict) -> list[str]:
    """提取画像顾虑，供阶段规则和总结使用。"""
    raw_concerns = profile.get("concerns")
    concerns = raw_concerns if isinstance(raw_concerns, list) else [raw_concerns]
    concerns = [concern for concern in concerns if concern]
    if not concerns:
        concerns = [profile.get("concern", "当前顾虑")]
    return [str(concern) for concern in concerns if concern]


def customer_messages_by_turn(messages: list[dict]) -> dict[int, str]:
    """按 BA 轮次整理顾客原话，供销冠回放优先引用。"""
    turn = 0
    result: dict[int, str] = {}
    for message in messages:
        role = message.get("role")
        if role == "ba":
            turn += 1
        elif role == "customer":
            result[max(turn, 1)] = message.get("content", "")
    return result


def ba_messages_by_turn(messages: list[dict]) -> dict[int, str]:
    """按轮次整理 BA 原话。"""
    turn = 0
    result: dict[int, str] = {}
    for message in messages:
        if message.get("role") == "ba":
            turn += 1
            result[turn] = message.get("content", "")
    return result


def fallback_champion_replay(session_data: dict) -> ChampionReplay:
    """LLM 不可用时生成至少一轮、且与当前画像相关的销冠示范。"""
    profile = persona_context(session_data)
    concerns = profile_concerns(profile)
    max_ba_turns = session_data.get("ba_turn_count", 0)
    concern = concerns[0] if concerns else "使用效果和安全性"
    goal = profile.get("goal", "了解适合自己的护肤方案")
    customer_by_turn = customer_messages_by_turn(session_data.get("messages", []))
    ba_by_turn = ba_messages_by_turn(session_data.get("messages", []))
    def _make_round(turn_num: int) -> ChampionRound:
        return ChampionRound(
            turn=turn_num,
            customer_message=customer_by_turn.get(turn_num) or f"我想先了解{goal}。",
            ba_reply=ba_by_turn.get(turn_num, "暂无 BA 原回复"),
            champion_reply=(
                f"我先确认{goal}，同时最在意{concern}。"
                "我先了解情况，再给您循序渐进的建议，可以吗？"
            ) if turn_num == 1 else (
                f"针对{goal}和{concern}，我们先从基础方案开始，逐步调整。"
            ),
            skill_tags=["先确认诉求", "回应核心顾虑"] if turn_num == 1 else ["推进方案", "给出建议"],
        )
    rounds = [_make_round(i) for i in range(1, min(max_ba_turns + 1, 3) + 1)]
    if not rounds:
        rounds = [_make_round(1)]
    return ChampionReplay(
        title="基于当前顾客画像的销冠示范",
        rounds=rounds,
    )


def determine_outcome(session_data: dict) -> tuple[str, str, list[str], str]:
    """根据顾客隐状态终值判定结局等级

    Returns:
        (outcome, outcome_title, highlight_steps, next_suggestion)
        - outcome: deal / churn / follow_up
        - outcome_title: 结局标题
        - highlight_steps: 做对的关键步骤（从 key_moments 提取，最多 2 条）
        - next_suggestion: 一条核心建议
    """
    state = session_data.get("customer_state", {})
    trust = state.get("trust", 50)
    intent = state.get("intent", 30)
    irritation_fear = state.get("irritation_fear", 40)

    # 阈值判定（阈值可调）
    if intent >= 65 and trust >= 55:
        outcome = "deal"
        outcome_title = "她把心交给了你"
    elif trust < 35 or irritation_fear >= 75:
        outcome = "churn"
        outcome_title = "她转身离开了"
    else:
        outcome = "follow_up"
        outcome_title = "她还在犹豫"

    # 从 key_moments 提取做对的关键步骤（type=good，最多 2 条）
    highlight_steps = []
    # key_moments 在 build_finish_response 里才解析，这里先从 messages 提取兜底
    # 实际 highlight_steps 在 build_finish_response 中会被覆盖（如果有 LLM 数据）

    # 核心建议根据结局定制
    if outcome == "deal":
        next_suggestion = "促单时可以再给一点紧迫感，比如限定试用周期或小样数量。"
    elif outcome == "churn":
        next_suggestion = "下次先接住顾客的核心顾虑，再推进推荐，避免信任崩盘。"
    else:
        next_suggestion = "临门一脚可以更主动：给出具体试用方案或限时优惠，帮顾客做决定。"

    return outcome, outcome_title, highlight_steps, next_suggestion


def fallback_finish_response(session_data: dict) -> dict:
    """生成总结页可直接渲染的基础兜底数据。"""
    profile = persona_context(session_data)
    concerns = profile_concerns(profile)
    concern = concerns[0] if concerns else "使用效果和安全性"
    goal = profile.get("goal", "了解适合自己的护肤方案")
    raw_dimensions = session_data.get("dimensions", {})
    scores = {
        name: max(0, min(100, int(raw_dimensions.get(name, 0))))
        for name in ("listening", "warmth", "professionalism", "objection_handling", "recommendation")
    }
    reasoning_detail = {"observation": "", "comparison": "", "reason": "", "benchmark": ""}
    dimensions = FinalDimensions(
        **{
            name: DimensionWithReasoning(score=score, reasoning=reasoning_detail)
            for name, score in scores.items()
        }
    )
    # 判定结局等级
    outcome, outcome_title, _, next_suggestion = determine_outcome(session_data)
    state = session_data.get("customer_state", {})
    return FinishResponse(
        summary=f"本次训练围绕“{goal}”展开，销冠示范会优先确认诉求并回应“{concern}”。",
        total_score=round(sum(scores.values()) / len(scores)),
        dimensions=dimensions,
        key_moments=[],
        champion_replay=fallback_champion_replay(session_data),
        status="completed",
        outcome=outcome,
        outcome_title=outcome_title,
        final_state={
            "trust": state.get("trust", 0),
            "intent": state.get("intent", 0),
            "irritation_fear": state.get("irritation_fear", 0),
        },
        highlight_steps=[],
        next_suggestion=next_suggestion,
    ).model_dump()


def build_finish_response(parsed: dict, session_data: dict) -> dict:
    """将 LLM 总结转换为稳定响应，缺失销冠轮次时补动态兜底。"""
    fallback = fallback_finish_response(session_data)
    if not parsed:
        return fallback

    try:
        fallback_dimensions = fallback["dimensions"]
        dimensions_data = parsed.get("dimensions") or {}
        dimension_values = {}
        for name in ("listening", "warmth", "professionalism", "objection_handling", "recommendation"):
            raw = dimensions_data.get(name, fallback_dimensions[name])
            if isinstance(raw, int):
                raw = {"score": raw, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}}
            dimension_values[name] = DimensionWithReasoning(**raw)

        key_moments = [KeyMoment(**moment) for moment in (parsed.get("key_moments") or [])]
        fallback_replay = ChampionReplay(**fallback["champion_replay"])
        replay_data = parsed.get("champion_replay") or {}
        rounds = []
        customer_by_turn = customer_messages_by_turn(session_data.get("messages", []))
        for raw_round in replay_data.get("rounds") or []:
            if not isinstance(raw_round, dict):
                continue
            raw_round = dict(raw_round)
            turn = int(raw_round.get("turn", 1))
            raw_round["turn"] = turn
            raw_round["customer_message"] = raw_round.get("customer_message") or customer_by_turn.get(turn)
            raw_round["ba_reply"] = raw_round.get("ba_reply") or "暂无 BA 原回复"
            raw_round["champion_reply"] = raw_round.get("champion_reply") or fallback_replay.rounds[0].champion_reply
            raw_round["skill_tags"] = raw_round.get("skill_tags") or fallback_replay.rounds[0].skill_tags
            rounds.append(ChampionRound(**raw_round))
        champion_replay = ChampionReplay(
            title=replay_data.get("title") or fallback_replay.title,
            rounds=rounds or fallback_replay.rounds,
        )

        # 判定结局等级 + 从 key_moments 提取做对的关键步骤
        outcome, outcome_title, _, next_suggestion = determine_outcome(session_data)
        # 从 key_moments 提取 type=good 的描述，最多 2 条
        highlight_steps = [m.description for m in key_moments if m.type == "good"][:2]
        if not highlight_steps:
            highlight_steps = fallback.get("highlight_steps", [])
        state = session_data.get("customer_state", {})

        return FinishResponse(
            summary=parsed.get("summary") or fallback["summary"],
            total_score=int(parsed.get("total_score", fallback["total_score"])),
            dimensions=FinalDimensions(**dimension_values),
            key_moments=key_moments,
            champion_replay=champion_replay,
            status="completed",
            outcome=outcome,
            outcome_title=outcome_title,
            final_state={
                "trust": state.get("trust", 0),
                "intent": state.get("intent", 0),
                "irritation_fear": state.get("irritation_fear", 0),
            },
            highlight_steps=highlight_steps,
            next_suggestion=next_suggestion,
        ).model_dump()
    except (TypeError, ValueError, KeyError) as exc:
        logger.warning(f"总结数据不完整，使用动态兜底: {exc}")
        return fallback


def success(data: dict, message: str = "success") -> dict:
    """成功响应"""
    return {"code": 0, "data": data, "message": message}


def error(message: str) -> dict:
    """错误响应"""
    return {"code": -1, "message": message}


def build_final_dimensions(dimensions_data: dict) -> FinalDimensions:
    """将 LLM 返回的五维评分转换为 API 模型。"""
    return FinalDimensions(
        listening=DimensionWithReasoning(**dimensions_data.get("listening", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
        warmth=DimensionWithReasoning(**dimensions_data.get("warmth", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
        professionalism=DimensionWithReasoning(**dimensions_data.get("professionalism", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
        objection_handling=DimensionWithReasoning(**dimensions_data.get("objection_handling", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
        recommendation=DimensionWithReasoning(**dimensions_data.get("recommendation", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
    )


def build_key_moments(key_moments_data: list) -> list[KeyMoment]:
    """将 LLM 返回的关键时刻转换为 API 模型。"""
    return [KeyMoment(**moment) for moment in key_moments_data]


def build_champion_replay(champion_replay_data: dict) -> ChampionReplay:
    """将 LLM 返回的销冠示范转换为 API 模型。"""
    rounds_data = champion_replay_data.get("rounds", [])
    rounds = [ChampionRound(**round_data) for round_data in rounds_data]
    return ChampionReplay(
        title=champion_replay_data.get("title", "销冠示范"),
        rounds=rounds,
    )


async def update_session_progress(
    session_data: dict,
    ba_message: str,
    customer_message: str | None,
) -> None:
    """根据本轮对话更新顾客状态、阶段和轮次记录。"""
    # ponytail: 关键词规则只覆盖当前 Demo 场景；扩展多场景时改为结构化信号抽取。
    state = session_data["customer_state"]
    profile = persona_context(session_data)
    concerns = profile_concerns(profile)
    state.setdefault("trust", 50)
    state.setdefault("intent", 30)
    state.setdefault("fear", concerns[0] if concerns else "怕刺痛烂脸")
    state.setdefault("irritation_fear", 70 if profile.get("tolerance") == "low" else 40)
    state.setdefault("addressed_concerns", [])
    state.setdefault("collected_info", [])
    state.setdefault("current_stage", session_data.get("stage", "opening"))
    state.setdefault("milestones", {})
    session_data.setdefault("history", [])
    session_data["ba_turn_count"] = session_data.get("ba_turn_count", 0) + 1

    customer_text = customer_message or ""
    for info_name, keywords in INFO_KEYWORDS.items():
        if any(keyword in customer_text for keyword in keywords) and info_name not in state["collected_info"]:
            state["collected_info"].append(info_name)

    concern_terms = tuple(set(CONCERN_KEYWORDS).union(concerns))
    if any(keyword in ba_message for keyword in concern_terms):
        if any(keyword in ba_message for keyword in ("理解", "先", "建议", "可以", "方案", "低频", "低浓度", "修护")):
            marker = concerns[0] if concerns else "afraid_of_irritation"
            if marker not in state["addressed_concerns"]:
                state["addressed_concerns"].append(marker)

    current_stage = session_data.get("stage", "opening")
    customer_has_concern = any(keyword in customer_text for keyword in concern_terms)
    customer_has_buying_signal = any(keyword in customer_text for keyword in BUYING_SIGNAL_KEYWORDS)
    ba_turn_count = session_data["ba_turn_count"]
    has_recommendation_info = RECOMMENDATION_INFO.issubset(state["collected_info"])
    has_addressed_concern = bool(state["addressed_concerns"])
    previous_milestones = state["milestones"]
    effect_concern = previous_milestones.get("effect_concern", False) or any(
        keyword in "、".join(concerns + [customer_text]) for keyword in EFFECT_KEYWORDS
    )
    other_involved = previous_milestones.get("other_involved", False) or any(
        keyword in customer_text for keyword in OTHER_PARTY_KEYWORDS
    )
    state["milestones"] = {
        "connection_established": state["trust"] > 30,
        "key_info_confirmed": has_recommendation_info,
        "time_invested": ba_turn_count >= 5,
        "purchase_ready": state["intent"] > 60 and customer_has_buying_signal and ba_turn_count >= 5 and not other_involved,
        "effect_concern": effect_concern,
        "other_involved": other_involved,
    }

    if current_stage == "opening" and state["milestones"]["connection_established"]:
        current_stage = "probing"
    elif current_stage == "probing":
        if (customer_has_concern or effect_concern) and not has_addressed_concern:
            current_stage = "objection"
        elif has_recommendation_info and has_addressed_concern:
            current_stage = "recommending"
    elif current_stage == "objection":
        if has_recommendation_info and has_addressed_concern:
            current_stage = "recommending"
    elif current_stage == "recommending":
        if state["milestones"]["purchase_ready"]:
            current_stage = "closing"

    session_data["stage"] = current_stage
    state["current_stage"] = current_stage
    session_data["history"].append(
        {
            "turn": ba_turn_count,
            "ba_message": ba_message,
            "customer_message": customer_message,
            "stage": current_stage,
            "customer_state": {
                "trust": state["trust"],
                "intent": state["intent"],
                "fear": state["fear"],
                "irritation_fear": state["irritation_fear"],
                "addressed_concerns": list(state["addressed_concerns"]),
                "collected_info": list(state["collected_info"]),
                "current_stage": current_stage,
                "milestones": dict(state["milestones"]),
            },
        }
    )


async def customer_state_response(session_data: dict) -> CustomerState:
    """将内存中的顾客状态转换为 API 模型。"""
    state = session_data["customer_state"]
    concerns = profile_concerns(persona_context(session_data))
    state.setdefault("trust", 50)
    state.setdefault("intent", 30)
    state.setdefault("fear", concerns[0] if concerns else "怕刺痛烂脸")
    state.setdefault("irritation_fear", 70 if persona_context(session_data).get("tolerance") == "low" else 40)
    state.setdefault("addressed_concerns", [])
    state.setdefault("collected_info", [])
    state.setdefault("current_stage", session_data.get("stage", "opening"))
    state.setdefault("milestones", {})
    return CustomerState(**state)


async def dimension_reasoning_response(session_data: dict) -> FinalDimensions:
    """返回实时五维评分依据，兼容创建于本次改造前的会话。"""
    dimensions = session_data["dimensions"]
    session_data.setdefault(
        "dimension_reasoning",
        {
            name: {
                "score": dimensions.get(name, 0),
                    "status": "needs_improvement",
                    "summary": "",
                    "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""},
            }
            for name in DIMENSION_NAMES
        },
    )
    return FinalDimensions(**session_data["dimension_reasoning"])


# 标签中文映射
AGE_LABELS = {"18-25": "18-25岁", "26-35": "26-35岁", "36+": "36岁以上"}
OILINESS_LABELS = {"oily": "油皮", "dry": "干皮", "combination": "混合皮"}
SENSITIVITY_LABELS = {"sensitive": "敏感肌", "non_sensitive": "非敏感肌"}


@router.post("/persona")
async def generate_persona(request: PersonaRequest) -> dict:
    """根据标签生成消费者画像"""
    try:
        logger.info(f"生成画像: age={request.age}, oiliness={request.oiliness}, sensitivity={request.sensitivity}")

        # 纯拼接画像句（不经过 LLM）
        parts = [
            AGE_LABELS.get(request.age, request.age),
            OILINESS_LABELS.get(request.oiliness, request.oiliness),
            SENSITIVITY_LABELS.get(request.sensitivity, request.sensitivity),
        ]
        if request.concern_text:
            parts.append(request.concern_text)
        display_line = "、".join(parts)

        # 调用 LLM 生成画像细节
        prompt = PERSONA_GENERATOR_PROMPT.format(
            age=request.age,
            oiliness=request.oiliness,
            sensitivity=request.sensitivity,
            concern_text=request.concern_text or "（未填写，请根据年龄和肤质推断典型顾虑）",
        )
        result = await call_llm(prompt)

        if result is None:
            return error("画像生成失败，请重试")

        parsed = json.loads(result)

        # 构建标签对象
        tags = PersonaTags(
            age=request.age,
            oiliness=request.oiliness,
            sensitivity=request.sensitivity,
            concern_text=request.concern_text,
        )

        # 构建顾客画像
        customer_profile = PersonaCustomerProfile(
            persona=parsed.get("persona", ""),
            skin_type=parsed.get("skin_type", ""),
            goal=parsed.get("goal", ""),
            concerns=parsed.get("concerns", []),
            tolerance=parsed.get("tolerance", "medium"),
            background=parsed.get("background", ""),
            tags=tags,
            display_line=display_line,
        )

        response = PersonaResponse(
            display_line=display_line,
            customer_profile=customer_profile,
            initial_message=parsed.get("initial_message", ""),
        )

        return success(response.model_dump())

    except json.JSONDecodeError as e:
        logger.error(f"画像 JSON 解析失败: {str(e)}")
        return error("画像数据格式错误")

    except Exception as e:
        logger.error(f"生成画像失败: {str(e)}")
        return error(f"生成画像失败: {str(e)}")


@router.post("/session")
async def create_session(request: SessionCreateRequest) -> dict:
    """创建会话"""
    try:
        session_id = str(uuid.uuid4())
        logger.info(f"创建会话: {session_id}, scenario={request.scenario_id}")

        if request.customer_profile and request.initial_message:
            # 动态画像模式
            profile_data = request.customer_profile
            initial_message = request.initial_message
            customer_profile = CustomerProfile(
                name=profile_data.get("persona", "顾客"),
                age=0,
                skin_type=profile_data.get("skin_type", ""),
                experience="",
                tolerance=profile_data.get("tolerance", "medium"),
                concern=profile_data.get("concerns", ["未知"])[0] if profile_data.get("concerns") else "未知",
            )
            # 保存完整画像数据到会话
            session_data = {
                "session_id": session_id,
                "customer_profile": customer_profile.model_dump(),
                "persona_profile": profile_data,  # 保存完整画像
                "messages": [],
                "stage": "opening",
                "dimensions": DimensionScores(
                    listening=0, warmth=0, professionalism=0,
                    objection_handling=0, recommendation=0,
                ).model_dump(),
                "dimension_reasoning": {
                    name: {"score": 0, "status": "needs_improvement", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}}
                    for name in DIMENSION_NAMES
                },
                "status": "active",
                "history": [],
                "customer_state": {
                    "trust": 30,
                    "intent": 30,
                    "fear": profile_data.get("concerns", ["未知"])[0] if profile_data.get("concerns") else "未知",
                    "irritation_fear": 70 if profile_data.get("tolerance") == "low" else 40,
                    "addressed_concerns": [],
                    "collected_info": [],
                    "current_stage": "opening",
                },
"ba_turn_count": 0,
                "coach_style": request.coach_style,
            }
        else:
            # 兼容旧逻辑（硬编码画像）
            customer_profile = CustomerProfile(
                name="林小姐",
                age=25,
                skin_type="敏感肌",
                experience="护肤新手",
                tolerance="低耐受",
                concern="怕刺痛烂脸",
            )
            initial_message = "你好，我最近看到早C晚A很火，但我皮肤有点敏感，怕用了会刺痛烂脸，你能帮我看看吗？"
            session_data = {
                "session_id": session_id,
                "customer_profile": customer_profile.model_dump(),
                "messages": [],
                "stage": "opening",
                "dimensions": DimensionScores(
                    listening=0, warmth=0, professionalism=0,
                    objection_handling=0, recommendation=0,
                ).model_dump(),
                "dimension_reasoning": {
                    name: {"score": 0, "status": "needs_improvement", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}}
                    for name in DIMENSION_NAMES
                },
                "status": "active",
                "history": [],
                "customer_state": {
                    "trust": 30,
                    "intent": 30,
                    "fear": "怕刺痛烂脸",
                    "irritation_fear": 70,
                    "addressed_concerns": [],
                    "collected_info": [],
                    "current_stage": "opening",
                },
"ba_turn_count": 0,
                "coach_style": request.coach_style,
            }

        session_data["messages"].append(
            {"role": "customer", "content": initial_message, "type": None, "requires_action": False}
        )

        session_manager.create(session_id, session_data)

        dimensions = DimensionScores(**session_data["dimensions"])
        response = SessionCreateResponse(
            session_id=session_id,
            customer_profile=customer_profile,
            stage="opening",
            initial_customer_message=initial_message,
            dimensions=dimensions,
            customer_state=CustomerState(**session_data["customer_state"]),
            persona_profile=session_data.get("persona_profile"),
        )

        return success(response.model_dump())

    except Exception as e:
        logger.error(f"创建会话失败: {str(e)}")
        return error(f"创建会话失败: {str(e)}")


@router.post("/chat")
async def chat(request: ChatRequest) -> dict:
    """发送消息，获取响应

    三种分支：
    1. halt 状态：走专项校验，只判断原 halt 问题是否解决
    2. 最后一轮（ba_turn_count+1 >= MAX_TRAINING_TURNS）：不生成顾客回复，直接返回
    3. 正常流程：评估 + 顾客模拟器并行
    """
    try:
        session_id = request.session_id
        logger.info(f"聊天请求: {session_id}")

        # 加载会话
        session_data = session_manager.load(session_id)
        if session_data is None:
            return error("会话不存在")

        coach = EvaluatorCoach(session_id, session_manager, error_tracker)
        current_profile = persona_context(session_data)
        concerns_text = "、".join(profile_concerns(current_profile))

        # 标记 BA 消息是否已记录（halt 分支会提前记录）
        ba_message_recorded = False

        # ========== 分支 1：halt 状态下走专项校验 ==========
        if session_data["status"] == "halted":
            halt_issue = session_data.get("halt_issue") or {}
            attempts = halt_issue.get("attempts", 0)

            # 记录 BA 修改后的新消息
            session_data["messages"].append(
                {"role": "ba", "content": request.message, "type": None, "requires_action": False}
            )
            ba_message_recorded = True

            # 兜底：连续未通过次数超限，自动放行
            if attempts >= HALT_MAX_ATTEMPTS:
                logger.info(f"[{session_id}] halt 校验已达 {attempts} 次，自动放行")
                session_data["status"] = "active"
                session_data["halt_issue"] = None
                session_data["last_coach_advice"] = None
                # 放行后走正常流程生成顾客回复（落入下方正常流程）
            else:
                halt_context = {
                    "stage": session_data["stage"],
                    "concerns": concerns_text,
                    "persona_profile": current_profile,
                }
                check_result = await coach.check_halt_resolution(
                    request.message, halt_issue, halt_context
                )
                new_messages = []
                if check_result["resolved"]:
                    # 解决：解除 halt，清空 halt_issue，走正常流程生成顾客回复
                    session_data["status"] = "active"
                    session_data["halt_issue"] = None
                    session_data["last_coach_advice"] = None
                    # 落入下方正常流程生成顾客回复
                else:
                    # 未解决：保持 halt，attempts+1，只针对同一问题提示
                    halt_issue["attempts"] = attempts + 1
                    session_data["halt_issue"] = halt_issue
                    feedback = check_result.get("feedback") or halt_issue.get("description", "请针对上次被打断的问题再次修改。")
                    coach_msg = Message(
                        role="coach",
                        content=feedback,
                        type="halt",
                        requires_action=True,
                    )
                    session_data["messages"].append(coach_msg.model_dump())
                    new_messages.append(coach_msg.model_dump())

                    session_manager.save(session_id, session_data)
                    response = ChatResponse(
                        messages=new_messages,
                        stage=session_data["stage"],
                        dimensions=DimensionScores(**session_data["dimensions"]),
                        dimension_reasoning=await dimension_reasoning_response(session_data),
                        status=session_data["status"],
                        customer_state=await customer_state_response(session_data),
                    )
                    return success(response.model_dump())

        # ========== 非 halt 状态：记录 BA 消息（halt 分支已记录则跳过） ==========
        if not ba_message_recorded:
            session_data["messages"].append(
                {"role": "ba", "content": request.message, "type": None, "requires_action": False}
            )

        # 构建上下文
        conversation_history = "\n".join(
            f"[{message['role']}] {message['content']}" for message in session_data["messages"]
        )
        previous_messages = session_data["messages"][:-1]
        recent_history = "\n".join(
            f"[{message['role']}] {message['content']}" for message in previous_messages[-8:]
        ) or "（暂无历史对话）"
        last_customer_message = next(
            (
                message["content"]
                for message in reversed(previous_messages)
                if message.get("role") == "customer"
            ),
            "",
        )

        next_turn = session_data.get("ba_turn_count", 0) + 1
        context = {
            "stage": session_data["stage"],
            "concerns": concerns_text,
            "persona_profile": current_profile,
            "customer_state": session_data["customer_state"],
            "conversation_history": conversation_history,
            "last_customer_message": last_customer_message,
            "turn": next_turn,
            "last_coach_advice": session_data.get("last_coach_advice") or "（无上轮建议）",
            "coach_style": session_data.get("coach_style", "gentle"),
        }

        # ========== 分支 2：最后一轮，不生成顾客回复 ==========
        is_final_turn = next_turn >= MAX_TRAINING_TURNS


        # ====== Day3 并行编排优化 ======
        # 三路并行：CustomerSimulator 与 EvaluatorCoach 并发启动，
        # CoachSelfReview 在评估完成后与顾客结果收集并发执行，
        # 将每轮响应从串行 ~20s 压缩到 ~10-12s
        # 提前启动顾客模拟器（与评估教练并行）
        if not is_final_turn:
            simulator = CustomerSimulator(session_id, session_manager)
            simulator_state_c = {
                **session_data["customer_state"],
                "persona_profile": current_profile,
                "conversation_history": recent_history,
            }
            customer_task = asyncio.create_task(
                simulator.respond(request.message, simulator_state_c)
            )
        else:
            customer_task = None
        # 评估教练（最后一轮仍需评估，更新雷达图）
        eval_result = await coach.evaluate(request.message, context)
        coach_decision = eval_result["coach_decision"]

        # 更新雷达图
        session_data["dimensions"] = eval_result["dimensions"]
        session_data["dimension_reasoning"] = eval_result.get(
            "dimension_reasoning",
            {
                name: {
                    "score": eval_result["dimensions"].get(name, 0),
                    "status": "needs_improvement",
                    "summary": "",
                    "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""},
                }
                for name in DIMENSION_NAMES
            },
        )

        # ========== 教练自省：回顾评分是否合理（与顾客回复并行） ==========
        coach_style = session_data.get("coach_style", "gentle")
        self_review_task = None
        if not is_final_turn:
            self_review_task = asyncio.create_task(
                call_llm(
                    COACH_SELF_REVIEW_PROMPT.format(
                        ba_message=request.message,
                        current_scores=json.dumps(session_data["dimensions"], ensure_ascii=False),
                        current_reasoning=json.dumps(session_data["dimension_reasoning"], ensure_ascii=False),
                        coach_style=coach_style,
                    ),
                    session_id=session_id,
                    observation_name="coach-self-review",
                    max_tokens=500,
                    temperature=0.3,
                )
            )
        new_messages = []
        customer_result = None

        if customer_task is not None:
            try:
                if coach_decision["type"] in ("halt", "halt_with_champion"):
                    customer_task.cancel()
                    await asyncio.gather(customer_task, return_exceptions=True)
                    customer_result = None
                    session_data["status"] = "halted"
                else:
                    customer_result = await customer_task
            finally:
                if not customer_task.done():
                    customer_task.cancel()
                    await asyncio.gather(customer_task, return_exceptions=True)

        if is_final_turn:
            # 最后一轮：不生成顾客回复，不触发教练打断（即使评估有问题也直接结束）
            logger.info(f"[{session_id}] 已达最大轮数 {MAX_TRAINING_TURNS}，本轮不生成顾客回复")
            # 如果教练想介入，忽略（已是最后一轮，不再打断）
            pass

        # 等待教练自省完成（与顾客回复并行执行）
        if self_review_task is not None:
            try:
                review_result = await self_review_task
                if review_result:
                    reviewed = json.loads(review_result)
                    if reviewed.get("reviewed") and reviewed.get("dimensions"):
                        adj = reviewed["dimensions"]
                        session_data["dimensions"] = {
                            name: max(0, min(100, adj[name]["score"])) for name in DIMENSION_NAMES
                        }
                        session_data["dimension_reasoning"] = adj
                        logger.info(f"[{session_id}] 教练自省调整了评分")
            except Exception as exc:
                logger.warning(f"[{session_id}] 教练自省解析失败，保留原评分: {exc}")

        # 根据教练风格调整评分偏差
        bias = COACH_STYLE_CONFIG.get(coach_style, {}).get("score_bias", 0)
        if bias != 0:
            for name in DIMENSION_NAMES:
                if name in session_data["dimensions"]:
                    session_data["dimensions"][name] = max(0, min(100, session_data["dimensions"][name] + bias))



        # 教练决策处理（最后一轮跳过教练介入）
        if not is_final_turn and coach_decision["type"] in ("halt", "halt_with_champion"):
            # halt：添加教练消息，冻结会话
            coach_msg = Message(
                role="coach",
                content=coach_decision["content"],
                type=coach_decision["type"],
                requires_action=True,
                champion_replay=coach_decision.get("champion_replay"),
            )
            session_data["messages"].append(coach_msg.model_dump())
            new_messages.append(coach_msg.model_dump())
            session_data["last_coach_advice"] = coach_decision["content"]
            session_data["status"] = "halted"
            session_data["halt_issue"] = {
                "type": eval_result.get("detected_errors", [None])[0] or "halt",
                "description": coach_decision["content"],
                "attempts": 0,
            }
        elif not is_final_turn and coach_decision["intervene"] and customer_result is not None:
            # probe/feedback：教练提示 + 顾客照常回复
            coach_msg = Message(
                role="coach",
                content=coach_decision["content"],
                type=coach_decision["type"],
                requires_action=False,
            )
            session_data["messages"].append(coach_msg.model_dump())
            new_messages.append(coach_msg.model_dump())
            session_data["last_coach_advice"] = coach_decision["content"]
            # 顾客照常回复
            state_delta = customer_result["state_delta"]
            session_data["customer_state"]["trust"] = max(
                0, min(100, session_data["customer_state"]["trust"] + state_delta.get("trust", 0))
            )
            session_data["customer_state"]["intent"] = max(
                0, min(100, session_data["customer_state"]["intent"] + state_delta.get("intent", 0))
            )
            customer_msg = Message(
                role="customer",
                content=customer_result["reply"],
                type=None,
                requires_action=False,
            )
            session_data["messages"].append(customer_msg.model_dump())
            new_messages.append(customer_msg.model_dump())
        elif customer_result is not None:
            # 正常流程：仅顾客回复
            state_delta = customer_result["state_delta"]
            session_data["customer_state"]["trust"] = max(
                0, min(100, session_data["customer_state"]["trust"] + state_delta.get("trust", 0))
            )
            session_data["customer_state"]["intent"] = max(
                0, min(100, session_data["customer_state"]["intent"] + state_delta.get("intent", 0))
            )
            customer_msg = Message(
                role="customer",
                content=customer_result["reply"],
                type=None,
                requires_action=False,
            )
            session_data["messages"].append(customer_msg.model_dump())
            new_messages.append(customer_msg.model_dump())
            session_data["last_coach_advice"] = None

        await update_session_progress(
            session_data,
            request.message,
            customer_result["reply"] if customer_result is not None else None,
        )

        # 保存会话
        session_manager.save(session_id, session_data)

        response = ChatResponse(
            messages=new_messages,
            stage=session_data["stage"],
            dimensions=DimensionScores(**session_data["dimensions"]),
            dimension_reasoning=await dimension_reasoning_response(session_data),
            status=session_data["status"],
            customer_state=await customer_state_response(session_data),
        )

        return success(response.model_dump())

    except Exception as e:
        logger.error(f"聊天失败: {str(e)}")
        return error(f"聊天失败: {str(e)}")


@router.post("/chat/continue")
async def chat_continue(request: ChatContinueRequest) -> dict:
    """继续对话（教练喊停后强制放行，不再要求 BA 修改）"""
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

        # 恢复会话状态，清空 halt_issue 和上轮教练建议
        session_data["status"] = "active"
        session_data["halt_issue"] = None
        session_data["last_coach_advice"] = None
        session_manager.save(session_id, session_data)

        response = ChatResponse(
            messages=[],
            stage=session_data["stage"],
            dimensions=DimensionScores(**session_data["dimensions"]),
            dimension_reasoning=await dimension_reasoning_response(session_data),
            status=session_data["status"],
            customer_state=await customer_state_response(session_data),
        )

        return success(response.model_dump())

    except Exception as e:
        logger.error(f"继续对话失败: {str(e)}")
        return error(f"继续对话失败: {str(e)}")


@router.post("/finish")
async def finish(request: FinishRequest) -> dict:
    """结束会话，生成总结"""
    try:
        session_id = request.session_id
        logger.info(f"结束会话: {session_id}")

        # 加载会话
        session_data = session_manager.load(session_id)
        if session_data is None:
            return error("会话不存在")

        profile = persona_context(session_data)
        concerns_text = "、".join(profile_concerns(profile))
        state = session_data.get("customer_state", {})

        # 构建完整对话上下文
        # 只保留最近 8 轮对话（最多 16 条消息），减少 prompt 长度加速生成
        recent_messages = session_data["messages"]
        if len(recent_messages) > 16:
            recent_messages = recent_messages[-16:]
        history_text = "\n".join(
            f"[{msg['role']}] {msg['content']}" for msg in recent_messages
        ) if recent_messages else "（暂无对话记录）"


        # 调用 LLM 生成总结
        prompt = SUMMARY_PROMPT.format(
            profile=json.dumps(profile, ensure_ascii=False),
            conversation_history=history_text,
            concerns=concerns_text,
            addressed_concerns="、".join(state.get("addressed_concerns", [])) or "暂无",
            current_stage=session_data.get("stage", "opening"),
            customer_state=json.dumps(state, ensure_ascii=False),
        )
        result = await call_llm(
            prompt,
            session_id=session_id,
            observation_name="session-summary",
            max_tokens=1024,
        )

        parsed = {}
        if result is not None:
            try:
                candidate = json.loads(result)
                if isinstance(candidate, dict):
                    parsed = candidate
            except json.JSONDecodeError as exc:
                logger.warning(f"总结 JSON 解析失败，使用动态兜底: {exc}")

        # 更新会话状态
        session_data["status"] = "completed"
        finish_data = build_finish_response(parsed, session_data)
        session_data["finish_data"] = finish_data
        session_manager.save(session_id, session_data)
        return success(finish_data)

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
            dimension_reasoning=await dimension_reasoning_response(session_data),
            status=session_data["status"],
            history=session_data.get("history", []),
            customer_state=await customer_state_response(session_data),
            ba_turn_count=session_data.get("ba_turn_count", 0),
            persona_profile=session_data.get("persona_profile"),
        )

        return success(response.model_dump())

    except Exception as e:
        logger.error(f"获取会话失败: {str(e)}")
        return error(f"获取会话失败: {str(e)}")


@router.post("/case-analysis")
async def post_case_analysis(request: CaseAnalysisRequest) -> dict:
    """案例复盘分析——BA 贴入叙述文字，并行调用两个 LLM：
    1. 诊断+评分+关键时刻（轻量）
    2. 销冠对话还原（重量）
    理论耗时 ≈ max(两者)，而非两者之和。
    """
    try:
        practice_id = f"practice_{uuid.uuid4()}"
        logger.info(f"案例复盘分析: {practice_id}")

        diagnosis_prompt = CASE_ANALYSIS_PROMPT.format(narrative=request.narrative)
        champion_prompt = CASE_CHAMPION_REPLAY_PROMPT.format(narrative=request.narrative)

        # 并行调用：诊断任务输出短（限 1000 token），销冠对话输出 3 轮（限 1100 token）
        diagnosis_result, champion_result = await asyncio.gather(
            call_llm(diagnosis_prompt, observation_name="case-diagnosis", max_tokens=1000),
            call_llm(champion_prompt, observation_name="case-champion-replay", max_tokens=1100),
        )

        if diagnosis_result is None and champion_result is None:
            return error("分析生成失败，请重试")

        # 解析诊断结果（允许为空时降级）
        parsed_diagnosis = {}
        if diagnosis_result:
            try:
                parsed_diagnosis = json.loads(diagnosis_result)
            except json.JSONDecodeError as e:
                logger.warning(f"诊断 JSON 解析失败，使用降级值: {str(e)}")

        # 解析销冠对话（允许为空时降级）
        parsed_champion = {}
        if champion_result:
            try:
                parsed_champion = json.loads(champion_result)
            except json.JSONDecodeError as e:
                logger.warning(f"销冠对话 JSON 解析失败，使用降级值: {str(e)}")

        # 转换维度评分
        dimensions_data = parsed_diagnosis.get("dimensions", {})
        final_dimensions = FinalDimensions(
            listening=DimensionWithReasoning(**dimensions_data.get("listening", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
            warmth=DimensionWithReasoning(**dimensions_data.get("warmth", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
            professionalism=DimensionWithReasoning(**dimensions_data.get("professionalism", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
            objection_handling=DimensionWithReasoning(**dimensions_data.get("objection_handling", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
            recommendation=DimensionWithReasoning(**dimensions_data.get("recommendation", {"score": 0, "status": "good", "summary": "", "reasoning": {"observation": "", "comparison": "", "reason": "", "benchmark": ""}})),
        )

        # 转换关键时刻
        key_moments_data = parsed_diagnosis.get("key_moments", [])
        key_moments = [KeyMoment(**km) for km in key_moments_data]

        # 转换销冠对比（优先用独立调用的结果，降级到诊断结果里的 champion_replay）
        champion_replay_data = parsed_champion.get("champion_replay") or parsed_diagnosis.get("champion_replay", {})
        rounds_data = champion_replay_data.get("rounds", [])
        rounds = [ChampionRound(**r) for r in rounds_data]
        champion_replay = ChampionReplay(
            title=champion_replay_data.get("title", "销冠示范"),
            rounds=rounds,
        )

        # 构建 key_issues（同时兼容 LLM 返回 key_issues 或 issues）
        key_issues = parsed_diagnosis.get("key_issues") or parsed_diagnosis.get("issues") or []

        # 保存 practice session，供后续对练使用
        session_manager.create(practice_id, {
            "practice_id": practice_id,
            "narrative": request.narrative,
            "analysis_summary": parsed_diagnosis.get("summary", ""),
            "key_issues": key_issues,
            "practice_history": [],
            "practice_turns": 0,
        })

        data = CaseAnalysisData(
            practice_id=practice_id,
            summary=parsed_diagnosis.get("summary", ""),
            key_issues=key_issues,
            total_score=parsed_diagnosis.get("total_score", 0),
            dimensions=final_dimensions,
            key_moments=key_moments,
            champion_replay=champion_replay,
        )

        return success(data.model_dump())

    except Exception as e:
        logger.error(f"案例分析失败: {str(e)}")
        return error(f"案例分析失败: {str(e)}")


@router.post("/case-practice")
async def post_case_practice(request: CasePracticeRequest) -> dict:
    """案例对练——BA 扮演顾客发消息，系统以销冠身份逐轮回复"""
    try:
        practice_id = request.practice_id
        logger.info(f"案例对练: {practice_id}")

        session_data = session_manager.load(practice_id)
        if session_data is None:
            return error("对练会话不存在，请先完成案例分析")

        turns = session_data.get("practice_turns", 0)
        if turns >= 10:
            return error("对练已满 10 轮，请结束对练")

        # 构建对练历史文本
        practice_history = "\n".join(
            f"[顾客] {h['customer_message']}\n[销冠] {h['champion_reply']}"
            for h in session_data.get("practice_history", [])
        )

        prompt = CHAMPION_PRACTICE_PROMPT.format(
            narrative=session_data["narrative"],
            analysis_summary=session_data["analysis_summary"],
            practice_history=practice_history if practice_history else "（尚无对话）",
            customer_message=request.message,
        )

        result = await call_llm(prompt)

        if result is None:
            return error("对练回复生成失败，请重试")

        parsed = json.loads(result)

        # 记录本轮对练
        session_data["practice_history"].append({
            "customer_message": request.message,
            "champion_reply": parsed.get("champion_reply", ""),
        })
        session_data["practice_turns"] = turns + 1
        session_manager.save(practice_id, session_data)

        data = CasePracticeData(
            champion_reply=parsed.get("champion_reply", ""),
        )

        return success(data.model_dump())

    except json.JSONDecodeError as e:
        logger.error(f"对练 JSON 解析失败: {str(e)}")
        return error("对练回复格式错误，请重试")

    except Exception as e:
        logger.error(f"对练失败: {str(e)}")
        return error(f"对练失败: {str(e)}")
