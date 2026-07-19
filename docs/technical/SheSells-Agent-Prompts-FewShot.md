# SheSells —— Agent Prompt Few-Shot 设计说明

> 对应代码文件：`prompts.ts`
> 目标：让 LLM 输出更稳定、更符合预期，尤其是约束复杂的结构化 JSON。
>
> 命名约定（与技术评审对齐）：
> - TypeScript 代码中的类型、变量统一使用 camelCase。
> - LLM 输出的 JSON 统一使用 snake_case，后端解析时做 key-mapping 到 camelCase TS 类型。
> - CustomerSimulator 输出需包含 `state_delta`、`addressed_concerns`、`collected_info`、`new_concern`、`buying_signal`。

---

## 为什么需要 Few-Shot

在黑客松场景下，我们没有时间 fine-tune 模型。Few-shot 是最快让 LLM 理解"我想要什么格式、什么风格、什么判断标准"的方法。

每个核心 Agent 的 prompt 都包含：
1. **角色设定**：告诉 LLM 它是谁。
2. **任务说明**：告诉它要做什么。
3. **输出格式**：强制 JSON schema。
4. **Few-shot 示例**：用 2-4 个例子展示边界 case 的正确输出。

---

## 1. CustomerSimulator（顾客模拟器）

### 设计要点

- 顾客不是随机回复，而是有**稳定人设**：敏感肌、犹豫、怕刺痛。
- 回复要影响**隐状态**（trust / purchase_intent / irritation_fear）。
- 同时输出 `addressed_concerns` 和 `collected_info`，让后端知道本轮后哪些顾虑已被回应、哪些信息已被收集。
- 不能过早购买，也不能永远不推进。

### Few-Shot 覆盖的边界

| 示例 | BA 行为 | 期望顾客反应 |
|------|---------|--------------|
| 示例 1 | 忽略顾虑、推销打折 | 犹豫、重复刺痛顾虑、信任下降 |
| 示例 2 | 主动探询使用史 | 愿意回答、信任小幅上升 |
| 示例 3 | 共情 + 安全方案 | 购买意愿上升、出现 buying_signal |

### 使用时代码示例

```typescript
import { buildCustomerSimulatorPrompt, formatConversationHistory } from './prompts';

const prompt = buildCustomerSimulatorPrompt({
  customerProfile: '25岁敏感肌女性，想尝试早C晚A...',
  trust: 30,
  purchaseIntent: 20,
  irritationFear: 80,
  addressedConcerns: [],
  collectedInfo: [],
  currentStage: 'opening',
  conversationHistory: formatConversationHistory(messages),
  baMessage: '你好，欢迎光临。'
});

const result = await callLLMJSON(prompt);
// result 为 snake_case JSON，解析后映射到 camelCase TS 类型
```

---

## 2. Evaluator（单轮评估器）

### 设计要点

- 评估要**可解释**，不是黑盒打分。
- 必须识别 `missed_concerns`，这是 CoachEngine 触发的基础。
- 评分维度要**与销售阶段目标绑定**。

### Few-Shot 覆盖的边界

| 示例 | 场景 | 期望评分 |
|------|------|----------|
| 示例 1 | BA 跳过探询直接推荐 | 推荐力/异议处理低，missed_concerns 非空 |
| 示例 2 | BA 主动收集信息 | 倾听力高，目标达成 |
| 示例 3 | BA 共情后给方案 | 异议处理/温度感高 |

### 关键设计

`missed_concerns` 是 CoachEngine 判断"是否喊停"的核心信号。

连续两轮出现 `missed_concerns` → 触发 halt。
阶段目标未达成但 BA 开始推荐 → 触发 probe。

---

## 3. EvaluatorCoach（评估 + 教练决策合并）

### 设计要点

- 技术评审推荐把 Evaluator 与 CoachEngine 合并为一次 LLM 调用，减少每轮 LLM 调用次数。
- 输出同时包含 5 维评分、`missed_concerns` 和 `coach_decision`。
- `coach_decision.type` 可选：probe / halt / feedback / none。

