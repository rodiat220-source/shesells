# SheSells —— 前端阅读指南

> 写给前端开发：时间紧，只有一个对话界面，但体验要对得起"Agent 不是 ChatBot"。
> 写于 2026-07-19

---

## 一、文件分类一览

```
📦 shesells/
│
├── 🔴 必须精读（2份）── 决定你实现的 UI 对不对
├── 🟡 实现时参考（3份）── 具体交互怎么做
├── 🟢 理解业务用的（3份）── 知道"为什么"就行
├── ⚪ 后端的东西（2份）── 联调时需要
└── ⚪ 可跳过（3份）── 前端不用碰
```

---

## 二、阅读顺序（按优先级）

### 第一优先：先搞懂"页面长什么样、API 返回什么"

| 顺序 | 文件 | 重点读哪些部分 | 时间 |
|:--:|------|--------------|:--:|
| **1** | `SheSells-AI销售教练-项目规划.md` | 第四章（Demo 聚焦）、第七章（3人分工中你的部分）、第九章（Demo 脚本） | 8min |
| **2** | `SheSells-技术详设.md` | 第三章（Message/CoachMetadata 类型，这是你渲染的依据）、第四章（3 个 API 的 response 格式） | 10min |

**为什么先看这两个：**

- 项目规划告诉你 Demo 只做 **1 个页面**（对话界面），以及评委亲手体验的流程——你写的 UI 要撑住这个体验。
- 技术详设告诉你后端返回的 `Message` 对象长什么样，特别是 `role: 'coach'` 的 5 种 `coachType`，每种渲染方式不同。

### 第二优先：写代码时放在旁边

| 顺序 | 文件 | 用途 | 何时查 |
|:--:|------|------|------|
| **3** | `SheSells-AI创新设计.md` | **创新三（CoT推理链）需要前端配合**——雷达图 hover 显示 reasoning tooltip；看第四章即可 | 做雷达图时 |
| **4** | `SheSells-执行规划.md` | 第六章（Day 3-5 前端任务）、第七章（8条风险里和你相关的） | Day 3 开工前扫一遍 |
| **5** | `SheSells-教练消息库.md` | 了解 coach 消息的语调和长度，评估 UI 留多大空间 | 设计 coach 消息样式时 |

### 可以跳过 / 仅联调时需要

| 文件 | 原因 |
|------|------|
| `SheSells-竞品分析报告.md` | 商业 Pitch 用的，前端不需要 |
| `SheSells-方法论提炼与评估教练映射.md` | 后端设计 coach 规则的理论依据，前端不需要 |
| `prompts.ts` | 后端代码，联调时看一下函数签名知道后端怎么调 LLM 就行 |
| `SheSells-AI创新设计.md` | 第四章（CoT reasoning）前端需要看，其余章节后端的事 |
| `SheSells-Agent-Prompts-FewShot.md` | 后端 prompt 设计文档 |
| `SheSells-AI-Coding-Prompts.md` | AI 生成代码用的 prompt，已过时 |
| `SheSells-初始化与Agent-Prompts.md` | Day 1 用的，已过时 |
| `后端阅读指南.md` | 后端同学的阅读指南，你可以跳过 |

---

## 三、你要实现的：1 个对话界面，3 种角色，5 种教练消息

### 3.1 整体约束

```
✅ 只有 1 个页面：对话界面
✅ 所有评分、对比、反馈都在对话流里自然展示，不切页面
✅ 不做独立 Dashboard、不做用户登录、不做多场景切换
✅ Demo 中评委亲自上手扮演 BA，所以 UI 要直观、防手滑、容错高
```

### 3.2 三种角色的消息渲染

| 角色 | 视觉区分 | 对齐 | 备注 |
|------|---------|:--:|------|
| **BA**（用户自己） | 右侧气泡，品牌色背景 | 右 | 普通聊天气泡 |
| **顾客**（AI 模拟） | 左侧气泡，灰色背景，带"顾客"标签 | 左 | 普通聊天气泡 |
| **教练**（AI 教练） | **左侧特殊样式**——不是气泡，是带左边框的提示块 | 左 | 这是区分 SheSells 和普通 ChatBot 的关键 |

### 3.3 教练消息的 5 种类型（每种渲染不同）

