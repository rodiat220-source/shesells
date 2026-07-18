# SheSells 后端剩余任务实施方案

> 状态：✅ 代码已实现并验证（2026-07-17）
>
> 范围：环境变量、独立日志配置、三个 Prompt 模板、错误追踪器、顾客模拟器
>
> 实现基准：`backend/` 当前 Python 代码
>
> 参考资料：`docs/prompts.ts`（历史参考）、`docs/SheSells-初始化与Agent-Prompts.md`（历史文档）、`docs/SheSells-技术详设.md`

## 1. 目标

补齐当前 Python 后端中尚未完成的四项能力，使以下主流程可以运行：

1. 后端从本地 `.env` 读取大模型配置。
2. BA 发送消息后，评估教练能获得结构稳定的评估结果。
3. 教练不介入时，顾客模拟器能生成顾客回复和状态变化。
4. 会话结束时，后端能生成符合现有响应模型的总结报告。

真实 API Key 只写入本地 `.env`，不进入本文档、日志或提交记录。

## 2. 实现依据与约束

### 2.1 依据优先级

出现字段或流程冲突时，按以下优先级处理：

1. `backend/app/api/routes.py` 的实际调用方式。
2. `backend/app/api/schemas.py` 的响应数据结构。
3. 各 Python 文件现有函数签名和注释。
4. `docs/` 中原 TypeScript 方案的角色设定、评分规则和 few-shot 示例。

旧 TypeScript 文档用于提炼 Prompt 内容，不照搬 camelCase 字段、未接入的状态字段和旧返回结构。

### 2.2 本次改动范围

实施文件：

- `backend/.env`：本地环境配置，不提交 Git。
- `backend/app/prompts/templates.py`：补全三个 Prompt 模板。
- `backend/app/agents/error_tracker.py`：实现三个现有方法。
- `backend/app/agents/customer_simulator.py`：实现顾客回复生成和降级逻辑。
- `backend/app/agents/evaluator_coach.py`：仅把错误追踪调用调整为异步等待。
- `backend/app/core/logging_config.py`：统一输出控制台日志和 `backend/app.log`。
- `backend/app/main.py`：应用启动时加载日志配置。

保持不变：

- API 路径和统一响应格式。
- 内存会话存储方案。
- `EvaluatorCoach` 的评估接口、路由和 Pydantic 模型。
- 当前目录结构和已有依赖。

## 3. 实施前代码现状

| 任务 | 当前状态 | 直接调用方 | 完成标准 |
|---|---|---|---|
| 环境变量 | 只有 `.env.example` | `config.py` | 从 `backend/.env` 正常加载密钥、地址和模型名 |
| 三个 Prompt | 三个常量均为空字符串 | `EvaluatorCoach`、`CustomerSimulator`、`/api/finish` | 占位符和 JSON 输出与 Python 解析逻辑一致 |
| 错误追踪器 | `track`、`get_count`、`reset` 为 `pass` | `EvaluatorCoach` | 同类错误按 1、2、3+ 次返回对应升级级别 |
| 顾客模拟器 | `respond` 为 `pass`，兜底回复为空 | `/api/chat` | 正常解析 LLM JSON，失败时返回结构完整的兜底结果 |

## 4. 任务一：配置环境变量

### 4.1 实施内容

在 `backend/` 目录执行：

```bash
cp .env.example .env
```

本地 `.env` 需要配置：

```env
LLM_API_KEY=<实际 API Key>
LLM_BASE_URL=<服务商 OpenAI 兼容接口地址>
LLM_MODEL=<实际模型名>
```

`LLM_BASE_URL` 需要填写到版本路径，例如以 `/v1` 结尾；现有 `llm_client.py` 会继续拼接 `/chat/completions`。

### 4.2 安全要求

- 真实 API Key 由项目成员在本机填写，不进入本文档、日志或提交记录。
- `backend/.gitignore` 已包含 `.env`，实施时再次用 `git status` 确认它未被跟踪。
- 不在 `.env.example` 中放入可用密钥。

### 4.3 验收

- 从 `backend/` 启动应用时，`Settings()` 不再因缺少 `LLM_API_KEY` 失败。
- 请求使用配置的模型和接口地址发出。
- `git status` 不显示 `backend/.env`。

## 5. 任务二：补全三个 Prompt 模板

### 5.1 通用要求

- 三个模板都使用 Python 多行字符串。
- 所有 `.format(...)` 占位符必须与调用方完全一致。
- Prompt 要求模型只返回合法 JSON，不附加 Markdown 代码围栏或说明文字。
- JSON 示例中的普通花括号需要转义为 `{{` 和 `}}`，避免被 `str.format` 当成占位符。
- 分数字段限制在 `0-100`，状态变化限制在 `-15` 到 `15`。
- 复用旧文档中的角色设定、教练语气和代表性 few-shot，控制模板长度，只保留能稳定输出的示例。

