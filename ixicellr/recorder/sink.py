"""Action 싱크 — 시간순 IR 적재 (COM 무관, 테스트 가능)."""
from __future__ import annotations

from typing import List

from ..model.action_ir import WEAK_KINDS, Action, Target


class ActionSink:
    def __init__(self):
        self.actions: List[Action] = []
        self._seq = 0

    def emit(self, kind: str, book: str, sheet: str = "", rng: str = "",
             payload: dict | None = None, evidence: dict | None = None,
             weak: bool | None = None) -> Action:
        self._seq += 1
        if weak is None:
            weak = kind in WEAK_KINDS
        action = Action(self._seq, kind, Target(book, sheet, rng),
                        payload or {}, evidence or {}, weak)
        self.actions.append(action)
        return action

    def strong(self) -> List[Action]:
        return [a for a in self.actions if not a.weak]

    def __len__(self) -> int:
        return len(self.actions)
