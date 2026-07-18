# SheSells —— AI 创新设计

> 文档日期：2026-07-13
> 用途：三个 Day 3-5 可实现的 AI 创新点，解决"技术壁垒偏弱"的评委质疑
> 创新方向：Agent 决策链而非模型层

---

## 一、为什么要做这三个创新

当前项目的 AI 技术栈（Multi-Agent + Structured Output + Few-shot）已经是 2024 年行业标配，竞品分析中列出的 20 个产品绝大部分也都有。

**这三个创新不在模型层，在 Agent 决策链**——让 LLM 的输出不是"说啥就是啥"，而是经过自检、自适应、可解释的决策过程。

| 创新 | 技术标签 | 实现成本 | Demo 可见性 |
|------|---------|:--:|:--:|
| 教练消息自检回环 | Lightweight Harness Loop / Self-Reflection | 1 次额外 LLM 调用 | 间接（消息质量提升） |
| 动态教练策略升级 | Adaptive Coaching / Error Pattern Tracking | 50 行规则代码 | **直接**（评委连犯错→反应升级） |
| 评估推理链可见化 | Chain-of-Thought Evaluation / Explainable AI | 纯 prompt 改造 | **直接**（雷达图 tooltip 显示推理） |

---

## 二、创新一：教练消息自检回环（SelfChecker）

### 2.1 问题

当前 EvaluatorCoach 生成教练消息后直接推给前端，没有质量控制。LLM 偶尔会产生：
- 不符合"先认可再纠正"原则的消息（直接批评）
- 过于空泛无法执行的建议（"你需要做得更好"）
- 语调不对的消息（像考官不像教练）

### 2.2 方案

在 EvaluatorCoach 输出后增加一次 SelfChecker LLM 调用：

```
EvaluatorCoach 生成 coach 消息
        │
        ▼
┌─────────────────────┐
│    SelfChecker       │
│                      │
│  检查标准：           │
│  ✓ adherence_rule    │  是否遵循"先认可再纠正"？
│  ✓ actionable        │  是否具体可执行？
│  ✓ tone              │  语气像教练而非考官？
│  ✓ length            │  长度是否合理？
│                      │
│  不合格 → 改写建议    │
│  合格   → 放行       │
└────────┬────────────┘
         │
    ┌────┴────┐
    │         │
  合格      不合格
    │         │
    │    ┌────▼────┐
    │    │ 自动改写  │ ← 带改写建议重新生成
    │    └────┬────┘
    │         │
    │    再检查一次
    │    （最多1次自检回环）
    │         │
    └────┬────┘
         │
         ▼
    返回给前端
```

**自检回环最多执行 1 次**（防止死循环），1 次改写后仍不合格则直接返回原始消息并标记 `selfChecked: false`。

### 2.3 SelfChecker Prompt

```typescript
export function buildSelfCheckerPrompt(params: {
  coachMessage: string;
  coachType: 'probe' | 'halt' | 'feedback';
  baMessage: string;
  customerMessage: string;
}): string {
  return `你是一个教练消息质量检查器。检查以下教练消息是否符合 SheSells 的教练标准。

【教练消息】
${params.coachMessage}

【对应的BA回复】
${params.baMessage}

【上一轮顾客消息】
${params.customerMessage}

【检查标准】
1. adherence_rule（遵循教练原则）：
   - 是否先认可了BA做得好的地方，再指出不足？
   - probe/feedback 必须包含正向肯定。
   - halt 不能是纯粹批评，必须包含"怎么做"的指导。

2. actionable（具体可执行）：
   - 是否说清楚了"怎么做"而不是只说了"做错了"？
   - 是否给出了具体的行动方向？
   - 反例："你需要更好地共情"（不可执行）
   - 正例："下次她说怕刺痛，你可以先说'我理解你的担心'，再问具体哪里刺痛"（可执行）

3. tone（教练语调）：
   - 是否像经验丰富的前辈在带新人，而非考官在打分？
   - 是否温暖、专业、不给压力？
   - 反例："你这里完全错了"
   - 正例："你问了她的顾虑，这很好。不过回应方式可以改进——"

4. length（长度）：
   - probe：20-80字
   - halt：50-200字
   - feedback：15-60字

输出严格 JSON：
{
  "pass": true/false,
  "checks": {
    "adherence_rule": true/false,
    "actionable": true/false,
    "tone": true/false,
    "length": true/false
  },
  "fail_reason": "如果不通过，简述原因",
  "rewritten": "如果不通过，给出改写后的完整消息"
}`;
}
```

