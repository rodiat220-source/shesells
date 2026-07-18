# SheSells —— AI Coding 每日 Prompts

> 使用方式：把对应 Day 的前端/后端 prompt 直接丢给 Cursor / Claude Code / GitHub Copilot Chat。
> 顺序：Day 1 后端先创建项目骨架，Day 1 前端在已创建的项目里继续。Day 2-5 前后端可并行。
>
> 命名约定（与技术评审对齐）：
> - TypeScript 代码中的类型、变量统一使用 camelCase。
> - LLM 返回的 JSON 统一使用 snake_case，后端/前端解析时做 key-mapping 到 camelCase TS 类型。
> - 核心映射：state_delta → stateDelta；addressed_concerns/collected_info → addressedConcerns/collectedInfo；
>   new_concern → newConcern；buying_signal → buyingSignal；stage_goal_achieved → stageGoalAchieved；
>   missed_concerns → missedConcerns；coach_decision → coachDecision；requires_action → requiresAction；
>   overall_score → overallScore；critical_moments → criticalMoments；key_insights → keyInsights；
>   improvement_suggestions → improvementSuggestions。

---

## 通用指令（每条 prompt 前都加上）

```
你是一个资深的全栈工程师，正在参与一个黑客松项目。

项目背景：
- 项目名：SheSells，一个 AI 销售教练 Agent。
- 目标用户：美妆品牌 BA（销售顾问）。
- 核心体验：评委扮演 BA，与 AI Agent 对话；Agent 同时扮演顾客和教练，会主动追问、主动喊停、主动对比销冠回复。
- 技术栈：Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui + Zustand + Vercel AI SDK + 国产 LLM API。

编码原则：
1. 严格使用已有的 TypeScript 类型，不新增未定义的字段。
2. 每个函数都要有明确的输入输出类型。
3. 优先跑通主线，不要过度设计。
4. 所有 LLM 调用都要使用结构化输出（JSON mode / function calling）或 Zod 校验；LLM 输出为 snake_case，解析后映射到 camelCase TS 类型。
5. 完成后给出 3 个验收测试，说明怎么验证这段代码是对的。

如果你发现需求有歧义，先问我，不要猜测。
```

---

## Day 1：后端 —— 项目骨架 + 类型 + API 桩

```
任务：创建 SheSells 的 Next.js 14 项目骨架，定义所有核心类型，并实现 API 桩。

要求：
1. 初始化 Next.js 14 项目（App Router + TypeScript + Tailwind CSS + shadcn/ui）。
2. 安装依赖：zustand、ai、zod、@ai-sdk/openai（或对应国产模型 SDK，如 @ai-sdk/qwen 如果有）、recharts。
3. 创建 src/types/index.ts，定义以下类型（统一 camelCase）：

export type SalesStage = 'opening' | 'probing' | 'objection' | 'recommending' | 'closing';

export interface CustomerProfile {
  persona: string;
  skinType: string;
  goal: string;
  concerns: string[];
  tolerance: 'low' | 'medium' | 'high';
  background: string;
}

export interface CustomerState {
  trust: number;
  purchaseIntent: number;
  irritationFear: number;
  addressedConcerns: string[];
  collectedInfo: string[];
  currentStage: SalesStage;
}

export interface Message {
  id: string;
  turn: number;
  role: 'ba' | 'customer' | 'coach';
  content: string;
  timestamp: string;
  coachType?: 'probe' | 'halt' | 'feedback' | 'summary' | 'champion_replay';
  metadata?: {
    turn?: number; // coach 消息关联到的 BA/顾客轮次
    stage?: SalesStage;
    dimensions?: Dimensions;
    criticalMoments?: CriticalMoment[];
    replayTurns?: ReplayTurn[];
    requiresAction?: boolean;
    actionLabel?: string;
  };
}

export interface CoachDecision {
  intervene: boolean;
  type: 'probe' | 'halt' | 'feedback' | 'none';
  content: string;
  requiresAction: boolean;
}

export interface Dimensions {
  listening: number;
  professionalism: number;
  recommendation: number;
  objectionHandling: number;
  warmth: number;
}

export interface CriticalMoment {
  turn: number;
  type: 'missed_concern' | 'good_probe' | 'objection_raised' | 'buying_signal' | 'premature_recommendation';
  description: string;
}

export interface ReplayTurn {
  turn: number;
  baMessage: string;
  customerMessage: string;
  note: string;
}

export interface Session {
  sessionId: string;
  scenarioId: string;
  status: 'active' | 'halted' | 'completed';
  createdAt: string;
  customerProfile: CustomerProfile;
  customerState: CustomerState;
  messages: Message[];
  baTurnCount: number;
}

4. 创建 src/lib/data/scenarios.ts，硬编码一个场景：
   - scenarioId: "sensitive_early_c_late_a"
   - title: "敏感肌想试早C晚A"
   - customerProfile: 25岁敏感肌女性，想尝试早C晚A，怕刺痛烂脸
   - initialMessage: "你好，我最近看到早C晚A很火，但我皮肤有点敏感，怕用了会刺痛烂脸，你能帮我看看吗？"

5. 创建 src/lib/data/products.ts，硬编码 5-8 个 SKU（VC精华、A醇精华、修护霜、防晒等）。

6. 创建 src/lib/data/championReplay.ts，硬编码销冠对话关键轮次（5-8 轮），用于后面的主动对比。

7. 创建 src/lib/sessionStore.ts，用内存 Map 临时存储 session（后续可替换为 Vercel KV）。

8. 创建以下 API 路由桩，返回 mock 数据即可：
   - app/api/session/route.ts：POST，创建 session。
   - app/api/session/[id]/route.ts：GET，根据 id 获取已有 session（刷新恢复用）。
   - app/api/chat/route.ts：POST，返回一条 mock 顾客回复。
   - app/api/finish/route.ts：POST，返回 mock 总结。
   - app/api/replay/route.ts：POST，返回 champion replay。
   - app/api/scenarios/route.ts：GET，返回场景列表。
   - app/api/products/route.ts：GET，返回 SKU 列表。

9. 所有 API 都用 Zod 校验请求体。

10. 配置 .env.local 模板：LLM_API_KEY、LLM_BASE_URL、LLM_MODEL（默认建议国产模型，如 kimi-latest）。

验收标准：
1. npm run dev 能启动。
2. POST /api/session 返回包含 sessionId 和 initialMessage 的 JSON。
3. GET /api/session/{id} 能返回对应 session。
4. POST /api/chat 返回一条 role 为 customer 的消息。
5. POST /api/finish 返回 coach 类型的 summary 和 champion_replay 消息。
```