### 5.2 `CUSTOMER_SIMULATOR_PROMPT`

现有调用方只提供四个占位符：

| 占位符 | 来源 | 含义 |
|---|---|---|
| `{trust}` | `state["trust"]` | 当前信任度 |
| `{intent}` | `state["intent"]` | 当前购买意愿 |
| `{fear}` | `state["fear"]` | 当前核心顾虑文本 |
| `{ba_message}` | `/api/chat` 请求 | BA 本轮消息 |

Prompt 需要定义敏感肌顾客“林小姐”的固定人设，并要求输出：

```json
{
  "reply": "顾客口语化回复",
  "state_delta": {
    "trust": 0,
    "intent": 0
  }
}
```

实现决策：

- 使用 Python 当前字段 `intent`，不沿用旧 TS 的 `purchase_intent`。
- `fear` 当前是顾虑文本，保持只读，不生成数值变化。
- 顾客回复需保持克制，不在一轮内直接完成购买。
- BA 共情并提供安全方案时提高信任和意愿；忽略顾虑或强推时降低二者。

### 5.3 `EVALUATOR_COACH_PROMPT`

现有调用方提供：

| 占位符 | 来源 |
|---|---|
| `{ba_message}` | BA 本轮消息 |
| `{concerns}` | 顾客核心顾虑 |
| `{stage}` | 当前销售阶段 |

现有 `EvaluatorCoach.evaluate()` 按顶层字段解析，因此 Prompt 必须输出：

```json
{
  "dimensions": {
    "listening": 70,
    "warmth": 75,
    "professionalism": 65,
    "objection_handling": 60,
    "recommendation": 50
  },
  "decision": "probe",
  "coach_message": "具体、简短、可执行的教练提示",
  "error_type": "skipped_probing"
}
```

字段约束：

- `decision` 只能为 `probe`、`halt`、`feedback`、`none`。
- `error_type` 只能为 `skipped_probing`、`ignored_concerns`、`shallow_reply`、`negative_response`、`hard_push` 或 `null`。
- 没有错误时返回 JSON 的 `null`，避免返回字符串 `"null"`。
- 教练消息先认可有效动作，再给出一个明确改进方向，控制在 100 字以内。
- 五维评分与 `DimensionScores` 字段完全一致。

旧 TS 版本的嵌套 `coach_decision` 结构不用于本次 Python 模板，因为当前解析器读取的是顶层 `decision` 和 `coach_message`。

### 5.4 `SUMMARY_PROMPT`

该模板只有 `{conversation_history}` 一个占位符。输出必须直接匹配 `FinishResponse`：

```json
{
  "summary": "总体评价",
  "total_score": 75,
  "dimensions": {
    "listening": {"score": 75, "reasoning": "评分依据"},
    "warmth": {"score": 75, "reasoning": "评分依据"},
    "professionalism": {"score": 75, "reasoning": "评分依据"},
    "objection_handling": {"score": 75, "reasoning": "评分依据"},
    "recommendation": {"score": 75, "reasoning": "评分依据"}
  },
  "key_moments": [
    {"turn": 1, "description": "关键表现", "type": "good"}
  ],
  "champion_replay": {
    "title": "销冠示范",
    "rounds": [
      {
        "turn": 1,
        "ba_reply": "BA 原回复",
        "champion_reply": "更优回复",
        "skill_tags": ["技巧标签"]
      }
    ]
  }
}
```

关键约束：

- `total_score` 为五维分数的整数平均值。
- 每个维度同时包含 `score` 和 `reasoning`。
- `key_moments.type` 只使用 `good` 或 `missed`。
- `champion_replay` 必须始终包含 `title` 和 `rounds`，即使对话较短也返回至少一轮可复盘内容。

## 6. 任务三：实现错误追踪器

### 6.1 `track(error_type)`

处理顺序：

1. 按项目规范将方法改为 `async def`，并在 `EvaluatorCoach` 中使用 `await` 调用。
2. 校验 `error_type` 是否属于 `VALID_ERROR_TYPES`。
3. 合法时将对应计数加一。
4. 第 1 次返回 `probe`。
5. 第 2 次返回 `halt`。
6. 第 3 次及以上返回 `halt_with_champion`。
7. 记录错误类型、最新次数和升级级别，不记录用户消息正文。

来自 LLM 的未知错误类型不写入计数字典；记录 warning 并返回 `none`，避免单个异常标签让整轮评估降级。

### 6.2 `get_count(error_type)`

- 按项目规范使用 `async def`。
- 使用字典读取累计次数。
- 从未出现的类型返回 `0`。
- 方法保持无副作用。

### 6.3 `reset()`

- 按项目规范使用 `async def`。
- 清空当前计数字典。
- 记录一次 reset 日志。

### 6.4 当前 MVP 边界

`error_tracker` 目前是全局内存单例，计数会被所有会话共享。黑客松单会话 Demo 可以沿用这一实现。开始支持并发训练会话时，需要把计数下沉到 `session_id` 维度。