### 2.4 伪代码

```typescript
async function selfCheckCoachMessage(
  coachDecision: CoachDecision,
  context: { baMessage: string; customerMessage: string }
): Promise<CoachDecision> {
  // 只在 probe / halt / feedback 类型时自检
  if (!['probe', 'halt', 'feedback'].includes(coachDecision.type)) {
    return coachDecision;
  }

  const checkResult = await llmCall(buildSelfCheckerPrompt({
    coachMessage: coachDecision.content,
    coachType: coachDecision.type,
    ...context
  }));

  if (checkResult.pass) {
    return { ...coachDecision, selfChecked: true };
  }

  // 一次改写回环
  return {
    ...coachDecision,
    content: checkResult.rewritten,
    selfChecked: true,
    originalContent: coachDecision.content // 保留原始版本供调优
  };
}
```

### 2.5 创新点总结

- **技术标签**: Lightweight Harness Loop / Agent Self-Reflection
- **差异化**: 竞品的教练消息是 LLM 直接输出；SheSells 多了一层质量检查回环
- **答辩说法**: "我们在 LLM 输出后加入了一个自检 Agent，它用教练原则作为评判标准，不合格的消息自动改写。这就是 harness loop 在销售教练场景的轻量落地。"

---

## 三、创新二：动态教练策略升级（ErrorPatternTracker）

### 3.1 问题

当前教练引擎"每轮独立判断"——BA 连续多次犯同一类错误，Agent 的回应强度始终不变。这不符合真实教练的行为：好教练在学员反复犯同一个错误时，反应会从温和提示升级到直接喊停。

### 3.2 方案

在 Session 中增加 `errorPatternHistory` 追踪 BA 的错误模式，根据重复次数自动升级教练策略：

```
错误模式定义：
  'skipped_probing'      → 跳过探询直接推荐
  'ignored_concerns'      → 忽略顾客顾虑
  'shallow_reply'         → 回复过于简略
  'negative_response'     → 用否定回应顾客（"没事的"）
  'hard_push'             → 强行推销

升级策略表：
┌────────────┬──────────┬──────────┬──────────────┐
│ 同一模式    │ 第1次    │ 第2次    │ 第3次+       │
│ 出现次数    │          │          │              │
├────────────┼──────────┼──────────┼──────────────┤
│ 教练反应    │ probe    │ halt     │ halt +       │
│            │ (温和)   │ (喊停)   │ champion     │
│            │          │          │ preview      │
│            │          │          │ (当场展示    │
│            │          │          │  销冠做法)   │
├────────────┼──────────┼──────────┼──────────────┤
│ requires   │ false    │ true     │ true         │
│ Action     │          │ (需确认) │ (需确认)     │
└────────────┴──────────┴──────────┴──────────────┘
```

### 3.3 数据结构

```typescript
interface ErrorPatternEntry {
  pattern: ErrorPattern;
  turn: number;
  context: string; // 简短的上下文描述
}

type ErrorPattern =
  | 'skipped_probing'
  | 'ignored_concerns'
  | 'shallow_reply'
  | 'negative_response'
  | 'hard_push';

// 在 Session 中新增字段
interface Session {
  // ... 原有字段
  errorPatternHistory: ErrorPatternEntry[];
}
```

### 3.4 升级规则代码

```typescript
function getEscalatedCoachAction(
  pattern: ErrorPattern,
  count: number,
  session: Session
): { type: CoachType; strategy: string; requiresAction: boolean } {
  if (count === 1) {
    // 第一次：温和追问
    return {
      type: 'probe',
      strategy: 'standard',
      requiresAction: false
    };
  }

  if (count === 2) {
    // 第二次：直接喊停
    return {
      type: 'halt',
      strategy: 'direct',
      requiresAction: true
    };
  }

  // 第三次及以上：喊停 + 当场展示销冠做法
  return {
    type: 'halt',
    strategy: 'with_champion_preview',
    requiresAction: true
    // coach消息中会嵌入销冠对比片段
  };
}

function detectErrorPattern(
  coachDecision: CoachDecision,
  baMessage: string
): ErrorPattern | null {
  if (coachDecision.type === 'probe' && coachDecision.reason?.includes('skip')) {
    return 'skipped_probing';
  }
  if (coachDecision.type === 'halt' && coachDecision.reason?.includes('concern')) {
    return 'ignored_concerns';
  }
  if (coachDecision.type === 'probe' && coachDecision.reason?.includes('short')) {
    return 'shallow_reply';
  }
  if (coachDecision.type === 'halt' && /没事的|不会的|别担心/.test(baMessage)) {
    return 'negative_response';
  }
  if (coachDecision.type === 'feedback' && /硬推|推销|逼单/.test(coachDecision.content)) {
    return 'hard_push';
  }
  return null;
}
```

