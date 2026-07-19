# SheSells —— 执行规划：方法论驱动的交付路线图

> 文档日期：2026-07-19
> 用途：将科学销售方法论映射到 Day 3-5 的具体代码/内容交付物
> 前提：Day 1-2 已完成 Data Model、API 契约、Customer Simulator、EvaluatorCoach Prompts、前端对话骨架

## 当前运行时基线（2026-07-19）

当前后端运行时是 Python FastAPI，动态画像相关实现和验证入口如下：

| 能力 | 当前文件 | 状态 |
|------|----------|------|
| 画像生成与标签校验 | `backend/app/api/routes.py`、`backend/app/prompts/templates.py` | 已接入 `/api/persona` |
| 动态顾客模拟 | `backend/app/agents/customer_simulator.py` | 已注入完整画像、状态和画像相关兜底 |
| 动态教练评估 | `backend/app/agents/evaluator_coach.py` | 已注入画像、顾虑、状态和历史；输出五维评分与四步依据，halt 时自检一次 |
| 阶段与里程碑 | `backend/app/api/routes.py` | 已按顾客回复收集关键信息，记录六项里程碑并限制推荐/促单推进 |
| 动态总结与销冠回放 | `backend/app/api/routes.py`、`backend/app/prompts/templates.py` | 已接入 `/api/finish`，支持真实顾客原话和动态兜底 |
| 前端回放 | `frontend/src/lib/backendApi.ts`、`frontend/app/persona/page.tsx` | 已映射 `customer_message`，创建训练失败可见提示 |
| 代表画像验收 | `backend/tests/test_routes.py` | 三组画像完整链路测试通过 |

`docs/technical/SheSells-prompts.ts` 是历史 TypeScript 参考，当前 Python 运行时不直接导入。KeyMomentDetector、销冠三段预设逐字稿和评分权重对齐继续保留为后续任务。

---

## 一、方法论→代码映射总览

### 1.1 方法论中哪些已落地、哪些需补强

| 方法论要点 | 当前 prompts.ts 状态 | Day 3-5 补强方向 |
|-----------|---------------------|-----------------|
| 科学销售五步法（用户分层→过程拆解→推进→激励→工具） | `EvaluatorCoach` 有 5 维度评分但权重未对齐方法论 | **对齐权重**：需求探询力 30%、共情倾听力 25%、产品匹配度 20%、异议处理力 15%、阶段完整度 10% |
| 销售过程拆解三步法（梳理决策→划分阶段→设计动作） | `SalesStateMachine` 已有 5 阶段（opening/probing/objection/recommending/closing） | **补里程碑判定标准**（6条）、每阶段强制退出条件 |
| 四大决策类型 | 未显式建模 | **加入 contact/purchase/payment/fulfillment 状态追踪** |
| 里程碑点 6 条判定标准 | 未实现 | **在状态机中加入 `stage_entry_conditions`** |
| 动力阻力触点框架 | 顾客模拟器有 trust/purchaseIntent/irritationFear | **补阻力信号列表**：价格顾虑、品牌疑虑、朋友意见等 |
| 教练原则（先认可再纠正、提供方向非答案、具体可执行、正向激励） | coach_decision 输出偏功能化 | **注入教练语调 prompt**：每次 coach 消息以正向肯定开头 |
| 销冠对比（FAB/讲人话/降低决策成本） | `ReplayTurn` 类型已定义但内容为空 | **编写 3 段场景化逐字稿**，每段带技巧标签 |
| 关键时刻（Key Moments）信号 | `CriticalMoment` 类型已定义（5 种） | **补 4 类信号检测逻辑**：购买/异议/信任/流失 |
| 50 激励策略（教练消息设计原则） | 未使用 | **在 coach 消息模板注入**：及时鼓励（策略39）、多赢小仗（策略2） |
| 8322 原则（定义动作标准） | 未使用 | **教练反馈必须有"怎么做"，不只给"做错了"** |

### 1.2 当前代码结构 → 补强地图