---

## Day 1：前端 —— 首页 + 单对话界面骨架

```
任务：在已创建的 Next.js 项目中，搭建前端页面和组件骨架。

要求：
1. 确保项目已安装 shadcn/ui，并安装以下组件：button、card、input、badge、avatar、skeleton。
2. 创建 app/page.tsx：
   - 标题：SheSells AI 销售教练
   - 副标题：教的不是话术，是懂她的能力
   - 一个“开始训练”按钮，点击后调用 POST /api/session，拿到 sessionId 后跳转到 /session/{id}。

3. 创建 app/session/[id]/page.tsx：
   - 进入页面时从 URL 拿到 sessionId，调用 GET /api/session/{sessionId} 加载已有会话。
   - 显示 initialMessage 作为第一条顾客消息。
   - 显示对话流区域、输入框、结束训练按钮。

4. 创建 src/store/sessionStore.ts（Zustand）：
   - state: session, messages[], isLoading, isHalted
   - actions: loadSession(sessionId), sendMessage(content), continueAfterHalt(), finishSession()
   - 先用 mock 数据让 UI 能跑起来，sendMessage 暂时把用户输入追加到 messages，再追加一条 mock 顾客回复。

5. 创建组件：
   - components/ChatContainer.tsx：消息流容器，自动滚动到底部。
   - components/MessageBubble.tsx：根据 role 渲染 ba/customer/coach（ coach 先简单渲染为带边框的提示卡片）。
   - components/BAInput.tsx：输入框 + 发送按钮 + 结束训练按钮。

6. 样式：
   - BA 消息靠右，蓝色背景。
   - 顾客消息靠左，灰色背景。
   - 教练消息居中，黄色/红色边框高亮。

验收标准：
1. 首页点击“开始训练”后进入对话页。
2. 能看到顾客开场白。
3. 输入消息后，能看到自己的消息和 mock 顾客回复。
4. 页面是响应式的，移动端可用。
```

---

## Day 2：后端 —— 顾客模拟器 + 真实对话

