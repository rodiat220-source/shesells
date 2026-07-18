# SheSells —— AI 销售教练 Agent · 技术详设

> 文档版本：V2.2（更新至 2026-07-18，反映 Python 后端实际实现 + 对练体验优化）
> 整理日期：2026-07-11 / 更新：2026-07-18
> 目标：5 天黑客松可直接执行，适配"Agent 不是工具"的产品定义

---

## 一、技术选型

### 1.1 栈选择

| 层级 | 选型 | 理由 |
|------|------|------|
| 前端框架 | Next.js 16 (App Router) + TypeScript | 全栈一体，React 19，部署简单 |
| UI 组件 | Tailwind CSS 4 + lucide-react | 快、风格统一、图标丰富 |
| 状态管理 | Zustand 5 | 轻量，适合单对话界面状态 |
| 图表 | Recharts 3 | 迷你雷达图易实现 |
| 后端 | **Python FastAPI + Uvicorn** | 前后端分离，高性能异步，Python AI 生态好 |
| LLM 调用 | httpx（自封装 `call_llm`） | 异步 HTTP 客户端，兼容 OpenAI API 格式 |
| 数据校验 | Pydantic 2 | 请求/响应模型校验 |
| 会话存储 | **内存字典** (SessionManager) | 黑客松够用，无须外部依赖 |
| LLM | 国产合规模型（GLM / Kimi / Qwen 等）API | 境内调用、中文好、成本低 |
| 部署 | 前端 standalone 输出 + 后端 Uvicorn | 前后端独立部署 |
| 可观测 | Python logging | 控制台 + 文件日志 |

### 1.2 关键取舍

- **前后端分离**：前端 Next.js 跑在 `localhost:3000`，后端 FastAPI 跑在 `localhost:8000`，通过 HTTP 通信。
- **不做独立 Dashboard 页面**：所有评分、反馈、销冠对比都在对话流内完成。
- **不做用户系统**：Demo 直接进入会话，降低实现复杂度。
- **内存存储**：使用 Python Dict 存储会话，不使用 Redis/数据库。

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
│   单个对话界面：消息流 + 教练高亮 + 迷你雷达图 + 销冠回放     │
│        (Next.js 16 App Router / React 19 / Tailwind 4)      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (localhost:8000)
┌──────────────────────────┼──────────────────────────────────┐
│                  Python FastAPI 后端                          │
│  /api/session  /api/chat  /api/finish  /api/persona         │
│  /api/chat/continue  /api/case-analysis  /api/case-practice  │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                     Agent Core（Python）                      │
│  处理流程（每轮 BA 消息后）：                                  │
│  1. halt 状态检查 ──→ 专项校验 (HALT_CHECK_PROMPT)            │
│  2. EvaluatorCoach.evaluate() ──→ 评估+教练决策+CoT reasoning │
│  3. 教练决策路由：                                            │
│     ├─ halt/probe/feedback → 返回教练消息                     │
│     └─ none → CustomerSimulator.respond() → 顾客回复          │
│                                                             │
│  模块：                                                     │
│  ├─ CustomerSimulator：顾客模拟器（动态画像驱动）             │
│  ├─ EvaluatorCoach：评估 + 教练决策合并                       │
│  │   ├─ evaluate()：全量评估，输出五维评分+教练决策            │
│  │   ├─ check_halt_resolution()：halt 专项校验                │
│  │   └─ CoT reasoning 四步推理链                              │
│  ├─ ErrorTracker：错误模式追踪+策略升级                       │
│  └─ SessionManager：内存会话管理                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│  LLM API（httpx → OpenAI 兼容接口）                            │
│  内存字典（SessionManager 会话存储）                           │
│  Python logging（调用追踪）                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型

> 后端使用 Python Pydantic BaseModel（`backend/app/api/schemas.py`），前端使用 TypeScript interface（`frontend/src/types/index.ts`）。以下展示核心运行时结构。

