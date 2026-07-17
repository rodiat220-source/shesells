# SheSells AI 销售教练 · 前端

> 黑客松 2026 · 美妆销售顾问 AI 实战陪练

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.2.6 | 框架（App Router） |
| React | 19.2.6 | UI 库 |
| TypeScript | 5.9.3 | 类型安全 |
| Tailwind CSS | 4.2.1 | 样式 |
| Zustand | 5.0.14 | 状态管理 |
| Recharts | 3.9.2 | 雷达图 |
| lucide-react | 1.24.0 | 图标 |
| Zod | 4.4.3 | 数据校验 |

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式（默认端口 3000）
pnpm dev

# 构建生产版本（standalone 模式）
pnpm build

# 启动生产服务
pnpm start
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```env
# 后端 API 地址
NEXT_PUBLIC_BACKEND_API_BASE_URL=http://localhost:8000
```

生产环境创建 `.env.production`：

```env
NEXT_PUBLIC_BACKEND_API_BASE_URL=https://api.your-domain.com
```

## 目录结构

```
frontend/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 全局布局（含 metadataBase）
│   ├── page.tsx                # 首页（开始训练入口）
│   ├── error.tsx               # 全局错误边界
│   ├── loading.tsx             # 全局骨架屏
│   ├── globals.css             # 全局样式
│   ├── session/[id]/           # 训练会话
│   │   ├── page.tsx            # 会话详情页
│   │   ├── conversation/       # 对话回看页
│   │   └── review/             # 复盘总结页
│   └── dev/                    # 开发调试页面
├── components/                 # UI 组件
│   ├── ChatContainer.tsx       # 聊天消息容器
│   ├── MessageBubble.tsx       # 消息气泡（BA/顾客/教练）
│   ├── BAInput.tsx             # BA 输入框
│   ├── MiniRadar.tsx           # 迷你雷达图
│   ├── CriticalTimeline.tsx    # 关键时刻时间线
│   └── ReplayInline.tsx        # 销冠对比回放
├── src/
│   ├── lib/
│   │   ├── backendApi.ts       # 后端 API 封装（直接调用后端）
│   │   └── data/
│   │       ├── mock.ts         # 开发调试用模拟数据
│   │       └── coachStateFixtures.ts  # 教练状态测试数据
│   ├── store/
│   │   └── sessionStore.ts     # Zustand 会话状态管理
│   └── types/
│       └── index.ts            # TypeScript 类型定义
├── public/                     # 静态资源
├── docs/                       # 设计文档
├── scripts/                    # 脚本
├── tests/                      # 测试
├── .env.example                # 环境变量示例
├── .env.local                  # 本地开发环境变量
├── next.config.ts              # Next.js 配置（standalone 输出）
├── tsconfig.json               # TypeScript 配置
├── postcss.config.mjs          # PostCSS 配置
├── eslint.config.mjs           # ESLint 配置
└── package.json
```

## API 调用

前端直接调用后端 API，无代理层：

```
浏览器 → backendApi.ts → http://localhost:8000/api/xxx（Python 后端）
```

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/session` | POST | 创建训练会话 |
| `/api/session/{id}` | GET | 获取会话详情 |
| `/api/chat` | POST | 发送消息 |
| `/api/chat/continue` | POST | 继续对话（教练喊停后） |
| `/api/finish` | POST | 结束训练，获取总结 |

## 部署

### 构建

```bash
pnpm build
```

构建产物在 `.next/standalone` 目录，可独立运行，不依赖 node_modules。

### Linux + Nginx 部署

```bash
# 1. 构建并上传
pnpm build
scp -r .next/standalone user@server:/opt/shesells-frontend/

# 2. 服务器上启动
cd /opt/shesells-frontend
node server.js

# 3. Nginx 反向代理
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

### 前后端同域名（Nginx 分流）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
    }

    # API 代理到后端
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
}
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | 运行测试 |
| `pnpm test:backend` | 后端接口冒烟测试 |
