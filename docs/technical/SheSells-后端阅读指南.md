# SheSells —— 后端文档阅读指南

> 写给后端开发：时间紧，这篇告诉你 10 个文件先看哪个、哪个可以跳过、遇到问题查哪个。
> 写于 2026-07-13

---

## 一、文件分类一览

```
📦 shesells/
│
├── 🔴 必须精读（3份）── 决定你做出来的东西对不对
├── 🟡 写代码时参考（4份）── 具体怎么写的答案
├── 🟢 商业/Pitch用（3份）── 后端基本不用看
└── ⚪ 已过时/AI生成代码用（1份）── 可以忽略
```

---

## 二、阅读顺序（按优先级）

### 第一优先：先花 15 分钟搞懂"我们要做什么"

| 顺序 | 文件 | 重点读哪些部分 | 时间 |
|:--:|------|--------------|:--:|
| **1** | `SheSells-技术详设.md` | **全文**，这是你的施工图纸 | 10min |
| **2** | `SheSells-AI销售教练-项目规划.md` | 第四、五章（Demo 聚焦 + 技术架构），第六章（5天计划），其余可扫读 | 5min |

**为什么这两个最先看：**
- 技术详设 = 所有 API 接口、数据模型、Agent Core 架构的定义。你写的每一行代码都对应这里。
- 项目规划 = 产品总纲，让你知道"为什么这么设计"，遇到模棱两可的时候回来查。

### 第二优先：写代码时打开放在旁边

| 顺序 | 文件 | 用途 | 何时用 |
|:--:|------|------|------|
| **3** | `prompts.ts` | 直接 import 的 prompt 构建函数 | **写 EvaluatorCoach 和 CustomerSimulator 时直接 import** |
| **4** | `SheSells-AI创新设计.md` | **三个 AI 创新的完整实现方案**：SelfChecker / ErrorPatternTracker / CoT Evaluation | **Day 3-4 实现创新点时必须看** |
| **5** | `SheSells-执行规划.md` | Day 3-5 具体要做哪些代码改动 | **Day 3 开始动手前看一遍** |
| **6** | `SheSells-教练消息库.md` | 教练消息模板，写 prompt 里的 few-shot 时照抄 | **调 prompt 调不出来时查** |

### 第三优先：可跳过，但商业/Pitch 需要

| 文件 | 内容 | 后端要看吗 |
|------|------|:--:|
| `SheSells-竞品分析报告.md` | 国内外 20+ 竞品对比 | 不用，给 PPT 用的 |
| `SheSells-方法论提炼与评估教练映射.md` | 方法论完整映射（40 万字课程提取） | 想深入理解"为什么这样评估"时看，否则看执行规划就够了 |
| `SheSells-AI-Coding-Prompts.md` | 丢给 AI 帮你写代码的 prompt | 写基础骨架时用，Day 3+ 已不需要 |

### 可以忽略

| 文件 | 原因 |
|------|------|
| `SheSells-初始化与Agent-Prompts.md` | Day 1 初始化 prompt，已经用过了，现在是历史文档 |
| `SheSells-Agent-Prompts-FewShot.md` | 对应 `prompts.ts` 的设计说明，代码已经有注释了 |

---

## 三、每份文档的核心内容速览

### 🔴 `SheSells-技术详设.md` — 施工图纸

| 章节 | 内容 | 后端相关度 |
|------|------|:--:|
| 一、技术选型 | Next.js + Vercel AI SDK + KV + 国产 LLM | 必读 |
| 二、系统架构 | Agent Core 4 模块关系图 | 必读 |
| **三、数据模型** | `Session`、`Message`、`CustomerState`、`CoachDecision`、`Dimensions`、`CriticalMoment`、`ReplayTurn`、`Product`、`SOPRule` — **所有 TypeScript 类型定义都在这** | **最重要** |
| **四、接口定义** | `POST /api/session`、`POST /api/chat`、`POST /api/finish`、`GET /api/session/{id}` — Request/Response schema | **最重要** |
| 五、Agent Core 设计 | CustomerSimulator / EvaluatorCoach / SalesStateMachine / CoachEngine 的伪代码和调用流 | 必读 |
| 六、实现优先级 | Phase 1-3 的交付列表 | 参考 |

**一句话：这是你的 API 契约和类型定义源头，所有代码都从这里长出来。**

---

### 🔴 `SheSells-AI销售教练-项目规划.md` — 产品总纲