```
任务：实现 CustomerSimulator，让 /api/chat 返回真实、一致的顾客回复。

要求：
1. 创建 src/lib/agents/customerSimulator.ts：
   - 函数签名：async function generateCustomerReply(session: Session, baMessage: Message): Promise<{ reply: string; stateDelta: Partial<CustomerState>; addressedConcerns: string[]; collectedInfo: string[]; newConcern: string | null; buyingSignal: boolean }>
   - 使用 Vercel AI SDK 的 generateText 或兼容 SDK 调用 LLM。
   - Prompt 必须注入 customerProfile、customerState、baMessage.content；LLM 输出 snake_case JSON，解析后映射到 camelCase TS 类型。
   - Prompt 要求 LLM 输出严格 JSON，包含 reply、state_delta、addressed_concerns、collected_info、new_concern、buying_signal。
   - 顾客人设：犹豫、怕刺痛、需要被理解；不能一开口就买。

2. 更新 /api/chat：
   - 保存 BA 消息。
   - 调用 CustomerSimulator 生成顾客回复。
   - LLM 返回的 snake_case JSON（state_delta 等）需要映射为 camelCase 的 `Partial<CustomerState>`。
   - 更新 customerState（数值裁剪到 0-100）。
   - 返回 { newMessages: [customerMessage], updatedState, sessionStatus: 'active' }。

3. 更新 sessionStore：
   - addMessage(sessionId, message)
   - updateState(sessionId, newState)
   - getSession(sessionId)

4. 添加 src/lib/agents/salesStateMachine.ts（初版）：
   - 函数 detectStage(messages: Message[]): SalesStage
   - 规则：如果 BA 消息包含产品名/推荐语句 → recommending；如果顾客消息包含顾虑词（怕、担心、刺痛）且 BA 未回应 → objection；否则根据上下文 LLM 判断。
   - MVP 可先用规则 + 关键词，后续再引入 LLM。

5. 用环境变量选择模型：LLM_MODEL、LLM_API_KEY、LLM_BASE_URL。

验收标准：
1. 连续对话 3 轮，顾客回复保持人设一致。
2. BA 说“我推荐这款精华”时，顾客应该表现出犹豫或抗拒，而不是直接接受。
3. BA 说“你怕刺痛是吧，我们先从低浓度开始”时，顾客信任度应上升。
4. 给出 3 个测试用例，验证上述行为。
```

---

## Day 2：前端 —— 真实对话接入

```
任务：把前端对话接到真实后端 API。

要求：
1. 更新 sessionStore：
   - loadSession(sessionId): 从 GET /api/session/{sessionId} 获取 session 数据。
   - sendMessage(content): 调用 POST /api/chat，把返回的 newMessages 追加到 messages。
   - 处理 isLoading 状态。

2. 更新 app/session/[id]/page.tsx：
   - 页面加载时调用 loadSession。
   - 显示 initialMessage 作为第一条顾客消息。

3. 更新 MessageBubble.tsx：
   - ba 消息：右侧蓝色气泡。
   - customer 消息：左侧灰色气泡。
   - coach 消息：中间高亮卡片（先用统一的 coach 样式）。

4. 添加 loading 状态：发送消息后显示“顾客思考中...”。

5. 添加基础错误处理：如果 API 失败，提示用户重试。

验收标准：
1. 在对话页输入消息，后端返回真实顾客回复并显示。
2. 连续对话 3 轮不报错。
3. 发送消息时输入框禁用，回复后恢复。
```

---

## Day 3：后端 —— 评估器 + 教练主动行为

```
任务：实现 EvaluatorCoach（评估 + 教练决策合并），让 Agent 能主动追问和喊停。

说明：技术评审建议把 Evaluator 与 CoachEngine 合并为一次 LLM 调用（EvaluatorCoach），CustomerSimulator 单独一次，减少超时风险。EvaluatorCoach 在 CustomerSimulator 之前调用，基于 BA 对上一轮顾客消息的回应做评估和决策；如未触发教练行为，再调用 CustomerSimulator 生成顾客回复。

要求：
1. 创建 src/lib/agents/evaluatorCoach.ts：
   - 函数 evaluateAndDecide(session: Session, baMessage: Message, lastCustomerMessage: Message): Promise<{ stage: SalesStage; stageGoalAchieved: boolean; dimensions: Dimensions; missedConcerns: string[]; feedback: string; coachDecision: CoachDecision }>
   - 使用 LLM 结构化输出，同时输出评估和 coach_decision。
   - LLM 输出 snake_case，解析时映射到 camelCase TS 类型。
   - 评分维度：listening、professionalism、recommendation、objectionHandling、warmth。
   - 必须识别 missed_concerns，例如顾客说“怕刺痛”但 BA 没回应。

2. 创建 src/lib/agents/coachEngine.ts（可选，独立生成教练消息）：
   - 函数 generateCoachMessage(session: Session, triggerReason: string, coachType: CoachType): Promise<Message>
   - 用于需要单独生成 coach 消息的场景。

3. 更新 /api/chat 流程：
   - 保存 BA 消息。
   - 更新 SalesStateMachine 阶段。
   - 调用 EvaluatorCoach 合并完成本轮评估 + 教练决策（传入上一轮顾客消息）。
     - 触发 halt/probe/feedback → 返回 coach 消息，sessionStatus 可能为 'halted'。
     - 未触发 → 调用 CustomerSimulator 生成顾客回复。
   - 返回 newMessages 数组。

4. 添加 src/lib/utils/stateUpdate.ts：
   - applyStateDelta(currentState, delta): 安全更新 state，数值裁剪到 0-100。
   - 注意 delta 来自 LLM 的 snake_case 输出，调用前要先映射为 camelCase 的 `Partial<CustomerState>`。

验收标准：
1. BA 跳过需求探询直接推荐 → Agent 返回主动追问。
2. BA 连续 2 次忽略“怕刺痛”顾虑 → Agent 返回主动喊停，sessionStatus = 'halted'。
3. BA 正常回应顾虑 → Agent 返回顾客回复，无教练介入。
4. 给出 3 个测试对话，验证触发器准确性。
```