### 3.1 Session（后端运行时结构）

```python
# Session 在内存字典中的运行时字段
{
  "session_id": str,
  "scenario_id": str,
  "status": "active" | "halted" | "completed",
  "created_at": str,
  "customer_profile": CustomerProfile,
  "customer_state": CustomerState,
  "messages": List[Message],
  "ba_turn_count": int,
  "error_counts": Dict[str, int],

  # --- 对练体验优化新增字段 ---
  "halt_issue": Optional[dict],         # { "type": str, "description": str, "attempts": int }
  "last_coach_advice": Optional[str],   # 上轮教练建议（跨轮记忆）
}
```

### 3.2 CustomerState（顾客隐状态）

```python
class CustomerState(BaseModel):
    trust: int                          # 0-100
    intent: int                         # 0-100
    fear: str                           # 核心顾虑
    irritation_fear: int                # 刺痛恐惧 0-100
    addressed_concerns: List[str]
    collected_info: List[str]
    current_stage: str
    milestones: Dict[str, bool]
```

### 3.3 教练决策与结局判定

```python
# 教练决策类型（EvaluatorCoach LLM 输出）
decision: "probe" | "halt" | "feedback" | "none"

# 结局判定规则（determine_outcome 函数）
# deal（成交）：intent >= 65 且 trust >= 55
# churn（流失）：trust < 35 或 irritation_fear >= 75
# follow_up（待跟进）：其他情况
```

### 3.4 Message 消息模型

```python
class Message(BaseModel):
    role: str            # ba / customer / coach
    content: str
    type: Optional[str]  # probe / halt / halt_with_champion / feedback
    requires_action: Optional[bool]
    action_label: Optional[str]
    turn: Optional[int]
    dimensions: Optional[dict]
    rationale: Optional[dict]
    error_type: Optional[str]
    champion_replay: Optional[dict]
```

---

## 四、接口定义（当前实现）

### 4.1 接口列表

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|:--:|
| POST | `/api/persona` | 根据标签生成顾客画像 | 新增 |
| POST | `/api/session` | 创建训练会话 | 已修改 |
| GET | `/api/session/{id}` | 获取会话详情 | 已有 |
| POST | `/api/chat` | 发送消息（含 halt 校验 + 结局判定） | 已修改 |
| POST | `/api/chat/continue` | 强制继续（放弃修改） | 新增 |
| POST | `/api/finish` | 结束会话，返回评估+结局 | 已修改 |
| POST | `/api/case-analysis` | 案例复盘分析 | 新增 |
| POST | `/api/case-practice` | 案例复盘对练 | 新增 |

### 4.2 创建会话

```http
POST /api/session
{
  "customer_profile": { ... },   # 由 /api/persona 生成
  "initial_message": "你好..."
}
```

Response: `{ session_id, customer_profile, stage, initial_customer_message, dimensions, customer_state }`

### 4.3 对话（核心接口，含 halt + 结局判定）

```http
POST /api/chat
{
  "session_id": "sess_xxx",
  "message": "我推荐这款精华"
}
```

处理流程：
1. **halt 状态检查**：如果会话为 `halted`，走 `HALT_CHECK_PROMPT` 专项校验，只判断原问题是否解决
2. **最后一轮判断**：`ba_turn_count + 1 >= MAX_TRAINING_TURNS (12)` → 不生成顾客回复，直接返回教练总结
3. **正常评估**：`EvaluatorCoach.evaluate()` → 输出五维评分 + 教练决策
4. **教练决策路由**：halt 时记录 `halt_issue` + `last_coach_advice`；probe/feedback 返回消息；none 调用 CustomerSimulator

Response 包含：`newMessages`, `session_status`, `customer_state`, `halt_issue`

### 4.4 强制继续

```http
POST /api/chat/continue
{ "session_id": "sess_xxx" }
```

清空 `halt_issue` 和 `last_coach_advice`，恢复 `active` 状态。