```
prompts.ts
├── CustomerSimulator     → Day 3 补：顾客阻力信号生成（价格/品牌/朋友意见）
├── EvaluatorCoach        → Day 3 补：权重对齐方法论、里程碑判定
│                           Day 4 补：CoT reasoning 输出（创新三）
├── 缺失: StageTransition  → Day 3 新增：阶段切换条件检查
├── 缺失: KeyMomentDetector → Day 3-4 新增：4 类信号检测
├── 缺失: ChampionReplay   → Day 4 新增：销冠预设逐字稿 prompt
├── 缺失: SummaryEvaluator → Day 4 新增：对话结束后 5 维评分+对比汇总
├── 缺失: CoachTone        → Day 4 新增：教练消息语气注入
├── 缺失: SelfChecker       → Day 4 新增：教练消息自检回环（创新一）
└── 缺失: ErrorPatternTracker → Day 4 新增：错误模式追踪+策略升级（创新二）
```

---

## 二、Day 3：评估引擎补强 + AI 创新落地（后端为主）

**目标**：端到端跑通对话 → 评分，评分规则对齐方法论。**同步落地 AI 创新点**（详见 `SheSells-AI创新设计.md`）。

### 2.0 AI 创新总览（Day 3-4 嵌入，详见独立文档）

| 创新 | 技术标签 | 实现成本 | 嵌入 Day |
|------|---------|:--:|:--:|
| **创新一：教练消息自检回环** | Lightweight Harness Loop | 1 次额外 LLM 调用 | Day 4 |
| **创新二：动态教练策略升级** | Adaptive Coaching / Error Pattern Tracking | 50 行规则代码 | Day 3-4 |
| **创新三：评估推理链可见化** | CoT Evaluation / Explainable AI | 纯 prompt 改造 | Day 3 |

> ⚠️ 如果时间只够做一个 AI 创新：**优先做创新二**（动态策略升级），Demo 现场可见性最强。

### 2.1 权重对齐 → 修改 EvaluatorCoach Prompt

将 5 维度名称和权重对齐方法论：

| 代码维度 | 方法论维度 | 权重 | 说明 |
|---------|----------|:---:|------|
| `listening` | **需求探询力** | 30% | BA 是否主动了解肤质、在用什么、预算、顾虑 |
| `warmth` | **共情倾听力** | 25% | 是否识别情感信号、是否先共情再介绍产品 |
| `recommendation` | **产品匹配度** | 20% | 推荐是否基于探询结果、是否讲人话、是否匹配肤质 |
| `objection_handling` | **异议处理力** | 15% | 顾客表达顾虑时是否正确回应而非跳过 |
| `professionalism` | **阶段完整度** | 10% | 是否按正确顺序推进、是否跳过关键阶段 |

> 注意：代码中原有的 `professionalism` 原本用于检测产品成分/护肤知识准确性，现改为检测**阶段完整性**。产品知识准确性并入 `recommendation` 的细分项。

**具体修改**：更新 `buildEvaluatorCoachPrompt` 中的评分维度说明部分。

### 2.2 里程碑判定标准注入 → 新增 StageTransition

新增 `stageTransitionRules` 常量，定义每个阶段的强制退出条件：

```typescript
const STAGE_TRANSITION_RULES = {
  opening: {
    nextStage: 'probing',
    entryConditions: ['顾客愿意继续对话', 'BA 已打招呼/建立联系'],
    exitConditions: ['BA 已建立基本沟通关系'],
    maxTurns: 3
  },
  probing: {
    nextStage: 'objection',
    entryConditions: ['顾客已说出至少 1 条关键信息'],
    exitConditions: ['BA 已收集：肤质 + 在用什么 + 主要顾虑'],
    maxTurns: 5
  },
  // ... 以此类推
};
```

**里程碑判定 6 条（从方法论映射到代码判断逻辑）**：

| 编号 | 判定标准 | 代码检测逻辑 |
|------|---------|------------|
| 1 | 从陌生到有联系 | `customerState.trust > 30` |
| 2 | 确认关键信息 | `customerState.collectedInfo.length >= 3` |
| 3 | 投入时间多 | `baTurnCount >= 5` |
| 4 | 真正要花钱 | `customerState.purchaseIntent > 60` |
| 5 | 长远影响大 | 顾客提出过 `effect_fear` 类顾虑 |
| 6 | 牵涉其他人 | 顾客提到朋友/家人意见 |

