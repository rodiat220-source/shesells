# sheSells 项目架构文档

## 项目概述

sheSells 是一个基于 AI 的销售训练平台，通过模拟真实客户场景，帮助销售团队提升沟通技巧和成交能力。

## 技术栈

### 后端技术栈

| 组件 | 技术 | 版本 | 说明 |
|------|------|------|------|
| Web 框架 | FastAPI | latest | 高性能异步 Web 框架 |
| ASGI 服务器 | Uvicorn | latest | ASGI 协议服务器 |
| 配置管理 | pydantic-settings | latest | 环境变量配置管理 |
| HTTP 客户端 | httpx | latest | 异步 HTTP 请求 |
| 数据模型 | Pydantic | latest | 数据验证和序列化 |
| 环境变量 | python-dotenv | latest | 环境变量加载 |

### 前端技术栈

| 组件 | 技术 | 版本 | 说明 |
|------|------|------|------|
| Web 框架 | Next.js | 16.x | App Router，React 19 |
| 样式 | Tailwind CSS | 4.x | 原子化 CSS |
| 状态管理 | Zustand | 5.x | 轻量级状态管理 |
| 图表 | Recharts | 3.x | 雷达图组件 |
| 图标 | lucide-react | 1.x | 图标库 |
| 数据校验 | Zod | 4.x | 前端数据验证 |

### 核心依赖

```
fastapi        # Web 框架
uvicorn        # ASGI 服务器
python-dotenv  # 环境变量管理
httpx          # HTTP 客户端
pydantic       # 数据模型
pydantic-settings # 配置管理
```

> 目录结构、环境变量、启动命令详见 [AGENTS.md](AGENTS.md)

## 模块职责说明

### 1. 应用入口 (main.py)

- FastAPI 应用实例创建
- CORS 中间件配置
- 路由注册

### 2. API 层 (api/)

| 文件 | 职责 |
|------|------|
| routes.py | 定义 API 路由和端点 |
| schemas.py | 定义请求/响应数据模型 |

### 3. 核心模块 (core/)

| 文件 | 职责 |
|------|------|
| config.py | 环境变量配置加载，LLM 参数管理 |
| llm_client.py | LLM API 客户端封装，统一调用接口 |
| session_manager.py | 会话数据管理（内存字典存储） |

### 4. Agent 层 (agents/)

| 文件 | 职责 |
|------|------|
| customer_simulator.py | 模拟真实客户行为和反馈 |
| evaluator_coach.py | 评估销售表现并提供指导建议 |
| error_tracker.py | 追踪和记录系统错误 |

### 5. 提示词模板 (prompts/)

| 文件 | 职责 |
|------|------|
| templates.py | 存放各类 LLM 提示词模板 |

## 核心组件说明

### SessionManager（会话管理器）

使用内存字典存储会话数据，提供简单的会话管理能力：

- `sessions: Dict[str, dict]` - 会话存储字典
- `save_session(session_id, data)` - 保存会话
- `load_session(session_id)` - 加载会话

### LLMClient（LLM 客户端）

封装 LLM API 调用，统一管理 API Key、Base URL 和 Model：

- 基于 httpx 异步客户端
- 自动读取配置中的 LLM 参数

### Settings（配置类）

使用 pydantic-settings 管理环境变量：

| 配置项 | 说明 |
|--------|------|
| LLM_API_KEY | LLM 服务 API 密钥 |
| LLM_BASE_URL | LLM 服务基础 URL |
| LLM_MODEL | 使用的模型名称 |

## 数据流图

```
客户端请求
    │
    ▼
┌──────────────┐
│  FastAPI     │  ← main.py
│   入口       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   路由层     │  ← api/routes.py
│  (Routes)    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Agent层    │  ← agents/*.py
│ (Business)   │
└──────┬───────┘
       │
       ├───→ ┌──────────────┐
       │     │  Session     │
       │     │  Manager     │  ← core/session_manager.py
       │     └──────────────┘
       │
       └───→ ┌──────────────┐
             │  LLM Client  │  ← core/llm_client.py
             └──────────────┘
                   │
                   ▼
              LLM API 服务
```

## 扩展规划

### 未来扩展点

1. **数据库集成**：后续可引入 SQLite/PostgreSQL 持久化会话数据
2. **用户认证**：添加 JWT/OAuth2 认证机制
3. **WebSocket 支持**：实现实时对话功能
4. **日志系统**：完善日志记录和监控
5. **测试框架**：添加 pytest 测试用例

## 近期新增（2026-07-18 优化）

### 新功能

| 功能 | 说明 | 涉及文件 |
|------|------|---------|
| 教练自省机制 | 每轮评分后教练回顾评分是否合理，允许 ±5 调整 | routes.py, templates.py |
| 教练风格选择 | 温和模式（鼓励为主）/ 严格模式（更高要求） | schemas.py, routes.py, evaluator_coach.py |
| 推理链可视化 | 雷达图可展开评分依据面板 | MiniRadar.tsx, MessageBubble.tsx |
| 页面刷新持久化 | finish 数据存入 session，刷新后不丢失 | schemas.py, routes.py, backendApi.ts |

### 体验优化

| 优化项 | 说明 |
|--------|------|
| probe/feedback 不阻断 | 仅 halt 才阻断对话，建议类消息顾客照常回复 |
| 教练不脑补 | prompt 硬约束：建议必须基于对话原文 |
| 并行 LLM 调用 | 顾客模拟器与评估教练并行执行，响应更快 |
| 结束训练不自动跳转 | 停留当前页，用户手动导航 |
| 按钮加载 + 防抖 | 完成栏和复盘栏所有按钮增加 loading 动画 |
| 卡片宽度统一 | 复盘页所有卡片 padding 统一为 24px |
| 销冠示范多轮切换 | 改为生成三轮对比数据 |
| 对话速度优化 | max_tokens 降低，并行调用 |

### 接口变更

| 接口 | 变更 |
|------|------|
| POST /api/session | 新增 coach_style 字段 |
| POST /api/session | 响应新增 finish_data 字段 |
| GET /api/session/{id} | 响应新增 finish_data 字段 |
| POST /api/chat | 内部优化：模拟器提前启动与评估并行 |

### 评分展示优化（2026-07-18 后续）
| 改动 | 说明 |
|------|------|
| 0 分时不显示详情 | 有实际分数才展开各维度评分面板 |
| 评分进度条 | 每个维度增加迷你进度条，颜色按分数变化（红/琥珀/绿） |
| 评分依据换行 | 各维度评分依据自动换行展示 |
| 布局调整 | "综合评分"文字左置，分数圆圈右置 |
| CriticalTimeline key 修复 | map 增加 idx 保证 key 唯一 |
