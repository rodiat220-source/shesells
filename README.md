# SheSells

AI 销售教练 Agent，通过模拟顾客对话 + 主动教练反馈，帮 BA 练出"懂顾客"的能力。

> 第三幕 · 黑客松 2026

---

## 项目概述

SheSells 是一个 AI 驱动的销售训练平台，模拟真实顾客场景，让美妆 BA（Beauty Advisor）在安全环境中练习销售技巧。平台提供：

- **动态顾客模拟**：按标签生成个性化顾客画像，模拟真实对话
- **主动教练反馈**：实时评估 BA 表现，主动追问/喊停，给出可执行建议
- **结局判定**：三种结局（成交/流失/待跟进），视觉化复盘
- **案例复盘**：BA 可贴入失败案例，AI 分析并生成销冠对比
- **销冠对比**：LLM 实时生成销冠级话术，贴合当前画像

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4 |
| 状态管理 | Zustand 5 |
| 图表 | Recharts 3 |
| 图标 | lucide-react |
| 后端 | Python 3.10+ FastAPI + Uvicorn |
| LLM 调用 | httpx（兼容 OpenAI API 格式） |
| 数据模型 | Pydantic 2 |
| 会话存储 | 内存字典 (SessionManager) |

---

## 快速启动

### 环境要求

- Python 3.10+
- Node.js 18+
- pnpm

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # 编辑 .env 填入 LLM_API_KEY 等配置
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
pnpm install
cp .env.local.example .env.local   # 配置 NEXT_PUBLIC_BACKEND_API_BASE_URL
pnpm dev
```

浏览器打开 `http://localhost:3000`

---

## 目录结构

```
sheSells/
├── backend/                    # Python FastAPI 后端
│   └── app/
│       ├── main.py             # FastAPI 入口
│       ├── api/                # API 路由 + 数据模型
│       ├── agents/             # CustomerSimulator / EvaluatorCoach / ErrorTracker
│       ├── core/               # 配置 / LLM 客户端 / 会话管理 / 日志
│       └── prompts/            # LLM Prompt 模板
├── frontend/                   # Next.js 前端
│   ├── app/                    # 页面（App Router）
│   ├── components/             # UI 组件
│   └── src/                    # 业务逻辑 / 状态管理 / 类型
├── docs/                       # 产品 + 技术文档
│   ├── product/                # 产品需求文档
│   └── technical/              # 技术设计文档
├── AGENTS.md                   # AI Agent 代码规范
├── ARCHITECTURE.md             # 项目架构文档
└── README.md                   # 本文件
```

---

## 相关文档

- [AGENTS.md](AGENTS.md) — AI Agent 代码规范（前后端全栈）
- [ARCHITECTURE.md](ARCHITECTURE.md) — 项目架构文档
- [技术详设](docs/technical/SheSells-技术详设.md) — 施工图纸（API / 数据模型 / Agent Core）
- [后端阅读指南](docs/technical/SheSells-后端阅读指南.md) — 后端文档导航
- [前端阅读指南](docs/technical/SheSells-前端阅读指南.md) — 前端文档导航