### 2.3 阻力信号检测

在 `CustomerSimulator` prompt 中增加新顾虑类型：

| 顾虑 ID | 含义 | 示例 |
|---------|------|------|
| `afraid_of_irritation` | 怕刺痛/烂脸 | "我怕用了会刺痛" |
| `price_concern` | 价格顾虑 | "会不会太贵了" |
| `brand_doubt` | 品牌疑虑 | "这个牌子我没听过" |
| `effect_fear` | 担心没效果 | "万一没效果怎么办" |
| `previous_bad_exp` | 之前差体验 | "之前用过类似的过敏了" |
| `friend_opinion` | 朋友的看法 | "我得问问我朋友" |

顾虑 ID 列表：`IRRITATION, PRICE, BRAND, EFFECT, PREV_BAD, FRIEND_OPINION`

### 2.4 创新三嵌入：EvaluatorCoach 输出 CoT reasoning

修改 `buildEvaluatorCoachPrompt` 中的 `dimensions` 输出 schema——从数字改为 `{ score, reasoning }` 对象：

```
reasoning 必须包含四步（每步一句话）：
1. 【观察】：BA 本轮在这个维度做了什么（或没做什么）
2. 【对比】：与当前阶段的预期相比差距在哪
3. 【原因】：为什么这导致了这个分数
4. 【标杆】：在这个维度上，好的做法是什么样
```

**前端配合**：雷达图 hover 时显示 reasoning tooltip。
详见 `SheSells-AI创新设计.md` 第四章。

---

## 三、Day 3-4：教练主动行为完善

### 3.1 追问触发器（ProbeTrigger）→ 精确化 3 条规则

当前 `EvaluatorCoach` prompt 中有基础规则，需精确化：

| 规则 | 方法论来源 | 检测逻辑 | 消息模板 |
|------|----------|---------|---------|
| R1: 跳过探询 | "不拆销售过程" | `currentStage === 'probing' && collectedInfo.length < 2 && baMessage 含推荐意图` | "等等，你还没了解她的皮肤状况，先问问她现在在用什么？" |
| R2: 回复过简 | "做足动作加法" | `baMessage.length < 20 && !baMessage.includes('?')` | "你再想想，她刚说怕刺痛，你觉得她真正担心的是什么？" |
| R3: 未追问信号 | "用户卖点分层" | `lastCustomerMessage 含顾虑信号 && baMessage 未提及该信号` | "她刚提到了{信号关键词}，这是一个重要的信息，你该追问一下" |

### 3.2 喊停触发器（HaltTrigger）→ 精确化 3 条规则

| 规则 | 方法论来源 | 检测逻辑 | 消息模板 |
|------|----------|---------|---------|
| S1: 连续忽略顾虑 | "里程碑点监控" | `连续 2 轮 missed_concerns 非空` | 见下方完整模板 |
| S2: 跳过关键阶段 | "划分销售阶段" | `currentStage 比应有阶段超前 >= 2` | "停——你跳过了需求探询和产品匹配，直接推荐是不对的。先了解她的肤质。" |
| S3: 错误回应 | "动力阻力触点" | `baMessage 含否定词('没事的'/'不会的') && 顾客有顾虑` | "注意——你说'没事的'等于在否定她的感受。正确的做法是先认可：'你说的对，敏感肌确实要小心'，再解释为什么适合。" |

### 3.3 教练消息注入"先认可再纠正"原则

在 EvaluatorCoach prompt 中增加：

```
【教练说话原则】（源自 50 激励策略）
每条教练消息必须遵循：
1. 先认可再纠正：先说 BA 哪里做得好，再指出不足
2. 提供方向而非答案：给思考方向，不给标准答案
3. 具体可执行：说清楚"怎么做"而不是"做得不对"
4. 正向激励：阶段完成时给出正向反馈（"你刚才帮顾客正确确认了肤质，很好"）
```

### 3.4 创新二嵌入：ErrorPatternTracker（错误模式追踪+策略升级）

在 Session 中新增 `errorPatternHistory` 字段，追踪 BA 重复犯错模式：

