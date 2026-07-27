"""워크북 식별·재바인딩 (Docs/07 §7.6).

교차 워크북 재현의 난제는 "워크북을 무엇으로 식별하느냐"다. 파일명은 다음 달엔
바뀌고(`..._3월.xlsx`), 저장 안 한 통합문서도 있고, 경로/공백 인코딩 차이(%20)도 있다.
키 파생과 정규화는 COM 없이도 테스트 가능한 순수 함수로 둔다.
"""
from __future__ import annotations

import os
from urllib.parse import unquote


def normalize_book_name(s: str) -> str:
    """경로/공백 인코딩 차이를 흡수(eval_eca 가 %20 에서 데임)."""
    if not s:
        return ""
    return unquote(s).strip()


def derive_key(name: str, fullname: str) -> str:
    """저장된 파일이면 경로 포함 FullName, 미저장이면 Name 을 안정 키로."""
    name = normalize_book_name(name)
    fullname = normalize_book_name(fullname)
    if fullname and fullname != name and (os.sep in fullname or "/" in fullname or "\\" in fullname):
        return fullname
    return name


def basename_of(key: str) -> str:
    return os.path.basename(key.replace("\\", "/"))


class WorkbookRegistry:
    """캡처/재현 시 워크북을 키로 추적하고, 슬롯에 바인딩한다."""

    def __init__(self):
        self._books = {}   # key -> {"name", "fullname"}
        self._slots = {}   # slot_label -> key

    # --- COM 워크북 등록 (Excel 있는 PC에서) ---
    @staticmethod
    def key_for(wb) -> str:
        return derive_key(getattr(wb, "Name", ""), getattr(wb, "FullName", ""))

    def register(self, wb, slot: str | None = None) -> str:
        key = self.key_for(wb)
        self._books[key] = {
            "name": normalize_book_name(getattr(wb, "Name", key)),
            "fullname": normalize_book_name(getattr(wb, "FullName", key)),
        }
        if slot:
            self._slots[slot] = key
        return key

    # --- 재현 시 재바인딩 (Docs/07 §7.8) ---
    def bind_slot(self, slot: str, key: str) -> None:
        self._slots[slot] = key

    def key_for_slot(self, slot: str) -> str | None:
        return self._slots.get(slot)

    def find_by_basename(self, basename: str) -> str | None:
        """열린 워크북 중 파일명이 일치하는 키를 찾는다(슬롯 재바인딩 보조)."""
        basename = normalize_book_name(basename)
        for key in self._books:
            if basename_of(key) == basename:
                return key
        return None

    def as_dict(self) -> dict:
        return {"books": dict(self._books), "slots": dict(self._slots)}
