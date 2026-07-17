# 错误追踪 Agent - 记录错误次数，决定教练升级级别
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
        self.error_counts: Dict[str, int] = {}

    def track(self, error_type: str) -> str:
        """记录错误并返回升级级别

        需要实现的逻辑：
        - 将 error_type 的计数加一
        - 根据累计次数返回升级级别：
          第 1 次 -> "probe"（黄色提示条追问）
          第 2 次 -> "halt"（蓝色遮罩喊停）
          第 3 次及以上 -> "halt_with_champion"（喊停 + 销冠对比）
        - 用 logging 记录日志
        """
        pass

    def get_count(self, error_type: str) -> int:
        """获取某类错误的累计次数

        需要实现的逻辑：
        - 返回 error_type 的累计次数
        - 未记录过返回 0
        """
        pass

    def reset(self) -> None:
        """清空所有错误计数

        需要实现的逻辑：
        - 清空 error_counts 字典
        - 用 logging 记录日志
        """
        pass


# 全局错误追踪器单例
error_tracker = ErrorTracker()
