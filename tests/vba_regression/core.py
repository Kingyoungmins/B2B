#!/usr/bin/env python3
"""공유 평가 유틸 — VBA/Python 정적 체크가 함께 쓰는 자료구조.

`CheckResult`(상태 누적기)와 `extract_code_block`(펜스 코드블록 추출)을 한 곳에
모아 VBA(`vba_static_checks.py`)와 Python(`python_static_checks.py`) 양쪽이 같은
구현을 재사용하게 한다. 개발/품질평가 전용(exe 패키징 대상 아님).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CheckResult:
    status: str = "PASS"
    passed: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    needs_windows: list[str] = field(default_factory=list)

    def fail(self, message: str) -> None:
        self.failures.append(message)
        self.status = "FAIL"

    def warn(self, message: str) -> None:
        self.warnings.append(message)
        if self.status == "PASS":
            self.status = "WARN"

    def need_windows(self, message: str) -> None:
        self.needs_windows.append(message)
        if self.status == "PASS":
            self.status = "NEEDS_WINDOWS"

    def pass_(self, message: str) -> None:
        self.passed.append(message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "passed": self.passed,
            "warnings": self.warnings,
            "failures": self.failures,
            "needs_windows": self.needs_windows,
        }


def extract_code_block(text: str) -> tuple[str | None, str | None]:
    """첫 펜스 코드블록의 (언어, 코드)를 돌려준다. 없으면 (None, None)."""
    match = re.search(r"```([a-zA-Z0-9_-]+)?\s*([\s\S]*?)```", text or "")
    if not match:
        return None, None
    return (match.group(1) or "").strip().lower(), (match.group(2) or "").strip()