| 章节 | 核心信息 |
|------|---------|
| 一、项目定位 | Agent 不是工具是教练，3 个主动行为（追问/喊停/对比） |
| 四、Demo 聚焦 | 只做 1 个场景：敏感肌试早C晚A，1 个顾客人格 |
| 五、技术架构 | Agent Core 架构图（比技术详设更偏产品视角） |
| 六、5天计划 | Day 1-5 的分工和交付节奏 |
| 七、3人分工 | A前端 / B后端（你） / C内容 — 你的关键交付列表 |
| 九、Demo 脚本 | 5 分钟演示的完整脚本，标出了你的代码要支持的演示点 |

**一句话：当你问"这个功能要不要做"时，回来查 Demo 聚焦那章——只做 1 个场景，别做多。**

---

### 🔴 `prompts.ts` — 可直接运行的 Prompt 代码

| 函数 | 用途 | 状态 |
|------|------|:--:|
| `formatConversationHistory()` | 消息数组 → 格式化文本 | 完成 |
| `buildCustomerSimulatorPrompt()` | 顾客模拟 prompt，含 3 个 few-shot | 完成，Day 3 需补阻力信号 |
| `buildEvaluatorCoachPrompt()` | 评估+教练合并 prompt，含 3 个 few-shot | 完成，Day 3-4 需补权重/语调/喊停规则 |

**一句话：这是你最重要的代码文件。`import { buildCustomerSimulatorPrompt, buildEvaluatorCoachPrompt } from './prompts'` 就是你的 LLM 调用入口。**

---

### 🟡 `SheSells-AI创新设计.md` — 三个 AI 创新的施工图纸

| 章节 | 内容 | 什么时候看 |
|------|------|-----------|
| 一、为什么要做 | 当前技术栈偏弱的背景 | 先扫一遍 |
| 二、创新一 | SelfChecker：教练消息自检回环（prompt + 伪代码 + 架构图） | Day 4 实现时照抄 |
| 三、创新二 | ErrorPatternTracker：错误模式追踪+动态策略升级（数据结构 + 规则代码） | Day 3-4 实现时照抄 |
| 四、创新三 | CoT Evaluation：评估推理链可见化（schema 改造 + prompt 修改） | Day 3 改 EvaluatorCoach 时用 |
| 五、整合架构 | 三个创新插入后的完整 Agent Core 流程图 | 规划调用顺序时看 |
| 六、优先级 | P0 创新二 > P1 创新一 > P2 创新三 | 时间不够时参考 |
| 七、答辩话术 | 整合版答辩回答 | Pitch 准备时用 |

**一句话：这是你的 AI 创新施工图纸。每个创新都有完整的 prompt、伪代码和数据结构——照抄即可。**

---

### 🟡 `SheSells-执行规划.md` — Day 3-5 施工清单

| 章节 | 你要做什么 |
|------|-----------|
| **一、方法论→代码映射** | 逐条列出哪些已落地、哪些需补强（最重要） |
| **二、Day 3：评估引擎补强** | ① 权重对齐（改 EvaluatorCoach prompt 中的维度权重）② StageTransition 规则注入 ③ 顾客阻力信号扩展 |
| **三、Day 3-4：教练主动行为** | ① Probe 3条规则精确化 ② Halt 3条规则精确化 ③ 教练语调注入（先认可再纠正） |
| **四、Day 4：销冠对比** | ③ 段销冠逐字稿（探询/异议/促单）+ ChampionReplay Prompt |
| **五、Day 4-5：总结评分** | 5维评分锚点（每维0-100分四档标准）+ SummaryEvaluator Prompt |
| **六、Day 3-5 分工** | 每天 A/B/C 三人各自做什么 |
| **七、风险清单** | 8 条 Day 3-5 特供风险：评分不准/喊停太频繁/喊停不触发/顾客模拟太呆等 |

**一句话：Day 3 开始写代码前先看这章的表 1.1 和表 1.2，它们告诉你具体改哪几个 prompt 函数、加什么新模块。**

---

### 🟡 `SheSells-教练消息库.md` — Prompt 调优素材

| 章节 | 内容 | 什么时候查 |
|------|------|-----------|
| 一、Probe 追问模板 | 3 类场景（跳过探询/回复过简/未追信号）× 多种上下文 | 调 `buildEvaluatorCoachPrompt` 的 few-shot 时照抄 |
| 二、Halt 喊停模板 | 3 类错误 × 完整三步法指导消息 | 喊停消息太生硬时参考 |
| 三、Feedback 反馈模板 | 正向肯定 + 温和提醒 | 教练反馈太冰冷时参考 |
| 四、Summary 总结模板 | 完整评分+对比+收尾消息结构 | 写 SummaryEvaluator prompt 时参考 |
| **五、教练语调注入 Prompt** | **可直接复制的 system prompt 片段** | **直接粘贴到 EvaluatorCoach prompt 开头** |
| 六、Demo 专用消息 | 按对话进度 T1-T7 编排 | Demo 场景教练消息不自然时查 |
| 七、坏例子对照表 | 教练不该说什么 | prompt 里加 negative example 时用 |

