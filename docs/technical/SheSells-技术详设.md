# SheSells —— AI 销售教练 Agent · 技术详设

> 文档版本：V2.0（对应项目规划 V3.0 Agent 方案）
> 整理日期：2026-07-11
> 目标：5 天黑客松可直接执行，适配“Agent 不是工具”的产品定义

---

## 一、技术选型

### 1.1 栈选择

| 层级 | 选型 | 理由 |
|------|------|------|
| 前端框架 | Next.js 14 (App Router) + TypeScript | 全栈一体、部署简单、AI 生态成熟 |
| UI 组件 | Tailwind CSS + shadcn/ui | 快、风格统一、可定制 |
| 状态管理 | Zustand | 轻量，适合单对话界面状态 |
| 图表 | Recharts | 迷你雷达图易实现 |
| 后端 | Next.js API Routes | 与前端同仓库，减少部署复杂度 |
| LLM SDK | Vercel AI SDK (`ai`) | 内置流式、结构化输出、工具调用 |
| 数据库 | Vercel KV / Upstash Redis | 会话级数据，读写快，5 天够用 |
| LLM | 国产合规模型（Kimi / Qwen / GLM）API | 境内调用、中文好、成本低 |
| 部署 | Vercel | 一键部署，支持 Serverless Functions |
| 可观测 | Langfuse 免费版 | 追踪 LLM 调用、Prompt、输出 |

### 1.2 关键取舍

- **不做独立 Dashboard 页面**：所有评分、反馈、销冠对比都在对话流内完成，前端只需要 1 个聊天界面。
- **不做用户系统**：Demo 直接进入会话，降低实现复杂度。
- **不做多场景/多品牌**：场景和 SKU 硬编码，保证 5 天能跑通。

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
│   单个对话界面：消息流 + 教练高亮 + 迷你雷达图 + 销冠回放     │
│        (Next.js App Router / React / Tailwind)              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────┼──────────────────────────────────┐
│                     Next.js API Routes                      │
│  /api/session  /api/chat  /api/finish  /api/replay           │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                     Agent Core（TypeScript）                 │
│  处理流程：                                                 │
│  1. CustomerSimulator ──→ 顾客回复                          │
│  2. EvaluatorCoach ──→ 评估+教练决策+CoT reasoning(创新三)   │
│  3. ErrorPatternTracker ──→ 错误模式追踪+策略升级(创新二)    │
│  4. SelfChecker ──→ 教练消息自检回环(创新一)                │
│                                                             │
│  模块：                                                     │
│  ├─ CustomerSimulator：顾客模拟器                            │
│  ├─ EvaluatorCoach：评估 + 教练决策合并                      │
│  │   ├─ ProbeTrigger（主动追问）                             │
│  │   ├─ HaltTrigger（主动喊停）                              │
│  │   ├─ SummaryTrigger（主动对比/总结）                      │
│  │   └─ CoT reasoning 输出（创新三）                         │
│  ├─ ErrorPatternTracker：错误模式追踪+策略升级（创新二）     │
│  ├─ SelfChecker：教练消息自检回环（创新一）                  │
│  ├─ SalesStateMachine：销售阶段状态机                        │
│  ├─ CoachEngine：独立教练消息生成器（可选）                  │
│  └─ KnowledgeBase：SKU / 成分 / SOP 注入                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────────┐
│  LLM API（结构化输出 / function calling）                     │
│  Vercel KV（session 存储） / Langfuse（调用追踪）             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、数据模型

> 命名约定：所有 TypeScript 类型/字段统一使用 camelCase；LLM 输出的 JSON 统一使用 snake_case，后端解析时做 key-mapping。

### 3.1 Session