```
错误模式：skipped_probing / ignored_concerns / shallow_reply / negative_response / hard_push

升级策略：
  第1次 → probe（温和追问）
  第2次 → halt（喊停，requiresAction: true）
  第3次+ → halt + champion_preview（喊停并当场播放销冠对比）
```

实现代码见 `SheSells-AI创新设计.md` 第三章。

### 3.5 创新一嵌入：SelfChecker（教练消息自检回环）

在 EvaluatorCoach 输出后增加一次 SelfChecker LLM 调用，检查标准：
- 是否遵循"先认可再纠正"原则
- 是否具体可执行
- 语气像教练而非考官

不合格的消息自动改写一次（最多1次回环，防止死循环）。

实现代码见 `SheSells-AI创新设计.md` 第二章。

---

## 四、Day 4：销冠对比实现

### 4.1 3 段销冠预设回复（在对话流中播放）

针对 Demo 场景（敏感肌顾客试早C晚A），编写 3 段销冠版逐字稿：

#### 对比段 1：探询时刻（第 2-3 轮）

```
顾客："我想试试早C晚A，但我皮肤敏感，怕翻车——"

❌ 普通 BA（跳过探询）：
"那我推荐你试试这款精华，它里面有舒缓成分。"

✅ 销冠 BA（先探询再推荐）：
"理解！早C晚A确实效果好，但敏感肌一定要小心。你先跟我说说——
你平时皮肤容易泛红吗？换季的时候会不会刺痒？之前用过 A 醇或其他酸类吗？"

技巧标签：#先共情 #三连问收集信息 #降低决策成本
```

#### 对比段 2：异议时刻（第 4-5 轮）

```
顾客："可是上次我朋友推荐了一个 A 醇精华，我用了一次脸就红了，一个礼拜才好。"

❌ 普通 BA（否定/忽视）：
"那个牌子不好的，我们这个很温和，不会红的。"

✅ 销冠 BA（先认同再给方案）：
"天哪，那个体验太糟糕了，我能理解为什么你这么小心。
其实很多敏感肌第一次接触 A 醇都会出现这样的问题——
因为用错了方法和浓度。
我们可以这样做：先从 0.1% 最低浓度开始，一周只涂一次，
用修护霜打底降低刺激，建立耐受大概需要三到四周。
三周后你基本就不会再有反应了。"

技巧标签：#双重共情（体验+原因） #给具体方案 #讲人话（不用"建立耐受"这种术语）
```

#### 对比段 3：促单时刻（最后 2 轮）

```
顾客："听起来好像可以试试，但我还是有点犹豫……"

❌ 普通 BA（硬推）：
"今天买有活动很划算的，明天就没有这个折扣了。"

✅ 销冠 BA（降低决策成本）：
"当然要谨慎，脸是自己的。
这样吧，我们有一个试用装，你可以免费带回家用三天。
如果三天后没有红肿刺痛，你再回来找我买正装，
那我就不只是卖东西给你——
我可以保证你回家用得安心。好吗？"

技巧标签：#降低决策成本 #先给再卖 #安全感说服 #关系而非交易
```

### 4.2 销冠对比代码实现

```typescript
const CHAMPION_REPLAYS = [
  {
    turn: 2,
    scenario: 'probe_skipped',
    baMessage: "那我推荐你试试这款精华，它里面有舒缓成分。",
    championMessage: "理解！早C晚A确实效果好，但敏感肌一定要小心...",
    skillTags: ['共情', '三连问', '降低决策成本'],
    gap: '跳过需求探询直接推荐'
  },
  {
    turn: 4,
    scenario: 'concern_ignored',
    baMessage: "那个牌子不好的，我们这个很温和，不会红的。",
    championMessage: "天哪，那个体验太糟糕了，我能理解为什么你这么小心...",
    skillTags: ['双重共情', '具体方案', '讲人话'],
    gap: '用否定回应顾客顾虑'
  },
  {
    turn: 6,
    scenario: 'hard_push',
    baMessage: "今天买有活动很划算的，明天就没有这个折扣了。",
    championMessage: "当然要谨慎，脸是自己的。这样吧...",
    skillTags: ['降低决策成本', '先给再卖', '安全感说服'],
    gap: '硬推而非降低决策成本'
  }
];
```

### 4.3 对比呈现方式

在 `SummaryEvaluator` prompt 中增加：

