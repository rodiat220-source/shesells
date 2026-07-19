# FastAPI 应用入口文件
import app.core.logging_config

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router

# 创建 FastAPI 应用实例
app = FastAPI(title="SheSells API", version="1.0.0")

# CORS 配置 - 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://118.89.19.149"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 健康检查路由
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SheSells API"}

# 挂载路由，统一前缀 /api
app.include_router(router, prefix="/api")


# 根路径由 Nginx 返回静态页面，不暴露后端信息
