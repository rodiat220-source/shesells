# 错误追踪 Agent - 记录错误次数，决定教练升级级别
from __future__ import annotations
import logging
from typing import Dict

logger = logging.getLogger(__name__)

# 支持的错误类型
VALID_ERROR_TYPES = {
    "skipped_probing",      # 跳过探询
    "ignored_concerns",     # 忽略顾虑
    "shallow_reply",        # 回复浅层
    "negative_response",    # 负面回应
    "hard_push",            # 强硬推销
}


class ErrorTracker:
    """错误追踪器，基于内存字典记录错误次数"""

    def __init__(self) -> None:
        """初始化错误计数字典"""
        self.error_counts: Dict[str, Dict[str, int]] = {}

    async def _get_session_counts(
        self,
        session_id: str | None,
        create: bool = True,
    ) -> Dict[str, int]:
        """获取指定会话的错误计数。"""
        key = session_id or "__default__"
        if create:
            return self.error_counts.setdefault(key, {})
        return self.error_counts.get(key, {})

    async def track(self, error_type: str, session_id: str | None = None) -> str:
        """记录错误并返回升级级别

        需要实现的逻辑：
        - 将 error_type 的计数加一
        - 根据累计次数返回升级级别：
          第 1 次 -> "probe"（黄色提示条追问）
          第 2 次 -> "halt"（蓝色遮罩喊停）
          第 3 次及以上 -> "halt_with_champion"（喊停 + 销冠对比）
        - 用 logging 记录日志
        """
        try:
            if error_type not in VALID_ERROR_TYPES:
                logger.warning(f"忽略未知错误类型: {error_type}")
                return "none"

            session_counts = await self._get_session_counts(session_id)
            count = session_counts.get(error_type, 0) + 1
            session_counts[error_type] = count

            if count == 1:
                level = "probe"
            elif count == 2:
                level = "halt"
            else:
                level = "halt_with_champion"

            logger.info(
                f"错误追踪: session={session_id or '__default__'}, "
                f"type={error_type}, count={count}, level={level}"
            )
            return level
        except Exception as e:
            logger.error(f"记录错误失败: {str(e)}")
            raise

    async def get_count(self, error_type: str, session_id: str | None = None) -> int:
        """获取某类错误的累计次数

        需要实现的逻辑：
        - 返回 error_type 的累计次数
        - 未记录过返回 0
        """
        try:
            session_counts = await self._get_session_counts(session_id, create=False)
            return session_counts.get(error_type, 0)
        except Exception as e:
            logger.error(f"读取错误计数失败: {str(e)}")
            raise

    async def reset(self, session_id: str | None = None) -> None:
        """清空所有错误计数

        需要实现的逻辑：
        - 清空 error_counts 字典
        - 用 logging 记录日志
        """
        try:
            if session_id is None:
                self.error_counts.clear()
                logger.info("错误计数已清空")
            else:
                self.error_counts.pop(session_id, None)
                logger.info(f"会话错误计数已清空: {session_id}")
        except Exception as e:
            logger.error(f"清空错误计数失败: {str(e)}")
            raise


# ponytail: 内存计数只适合单进程 Demo，多进程部署时改为共享存储。
# 全局错误追踪器单例
error_tracker = ErrorTracker()
