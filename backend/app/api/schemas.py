# API 数据模型定义文件 - 所有接口的请求/响应数据模型
from typing import Optional, List
from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    """创建会话请求"""
    # 场景 ID，固定值
    scenario_id: str = "sensitive_early_c_late_a"


class CustomerProfile(BaseModel):
    """顾客信息"""
    name: str               # 顾客姓名
    age: int                 # 年龄
    skin_type: str           # 肤质
    experience: str          # 护肤经验
    tolerance: str           # 耐受度
    concern: str             # 核心顾虑


class DimensionScores(BaseModel):
    """五维评分（雷达图数据）"""
    listening: int = Field(ge=0, le=100)              # 倾听力（0-100）
    warmth: int = Field(ge=0, le=100)                 # 共情力（0-100）
    professionalism: int = Field(ge=0, le=100)        # 专业度（0-100）
    objection_handling: int = Field(ge=0, le=100)     # 异议处理（0-100）
    recommendation: int = Field(ge=0, le=100)         # 推荐力（0-100）


class DimensionWithReasoning(BaseModel):
    """单维度评分（含推理链）"""
    score: int = Field(ge=0, le=100)   # 维度分数（0-100）
    reasoning: str                      # 评分依据


class FinalDimensions(BaseModel):
    """最终五维评分（含推理链）"""
    listening: DimensionWithReasoning            # 倾听力
    warmth: DimensionWithReasoning              # 共情力
    professionalism: DimensionWithReasoning      # 专业度
    objection_handling: DimensionWithReasoning  # 异议处理
    recommendation: DimensionWithReasoning       # 推荐力


class SessionCreateResponse(BaseModel):
    """创建会话响应"""
    session_id: str                        # 会话 ID
    customer_profile: CustomerProfile      # 顾客信息
    stage: str                              # 当前阶段
    initial_customer_message: str           # 顾客开场消息
    dimensions: DimensionScores             # 初始雷达图数据


class ChatRequest(BaseModel):
    """聊天请求"""
    session_id: str    # 会话 ID
    message: str       # BA 发送的消息


class Message(BaseModel):
    """单条消息"""
    role: str                          # 角色（ba / customer / coach）
    content: str                       # 消息内容
    type: Optional[str] = None         # 教练类型（probe / halt / feedback，仅 coach 有）
    requires_action: bool = False      # 是否需要确认（仅 coach 有）


class ChatResponse(BaseModel):
    """聊天响应"""
    messages: List[Message]     # 本轮新增消息列表
    stage: str                  # 当前阶段
    dimensions: DimensionScores # 最新雷达图数据
    status: str                 # 会话状态（active / halted / completed）


class ChatContinueRequest(BaseModel):
    """继续对话请求（教练喊停后确认继续）"""
    session_id: str    # 会话 ID


class KeyMoment(BaseModel):
    """关键时刻"""
    turn: int          # 轮次编号
    description: str   # 时刻描述
    type: str          # 类型（good / missed）


class ChampionRound(BaseModel):
    """销冠对比单轮"""
    turn: int                  # 轮次编号
    ba_reply: str              # BA 的实际回复
    champion_reply: str        # 销冠的示范回复
    skill_tags: List[str]      # 技巧标签


class ChampionReplay(BaseModel):
    """销冠对比回放"""
    title: str                     # 对比标题
    rounds: List[ChampionRound]    # 对比轮次列表


class FinishResponse(BaseModel):
    """结束会话响应（总结页数据）"""
    summary: str                       # 总结文字
    total_score: int                   # 综合评分
    dimensions: FinalDimensions        # 最终五维评分
    key_moments: List[KeyMoment]       # 关键时刻列表
    champion_replay: ChampionReplay    # 销冠对比数据
    status: str                        # 会话状态


class SessionResponse(BaseModel):
    """会话详情响应（包含所有会话数据）"""
    session_id: str                            # 会话 ID
    customer_profile: CustomerProfile          # 顾客信息
    messages: List[Message]                    # 所有消息记录
    stage: str                                  # 当前阶段
    dimensions: DimensionScores                 # 最新雷达图数据
    status: str                                 # 会话状态
    history: List[dict]                         # 历史轮次记录