`EvaluatorCoach` 当前只记录 `track()` 返回的升级级别，最终是否介入仍使用 LLM 返回的 `decision`。本轮按用户列出的文件范围完成追踪器方法；如需让累计次数强制决定 `probe/halt/halt_with_champion`，后续需要单独调整 `EvaluatorCoach.evaluate()` 的决策合并逻辑。

## 7. 任务四：实现顾客回复生成逻辑

### 7.1 固定返回结构

正常和降级路径都返回：

```json
{
  "reply": "顾客回复",
  "state_delta": {
    "trust": 0,
    "intent": 0
  }
}
```

`FALLBACK_REPLY` 使用固定、自然且能继续对话的敏感肌顾客回复。兜底状态变化全部为 `0`，避免 LLM 失败时错误改变会话状态。

### 7.2 `respond(ba_message, state)` 流程

1. 从现有模块导入 `CUSTOMER_SIMULATOR_PROMPT` 和 `call_llm`。
2. 使用 `state.get(...)` 读取 `trust`、`intent`、`fear`，填充 Prompt。
3. 记录本次调用的 `session_id`，不记录完整 Prompt 和 API Key。
4. 异步调用 `call_llm(prompt)`。
5. 返回 `None` 时使用固定兜底结果。
6. 有返回值时使用标准库 `json.loads` 解析。
7. 校验 `reply` 为非空字符串，`state_delta` 为字典。
8. 将 `trust`、`intent` 变化转换为整数并限制在 `-15` 到 `15`。
9. JSON 无效、字段缺失或类型错误时记录 error，并返回固定兜底结果。

不新增第三方依赖，不新增 Agent 抽象层。

## 8. 实施顺序

### 阶段一：本地配置

1. 创建 `backend/.env`。
2. 填写实际服务商地址、模型名和 API Key。
3. 验证配置可加载且 `.env` 未被 Git 跟踪。

### 阶段二：Prompt 契约

1. 先补 `CUSTOMER_SIMULATOR_PROMPT`。
2. 再补 `EVALUATOR_COACH_PROMPT`。
3. 最后补 `SUMMARY_PROMPT`。
4. 对三个模板分别执行一次 `.format(...)`，确认没有遗漏或误解析的花括号。

### 阶段三：纯内存逻辑

1. 实现 `ErrorTracker.track()`。
2. 实现 `get_count()` 和 `reset()`。
3. 在 `EvaluatorCoach` 中等待异步 `track()` 结果。
4. 用连续三次同类错误验证升级序列。

### 阶段四：顾客模拟器

1. 填写固定兜底回复。
2. 实现 Prompt 填充、LLM 调用和 JSON 解析。
3. 增加最小字段校验和状态变化限制。
4. 验证正常返回、`None`、非法 JSON 三条路径。

### 阶段五：接口联调

1. 创建会话。
2. 发送一条会触发教练的强推话术。
3. 发送一条正常探询话术并获得顾客回复。
4. 结束会话并检查总结结构。

## 9. 验收清单

### 9.1 静态检查

- [ ] 所有新增函数逻辑保留类型注解和中文注释。
- [ ] 使用绝对导入。
- [ ] 使用 `logging`，没有 `print`。
- [ ] 没有新增依赖和目录。
- [ ] 三个 Prompt 的 `.format(...)` 均能成功执行。
- [ ] `python -m compileall app` 通过。

### 9.2 错误追踪器

- [ ] 第一次同类错误返回 `probe`，计数为 1。
- [ ] 第二次返回 `halt`，计数为 2。
- [ ] 第三次及以后返回 `halt_with_champion`。
- [ ] 未记录类型的计数为 0。
- [ ] `reset()` 后所有计数清零。
- [ ] 未知错误类型不会污染计数。

### 9.3 顾客模拟器

- [ ] 正常 LLM JSON 能转换成固定返回结构。
- [ ] `reply` 非空。
- [ ] `trust`、`intent` 单次变化均在 `-15` 到 `15`。
- [ ] LLM 返回 `None` 时使用兜底回复。
- [ ] 非法 JSON 或字段异常时使用兜底回复。

### 9.4 API 联调

- [ ] `POST /api/session` 成功创建会话。
- [ ] `POST /api/chat` 能返回 coach 或 customer 消息。
- [ ] 顾客回复后，会话中的 `trust` 和 `intent` 正确更新。
- [ ] `POST /api/finish` 返回符合 `FinishResponse` 的完整数据。
- [ ] 全部接口保持 `{code, data, message}` 统一响应格式。

## 10. 实施前需要的输入

进入编码阶段前只需准备以下配置：

- 大模型服务商名称。
- OpenAI 兼容的 Base URL。
- 可调用的模型名。
- 本地使用的 API Key。

API Key 建议由项目成员直接写入本地 `backend/.env`，无需通过聊天或文档传递。