**一句话：这是你的 prompt few-shot 素材库。LLM 输出的教练消息不对味时，从这里复制正例到 prompt 里。**

---

### 🟡 `SheSells-方法论提炼与评估教练映射.md` — 方法论依据

| 章节 | 内容 |
|------|------|
| 一、核心方法论全景 | 科学销售五步法 + 六大类典型错误 |
| 二、状态机阶段映射 | 四大决策类型 → 5 阶段状态机（破冰/探询/异议/推荐/促单），每阶段含里程碑和检测指标 |
| 三、评估体系 | 五维评估模型（30%/25%/20%/15%/10% 权重） + 关键时刻信号检测 |
| 四、教练决策规则 | 3 条追问 + 3 条喊停触发规则（含精确检测逻辑和消息模板） |
| 五、销冠对比 | 5 对比维度 + 呈现方式 + 编写原则 |

**一句话：执行规划中的改动依据都来自这里。评审问"为什么权重这样设"，答案在这。**

---

## 四、遇到具体问题查哪个文档

| 问题 | 查哪个文档 | 重点章节 |
|------|-----------|---------|
| "API 接口的 request/response 格式是什么？" | `技术详设.md` | 第四章 |
| "Session、Message、CoachDecision 的类型定义在哪？" | `技术详设.md` | 第三章 |
| "EvaluatorCoach prompt 怎么调？" | `prompts.ts` + `教练消息库.md` | `prompts.ts` 的 `buildEvaluatorCoachPrompt`；`教练消息库.md` 第五章的语调注入片段 |
| "5 个维度的权重是多少？" | `执行规划.md` | 第二章 2.1 节 |
| "喊停/追问的触发条件对不对？" | `执行规划.md` | 第三章 3.1/3.2 节 + `方法论提炼.md` 第四章 |
| "顾客模拟器应该输出什么顾虑？" | `执行规划.md` | 第二章 2.3 节（阻力信号列表） |
| "销冠对比的 3 段回复怎么实现？" | `执行规划.md` | 第四章（含代码片段和每段完整文案） |
| "教练消息不够自然/太生硬" | `教练消息库.md` | 第五、七章 |
| "阶段切换条件怎么判断？" | `执行规划.md` | 第二章 2.2 节（StageTransition 规则） |
| "这个功能 Demo 要做吗？" | `项目规划.md` | 第四章 4.4 节"Demo 不做什么" |
| "评分打不准怎么办？" | `执行规划.md` | 第七章风险清单第一条 + 第五章 5.1 节评分锚点 |
| "为什么这样设计？" | `方法论提炼.md` | 全文 |
| "竞品怎么做？" | `竞品分析报告.md` | —（后端不需要） |

---

## 五、后端 Day 3-5 最小阅读路径

如果你时间极紧，按这个顺序看，1 小时内能上手：

```
第 1 步（15min）：技术详设.md 第三章 + 第四章 → 确认数据模型和 API 契约没有忘
第 2 步（10min）：prompts.ts 全文件扫一遍 → 确认两个 build 函数的输入输出
第 3 步（15min）：执行规划.md 第一章 + 第二章 + AI创新设计.md 第六章 → 知道今天要改什么、加什么、优先做哪个创新
第 4 步（10min）：教练消息库.md 第五章 → 复制教练语调 Prompt 到代码里
第 5 步（开始写代码）：
    先改 EvaluatorCoach prompt（权重 + 语调）
    再加 StageTransition 规则
    再补阻力信号
    最后加 ChampionReplay + SummaryEvaluator
```

**每改完一个 prompt 就调一次 LLM 看输出对不对，不要全改完再调。**

---

## 六、文件依赖关系图

```
项目规划.md（产品总纲）
    │
    ├──→ 技术详设.md（施工图纸：类型 + API + 架构）
    │       │
    │       ├──→ prompts.ts（可执行代码）
    │       │       │
    │       │       └──→ 教练消息库.md（prompt few-shot 素材）
    │       │
    │       ├──→ AI创新设计.md（三个 AI 创新施工图纸）
    │       │       │
    │       │       └──→ 执行规划.md 引用其实现方案
    │       │
    │       └──→ 执行规划.md（Day 3-5 施工清单）
    │               │
    │               └──→ 方法论提炼.md（设计依据，非必读）
    │
    ├──→ 竞品分析报告.md（商业/Pitch，后端可跳过）
    │
    └──→ [已过时] 初始化与Agent-Prompts.md
              [已过时] AI-Coding-Prompts.md
              [已过时] Agent-Prompts-FewShot.md
```

箭头方向 = "依赖/参考"方向。越靠上的越基础。

---

_整理日期：2026-07-13_