类型定义在 `技术详设.md` 第三章 `Message` 的 `CoachType`：

```
type CoachType = 'probe' | 'halt' | 'feedback' | 'summary' | 'champion_replay';
```

#### ① probe —— 主动追问

**什么时候出现**：BA 跳过探询就推荐、或回复太简略时。

**后端返回示例**：
```json
{
  "role": "coach",
  "coachType": "probe",
  "content": "等等，你还没了解她的皮肤状况，先问问她现在在用什么？",
  "metadata": { "requiresAction": false }
}
```

**UI 要求**：
- 左侧提示块，淡黄色/琥珀色左边框
- 不打断输入，BA 可以直接回复顾客（所以 `requiresAction: false`）
- 小字体、弱视觉权重——它是旁白，不是主角
- 图标：💡或问号图标

---

#### ② halt —— 主动喊停 ⚠️ **Demo 炸点**

**什么时候出现**：BA 连续 2 次忽略顾客顾虑时。

**后端返回示例**：
```json
{
  "role": "coach",
  "coachType": "halt",
  "content": "停一下——她说了 2 次怕刺痛，你都没接住，试试先共情再推荐。",
  "metadata": { "requiresAction": true, "actionLabel": "明白了，继续" }
}
```

**UI 要求（关键！）**：
- 左侧提示块，红色/珊瑚色左边框，视觉权重最高
- **`requiresAction: true` → 输入框变灰 + 禁用**，底部出现确认按钮
- 按钮文案用 `metadata.actionLabel`（默认"明白了，继续"）
- 点击按钮后：① 输入框恢复 ② 按钮消失 ③ BA 可以继续对话
- **Demo 表演要点**：喊停是全场最有冲击力的时刻，动画要明显但不过度——比如喊停块从上方滑入，输入框瞬间变灰

---

#### ③ feedback —— 即时反馈

**什么时候出现**：BA 做了一个值得注意的动作（好或不好），但不需要中断对话。

**后端返回示例**：
```json
{
  "role": "coach",
  "coachType": "feedback",
  "content": "很好——你问了她肤质、在用产品和之前的经历，这三个信息是推荐的基础。",
  "metadata": { "requiresAction": false }
}
```

**UI 要求**：
- 左侧提示块，绿色/蓝绿色左边框
- `requiresAction: false`，不打断输入
- 比 probe 更轻的视觉权重
- 正向反馈用绿色边框，提醒用蓝色边框（前端根据内容判断，含正向词如"很好/不错"用绿色）

---

#### ④ summary —— 对话结束总结

**什么时候出现**：BA 点击"结束训练"或达到最大轮数。

**后端返回示例**：
```json
{
  "role": "coach",
  "coachType": "summary",
  "content": "综合来看，你的表现有亮点也有可提升的地方...",
  "metadata": {
    "dimensions": { "listening": 78, "professionalism": 70, "recommendation": 60, "objectionHandling": 55, "warmth": 72 },
    "criticalMoments": [
      { "turn": 2, "type": "good_probe", "description": "主动询问了肤质和使用史" },
      { "turn": 4, "type": "missed_concern", "description": "未回应顾客怕刺痛的顾虑" }
    ]
  }
}
```

**UI 要求**：
- 对话流中的总结块，比普通教练消息稍大
- **嵌入迷你雷达图**：5 个维度（用 Recharts 或纯 CSS）
  - 维度名称用中文：倾听力 · 专业度 · 推荐匹配 · 异议处理 · 共情力
  - 注意：后端字段名是 `listening / professionalism / recommendation / objectionHandling / warmth`，前端映射为中文标签
  - **降级方案**：如果雷达图放不下或渲染有问题，用纯文字 "倾听 78 · 专业 70 · 推荐 60 · 异议 55 · 共情 72"
  - **创新三：hover 显示推理链**（详见 `SheSells-AI创新设计.md` 第四章）：后端可能返回 `dimensions.listening.reasoning` 格式（`{ score, reasoning }` 对象），如果不是对象而是纯数字，则降级为纯数字展示。如果是对象，雷达图每个维度点 hover 时显示 reasoning tooltip
- 展示关键时刻标注：🟢 做得好 / 🔴 需要提升
- 内容较长，允许滚动

---

#### ⑤ champion_replay —— 销冠对比