```
【销冠对比规则】
根据 BA 实际对话中的 missed_concerns 和关键失误，选择匹配的 Champion Replay。
在对话流中说：
"你刚才在第 {turn} 轮错过了一个关键信号，来看销冠怎么处理——"
然后播放：
  - 先回放 BA 的原话
  - 再展示销冠在同一时刻会怎么说
  - 标注技巧标签：为什么这句更有效
```

---

## 五、Day 4-5：5维评分细则与对话结束后总结

### 5.1 每维评分锚点（源自方法论）

| 维度 | 0-30 分 | 31-60 分 | 61-80 分 | 81-100 分 |
|------|---------|---------|---------|----------|
| **需求探询力** (30%) | BA 不提问，直接推荐 | 问了 1 个问题但不够深 | 问了肤质 + 在用产品 + 顾虑，3 个点 | 问了 4+ 点，包括护肤习惯和预算 |
| **共情倾听力** (25%) | 冷漠/忽视顾客情绪 | 有回应但较敷衍("哦这样") | 先共情再聊产品，语气自然 | 深度共情+关联自己的经验/其他顾客的故事 |
| **产品匹配度** (20%) | 乱推荐、不看肤质 | 推荐大致方向对但细节不对 | 明确说清为什么适合她的肤质 | 基于探询结果定制方案+讲人话+备选方案 |
| **异议处理力** (15%) | 否定("没事的") | 简单安抚但不给方案 | 共情+解释+给具体安全方案 | 共情+解释原理+给替代方案+建立信任 |
| **阶段完整度** (10%) | 跳过 2 个以上关键阶段 | 跳过 1 个阶段 | 按顺序推进，每阶段有收尾 | 每阶段有明确收尾动作+过渡到下一阶段 |

### 5.2 关键时刻标注（Key Moments）

对话结束后标注的关键时刻类型和示例：

| 类型 | 判别条件 | 对话示例 | 展示方式 |
|------|---------|---------|---------|
| `missed_concern` | 顾客表露顾虑但 BA 未回应 | "我怕刺痛" → BA 说别的 | 🔴 标注"错过" |
| `good_probe` | BA 主动问了关键问题 | "你之前用过 A 醇吗？" | 🟢 标注"做得好" |
| `objection_raised` | 顾客提出新异议 | "这个安全吗？" | 🟡 标注"顾客顾虑" |
| `buying_signal` | 顾客给出购买信号但 BA 未推进 | "听起来可以试试" | 🟡 标注"错过信号" |
| `premature_recommendation` | BA 未了解需求就推荐 | 顾客刚说完怕刺痛，BA 就推荐产品 | 🔴 标注"推荐过早" |

### 5.3 对话结束后 Summary Prompt

```typescript
export function buildSummaryPrompt(params: {
  conversationHistory: string;
  allDimensions: number[][];  // 每轮的 5 维评分
  missedConcernsLog: string[];
  criticalMomentsLog: CriticalMoment[];
}) {
  return `你是 SheSells 的总结教练。对话已结束，你需要：

1. **五维总评分**：综合所有轮次，计算加权总分
   权重：需求探询力 30%、共情倾听力 25%、产品匹配度 20%、异议处理力 15%、阶段完整度 10%

2. **关键时时刻标注**：回放 2-3 个最关键的时刻

3. **销冠对比**：每个错过的关键时刻，展示销冠会怎么说

4. **正向收尾**：先肯定 BA 做得好的点，再指出可提升点

【说话原则】
- 教练语调：像资深培训师，不是考官
- 先认可再纠正
- 要具体可执行
- 结尾给一句鼓励

输出格式：一段流畅的自然语言，直接渲染在对话流里。
不要用 JSON，直接输出文本。`;
}
```

---

## 六、Day 3-5 整合后的 roles 分工