### 3.5 升级时教练消息的变化

| 次数 | 模式: ignored_concerns | 消息示例 |
|:--:|------|------|
| 第1次 | probe | "她提到了怕刺痛——这是个重要信号，下次试着先共情再回答。" |
| 第2次 | halt | "停一下——她说了 2 次怕刺痛，你都没接住。试试先共情：'我理解，敏感肌确实要小心'，再给方案。" |
| 第3次 | halt + champion_preview | "停。这是你第 3 次在顾客表达顾虑时直接跳过了。来看销冠怎么处理同一种情况——[播放对比] 注意销冠做的第一步永远是先共情，而不是先解释产品。" |

### 3.6 创新点总结

- **技术标签**: Adaptive Coaching / Error Pattern Tracking / Progressive Intervention
- **差异化**: 竞品的教练反馈是"每轮独立"的；SheSells 跨轮次追踪错误模式，自动升级干预强度，模拟真实教练的因材施教
- **Demo 炸点**: 评委如果连续犯同样的错，Agent 的反应会从温柔追问变成直接喊停+播销冠对比——现场从"温和提示"到"严厉喊停"的递进感，是其他竞品做不到的
- **答辩说法**: "我们的 Agent 不是每轮独立判断——它跨轮次追踪 BA 的犯错模式。同一个错误犯到第三次，教练策略自动从温和追问升级到直接喊停并当场展示销冠做法。这是自适应教学，不是固定规则引擎。"

---

## 四、创新三：评估推理链可见化（CoT Evaluation）

### 4.1 问题

当前评分只返回数字（`listening: 40`），BA 不知道"为什么是 40 分"。黑盒评分的公信力低，评委也会质疑"分数是不是随便打的"。

### 4.2 方案

让 EvaluatorCoach 为每个维度的评分附带一条 LLM 生成的推理链，包含：
1. **观察**: BA 本轮做了什么
2. **对比**: 与阶段预期的差距
3. **原因**: 为什么导致这个分数
4. **标杆**: 好的做法应该是什么

### 4.3 输出 Schema 改造

原来的 EvaluatorCoach 输出：
```json
{
  "dimensions": {
    "listening": 40,
    "warmth": 50,
    "recommendation": 30,
    "objection_handling": 20,
    "professionalism": 50
  }
}
```

改造后：
```json
{
  "dimensions": {
    "listening": {
      "score": 40,
      "reasoning": "【观察】BA 未提问任何关于肤质、使用史的问题，直接进入推荐。【对比】当前处于 probing 阶段，应收集肤质+使用史+顾虑至少3条信息，实际收集为0。【标杆】此时应先问'你平时皮肤容易泛红吗？之前用过A醇吗？'"
    },
    "warmth": {
      "score": 35,
      "reasoning": "【观察】对顾客'怕翻车'的情绪未做任何情感回应。【对比】顾客表达了明确的担忧，BA 的'没事的'属于否定式安抚。【标杆】'理解你的担心，敏感肌确实要小心。不过我们可以用最低浓度开始，不是所有A醇都会刺激。'"
    },
    "objection_handling": {
      "score": 20,
      "reasoning": "【观察】顾客两轮前已表达刺痛顾虑，本轮 BA 仍未回应。【对比】连续2轮 missed_concerns。【标杆】先共情顾虑，再给出具体安全方案（如低浓度+修护霜打底+逐步建立耐受）。"
    }
  }
}
```

### 4.4 EvaluatorCoach Prompt 改造

在 `buildEvaluatorCoachPrompt` 的输出格式部分，将 `dimensions` 改为嵌套对象：

```
【评分维度】（0-100 分）
每个维度需输出 score 和 reasoning：

reasoning 必须包含以下四步（每步一句话）：
1. 【观察】：BA 本轮在这个维度做了什么（或没做什么）
2. 【对比】：与当前阶段的预期相比差距在哪
3. 【原因】：为什么这导致了这个分数
4. 【标杆】：在这个维度上，好的做法是什么样

【输出格式】
{
  "dimensions": {
    "listening": {
      "score": 40,
      "reasoning": "【观察】BA 未收集顾客肤质信息就直接推荐。【对比】probing阶段预期收集≥3条关键信息。【原因】缺少需求信息导致推荐缺乏依据。【标杆】先问'你平时皮肤容易泛红吗？之前用过A醇吗？'"
    },
    ...
  }
}
```