**什么时候出现**：紧接在 summary 之后。

**后端返回示例**：
```json
{
  "role": "coach",
  "coachType": "champion_replay",
  "content": "你刚才在第 3 轮错过了一个关键信号，来看销冠怎么处理——",
  "metadata": {
    "replayTurns": [
      {
        "turn": 3,
        "baMessage": "那个牌子不好的，我们这个很温和",
        "customerMessage": "可是上次我试过一个抗老精华，脸红了三天才好……",
        "note": "用否定回应顾客顾虑，应先共情再给方案"
      },
      {
        "turn": 3,
        "baMessage": "天哪，那个体验太糟糕了，我能理解为什么你这么小心...",
        "customerMessage": null,
        "note": "销冠做法：先共情坏体验，再解释原因，给具体方案"
      }
    ]
  }
}
```

**UI 要求（Demo 第二大炸点）**：
- 对比块左右分栏或上下排列：
  - 左边/上边：❌ 你的回复（红色标识）
  - 右边/下边：✅ 销冠的回复（绿色标识）
- 每段配 `note` 作为技巧说明
- 如果是逐轮播放式，每段切换有过渡动画
- **不要做成弹窗/Modal**，在对话流里自然展开

---

## 四、界面状态机

你的对话界面有 4 种状态，每种状态的 UI 表现不同：

```
┌──────────┐    开始训练    ┌──────────┐
│  初始态   │ ──────────→  │  对话中   │
│ 首页入口  │              │ BA可输入  │
└──────────┘              └─────┬────┘
                                │
                    halt触发     │  BA点"结束训练"
                    requiresAction=true
                                │
                         ┌──────┴──────┐
                         ↓              ↓
                    ┌─────────┐   ┌──────────┐
                    │  暂停态  │   │  结束态   │
                    │ 输入禁用 │   │ 总结+对比 │
                    │ 等待确认 │   │ 输入禁用  │
                    └────┬────┘   └──────────┘
                         │
                    点击"明白了"
                         │
                         ↓
                    ┌──────────┐
                    │  对话中   │
                    │ BA可输入  │
                    └──────────┘
```

### 状态详解

| 状态 | sessionStatus | 输入框 | 底部按钮 | 触发条件 |
|------|:---:|:--:|------|------|
| 初始态 | — | 无对话界面 | "开始训练"按钮 | 首页进入 |
| 对话中 | `active` | 可用 | "结束训练"按钮 | 正常对话 |
| 暂停态 | `halted` | **禁用+变灰** | "明白了，继续"按钮 | `coachType: halt` + `requiresAction: true` |
| 结束态 | `completed` | **禁用+变灰** | "重新开始"按钮 | BA 点"结束训练"或达到最大轮数 |

---

## 五、API 调用时序

```
1. POST /api/session → 创建会话，获得 sessionId + 顾客开场白
2. POST /api/chat → 每轮 BA 发消息，返回 1-N 条 newMessages + updatedState
   注意：newMessages 的顺序就是渲染顺序。
   可能包含 [coach消息] 或 [coach消息, customer消息] 或 [customer消息]
3. 重复步骤 2，直到：
   a. sessionStatus === 'halted' → 进入暂停态，等用户点确认
   b. 用户点"结束训练" → POST /api/finish
4. POST /api/finish → 返回 summary + champion_replay 消息
5. sessionStatus === 'completed' → 进入结束态
```

---

## 六、Demo 关键时刻的 UI 配合

Demo 脚本（见项目规划第九章）有 3 个关键演示点，你的 UI 需要配合：

| Demo 时刻 | 产品说的话 | 你的 UI 要做的事 |
|-----------|-----------|----------------|
| **评委跳过探询直接推荐** | "等等，你还没了解她的皮肤状况……" | 渲染 `probe` 类型的教练消息，淡黄色左边框，输入框保持可用 |
| **评委连续 2 次忽略顾虑** | "停一下——她说了 2 次怕刺痛……" | 渲染 `halt` 类型的教练消息，红色左边框 + **输入框瞬间变灰** + 底部出现"明白了，继续"按钮。这是全场视觉冲击最强的时刻 |
| **对话结束，展示对比** | "你第 3 轮错过了一个信号，来看销冠——" | 先渲染 `summary`（含迷你雷达图 + 关键时刻），再依次渲染 `champion_replay`（左右对比块） |