### 4.5 结束训练

```http
POST /api/finish
{ "session_id": "sess_xxx" }
```

Response 新增结局字段：
- `outcome`: deal / churn / follow_up
- `outcome_title`: 结局标题
- `final_state`: 终态 trust / intent / irritation_fear
- `highlight_steps`: 关键步骤
- `next_suggestion`: 核心建议

---

## 五、Agent Core 设计（Python 实际实现）

### 5.1 处理流程

每次 BA 发送消息后，后端 `app/api/routes.py` 的 `chat_endpoint` 执行：

```
1. 保存 BA 消息到 session.messages
2. halt 状态检查：
   ├─ session.status == "halted" → 走 HALT_CHECK_PROMPT 专项校验（见 5.2）
   └─ session.status == "active" → 正常流程
3. 最后一轮判断：
   └─ ba_turn_count + 1 >= MAX_TRAINING_TURNS(12) → 不生成顾客回复，直接返回教练总结
4. EvaluatorCoach.evaluate()（一次 LLM 调用）：
   ├─ 输入：完整对话历史 + last_coach_advice + customer_state
   ├─ 输出：五维评分 + CoT reasoning + 教练决策(probe/halt/feedback/none)
   └─ 若决策为 halt：记录 halt_issue + last_coach_advice，返回教练消息
5. 路由决策：
   ├─ probe/feedback → 返回教练消息（不生成顾客回复）
   └─ none → CustomerSimulator.respond() → 生成顾客回复 + state_delta
6. 返回 newMessages + updatedState
```

> 说明：EvaluatorCoach 与 CustomerSimulator 各一次 LLM 调用，每轮最多 2 次 LLM 调用。EvaluatorCoach 在 CustomerSimulator 之前调用，基于 BA 对上一轮顾客消息的回应做评估和决策。

### 5.2 Halt 流程

**触发机制**：EvaluatorCoach 评估时判断 BA 存在严重问题（如连续忽略顾客顾虑），输出 `decision: "halt"`，后端将 session 置为 `halted` 状态，记录：

```python
halt_issue = {
    "type": "missed_concern",        # 问题类型
    "description": "顾客连续 2 轮表达刺痛顾虑，BA 未回应",  # 问题描述
    "attempts": 0                    # BA 已重试次数
}
```

**重发校验**：BA 看到教练提示后修改消息重发，后端检测 `session.status == "halted"`，切换到 `HALT_CHECK_PROMPT` 专项校验：

- 只判断"原问题是否已解决"，不做全量评估
- 问题已解决 → 清空 `halt_issue`，恢复 `active`，正常生成顾客回复
- 问题未解决 → `halt_issue.attempts += 1`，再次返回教练提示

**自动释放**：`HALT_MAX_ATTEMPTS = 3`，当 `attempts >= 3` 时自动清空 `halt_issue` 恢复 `active`，避免卡死。

### 5.3 跨轮记忆

**问题**：教练建议可能前后矛盾，例如第一轮建议"多问需求"，第三轮又建议"直接推荐"。

**方案**：Session 新增 `last_coach_advice` 字段，存储上轮教练给出的建议文本。EvaluatorCoach 的 prompt 中包含：

```
## 跨轮一致性铁律
上轮你给 BA 的建议是：「{last_coach_advice}」

本轮评估时必须注意：
1. 如果 BA 正在按照上轮建议行动，给予正面反馈，不要批评同一方向
2. 如果 BA 确实做错了方向，指出问题但说明为什么上轮建议不适用
3. 绝对不要给出与上轮建议直接矛盾的新建议
```

每轮教练决策输出后，更新 `last_coach_advice` 为当前建议。

### 5.4 最后一轮处理

**问题**：对话可能无限进行，或在不合适时结束。

**方案**：`MAX_TRAINING_TURNS = 12` 硬上限。

