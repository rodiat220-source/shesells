# SheSells AI Agent 代码规范

> 黑客松 2026 · 5天交付 · 前后端全栈规范

---

## 1. 核心原则

| 原则 | 说明 |
|------|------|
| 先确认再生成 | 不清楚的需求先问，不猜不臆测 |
| 不要过度设计 | 黑客松够用就行，优先交付可运行版本 |
| 遵循项目风格 | 参考已有代码风格，保持一致性 |
| 只生成需要的代码 | 不自动扩展功能，不画蛇添足 |

---

## 2. Python 后端规范

### 2.1 基本要求

- Python 3.10+
- 所有函数使用 `async def`
- 必须写类型注解
- 使用 Pydantic BaseModel 做数据校验
- 中文注释，简洁说明用途

### 2.2 正确示例

```python
# 正确示例
from typing import Optional
from pydantic import BaseModel

class ChatRequest(BaseModel):
    """聊天请求模型"""
    session_id: str
    message: str

async def process_chat(request: ChatRequest) -> dict:
    """处理聊天请求"""
    # 业务逻辑
    return {"response": "hello"}
```

### 2.3 错误示例

```python
# 错误示例 - 不要这样写
def process_chat(request):  # ❌ 缺少 async 和类型注解
    # 没有注释
    return "hello"  # ❌ 直接返回字符串，不符合统一响应格式
```

---

## 3. 目录结构

```
backend/
├── app/
│   ├── main.py                    # FastAPI 入口
│   ├── api/
│   │   ├── routes.py              # API 路由定义
│   │   └── schemas.py             # 请求/响应数据模型
│   ├── core/
│   │   ├── config.py              # 配置管理
│   │   ├── llm_client.py          # LLM API 调用封装
│   │   └── session_manager.py     # 内存会话管理（不用 Redis）
│   ├── agents/
│   │   ├── customer_simulator.py  # 顾客模拟器 Agent
│   │   ├── evaluator_coach.py     # 评估教练 Agent
│   │   └── error_tracker.py       # 错误追踪 Agent
│   └── prompts/
│       └── templates.py           # 提示词模板
├── requirements.txt
├── .env.example
└── .gitignore
```

**严格遵守以上目录结构，不要随意新增目录！**

---

## 4. 导入规范

- 使用绝对导入：`from app.core.config import settings`
- 禁止使用相对导入：不要用 `from .config import settings`

```python
# 正确
from app.core.config import settings
from app.api.schemas import ChatRequest
from app.agents.customer_simulator import CustomerSimulator

# 错误
from .config import settings  # ❌
from ..api.schemas import ChatRequest  # ❌
```

---

## 5. 错误处理要求

- 必须有 try-except 捕获异常
- 必须用 logging 记录日志，禁止使用 print

```python
import logging

logger = logging.getLogger(__name__)

async def process_chat(request: ChatRequest) -> dict:
    try:
        # 业务逻辑
        result = await do_something()
        return result
    except Exception as e:
        logger.error(f"处理聊天请求失败: {str(e)}")
        raise
```

---

## 6. API 规范

### 6.1 路径前缀

所有 API 路径前缀为 `/api`

### 6.2 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/session` | 创建会话 |
| GET | `/api/session/{id}` | 获取会话详情 |
| POST | `/api/chat` | 发送消息，获取响应 |
| POST | `/api/finish` | 结束会话，获取评估 |

### 6.3 统一响应格式

```python
{
    "code": 0,        # 0 表示成功，非 0 表示错误
    "data": {...},    # 数据内容
    "message": "success"  # 提示信息
}
```

---

## 7. 禁止事项

| 禁止行为 | 说明 |
|----------|------|
| 同步阻塞代码 | 必须使用 async/await |
| 硬编码敏感信息 | 敏感信息通过环境变量配置 |
| 随意新增目录 | 严格遵守现有目录结构 |
| 引入不必要的库 | 只使用 requirements.txt 中的库 |
| 用 print 调试 | 使用 logging |
| 不写类型注解 | 所有函数必须有类型注解 |
| 不写注释 | 关键代码必须有中文注释 |

---

## 8. 开发流程

```
1. 先问后写
   └── 确认需求细节，避免误解

2. 小步迭代
   └── 每次只写一个功能，确保可运行

3. 写前确认
   └── 确认在哪个文件写，是否符合目录规范

4. 写后自检
   └── 检查格式、类型、注释是否完整
```

---

## 9. 代码模板

### 9.1 Agent 类模板

```python
import logging
from typing import Any

logger = logging.getLogger(__name__)

class NewAgent:
    """新 Agent 类说明"""
    
    def __init__(self):
        """初始化 Agent"""
        # 初始化资源
    
    async def process(self, data: dict) -> Any:
        """处理方法
        
        Args:
            data: 输入数据
            
        Returns:
            处理结果
        """
        try:
            # 业务逻辑
            logger.info(f"NewAgent 处理数据: {data}")
            return {}
        except Exception as e:
            logger.error(f"NewAgent 处理失败: {str(e)}")
            raise
```

