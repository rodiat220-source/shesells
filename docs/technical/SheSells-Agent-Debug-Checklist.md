# Agent 模块调试清单

## 一、现有 Agent 模块

| Agent | 文件路径 | 职责 | 关注点 |
|-------|----------|------|--------|
| CustomerSimulator | app/agents/customer_simulator.py | 根据 BA 消息生成顾客回复 | ① Prompt 角色设定是否与动态画像匹配；② trust/intent/fear 是否正确传递和更新；③ 返回格式是否含 reply + state_delta；④ LLM 失败时兜底回复是否自然；⑤ 不同画像下回复差异是否明显 |
| EvaluatorCoach | app/agents/evaluator_coach.py | 评估 BA 表现，输出 5 维评分 + 教练决策 | ① probe/halt/feedback 触发阈值是否合理；② 推理链是否完整（观察→对比→原因→标杆）；③ 是否与 ErrorTracker 正确联动 |
| ErrorTracker | app/agents/error_tracker.py | 记录错误类型和次数，返回升级级别 | ① 错误类型枚举是否完整；② 升级规则是否正确（1→probe / 2→halt / 3→halt+对比）；③ 画像切换时是否调用 reset() 清空历史 |


## 二、Prompt 模板（backend/app/prompts/templates.py）

| Prompt | 状态 | 关注点 |
|--------|------|--------|
| CUSTOMER_SIMULATOR_PROMPT | 修改 | 移除「A醇/刺痛」硬编码，改为围绕 goal 和 concerns 动态展开 |
| EVALUATOR_COACH_PROMPT | 修改 | 不写死具体产品/肤质，评分标准引用动态 concerns |
| SUMMARY_PROMPT | 修改 | 是否包含推理链四步格式，是否输出关键时刻列表 |
| PERSONA_GENERATOR_PROMPT | 已有 | 输出格式严格 JSON，顾虑处理逻辑正确（填了→展开，没填→推断） |
| champion replay | 已实现于 `/api/finish` | 销冠话术贴合当前画像，优先引用真实顾客原话；LLM 失败或 rounds 为空时走动态兜底模板 |


## 三、接口调用链（app/api/routes.py）

| 接口 | Agent 调用 | 关注点 |
|------|-----------|--------|
| POST /api/persona（新增） | 调用画像生成 Prompt | LLM 返回 JSON 是否完整，生成失败时是否有兜底画像，必填标签校验是否到位 |
| POST /api/chat | EvaluatorCoach → ErrorTracker → CustomerSimulator | 调用顺序是否正确，各 Agent 返回数据格式是否匹配，错误升级后的 type 是否覆盖原有决策，LLM 超时/失败时的降级方案是否生效 |
| POST /api/chat/continue | 无 Agent 调用，仅更新状态 | 是否只做状态变更（halted → active），不重复评估，会话状态是否正确持久化 |
| POST /api/finish | SUMMARY_PROMPT | 画像、顾虑、已回应顾虑、阶段和状态都传入；销冠对比随画像生成 |


## 四、新增需求涉及的 Agent 能力

| 需求 | Agent 相关变更 | 关注点 |
|------|---------------|--------|
| 顾客画像标签化 | 新增画像生成 Agent + 修改模拟器 Prompt | 标签选择→画像生成→进入对话链路是否跑通；不同画像下顾客回复是否差异化；displayLine 纯拼接不经过 LLM；重选标签时是否清空 ErrorTracker 历史 |
| 案例复盘 | 新增案例分析 Prompt | 分析结果是否包含问题诊断 + 五维评分 + 关键时刻；对练模式上限 10 轮 |
| 销冠对比实时生成 | 新增 Prompt + 修改 /api/finish | 是否贴合当前画像品类；是否引用 BA 实际犯的错；失败时走兜底模板 |


## 五、需要验证的场景清单

| 场景 | 预期结果 |
|------|----------|
| 选择不同标签组合进入对话 | 顾客回复体现不同画像特征（敏感干皮 vs 非敏感油皮） |
| 重选标签后开始新对话 | 错误追踪器归零，会话无残留 |
| BA 跳过探询直接推荐 | 触发 probe，黄色提示条显示 |
| BA 连续 2 次忽略顾虑 | 触发 halt，requires_action: true |
| BA 正确回应顾虑 | 触发 feedback，绿色提示条显示 |
| 同一错误连续犯 3 次 | 第1次→probe，第2次→halt，第3次→halt+销冠对比 |
| 结束训练后查看总结页 | 销冠对比贴合当前画像，非固定内容 |
| 进入 halted 状态 | 前端输入框禁用，只有点击确认按钮才恢复 |
| 输入失败案例叙述 | 输出问题诊断 + 评分 + 销冠对比 |
| LLM 超时/失败 | 返回预设兜底数据，前端正常渲染 |


## 六、需要日志记录的内容

| 日志类型 | 格式 |
|----------|------|
| Agent 输入输出 | [AgentName] 输入: {...} \| 输出: {...} \| 耗时: Xms |
| 错误追踪 | 错误类型 → 当前计数 → 升级级别 |
| 降级触发 | [FALLBACK] 原因 |
| 会话状态变更 | status: active → halted → active → completed |


## 七、风险与兜底

| 风险 | 兜底方案 |
|------|----------|
| LLM 生成画像质量参差 | few-shot 覆盖 ≥3 种组合；预览页提供重选 |
| 销冠对比 LLM 翻车 | 通用结构模板兜底；Demo 选验证过的画像组合 |
| 不同画像下顾客模拟差异不够 | Prompt 强制注入 concerns 和语气特征 |
| 画像切换时错误追踪未重置 | reset() 在新建会话时强制调用 |
| 教练介入频率过高影响体验 | 同类型 probe 至少间隔 2 轮 |


## 八、参考文档
- 顾客画像标签化 PRD：docs/product/SheSells-顾客画像标签化-需求文档.md
- 案例复盘 PRD：docs/product/SheSells-案例复盘-需求文档.md

## 九、动态画像闭环验收记录（2026-07-17）

运行时以 `backend/app/` Python 实现为准，`docs/technical/SheSells-prompts.ts` 保留为历史 TypeScript 参考。

| 验收项 | 结果 |
|--------|------|
| `18-25 + dry + sensitive`：`/api/persona → /api/session → /api/chat → /api/finish` | 通过 |
| `26-35 + oily + non_sensitive`：完整链路 | 通过，顾客兜底围绕油皮画像顾虑 |
| `36+ + combination + sensitive`：完整链路 | 通过 |
| CustomerSimulator 注入 goal、concerns、skin_type、tolerance | 通过 |
| EvaluatorCoach 注入画像、状态、历史和动态顾虑 | 通过 |
| finish 销冠回放引用真实顾客原话 | 通过，`customer_message` 可选兼容旧数据 |
| finish LLM 失败、JSON 非法或 rounds 为空 | 通过，返回至少一轮动态销冠兜底 |
| 旧默认 session 创建和聊天 | 通过，保留默认兼容画像 |
| 前端 `pnpm lint` / `pnpm build` | 通过；lint 保留 1 个既有 warning |

`frontend/tests/rendered-html.test.mjs` 仍引用已移除的 Sites Preview 文件，属于既有测试维护问题，本次动态画像分支未扩展修复范围。