当 `ba_turn_count + 1 >= MAX_TRAINING_TURNS` 时：
- BA 的第 12 条消息正常保存
- **不生成顾客回复**（跳过 CustomerSimulator）
- 直接调用 EvaluatorCoach 生成总结性评估
- Session 自动进入 `completed` 状态
- 前端显示"训练已结束"提示，引导用户查看结果

### 5.5 结局判定（determine_outcome）

训练结束（手动 finish 或达到 MAX_TRAINING_TURNS）时，根据 `customer_state` 终态判定结局：

```python
def determine_outcome(state: CustomerState) -> dict:
    """根据顾客隐状态判定结局"""
    trust = state.trust
    intent = state.intent
    irritation_fear = state.irritation_fear

    if intent >= 65 and trust >= 55:
        return {"outcome": "deal", "title": "🎉 成交！"}
    elif trust < 35 or irritation_fear >= 75:
        return {"outcome": "churn", "title": "😞 流失"}
    else:
        return {"outcome": "follow_up", "title": "📋 待跟进"}
```

三种结局对应不同的 UI 展示（见 6.2）。

### 5.6 CustomerSimulator（顾客模拟器）

**实现位置**：`backend/app/agents/customer_simulator.py`

动态画像驱动，基于 `CustomerProfile`（由 `/api/persona` 生成）和 `CustomerState` 隐状态生成回复。

核心机制：
- **人格一致性**：根据 dynamic_tags（如"价格敏感"、"成分党"、"急性子"）塑造语言风格和顾虑倾向
- **状态感知**：trust/intent/irritation_fear 影响回复语气和开放程度
- **输出格式**：

```json
{
  "reply": "嗯...听起来还行，但我还是有点担心刺激性",
  "state_delta": {
    "trust": 3,
    "intent": 2,
    "irritation_fear": -5
  },
  "addressed_concerns": [],
  "collected_info": [],
  "new_concern": null,
  "buying_signal": false
}
```

`state_delta` 各项范围在 `[-15, +15]` 内，保证状态变化可控、不剧烈波动。

### 5.7 EvaluatorCoach（评估+教练）

**实现位置**：`backend/app/agents/evaluator_coach.py`

合并评估与教练决策为一次 LLM 调用，输出结构：

```json
{
  "stage": "probing",
  "stage_goal_achieved": false,
  "dimensions": {
    "listening": 70,
    "professionalism": 65,
    "recommendation": 50,
    "objection_handling": 60,
    "warmth": 75
  },
  "coach_decision": {
    "type": "probe",
    "content": "等等，你还没了解她的皮肤耐受度，先问问她之前用过 A 醇吗？",
    "requires_action": false
  },
  "cot_reasoning": {
    "observation": "BA 直接推荐了 A 醇产品",
    "comparison": "上轮教练提示了要先了解耐受度",
    "cause": "BA 急于推进，忽略了必要的探询步骤",
    "benchmark": "销冠在此阶段会先确认顾客的使用史和皮肤状态"
  }
}
```

CoT 推理四步链：
1. **observation**（观察）：描述 BA 本轮说了什么，做了哪些动作
2. **comparison**（对比）：与上轮教练建议对比，是否在按建议改进
3. **cause**（归因）：分析 BA 行为背后的原因（缺乏意识/急于推进/知识不足）
4. **benchmark**（对标）：销冠在此情境下会怎么做

教练决策类型：
- **halt**：严重问题，必须暂停（连续忽略顾虑、严重违规话术）
- **probe**：需要引导（跳过必要探询步骤）
- **feedback**：可优化（方向对但表达可改进）
- **none**：本轮无问题，正常推进

### 5.8 销冠 replay 生成

**当前实现**：LLM 实时生成（配合动态画像），而非预硬编码脚本。

- `/api/finish` 触发时，EvaluatorCoach 根据实际对话历史，由 LLM 生成销冠处理方式对比
- 优点：与具体对话场景高度相关，不受硬编码脚本局限
- 兜底：LLM 调用失败时返回通用销冠片段