### 9.2 API 路由模板

```python
from fastapi import APIRouter, HTTPException
from app.api.schemas import RequestModel, ResponseModel

router = APIRouter()

@router.post("/api/xxx", response_model=dict)
async def xxx_endpoint(request: RequestModel) -> dict:
    """接口说明"""
    try:
        # 业务逻辑
        result = {}
        return {"code": 0, "data": result, "message": "success"}
    except Exception as e:
        logger.error(f"接口执行失败: {str(e)}")
        return {"code": -1, "data": None, "message": str(e)}
```

---

## 10. 开发环境

### 10.1 版本要求

| 依赖 | 版本 |
|------|------|
| Python | 3.10+ |
| FastAPI | 0.100+ |
| httpx | 0.25+ |
| Pydantic | 2.0+ |
| uvicorn | latest |

### 10.2 启动命令

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 10.3 环境变量

复制 `.env.example` 为 `.env`，配置以下变量：

```env
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.example.com/v1
LLM_MODEL=gpt-4
```

---

## 11. 协作说明

- 前后端分离，后端独立运行在 `localhost:8000`
- 使用内存字典存储会话数据，**不要使用 Redis**
- 另一位后端同学会基于此骨架继续开发，保持代码整洁

---

## 12. 前端规范

### 12.1 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.2.6 | 框架（App Router） |
| React | 19.2.6 | UI 库 |
| TypeScript | 5.9.3 | 类型安全 |
| Tailwind CSS | 4.2.1 | 样式 |
| Zustand | 5.0.14 | 状态管理 |
| Recharts | 3.9.2 | 雷达图 |

### 12.2 目录结构（必须遵守）

```
frontend/
├── app/                        # Next.js App Router 页面
│   ├── layout.tsx              # 全局布局
│   ├── page.tsx                # 首页
│   ├── globals.css             # 全局样式
│   ├── session/[id]/           # 训练会话页面
│   └── dev/                    # 开发调试页面
├── components/                 # UI 组件
├── src/
│   ├── lib/
│   │   ├── backendApi.ts       # 后端 API 封装（唯一直连后端的入口）
│   │   └── data/               # 模拟数据
│   ├── store/
│   │   └── sessionStore.ts     # Zustand 状态管理
│   └── types/
│       └── index.ts            # 类型定义
├── public/                     # 静态资源
├── .env.local                  # 环境变量
└── next.config.ts              # Next.js 配置（output: standalone）
```

**严格遵守以上目录结构，不要随意新增目录！**

### 12.3 API 调用规范

- 前端直接调用后端 API，**不要新建 Next.js API Route 代理层**
- 所有后端请求统一通过 `src/lib/backendApi.ts` 封装
- 后端地址通过环境变量 `NEXT_PUBLIC_BACKEND_API_BASE_URL` 配置

```
浏览器 → backendApi.ts → http://localhost:8000/api/xxx（Python 后端）
```

### 12.4 导入规范

- 使用 `@/` 路径别名（指向 `frontend/` 根目录）
- 组件用 `@/components/xxx`
- 业务逻辑用 `@/src/lib/xxx`、`@/src/store/xxx`、`@/src/types/xxx`

```typescript
// 正确
import { useSessionStore } from "@/src/store/sessionStore";
import { ChatContainer } from "@/components/ChatContainer";

// 错误
import { useSessionStore } from "../../src/store/sessionStore";  // ❌ 相对路径
```

### 12.5 组件规范

- 使用函数式组件
- 客户端组件必须标记 `"use client"`
- Props 必须定义 TypeScript 接口
- 状态管理统一用 Zustand，不要引入 Redux/Context

### 12.6 前端禁止事项

| 禁止行为 | 说明 |
|----------|------|
| 新建 API Route 代理 | 直接调用后端，不经过 Next.js API Route |
| 引入新的状态管理库 | 统一用 Zustand |
| 引入新的 UI 库 | 统一用 Tailwind CSS + lucide-react |
| 使用相对路径导入 | 使用 `@/` 别名 |
| 硬编码后端地址 | 通过环境变量配置 |

### 12.7 启动命令

```bash
cd frontend
pnpm install
pnpm dev          # 开发模式，端口 3000
pnpm build        # 生产构建（standalone）
pnpm start        # 生产启动
```

### 12.8 环境变量

```env
# .env.local（开发）
NEXT_PUBLIC_BACKEND_API_BASE_URL=http://localhost:8000

# .env.production（生产）
NEXT_PUBLIC_BACKEND_API_BASE_URL=https://api.your-domain.com
```
