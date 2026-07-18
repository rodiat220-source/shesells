# SheSells「案例复盘」需求文档与技术详设

> 分支：`hh-case-review` | 日期：2026-07-16

---

## 一、需求概述

### 1.1 目标用户

美妆 BA（Beauty Advisor）及其品牌培训部/区域督导。

### 1.2 使用场景

BA 在线下遇到顾客，觉得能成交，但最后顾客走了没买。BA 不知道为什么丢单，也不知道下次遇到类似情况该怎么改进。

### 1.3 功能流程

```
首页 → 点击"案例复盘" → /case-review 页面

  Phase 1: 输入         贴入语音转文字的失败案例叙述 → 点击"开始分析"
  Phase 2: 加载中       AI 正在分析…
  Phase 3: 分析结果      显示：问题诊断 + 五维评分 + 关键时刻 + 销冠对比
  Phase 4: 角色对练      可选：BA 扮演顾客，AI 扮演销冠，逐轮对话
```

### 1.4 功能边界

| 做 | 不做 |
|----|------|
| BA 粘贴叙述文字 → 一键分析 | 上传语音文件 |
| 输出核心问题 + 五维评分 + 关键时刻 + 销冠版对话 | 历史案例搜索/管理 |
| 分析后可选择"跟销冠对练"（上限 10 轮） | 对练中评估 BA 的顾客模拟水平 |
| 复用现有组件 | 新建组件库 |

---

## 二、技术方案

### 2.1 后端（3 个文件修改）

#### 文件 1：`backend/app/api/schemas.py`

**改动**：追加 4 个 Pydantic 数据模型。

```python
class CaseAnalysisRequest(BaseModel):
    narrative: str = Field(min_length=10)    # BA 语音转文字叙述

class CaseAnalysisData(BaseModel):
    practice_id: str                          # 生成的对练会话 ID
    summary: str                              # 总体分析文字
    key_issues: List[str]                     # 关键错误列表（3-5条）
    total_score: int                          # 综合评分
    dimensions: FinalDimensions               # 五维评分（含推理链）
    key_moments: List[KeyMoment]             # 关键时刻标注
    champion_replay: ChampionReplay          # 销冠对比对话

class CasePracticeRequest(BaseModel):
    practice_id: str
    message: str                              # BA 扮演顾客说的话

class CasePracticeData(BaseModel):
    champion_reply: str                       # 销冠 BA 的回复
```

> `FinalDimensions`、`KeyMoment`、`ChampionReplay` 均为已有模型，直接复用。

#### 文件 2：`backend/app/prompts/templates.py`

**改动**：末尾追加 2 个 Prompt 模板。

| Prompt | 用途 | 占位符 |
|--------|------|--------|
| `CASE_ANALYSIS_PROMPT` | 分析 BA 叙述的失败案例，输出诊断、评分、销冠对比 | `{narrative}` |
| `CHAMPION_PRACTICE_PROMPT` | 让 LLM 扮演销冠 BA，与 BA 逐轮对练 | `{narrative}`, `{analysis_summary}`, `{practice_history}`, `{customer_message}` |

#### 文件 3：`backend/app/api/routes.py`

**改动**：新增导入 + 末尾追加 2 个 API 端点。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/case-analysis` | POST | 接收 narrative → 调用 LLM 分析 → 创建 practice session → 返回诊断结果 |
| `/api/case-practice` | POST | 接收 practice_id + message → 拼接对练上下文 → 调用 LLM → 返回销冠回复（上限 10 轮） |

核心调用链：`routes.py → call_llm(CASE_ANALYSIS_PROMPT) → JSON 解析 → 保存到 session_manager`

### 2.2 前端（4 个文件修改 + 1 个新文件）

#### 文件 1（修改）：`frontend/src/types/index.ts`

追加 2 个新类型：

```typescript
interface CaseAnalysisResult {
  practiceId: string; summary: string; keyIssues: string[];
  totalScore: number; dimensions: Dimensions; keyMoments: CriticalMoment[];
  championReplay: { title: string; rounds: ReplayTurn[]; };
}
interface PracticeMessage {
  id: string; role: "customer" | "champion"; content: string;
}
```

#### 文件 2（修改）：`frontend/src/lib/backendApi.ts`

追加 2 个 API 函数（含 snake_case→camelCase 映射）：

```typescript
analyzeCase(narrative: string): Promise<CaseAnalysisResult>
sendPracticeMessage(practiceId: string, message: string): Promise<string>
```

#### 文件 3（修改）：`frontend/app/page.tsx`

在"开始情境训练"按钮旁增加"案例复盘"按钮（`BookOpen` 图标），点击跳转 `/case-review`。

#### 文件 4（修改）：`frontend/components/MessageBubble.tsx`

增加可选 props `baLabel` 和 `customerLabel`，支持对练模式下自定义气泡标签（"销冠 BA"/"你 (扮演顾客)"）。

#### 文件 5（新建）：`frontend/app/case-review/page.tsx`

完整页面，包含 4 个阶段：

| 阶段 | 显示内容 |
|------|---------|
| `input` | 大文本输入框 + 小贴士 → 点击"开始分析" |
| `loading` | 旋转动画 + "AI 正在分析你的案例…" |
| `result` | 问题诊断列表 + MiniRadar 五维图 + CriticalTimeline 关键时刻 + ReplayInline 销冠对比 + "跟销冠对练"按钮 |
| `practice` | 聊天界面（输入顾客话 → 销冠回复）+ "结束对练"按钮 + 10 轮上限提示 |

#### 额外：`frontend/app/globals.css`

追加约 60 行样式：`secondary-button`、案例输入区、加载态、结果区、对聊区。

### 2.3 组件复用

| 现有组件 | 用途 | 修改 |
|----------|------|------|
| `MiniRadar` | 五维评分雷达图 | 无需修改，传入 `compact` 模式 |
| `CriticalTimeline` | 关键时刻时间线 | 无需修改，直接传入 moments 数组 |
| `ReplayInline` | 销冠对比 Tab 切换 | 无需修改，直接传入 turns 数组 |
| `MessageBubble` | 消息气泡 | 新增可选 `baLabel`/`customerLabel` prop |

---

## 三、与现有系统的关系

| 方面 | 说明 |
|------|------|
| 会话管理 | practice session 复用 `session_manager`，ID 以 `practice_` 前缀区分 |
| LLM 调用 | 复用 `call_llm()`，不做任何修改 |
| 现有路由 | 5 个原有路由逻辑完全不变 |
| 现有 Prompt | 3 个原有 Prompt 完全不变 |
| 前端状态管理 | 对练状态用页面级 `useState`，不污染 `sessionStore` |
| 样式 | 追加 CSS 类，无全局样式变更 |

---

## 四、执行步骤

1. 切到 `hh-case-review` 分支：
   ```bash
   git checkout hh-case-review
   ```
2. 按本文第二章的表格，找到对应文件，查看改动。
3. 理解改动逻辑后，可合并到主分支：
   ```bash
   git checkout master && git merge hh-case-review
   ```

**Pull Request 地址**：`https://github.com/kellyioz/sheSells/pull/new/hh-case-review`
