"""Centralized logging factory - UTF-8 safe for Windows"""
import logging
import sys
from typing import Optional


def get_logger(name: str) -> logging.Logger:
    """Return a named logger."""
    return logging.getLogger(name)


def configure_logging(log_file: Optional[str] = None, level: str = "INFO"):
    """Configure root logger with UTF-8 safe handlers (call once at startup)."""
    fmt = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    handlers: list = []

    if log_file:
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(fmt)

    # Windows UTF-8 safety
    if hasattr(stream_handler.stream, "reconfigure"):
        try:
            stream_handler.stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    else:
        try:
            import io
            stream_handler.stream = io.TextIOWrapper(
                stream_handler.stream.buffer,
                encoding="utf-8",
                errors="replace",
                line_buffering=True,
            )
        except AttributeError:
            pass

    handlers.append(stream_handler)

    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=handlers,
    )