---

## Day 3：前端 —— 教练消息渲染 + 喊停交互

```
任务：前端支持 coach 消息的不同类型和喊停交互。

要求：
1. 更新 MessageBubble.tsx：
   - coachType === 'probe'：黄色边框，标签“教练提示”。
   - coachType === 'halt'：红色边框，标签“停一下”，内容加粗。
   - coachType === 'feedback'：浅蓝色边框。

2. 更新 BAInput.tsx：
   - 当 isHalted 为 true 时，隐藏输入框，显示“明白了，继续”按钮。
   - 点击按钮调用 continueAfterHalt()，本地设置 isHalted = false，无需调用后端。

3. 更新 sessionStore：
   - sendMessage 处理 /api/chat 返回的 newMessages 数组（可能包含多条消息）。
   - 如果返回的 coach 消息 metadata.requiresAction 为 true，设置 isHalted = true。
   - continueAfterHalt(): 本地恢复输入，不发送请求。

4. 添加消息顺序动画：新消息依次出现，不要同时弹出。

5. 在 coach-halt 消息出现时，其他消息短暂变灰，突出教练提示。

验收标准：
1. BA 触发追问时，页面显示黄色教练提示。
2. BA 触发喊停时，输入框消失，出现“明白了，继续”按钮。
3. 点击继续后，能继续对话。
4. 多条新消息能按顺序渲染。
```

---

## Day 4：后端 —— 结束总结 + 销冠对比

```
任务：实现 /api/finish，在对话流内主动总结并返回销冠对比。

要求：
1. 创建 src/lib/agents/finalEvaluator.ts：
   - 函数 evaluateSession(session: Session): Promise<{ overallScore: number; dimensions: Dimensions; criticalMoments: CriticalMoment[]; keyInsights: string[]; improvementSuggestions: string[] }>
   - 基于完整对话做最终评估。
   - LLM 输出 snake_case，解析后映射到 camelCase。
   - overallScore 取 dimensions 平均分。
   - criticalMoments 必须包含具体轮次和描述。

2. 更新 /api/finish：
   - 调用 FinalEvaluator。
   - 直接返回完整 championReplay（MVP 不严格按 criticalMoments 匹配轮次，降低实现复杂度）。
   - 返回 newMessages：
     - 一条 coachType='summary' 消息，包含 dimensions 和 criticalMoments。
     - 一条 coachType='champion_replay' 消息，包含 replayTurns。
   - sessionStatus = 'completed'。

3. 创建 src/lib/agents/championReplaySelector.ts（可选）：
   - 输入 criticalMoments，输出需要展示的 replayTurns（MVP 直接返回全部）。

4. 更新 sessionStore：把 session 状态改为 completed。

5. 可选：实现动态 champion replay 生成（如果时间允许）：用 LLM 根据 customerProfile 和 missed concerns 生成销冠回复。

验收标准：
1. 调用 /api/finish 返回 summary + champion_replay 两条 coach 消息。
2. summary 中包含 5 维评分和至少 2 个关键时刻。
3. champion_replay 中包含完整销冠轮次。
4. 给出 1 个完整对话测试用例，验证 finish 输出。
```

---

## Day 4：前端 —— 雷达图 + 销冠回放 + 结束流程