---

## 六、前端设计

### 6.1 页面与组件

```
app/
├── page.tsx              # 首页：选择训练场景 + 顾客画像标签
├── session/
│   └── [id]/
│       └── page.tsx      # 唯一对话界面
├── case-review/
│   └── page.tsx          # 案例复盘页面
├── layout.tsx
└── globals.css

components/
├── ChatContainer.tsx     # 消息流容器
├── MessageBubble.tsx     # 根据 role 渲染不同样式
├── CoachCard.tsx         # 教练消息高亮卡片
├── ReplayInline.tsx      # 对话内销冠回放
├── MiniRadar.tsx         # 迷你雷达图
├── BAInput.tsx           # 输入框 + 发送/结束按钮
├── HaltOverlay.tsx       # 喊停时覆盖层
└── OutcomeCard.tsx       # 结局卡片（成交/流失/待跟进）
```

### 6.2 消息渲染规则

| role | 样式 |
|------|------|
| ba | 右侧气泡，主色 |
| customer | 左侧气泡，灰色 |
| coach-probe | 中间高亮条，黄色边框，带"教练提示"标签 |
| coach-halt | 中间高亮块，红色边框，带"停一下"标签，禁用输入 |
| coach-summary | 中间卡片，包含雷达图和关键时刻列表 |
| coach-champion_replay | 中间卡片，内嵌销冠关键轮次 |
| outcome-card | 顶部/中部卡片，不同结局不同主色（deal=绿/churn=红/follow_up=蓝） |

### 6.3 Halt 状态 UI

当 sessions status 为 `halted` 时，前端展示：

- **输入框替换为 textarea**：placeholder 文案 "按教练建议修改你的回应，重发即可…"
- **"放弃修改，继续"按钮**：调用 `POST /api/chat/continue`，清空 halt 状态后恢复正常输入
- **教练提示卡片**：高亮显示具体问题描述和建议
- **HaltOverlay 覆盖层**：半透明遮罩 + 红色边框强调当前处于暂停状态

### 6.4 状态管理（Zustand）

```typescript
interface SessionStore {
  session: Session | null;
  messages: Message[];
  isLoading: boolean;
  isHalted: boolean;
  isContinuingAfterHalt: boolean;  // 正在执行 /api/chat/continue
  isFinishing: boolean;            // 正在执行 /api/finish
  outcome: Outcome | null;         // 结局信息（deal/churn/follow_up）

  loadSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  continueAfterHalt: () => Promise<void>;  // POST /api/chat/continue
  finishSession: () => Promise<void>;      // POST /api/finish
}
```

---

## 七、5 天开发路径（对齐项目规划 V3.0）

> 注：以下为原始开发计划，已于 2026-07-17 完成。实际实现与计划有差异：
> - 后端使用 Python FastAPI（非原计划的 Next.js API Routes）
> - 新增功能：动态画像标签化、案例复盘、对练体验优化（4 项）

### Day 1：骨架 + 契约

- 初始化 Next.js + shadcn/ui 项目。
- 定义 TypeScript 类型（重点：Message 支持 coach 角色）。
- 硬编码 scenario、products、champion replay。
- 定 `/api/chat` 返回结构（newMessages + sessionStatus）。

### Day 2：对话跑通

- 实现 `CustomerSimulator` + `/api/chat` 基础版（只返回顾客回复）。
- 前端实现单对话界面，区分 ba/customer 气泡。
- 联调：BA 发消息 → 看到顾客回复。

### Day 3：状态机 + 评估 + 教练介入

- 实现 `SalesStateMachine` 和 `EvaluatorCoach`（合并评估与教练决策）。
- 实现主动追问、主动喊停。
- 前端支持 coach 消息渲染和输入禁用。
- 晚上端到端跑通：BA 犯错 → Agent 喊停/追问。

### Day 4：总结 + 销冠对比 + 打磨