**注意保持兼容**：summary 的 `Dimensions` 类型保留简单的 `number` 映射，用于雷达图渲染。`reasoning` 仅在维度评分展示 tooltip 时使用。

### 4.5 前端配合

雷达图上每个维度点 hover 时显示 reasoning tooltip（见`前端阅读指南.md`第八章新增）。

### 4.6 创新点总结

- **技术标签**: Chain-of-Thought Evaluation / Explainable AI / Transparent Scoring
- **差异化**: 大部分竞品的评分是黑盒数字；SheSells 的每个分数都带 LLM 实时生成的"观察→对比→原因→标杆"推理链
- **评委体验**: 不仅看到 40 分，还看到"为什么是 40 分，好的是什么样"
- **答辩说法**: "我们的评估不是黑盒。每个评分维度都附带 LLM 生成的推理链——观察、对比、原因、标杆四步。BA 看到的不仅是分数，更是'为什么低'和'怎么变高'。这是评估透明化，也是教练教学的一部分。"

---

## 五、三个创新整合后的 Agent Core 架构

```
┌─────────────────────────────────────────────────────────┐
│                   Agent Core（TypeScript）                │
│                                                          │
│  每次 BA 消息后的处理流程：                               │
│                                                          │
│  1. CustomerSimulator ──→ 顾客回复（无变化）              │
│                                                          │
│  2. EvaluatorCoach ──→ 评估+教练决策+推理链               │
│     │  输出：dimensions(含reasoning), coachDecision       │
│     │                                                    │
│     ├──→ 3. ErrorPatternTracker（创新二）                 │
│     │    输入：coachDecision, 历史 errorPatternHistory    │
│     │    输出：升级后的 coachDecision（probe→halt→对比）   │
│     │                                                    │
│     └──→ 4. SelfChecker（创新一）                        │
│          输入：coachDecision, BA消息, 顾客消息              │
│          输出：通过或改写后的 coachDecision                │
│          自检回环：不合格→改写→再检查（最多1次）           │
│                                                          │
│  5. SalesStateMachine ──→ 阶段切换（无变化）              │
│                                                          │
│  6. 返回 newMessages                                     │
│     · customer 消息（如有）                               │
│     · coach 消息（含 reasoning） ← 前端雷达图展示（创新三）│
│                                                          │
│  新增模块:                                               │
│  ├─ SelfChecker：教练消息自检回环                         │
│  ├─ ErrorPatternTracker：错误模式追踪+策略升级            │
│  └─ EvaluatorCoach（改造）：输出含 CoT reasoning          │
└─────────────────────────────────────────────────────────┘
```

---

## 六、实现优先级与工时估算

| 优先级 | 创新点 | 后端工时 | 前端工时 | 理由 |
|:--:|------|:--:|:--:|------|
| **P0** | 创新二：动态策略升级 | 1h | 0 | **Demo 现场可见性最强**——评委连犯错→反应升级→冲击力 |
| **P1** | 创新一：自检回环 | 1.5h | 0 | 技术标签最强（harness loop），答辩价值高 |
| **P2** | 创新三：推理链可见化 | 0.5h | 0.5h | 最省事，纯 prompt 改+前端 tooltip；但 Demo 中评委不一定会 hover 雷达图 |

**如果时间只够做一个：做创新二。**

---

## 七、答辩话术整合

如果三个都做了：

> "我们的 AI 创新不在模型层，在教练决策链。
>
> **第一**，教练消息不是 LLM 直接输出的——它过了一遍自检回环：用教练原则作为评判标准，检查是否'先认可再纠正'、是否具体可执行。不合格就自动改写。这是 lightweight harness loop 在垂直场景的落地。
>
> **第二**，Agent 跨轮次追踪 BA 的犯错模式。同一个错误犯到第三次，教练策略从温和追问自动升级到直接喊停并当场展示销冠做法。这是自适应教学，不是固定规则。
>
> **第三**，评分不是黑盒。每项评分都带 LLM 实时生成的推理链——'观察→对比→原因→标杆'，BA 看到的不仅是 40 分，还有为什么是 40 分，以及好的标杆是什么样的。"

---

_整理日期：2026-07-13_
_对应执行规划 Day 3 新增任务_