| Day | A-前端 | B-后端 | C-内容 |
|-----|--------|--------|--------|
| **Day 3** | 教练高亮 + 迷你雷达图 UI + reasoning tooltip | ① 对齐 5 维权重 ② StageTransition ③ 阻力信号扩展 ④ **CoT reasoning 改造（创新三）** ⑤ 端到端跑通 | 顾客脚本定稿 + SKU 数据 + 商业 PPT 初稿 |
| **Day 4** | 主动喊停/追问的 UI 表现 + 销冠播放组件 | ① HaltTrigger 精确化 ② KeyMomentDetector ③ ChampionReplay Prompt ④ 教练语调注入 ⑤ **ErrorPatternTracker（创新二）** ⑥ **SelfChecker（创新一）** | 销冠 3 段逐字稿 + PPT 定稿 + Demo 话术排练 |
| **Day 5 上午** | 前端打磨 + 联调 | SummaryEvaluator + 完整流程调试 | Q&A 题库准备 |
| **Day 5 下午** | 完整 Demo 彩排 3 遍 | 修 bug + buffer | Q&A 模拟演练 |

---

## 七、风险清单（Day 3-5 特供）

| 风险 | 具体表现 | 对策 |
|------|---------|------|
| 评分不准 | LLM 对 5 维度的打分不一致 | **设置评分锚点**（见 5.1 节），用 few-shot 校准；同一轮打分允许 ±5 浮动 |
| 喊停太频繁 | 每轮都触发 probe 打断体验 | **设置冷却期**：同类型 probe 至少间隔 2 轮才再次触发 |
| 喊停不触发 | 顾客说了顾虑但 BA 确实没回应，agent 也没喊停 | **降低触发阈值**：从"连续 2 轮 missed_concerns"改为"1 轮 missed_concern + ba 回复 > 30 字" |
| 顾客模拟太呆 | 顾客回复模式化，评委会看出来 | Few-shot 示例从小红书/知乎护肤帖改写，每次随机选择 1 个范例 |
| 销冠对比太假 | 对比段和 BA 实际对话不匹配 | **不要实时生成销冠回复**，用 3 段预写好的逐字稿做匹配，安全 |
| 阶段状态机不准 | LLM 对 stage 判断不稳定 | 在代码层面加规则校验：前两轮不能是 closing、未收集 2+ info 不能进 recommending |
| 主动行为 UI 体验差 | 喊停/追问让评委会感觉被打断很烦 | **教练消息旁白式呈现**——不是弹出 modal，是在对话流中显示灰色引用块 + 输入框变灰 |
| 5 维雷达图渲染 | Recharts 迷你图在对话流里放不下 | **降级方案**：用纯文字"倾听 78 · 专业 70 · 推荐 60 · 异议 55 · 共情 72"替代雷达图 |
| SelfChecker 死循环 | 改写后仍不合格，无限回环 | **最多 1 次自检回环**，第 2 次不合格直接返回原始消息并标记 `selfChecked: false` |
| ErrorPattern 误判 | 不同轮次的不同错误被归为同一模式 | 模式匹配放宽，用 LLM 辅助判断"是否同一类错误"而非纯字符串匹配 |
| SelfChecker 增加延迟 | 额外 LLM 调用让每轮响应变慢 | probe/feedback 可跳过自检（低风险），仅 halt 时启用；评估阶段可异步 |

---

## 八、Day 5 Demo 最终检查清单

- [ ] 从 `POST /api/session` → `POST /api/chat` × N → `POST /api/finish` 全流程跑通
- [ ] 主动追问：跳过探询直接推荐时触发
- [ ] 主动喊停：连续 2 次忽略顾客顾虑时触发（含 `requiresAction: true` 确认按钮）
- [ ] 对话结束后：5 维评分 + 关键时刻标注 + 销冠对比自然呈现
- [ ] 教练消息遵循"先认可再纠正"原则
- [ ] **创新二**：同一错误犯第 2 次时升级为 halt，第 3 次时喊停+展示销冠对比
- [x] **创新一**：教练消息经过 SelfChecker 自检回环（halt 类型启用）
- [x] **创新三**：雷达图 hover 显示 reasoning tooltip
- [ ] 销冠 3 段对比在 Demo 中至少展示 1 段
- [ ] 翻车预案：LLM 异常 → 切预设脚本；评委不配合 → B 方案成员扮演 BA
- [ ] PPT 关键数字：BA 50 万+、年培训费 ¥3000-8000/人、订阅 ¥200-500/月

---

_整理日期：2026-07-19_
_对应项目规划 V3.0 Agent 方案_