```typescript
interface Session {
  sessionId: string;
  scenarioId: string;
  status: 'active' | 'halted' | 'completed';
  createdAt: string;
  customerProfile: CustomerProfile;
  customerState: CustomerState;
  messages: Message[];
  baTurnCount: number; // 用于触发规则
}

interface CustomerProfile {
  persona: 'sensitive_skincare_newbie';
  skinType: 'sensitive';
  goal: 'try_early_c_late_a';
  concerns: string[];
  tolerance: 'low' | 'medium' | 'high';
  background: string;
}

interface CustomerState {
  trust: number;                 // 0-100
  purchaseIntent: number;        // 0-100
  irritationFear: number;        // 0-100
  addressedConcerns: string[];
  collectedInfo: string[];       // BA 已收集到的关键信息
  currentStage: SalesStage;
}

type SalesStage = 'opening' | 'probing' | 'objection' | 'recommending' | 'closing';
```

### 3.2 Message（核心更新：支持 coach 角色）

```typescript
interface Message {
  id: string;
  turn: number;
  role: 'ba' | 'customer' | 'coach';
  content: string;
  timestamp: string;

  // 仅 role === 'coach' 时使用
  coachType?: CoachType;
  metadata?: CoachMetadata;
}

type CoachType =
  | 'probe'            // 主动追问
  | 'halt'             // 主动喊停
  | 'feedback'         // 即时反馈
  | 'summary'          // 对话总结
  | 'champion_replay'; // 销冠对比

interface CoachMetadata {
  turn?: number;              // coach 消息关联到的 BA/顾客轮次（coach 自身不占用独立 turn）
  stage?: SalesStage;
  dimensions?: Dimensions;
  criticalMoments?: CriticalMoment[];
  replayTurns?: ReplayTurn[];
  requiresAction?: boolean; // true 时前端暂停输入，等待 BA 确认
  actionLabel?: string;     // 按钮文案，如“明白了，继续”
}

interface CoachDecision {
  intervene: boolean;
  type: 'probe' | 'halt' | 'feedback' | 'none';
  content: string;
  requiresAction: boolean;
}

interface Dimensions {
  listening: number;
  professionalism: number;
  recommendation: number;
  objectionHandling: number;
  warmth: number;
}

interface CriticalMoment {
  turn: number;
  type: 'missed_concern' | 'good_probe' | 'objection_raised' | 'buying_signal' | 'premature_recommendation';
  description: string;
}

interface ReplayTurn {
  turn: number;
  baMessage: string;
  customerMessage: string;
  note: string;
}
```

### 3.3 SKU / SOP

```typescript
interface Product {
  id: string;
  name: string;
  brand: string;
  category: 'vc_serum' | 'retinol_serum' | 'repair_cream' | 'sunscreen';
  price: number;
  keyIngredients: string[];
  suitableSkin: string[];
  usageTips: string;
  precautions: string[];
}

interface SOPRule {
  stage: SalesStage;
  goal: string;
  requiredInfo?: string[];    // 进入下一阶段前必须收集的信息
  forbiddenPhrases: string[];
}
```

---

## 四、接口定义

### 4.1 创建会话

```http
POST /api/session
Content-Type: application/json

{
  "scenarioId": "sensitive_early_c_late_a"
}
```

Response:

```json
{
  "sessionId": "sess_xxx",
  "scenario": {
    "id": "sensitive_early_c_late_a",
    "title": "敏感肌想试早C晚A",
    "customerProfile": { "persona": "...", "background": "..." },
    "initialMessage": "你好，我最近看到早C晚A很火，但我皮肤有点敏感，怕用了会刺痛烂脸，你能帮我看看吗？"
  }
}
```

### 4.1.5 获取已有会话

```http
GET /api/session/{sessionId}
```

Response: 返回完整 Session 对象（用于页面刷新或重新进入时恢复对话）。

> 注意：前端 `loadSession(sessionId)` 应该调用 GET，而不是重复 POST /api/session 创建新会话。

### 4.2 对话（核心接口）

```http
POST /api/chat
Content-Type: application/json

{
  "sessionId": "sess_xxx",
  "message": "我推荐这款精华"
}
```

Response:

```json
{
  "sessionId": "sess_xxx",
  "newMessages": [
    {
      "id": "msg_xxx",
      "turn": 2,
      "role": "coach",
      "coachType": "probe",
      "content": "等等，你还没了解她的皮肤状况，先问问她现在在用什么、耐不耐受。",
      "timestamp": "2026-07-11T12:00:00Z",
      "metadata": { "requiresAction": false }
    }
  ],
  "updatedState": {
    "currentStage": "probing",
    "trust": 32,
    "purchaseIntent": 20,
    "irritationFear": 82
  },
  "sessionStatus": "active"
}
```

说明：
- 返回的 `newMessages` 可能包含 1-2 条消息（顾客回复 + 教练介入）。
- 如果触发主动喊停，`sessionStatus` 变为 `halted`，教练消息 `requiresAction: true`。
- 前端按顺序渲染消息，有 `requiresAction: true` 时禁用输入框并显示确认按钮。

### 4.3 结束训练（主动总结 + 对比）

```http
POST /api/finish
Content-Type: application/json

{
  "sessionId": "sess_xxx"
}
```

Response:

```json
{
  "sessionId": "sess_xxx",
  "newMessages": [
    {
      "id": "msg_summary",
      "turn": 8,
      "role": "coach",
      "coachType": "summary",
      "content": "你整体表现不错，但异议处理需要加强。第 3 轮她说怕刺痛，你没回应；第 6 轮你直接推荐，没有先共情。",
      "timestamp": "2026-07-11T12:00:00Z",
      "metadata": {
        "dimensions": { "listening": 78, "professionalism": 70, "objectionHandling": 55, "recommendation": 60, "warmth": 72 },
        "criticalMoments": [...]
      }
    },
    {
      "id": "msg_replay",
      "turn": 8,
      "role": "coach",
      "coachType": "champion_replay",
      "content": "来看销冠怎么处理同一个顾客——",
      "timestamp": "2026-07-11T12:00:00Z",
      "metadata": {
        "replayTurns": [
          { "turn": 3, "baMessage": "...", "customerMessage": "...", "note": "先共情刺痛顾虑" }
        ]
      }
    }
  ],
  "finalReport": { /* 完整评分对象 */ },
  "sessionStatus": "completed"
}
```

### 4.4 获取销冠 replay（可选，/finish 已返回时可不用）

```http
POST /api/replay
Content-Type: application/json

{
  "sessionId": "sess_xxx"
}
```

### 4.5 静态数据

```http
GET /api/scenarios
GET /api/products?scenarioId=sensitive_early_c_late_a
```

---

## 五、Agent Core 设计

### 5.1 处理流程

每次 BA 发送消息后，后端执行：

```
1. 保存 BA 消息
2. SalesStateMachine 更新阶段和 customerState
3. EvaluatorCoach 合并完成本轮评估 + 教练决策
   - 输入为 BA 刚说的话 + 上一轮顾客回复（已存在于对话历史中）
   - 触发 halt → 返回教练喊停消息，sessionStatus = halted
   - 触发 probe/feedback → 返回教练消息
   - 无触发 → CustomerSimulator 生成顾客回复
4. 返回 newMessages + updatedState
```

> 说明：技术评审建议把 Evaluator 与 CoachEngine 合并为一次 LLM 调用（EvaluatorCoach），CustomerSimulator 单独一次，减少每轮 LLM 调用次数和超时风险。EvaluatorCoach 在 CustomerSimulator 之前调用，基于 BA 对上一轮顾客消息的回应做评估和决策。

### 5.2 教练引擎（CoachEngine）

核心思想：**Agent 不是回应者，是观察者+干预者**。教练行为基于规则 + LLM 判断，优先保证 Demo 稳定性。

#### 触发器规则（MVP 版）

