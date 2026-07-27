""".icr 스킬 번들 저장/로드 (Docs/06 §6.1).

.icr 는 zip 컨테이너:
    manifest.json              # 스킬 메타 + params + schedule + steps_order
    steps/000_kind.json        # 정규화 스텝(리플레이 입력)
    recordings/raw_actions.jsonl  # 원시 IR(재정제용)

값/수식은 코드 문자열이 아니라 데이터(JSON)로 저장한다 → 따옴표·한글·줄바꿈 안전.
"""
from __future__ import annotations

import json
import zipfile
from typing import List, Optional, Tuple

from ..model.action_ir import Action
from ..model.skill import Skill, Step

_RAW_PATH = "recordings/raw_actions.jsonl"


def save(skill: Skill, path: str, *, raw_actions: Optional[List[Action]] = None) -> str:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("manifest.json",
                   json.dumps(skill.manifest(), ensure_ascii=False, indent=2))
        for s in skill.steps:
            z.writestr(f"steps/{s.id}_{s.kind}.json",
                       json.dumps(s.to_dict(), ensure_ascii=False, indent=2))
        if raw_actions:
            body = "\n".join(json.dumps(a.to_dict(), ensure_ascii=False) for a in raw_actions)
            z.writestr(_RAW_PATH, body + "\n")
    return path


def load(path: str) -> Tuple[Skill, List[Action]]:
    with zipfile.ZipFile(path, "r") as z:
        manifest = json.loads(z.read("manifest.json").decode("utf-8"))
        steps: List[Step] = []
        for name in z.namelist():
            if name.startswith("steps/") and name.endswith(".json"):
                steps.append(Step.from_dict(json.loads(z.read(name).decode("utf-8"))))
        steps.sort(key=lambda s: s.id)
        skill = Skill.from_manifest(manifest, steps)

        raw: List[Action] = []
        if _RAW_PATH in z.namelist():
            for line in z.read(_RAW_PATH).decode("utf-8").splitlines():
                line = line.strip()
                if line:
                    raw.append(Action.from_dict(json.loads(line)))
    return skill, raw