- 实现 `/api/finish`：返回 summary + champion_replay coach 消息。
- 前端做迷你雷达图、关键时刻列表、ReplayInline。
- 调优触发规则和 prompt，确保 Demo 路径稳定。
- PPT 定稿。

### Day 5：稳定 + 彩排

- 准备 fallback 预设回复。
- 完整 Demo 彩排 3 遍。
- 部署生产环境。

---

## 八、AI Coding 协作方式

### 8.1 任务拆分粒度

把任务拆到 AI 能单步完成：

- "生成 Next.js 14 + shadcn/ui 项目骨架。"
- "根据 types/index.ts 实现 /api/session 路由，返回硬编码场景。"
- "实现 CoachEngine 类，包含 probe/halt 两个触发器，返回教练消息。"
- "实现 MessageBubble 组件，根据 role 渲染 ba/customer/coach 三种样式。"

### 8.2 Prompt 是核心，人工迭代

- 用 AI 生成第一版 prompt，但 `CustomerSimulator`、`EvaluatorCoach`、`CoachEngine` 的 prompt 需要团队手动调 5-10 轮。
- 建立测试集：3-5 段 BA 犯错对话，验证教练是否能正确触发。

### 8.3 类型即契约

- 先定死 `types/index.ts`，要求 AI 生成代码时严格复用，不新增字段。
- 前后端共用同一类型文件，减少联调 bug。

### 8.4 先做主线，再打磨

- Day 2 结束前必须跑通基础对话。
- Day 3 结束前必须跑通教练主动行为。
- 不要 Day 1 就追求 UI 精致。

---

## 九、风险与兜底

| 风险 | 兜底方案 |
|------|----------|
| LLM 返回慢/失败 | 准备 3 套预设顾客回复和教练消息，超时自动切换 |
| 教练触发不准 | 规则从简单开始：2 次未回应顾虑 → 喊停；跳过必要问题 → 追问 |
| JSON 解析失败 | 结构化输出 + Zod 校验，失败时重试一次 |
| 顾客模拟太假 | 脚本基于真实护肤帖改写；预设 fallback 兜底 |
| 主动行为过多打扰 | 每个行为间隔至少 2 轮 BA 消息，避免连续打断 |
| 销冠 replay 生成失败 | 预生成 champion replay，不依赖实时 LLM |
| 前后端联调卡住 | Day 1 定死 API 契约，前端先用 mock 数据并行开发 |
| **教练建议前后矛盾** | `last_coach_advice` 跨轮记忆，prompt 中注入"跨轮一致性铁律"约束 |
| **halt 校验标准不稳** | `HALT_CHECK_PROMPT` 专项校验，只检查原问题是否解决，不做全量评估 |
| **对话结束时机不对** | `MAX_TRAINING_TURNS=12` 硬上限 + 最后一轮后自动触发结束流程 |
| **结局缺等级感** | `determine_outcome()` 三段式判定 + 结局卡片 UI（deal/churn/follow_up） |

---

## 十、技术深度总结

### 10.1 为什么不是套壳

| 维度 | ChatGPT + Prompt | SheSells Agent |
|------|------------------|----------------|
| 角色 | 单一回应者 | 顾客 + 教练双角色 |
| 主动性 | 被动 | 主动追问、喊停、对比 |
| 状态 | 无 | 顾客信任度、购买意愿、顾虑集合等隐状态 |
| 结构 | 自由聊天 | 销售阶段状态机 |
| 评估 | 无 | 5 维评分 + 关键时刻 |
| 反馈 | 泛泛建议 | 基于具体轮次的结构化反馈 |
| 数据飞轮 | 无 | 练习数据回流校准模拟器和评估器 |

### 10.2 用到的前沿 AI 技术

