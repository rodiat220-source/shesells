# 会话管理文件 - 使用内存字典存储会话数据
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class SessionManager:
    """会话管理器，基于内存字典存储"""

    def __init__(self) -> None:
        """初始化会话存储字典"""
        self._sessions: Dict[str, dict] = {}

    def create(self, session_id: str, data: dict) -> None:
        """创建新会话

        Args:
            session_id: 会话 ID
            data: 会话初始数据
        """
        self._sessions[session_id] = data
        logger.info(f"创建会话: {session_id}")

    def save(self, session_id: str, data: dict) -> None:
        """保存会话数据

        Args:
            session_id: 会话 ID
            data: 会话数据
        """
        self._sessions[session_id] = data
        logger.info(f"保存会话: {session_id}")

    def load(self, session_id: str) -> Optional[dict]:
        """加载会话数据

        Args:
            session_id: 会话 ID

        Returns:
            会话数据，不存在返回 None
        """
        data = self._sessions.get(session_id)
        if data is None:
            logger.warning(f"会话不存在: {session_id}")
        else:
            logger.info(f"加载会话: {session_id}")
        return data

    def exists(self, session_id: str) -> bool:
        """检查会话是否存在

        Args:
            session_id: 会话 ID

        Returns:
            存在返回 True，否则返回 False
        """
        exists = session_id in self._sessions
        logger.info(f"检查会话存在: {session_id} -> {exists}")
        return exists


# 全局会话管理器单例
session_manager = SessionManager()