| 触发器 | 触发条件 | 输出 |
|--------|---------|------|
| **主动追问 probe** | BA 在 probing 阶段未收集 `requiredInfo` 就进入推荐；或 BA 回复过于简略（少于 15 字且不含提问） | coach 消息提示 BA 先问什么 |
| **主动喊停 halt** | 连续 2 轮 BA 消息中顾客表达了顾虑但未被回应 | coach 高亮提示，要求 BA 确认后再继续 |
| **主动总结 summary** | BA 点击“结束训练”或达到最大轮数（如 12 轮） | coach 输出评分、关键时刻 |
| **主动对比 champion_replay** | summary 之后 | coach 输出销冠关键轮次 |

#### 伪代码

```typescript
class CoachEngine {
  decide(session: Session, lastBAMessage: Message): CoachDecision {
    // 1. 喊停：连续忽略顾虑
    if (this.hasMissedConcerns(session, 2)) {
      return {
        type: 'halt',
        content: '停一下——她说了 2 次怕刺痛，你都没接住，试试先共情再推荐。',
        requiresAction: true
      };
    }

    // 2. 追问：跳过必要探询
    if (this.skippedRequiredInfo(session)) {
      return {
        type: 'probe',
        content: '等等，你还没了解她的皮肤耐受度，先问问她之前用过 A 醇吗？'
      };
    }

    return null; // 不触发，继续顾客回复
  }
}
```

### 5.3 顾客模拟器（CustomerSimulator）

基于 customerState 生成回复，保持人格一致性。按技术评审要求，输出中需包含 `addressed_concerns` 和 `collected_info`，由 LLM 判断本轮更新。

Prompt 核心：

```
你是顾客模拟器。扮演以下角色：
- 25 岁敏感肌女性，想尝试早 C 晚 A
- 当前信任度 {trust}，购买意愿 {purchase_intent}，刺痛恐惧 {irritation_fear}
- 已回应顾虑：{addressed_concerns}
- 已收集信息：{collected_info}
- 当前阶段：{current_stage}

规则：
1. 回复口语化、真实。
2. 如果 BA 没回应你的顾虑，你会犹豫、重复或轻微抗拒。
3. 如果 BA 共情并给出合理方案，信任度和购买意愿上升。
4. 不要一次性答应购买。

BA 刚说的话：{ba_message}

请输出 JSON：
{
  "reply": "顾客回复",
  "state_delta": { "trust": 5, "purchase_intent": 3, "irritation_fear": -2 },
  "addressed_concerns": ["afraid_of_irritation"],
  "collected_info": ["skin_type"],
  "new_concern": null,
  "buying_signal": false
}
```

### 5.4 销售状态机（SalesStateMachine）

| 阶段 | 目标 | 进入下一阶段条件 |
|------|------|-----------------|
| opening | 建立信任、自然开场 | BA 问候并让顾客愿意继续 |
| probing | 挖掘需求 | 收集到皮肤类型 + 主要顾虑 + 使用史 |
| objection | 处理顾虑 | 顾客明确表达顾虑且 BA 已回应 |
| recommending | 给出方案 | 在了解需求后给出匹配推荐 |
| closing | 确认下一步 | 给出清晰购买/试用建议 |

阶段判断：规则 + LLM。例如：
- 出现产品名/推荐语句 → 进入 recommending
- 顾客表达顾虑且未被回应 → 进入 objection
- BA 连续提问且未推荐 → 保持在 probing

### 5.5 评估器（Evaluator / EvaluatorCoach）

每轮 BA 消息后做轻量评估，为教练决策提供输入。

Evaluator 输出 JSON：

```json
{
  "stage": "probing",
  "stage_goal_achieved": false,
  "dimensions": { "listening": 70, "professionalism": 65, "recommendation": 50, "objection_handling": 60, "warmth": 75 },
  "missed_concerns": ["afraid_of_irritation"],
  "feedback": "你问了皮肤类型，但没问她是否用过 A 醇。"
}
```

EvaluatorCoach 额外输出：

```json
{
  "coach_decision": {
    "intervene": true,
    "type": "probe",
    "content": "等等，你还没了解她的皮肤耐受度...",
    "requires_action": false
  }
}
```

说明：
- MVP 阶段分数用于展示，不严格绑定教练触发。
- 教练触发优先用规则（如 `missed_concerns` 连续出现 2 次 → halt）。