**注意**：Demo 是现场直播，评委的操作不可预测。你的 UI 要能应对：
- 评委打字很慢 → loading 状态要友好（三点跳动动画）
- 评委乱打字 → 后端照样返回 coach 消息，前端照样渲染
- 网络卡顿 → API 超时时显示"正在思考……"不要白屏

---

## 七、状态管理建议（Zustand）

```typescript
interface ChatStore {
  // 会话
  sessionId: string | null;
  sessionStatus: 'active' | 'halted' | 'completed';
  isLoading: boolean;

  // 消息列表（按时间顺序渲染）
  messages: Message[];

  // 输入控制
  inputDisabled: boolean;      // halt 或 completed 时为 true
  confirmAction: string | null; // halt 时的按钮文案，如"明白了，继续"

  // 动作
  createSession: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  confirmHalt: () => void;     // 点击"明白了，继续"
  finishSession: () => Promise<void>;
  resetSession: () => void;
}
```

**关键逻辑**：
- `sendMessage` 后检查返回的 `newMessages`，如果有一条 `coachType === 'halt' && requiresAction === true`，设置 `inputDisabled = true` 和 `confirmAction`
- `confirmHalt` 只恢复输入框状态，不发 API——BA 可以继续对话下一步

---

## 八、Demo 防翻车清单

### 8.1 前端特有的风险

| 风险 | 对策 |
|------|------|
| 雷达图渲染失败 | **降级方案优先写好**：用纯文字 "倾听 78 · 专业 70 · 推荐 60 · 异议 55 · 共情 72" 替代，Recharts 失败时自动切换 |
| halt 输入框没禁用 | `sendMessage` 返回后立即检查每一条 newMessage，不依赖 sessionStatus 判断 |
| 消息顺序错误 | 按 API 返回的 `newMessages` 数组顺序追加，不要自己排序 |
| 教练消息太长撑破布局 | 给 coach 消息块设 `max-height` + 内部滚动 |
| 移动端/小屏看不了 | Demo 优先桌面端，但至少保证 13 寸笔记本能看到全部内容 |
| 评委不小心刷新页面 | `GET /api/session/{id}` 恢复对话，sessionId 存 localStorage |
| loading 太久 | 设置 15 秒超时提示，不要让评委盯着空白等 |

### 8.2 上线前检查

- [ ] 顾客消息：左侧灰色气泡
- [ ] BA 消息：右侧品牌色气泡
- [ ] probe 消息：淡黄色左边框，不打断输入
- [ ] halt 消息：红色左边框，输入框变灰 + "明白了，继续"按钮
- [ ] feedback 消息：绿色/蓝色左边框
- [ ] summary 消息：含迷你雷达图（或降级文字）+ 关键时刻标注
- [ ] champion_replay 消息：左右对比块，❌/✅ 标记
- [ ] halt 暂停 → 点确认 → 输入框恢复 → 可继续对话
- [ ] 输入框 loading 状态（三点跳动）
- [ ] 结束态不可输入
- [ ] "重新开始"可从头开始
- [ ] 页面刷新后对话不丢失（从 localStorage 恢复 sessionId，调 GET 接口恢复）

---

## 九、前端最小阅读路径

如果你时间极紧，1 小时内能上手：

```
第 1 步（10min）：项目规划.md 第四章 Demo 聚焦 + 第九章 Demo 脚本
                  → 搞懂 3 个关键时刻的 UI 要求

第 2 步（10min）：技术详设.md 第三章 Message/CoachType 类型 + 第四章 API response
                  → 搞清楚 5 种 coachType 和后端返回的数据结构

第 3 步（5min）： 本文件第六章 Demo 关键时刻 UI 配合
                  → 对着表格确认 3 个时刻你的 UI 表现

第 4 步（开始写代码）：
    先做基础对话（BA 气泡 + 顾客气泡 + 输入框 + 发送）
    再做 coach 消息样式（probe → feedback → halt）
    再做 summary（迷你雷达图 + 关键时刻）
    最后做 champion_replay（对比块）

每做完一种 coach 类型，用 mock 数据看渲染效果，不要全写完再调。
```

---

_整理日期：2026-07-19_
_对应项目规划 V3.0 Agent 方案_