### Few-Shot 覆盖的边界

| 示例 | 场景 | 期望输出 |
|------|------|----------|
| 示例 1 | BA 跳过探询直接推荐 | missed_concerns 非空，coach_decision.type = probe |
| 示例 2 | BA 连续忽略顾虑 | missed_concerns 连续非空，coach_decision.type = halt，requires_action = true |
| 示例 3 | BA 正常回应 | missed_concerns 空，coach_decision.type = none |

---

## 4. CoachEngine（教练消息生成器）

### 设计要点

- 语气是**教练**，不是客服，更不是批评。
- 不同类型的教练消息有不同的功能：
  - **probe**：引导 BA 自己发现问题。
  - **halt**：坚定打断，要求改变策略。
  - **feedback**：即时正向/负向反馈。
  - **summary**：对话结束后的总体复盘。

### Few-Shot 覆盖的边界

| 类型 | 触发原因 | 消息特征 |
|------|----------|----------|
| probe | BA 跳过必要探询 | "等等，你还没了解..." |
| halt | 连续忽略顾虑 | "停一下——她说了两次..." |
| feedback | BA 做对/做错某一点 | 简短表扬或纠正 |
| summary | 对话结束 | 总体评价 + 关键时刻 |

### 关键设计

- `requires_action` 只在 `halt` 时为 true，前端据此暂停输入。
- 消息控制在 100 字以内，避免打断 Demo 节奏。

---

## 5. FinalEvaluator（最终评估器）

### 设计要点

- 基于完整对话做**全局评估**。
- 输出包括：总分、5 维评分、关键时刻、洞察、建议。
- 关键时刻用于从 champion replay 中提取对应轮次（MVP 可直接返回完整 replay）。

### Few-Shot 覆盖的边界

示例展示了一段"先犯错、后纠正"的对话，期望输出：
- 前期 missed_concern 被识别。
- 后期 good_probe 被表扬。
- 改进建议具体可执行。

---

## Prompt 调优建议

### 1. 先用规则兜底，再用 LLM 增强

MVP 阶段：
- `missed_concerns` 的触发可以用规则（关键词匹配）兜底。
- LLM 用于生成更自然的 coach 消息和顾客回复。

### 2. 准备测试集

准备 5 段标准对话：
- 1 段正确探询
- 1 段跳过探询直接推荐
- 1 段连续忽略顾虑
- 1 段成功处理顾虑
- 1 段完整对话

每改一次 prompt，都跑一遍测试集，看输出是否稳定。

### 3. 控制 prompt 长度

Few-shot 示例越多，模型越稳定，但 token 越贵、延迟越高。

建议：
- 每个 Agent 2-3 个示例。
- 如果线上延迟过高，可以只保留 1 个示例，其余用规则兜底。

### 4. 使用 JSON mode + Zod 校验

```typescript
import { z } from 'zod';

const CustomerSimulatorOutputSchema = z.object({
  reply: z.string(),
  state_delta: z.object({
    trust: z.number(),
    purchase_intent: z.number(),
    irritation_fear: z.number()
  }),
  addressed_concerns: z.array(z.string()),
  collected_info: z.array(z.string()),
  new_concern: z.string().nullable(),
  buying_signal: z.boolean()
});

const raw = await callLLMJSON(prompt);
const result = CustomerSimulatorOutputSchema.parse(raw);
// 再把 snake_case 字段映射为 camelCase TS 类型
```

### 5. 记录每次调用

用 Langfuse 或 console.log 记录：
- prompt
- 输出
- 耗时
- 是否解析成功

方便快速定位哪类输入容易让 LLM 翻车。

---

## 文件对应关系

| 说明文档 | 代码文件 |
|----------|----------|
| 本文档 | `SheSells-Agent-Prompts-FewShot.md` |
| 可直接导入的 prompt 函数 | `prompts.ts` |

---

_整理日期：2026-07-19_
_对应项目：SheSells —— AI 销售教练 Agent_
