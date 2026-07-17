# SheSells Backend

AI 销售教练后端服务 · 黑客松 2026

## 技术栈

- Python 3.10+
- FastAPI 0.100+
- httpx 0.25+（异步 HTTP 客户端）
- Pydantic 2.0+（数据校验）
- uvicorn（ASGI 服务器）

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.example.com/v1
LLM_MODEL=qwen-turbo
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --port 8000
```

启动后访问：
- 根路径：http://localhost:8000
- API 文档：http://localhost:8000/docs
- ReDoc：http://localhost:8000/redoc

## API 接口

### 1. 创建会话

```
POST /api/session
```

请求体：
```json
{
  "scenario_id": "sensitive_early_c_late_a"
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "session_id": "uuid-xxx",
    "customer_profile": {
      "name": "林小姐",
      "age": 25,
      "skin_type": "敏感肌",
      "experience": "护肤新手",
      "tolerance": "低耐受",
      "concern": "怕刺痛烂脸"
    },
    "stage": "opening",
    "initial_customer_message": "你好，我最近看到早C晚A很火...",
    "dimensions": {
      "listening": 0,
      "warmth": 0,
      "professionalism": 0,
      "objection_handling": 0,
      "recommendation": 0
    }
  },
  "message": "success"
}
```

### 2. 发送消息

```
POST /api/chat
```

请求体：
```json
{
  "session_id": "uuid-xxx",
  "message": "我推荐你直接买这套早C晚A"
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "messages": [
      {
        "role": "coach",
        "content": "等等，先别急着推荐...",
        "type": "probe",
        "requires_action": false
      }
    ],
    "stage": "probing",
    "dimensions": {
      "listening": 56,
      "warmth": 50,
      "professionalism": 48,
      "objection_handling": 50,
      "recommendation": 40
    },
    "status": "active"
  },
  "message": "success"
}
```

> 如果会话状态为 `halted`，调用此接口会返回错误，需先调用 `/api/chat/continue`

### 3. 继续对话

```
POST /api/chat/continue
```

请求体：
```json
{
  "session_id": "uuid-xxx"
}
```

响应：返回当前会话状态，`status` 恢复为 `active`

### 4. 结束会话

```
POST /api/finish
```

请求体：
```json
{
  "session_id": "uuid-xxx"
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "summary": "你很愿意倾听...",
    "total_score": 79,
    "dimensions": {
      "listening": {"score": 80, "reasoning": "..."},
      "warmth": {"score": 75, "reasoning": "..."},
      "professionalism": {"score": 70, "reasoning": "..."},
      "objection_handling": {"score": 65, "reasoning": "..."},
      "recommendation": {"score": 60, "reasoning": "..."}
    },
    "key_moments": [
      {"turn": 1, "description": "主动询问使用史", "type": "good"}
    ],
    "champion_replay": {
      "title": "优秀示范",
      "rounds": [
        {
          "turn": 2,
          "ba_reply": "我推荐你直接买...",
          "champion_reply": "我理解你的担心...",
          "skill_tags": ["先共情", "三连问", "不急着推荐"]
        }
      ]
    },
    "status": "completed"
  },
  "message": "success"
}
```

### 5. 获取会话详情

```
GET /api/session/{session_id}
```

响应：返回完整会话数据（顾客信息、所有消息、当前状态等）

## 统一响应格式

```json
{
  "code": 0,           // 0=成功，-1=失败
  "data": {...},       // 数据内容
  "message": "success" // 提示信息
}
```

## 会话状态流转

```
active ──(教练 halt)──> halted ──(/chat/continue)──> active
  │
  └──(/finish)──> completed
```

## 错误升级机制

| 同类错误次数 | 教练行为 | 升级级别 |
|------------|---------|---------|
| 第 1 次 | 黄色提示条追问 | `probe` |
| 第 2 次 | 蓝色遮罩喊停 | `halt` |
| 第 3 次+ | 喊停 + 销冠对比 | `halt_with_champion` |

错误类型：`skipped_probing` / `ignored_concerns` / `shallow_reply` / `negative_response` / `hard_push`

## 项目结构

```
backend/
├── app/
│   ├── main.py                    # FastAPI 入口
│   ├── api/
│   │   ├── routes.py              # 5 个 API 接口
│   │   └── schemas.py             # Pydantic 数据模型
│   ├── core/
│   │   ├── config.py              # 环境变量配置
│   │   ├── llm_client.py          # LLM API 调用（含重试）
│   │   └── session_manager.py     # 内存字典会话管理
│   ├── agents/
│   │   ├── customer_simulator.py  # 顾客模拟器
│   │   ├── evaluator_coach.py     # 评估教练
│   │   └── error_tracker.py       # 错误追踪 + 策略升级
│   └── prompts/
│       └── templates.py           # LLM 提示词模板
├── requirements.txt
├── .env.example
└── .gitignore
```

## 开发说明

- 会话数据存储在内存字典中，服务重启后丢失
- LLM 调用失败时自动重试 2 次，仍失败则返回降级数据
- CORS 允许 `http://localhost:3000` 前端访问
- 代码规范详见项目根目录 [AGENTS.md](../AGENTS.md)