### 5.6 销冠 replay 生成

**MVP 策略：预生成 + 完整返回**

- 预先写好销冠对话脚本（5-8 轮），硬编码在 `lib/data/championReplay.ts`。
- `/api/finish` 直接返回完整 champion replay，不必严格按 `criticalMoments` 匹配轮次，降低实现复杂度。
- 进阶：用 LLM 根据实际对话动态生成 champion replay（Day 4 后如有余力再做）。

---

## 六、前端设计

### 6.1 页面与组件

```
app/
├── page.tsx              # 首页：1 个按钮“开始训练”
├── session/
│   └── [id]/
│       └── page.tsx      # 唯一对话界面
├── layout.tsx
└── globals.css

components/
├── ChatContainer.tsx     # 消息流容器
├── MessageBubble.tsx     # 根据 role 渲染不同样式
├── CoachCard.tsx         # 教练消息高亮卡片
├── ReplayInline.tsx      # 对话内销冠回放
├── MiniRadar.tsx         # 迷你雷达图
├── BAInput.tsx           # 输入框 + 发送/结束按钮
└── HaltOverlay.tsx       # 喊停时覆盖层
```

### 6.2 消息渲染规则

| role | 样式 |
|------|------|
| ba | 右侧气泡，主色 |
| customer | 左侧气泡，灰色 |
| coach-probe | 中间高亮条，黄色边框，带“教练提示”标签 |
| coach-halt | 中间高亮块，红色边框，带“停一下”标签，禁用输入 |
| coach-summary | 中间卡片，包含雷达图和关键时刻列表 |
| coach-champion_replay | 中间卡片，内嵌销冠关键轮次 |

### 6.3 状态管理（Zustand）

```typescript
interface SessionStore {
  session: Session | null;
  messages: Message[];
  isLoading: boolean;
  isHalted: boolean;
  loadSession: (sessionId: string) => Promise<void>;  // GET /api/session/{sessionId}
  sendMessage: (content: string) => Promise<void>;    // POST /api/chat
  continueAfterHalt: () => void;                      // 本地恢复输入，无需后端接口
  finishSession: () => Promise<void>;                 // POST /api/finish
}
```

---

## 七、5 天开发路径（对齐项目规划 V3.0）

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

- “生成 Next.js 14 + shadcn/ui 项目骨架。”
- “根据 types/index.ts 实现 /api/session 路由，返回硬编码场景。”
- “实现 CoachEngine 类，包含 probe/halt 两个触发器，返回教练消息。”
- “实现 MessageBubble 组件，根据 role 渲染 ba/customer/coach 三种样式。”

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
- **主动行为决策**：结合规则与 LLM 判断，让 Agent 具备“教学意图”。
- **可解释评估**：不是黑盒打分，而是指出具体轮次和原因。

### 10.3 Demo 要证明什么

- 在“敏感肌早 C 晚 A”这一个场景下，SheSells 能：
  1. 稳定扮演一个犹豫、怕刺痛的顾客；
  2. 在 BA 犯错时主动追问或喊停；
  3. 在对话结束后主动总结并播放销冠处理方式；
  4. 整个体验发生在一个对话界面内，无需切页面。

---

## 十一、Review 补充说明与待决策事项

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

### 11.3 其他低风险建议

- **模型选择**：`.env` 默认建议用国产合规模型（Kimi / Qwen / GLM）；如果必须兼容 OpenAI 格式，可用 `OPENAI_BASE_URL` 指向国内代理。
- **champion replay 匹配**：MVP 阶段直接返回完整 champion replay，不必严格按 `criticalMoments` 匹配轮次，降低实现复杂度。
- **halt 恢复**：`continueAfterHalt` 纯前端本地实现，无需后端接口，点击后恢复输入即可。

---

_整理日期：2026-07-11_
_对应文档：SheSells-AI销售教练-项目规划.md V3.0_
_目标：5 天黑客松可直接执行_
