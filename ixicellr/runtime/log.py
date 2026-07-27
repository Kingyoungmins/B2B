"""파일 로깅 — 디버깅용.

- exe(frozen) 실행: exe 파일 위치 옆 logs\\ixi-cell-r.log
- 소스 실행: %LOCALAPPDATA%\\ixi-Cell-R\\logs\\ixi-cell-r.log
핫패스(매 키 입력)에는 절대 쓰지 않는다. 수명주기·캡처·정지 덤프·하트비트·오류만.
"""
from __future__ import annotations

import logging
import os
import sys
import traceback

_logger = None


def _appdata_logs() -> str:
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    return os.path.join(base, "ixi-Cell-R", "logs")


def log_dir() -> str:
    # exe 면 exe 옆, 소스면 LOCALAPPDATA. 쓰기 실패 시 LOCALAPPDATA → 홈 폴백.
    if getattr(sys, "frozen", False):
        primary = os.path.join(os.path.dirname(os.path.abspath(sys.executable)), "logs")
    else:
        primary = _appdata_logs()
    for d in (primary, _appdata_logs(), os.path.expanduser("~")):
        try:
            os.makedirs(d, exist_ok=True)
            return d
        except Exception:
            continue
    return os.path.expanduser("~")


def log_path() -> str:
    return os.path.join(log_dir(), "ixi-cell-r.log")


def get_logger():
    global _logger
    if _logger is not None:
        return _logger
    lg = logging.getLogger("ixicellr")
    lg.setLevel(logging.DEBUG)
    if not lg.handlers:
        try:
            fh = logging.FileHandler(log_path(), encoding="utf-8")
            fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)-5s %(message)s"))
            lg.addHandler(fh)
        except Exception:
            lg.addHandler(logging.NullHandler())
    _logger = lg
    return lg


def info(msg: str):
    try:
        get_logger().info(msg)
    except Exception:
        pass


def warn(msg: str):
    try:
        get_logger().warning(msg)
    except Exception:
        pass


def error(msg: str, exc: BaseException | None = None):
    try:
        if exc is not None:
            msg = f"{msg}\n{''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))}"
        get_logger().error(msg)
    except Exception:
        pass


def banner(msg: str):
    info("=" * 8 + f" {msg} " + "=" * 8)
