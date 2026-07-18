"""应用日志配置。"""
import logging
from pathlib import Path

LOG_FILE = Path(__file__).resolve().parents[2] / "app.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