- **结构化输出（JSON mode / function calling）**：约束 LLM 输出顾客回复、状态更新、评分结果。
- **多 Agent 协同**：顾客模拟器、EvaluatorCoach、状态机分离，互不污染。
- **状态感知生成**：顾客回复不是随机生成，而是基于隐状态变化。
- **RAG 知识注入**：SKU、成分、SOP 通过检索注入，减少幻觉。
- **主动行为决策**：结合规则与 LLM 判断，让 Agent 具备"教学意图"。
- **可解释评估**：不是黑盒打分，而是指出具体轮次和原因。

### 10.3 Demo 要证明什么

- 在"敏感肌早 C 晚 A"这一个场景下，SheSells 能：
  1. 稳定扮演一个犹豫、怕刺痛的顾客；
  2. 在 BA 犯错时主动追问或喊停；
  3. 在对话结束后主动总结并播放销冠处理方式；
  4. 整个体验发生在一个对话界面内，无需切页面。

---

## 十一、Review 补充说明与实际实现决策

### 11.1 已修正的问题

1. **会话加载接口**：新增 `GET /api/session/{sessionId}`，避免前端刷新时重复创建 session。
2. **prompts.ts 导入路径**：默认使用 `@/types`，并添加路径调整注释。
3. **无效 JSON 示例**：已修正所有 CustomerSimulator few-shot 示例中的 `+5`、`+8`、`+10` 为合法 JSON 数字。
4. **命名规范统一**：TypeScript 类型/字段全部使用 camelCase；LLM 输出 JSON 使用 snake_case，后端解析时做 key-mapping。
5. **Evaluator + CoachEngine 合并**：主流程推荐使用 `EvaluatorCoach` 一次 LLM 调用完成评估+教练决策，CustomerSimulator 单独一次，降低超时风险。
6. **turn 语义明确**：`turn` 只表示 BA/顾客对话轮次；coach 消息不占用独立 turn，通过 `metadata.turn` 关联到对应轮次。
7. **CustomerSimulator 输出补全**：输出中增加 `addressed_concerns` 和 `collected_info`，由 LLM 判断本轮更新。

### 11.2 设计问题决策结论

按技术评审建议，以下问题已拍板采用推荐方案：

| 问题 | 采用方案 |
|------|---------|
| A. 多次 LLM 调用 vs 合并调用 | **Evaluator + CoachEngine 合并为 EvaluatorCoach**；CustomerSimulator 单独一次。 |
| B. camelCase vs snake_case | **TS 类型统一 camelCase；LLM 输出统一 snake_case，解析时 key-mapping**。 |
| C. turn 编号语义 | **turn 只给 BA/顾客；coach 消息通过 metadata.turn 关联，不占用独立 turn**。 |
| D. addressed/collected 由谁更新 | **CustomerSimulator 输出 addressed_concerns + collected_info，由 LLM 判断更新**。 |

### 11.3 实际实现差异（与原设计对比）

以下为实际开发中做出的调整决策：

- **halt 恢复**：`continueAfterHalt` 现已改为调用后端 `POST /api/chat/continue` 接口，清空 `halt_issue` 和 `last_coach_advice`。原设计为纯前端本地实现，现改为后端状态管理以确保数据一致性。
- **champion replay 生成**：已从"预硬编码脚本"改为 **LLM 实时生成**（配合动态顾客画像），使销冠对比与具体对话场景高度相关，提升训练针对性。
- **数据存储**：使用 Python 内存字典 `SessionManager`，未采用 Vercel KV 等外部存储。黑客松场景下首轮对话即完成训练，无持久化需求。

### 11.4 其他低风险建议

- **模型选择**：`.env` 默认建议用国产合规模型（Kimi / Qwen / GLM）；如果必须兼容 OpenAI 格式，可用 `OPENAI_BASE_URL` 指向国内代理。
- **champion replay 匹配**：MVP 阶段直接返回完整 champion replay，不必严格按 `criticalMoments` 匹配轮次，降低实现复杂度。

---

_整理日期：2026-07-18_
_对应文档：SheSells-AI销售教练-项目规划.md V3.0_
_目标：5 天黑客松可直接执行_