```
任务：在对话流内展示评分雷达图和销冠回放。

要求：
1. 安装 recharts。
2. 创建 components/MiniRadar.tsx：
   - 接收 Dimensions 对象，渲染 5 维雷达图。
   - 尺寸适配对话内嵌展示（宽度约 300px）。

3. 创建 components/CriticalTimeline.tsx：
   - 接收 CriticalMoment[]，按 turn 排序，显示时间轴。
   - missed_concern 用红色，good_probe 用绿色。

4. 创建 components/ReplayInline.tsx：
   - 接收 ReplayTurn[]，在 coach 消息内以卡片形式展示销冠对话。
   - 每条 replay 显示 BA 说的话、顾客回应、教练备注 note。

5. 更新 MessageBubble.tsx：
   - coachType === 'summary' 时，渲染 MiniRadar + CriticalTimeline。
   - coachType === 'champion_replay' 时，渲染 ReplayInline。

6. 更新 BAInput.tsx：
   - 添加“结束训练”按钮。
   - 点击后调用 finishSession()，后端返回 summary 和 replay。
   - 结束后禁用输入框。

7. 更新 sessionStore.finishSession()：
   - 调用 POST /api/finish。
   - 把返回的 newMessages 追加到 messages。
   - 设置 isLoading=false，session.status='completed'。

验收标准：
1. 点击“结束训练”后，对话流里出现带雷达图的 summary 卡片。
2. summary 下方出现销冠 replay 卡片。
3. 雷达图 5 个维度都显示正确。
4. 整个体验不跳出当前对话页面。
```

---

## Day 5：后端 —— 兜底 + 部署

```
任务：完善后端稳定性、错误处理和部署。

要求：
1. 添加 fallback 机制：
   - 在 src/lib/data/fallbackReplies.ts 中预置 5 条顾客回复和 3 条教练消息。
   - 当 LLM 调用超时（>8 秒）或 JSON 解析失败时，返回 fallback 回复。

2. 强化 Zod 校验：
   - 所有 API 路由都用 z.object 校验请求体。
   - 对 LLM 输出用 zod 再校验一次，失败时重试或 fallback。
   - 注意 LLM 输出字段为 snake_case，校验 schema 也用 snake_case，通过后再映射到 camelCase。

3. 添加日志：
   - 每次 LLM 调用记录 prompt、output、latency。
   - 可使用 console.log，或接入 Langfuse（可选）。

4. Prompt 最终调优：
   - 根据 Day 4 的测试结果，微调 CustomerSimulator、EvaluatorCoach、CoachEngine 的 prompt。
   - 确保 Demo 路径稳定：BA 跳过探询 → 追问；连续忽略顾虑 → 喊停。

5. 部署：
   - 配置 Vercel 环境变量：LLM_API_KEY、LLM_MODEL、LLM_BASE_URL（如需要）。
   - 执行 vercel --prod 部署。

验收标准：
1. LLM 失败时返回 fallback，不崩。
2. 部署后线上可访问。
3. 完整 Demo 路径（创建 → 对话 → 犯错 → 教练介入 → 结束 → 销冠对比）线上跑通。
```

---

## Day 5：前端 —— UI 打磨 + 部署

```
任务：打磨前端 UI，确保 Demo 稳定、好看、有 fallback。

要求：
1. UI 打磨：
   - 添加消息进入动画（fade + slide）。
   - 教练消息使用更醒目的颜色和图标（可用 lucide-react 图标）。
   - 输入框在底部固定，发送按钮明显。
   - 移动端适配良好。

2. 错误处理：
   - API 失败时显示友好提示，不白屏。
   - 添加“重新发送”按钮。

3. Fallback Demo 模式：
   - 如果线上 LLM 不稳定，准备一套硬编码的完整对话数据。
   - 添加一个环境变量或隐藏按钮，可切换到 fallback demo 模式。

4. 性能优化：
   - 消息列表大数据量时使用虚拟滚动（如果消息很多）。
   - 图片/图标按需加载。

5. 部署：
   - 配置 Vercel 项目，与后端同仓库一起部署。
   - 验证线上所有页面和 API 正常。

验收标准：
1. 线上 Demo 完整跑一遍无错。
2. 教练追问/喊停/对比三个主动行为都能稳定触发。
3. 移动端可用。
4. 有 fallback demo 模式预案。
```

---

## 使用建议

1. **Day 1 先跑后端 prompt**：创建项目和类型定义后，再跑前端 prompt。
2. **Day 2-5 前后端可并行**：只要 API 契约不变，两边互不阻塞。
3. **每天晚上联调**：前后端合并代码，跑一遍当天验收标准。
4. **Prompt 不是死的**：如果 AI 产出不对，把错误信息和预期行为补充进去，再发一次。

---

_整理日期：2026-07-11_
_对应文档：SheSells-AI销售教练-项目规划.md V3.0 / SheSells-技术详设.md V2.0_
