"""Skill / Step / Param 모델 (Docs/06 §6.1, Docs/05 §5.2).

Step 은 distiller 가 만든 '정규화 스텝'으로, 리플레이 엔진의 입력이다.
값/수식은 문자열 코드가 아니라 payload 안의 데이터로 보관한다(따옴표·한글·줄바꿈 안전).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from .action_ir import Target


@dataclass
class Param:
    """리플레이 시 해석되는 변수 (Docs/05 §5.2)."""
    name: str
    type: str  # month|date|year|path|sheet_name|value_table
    anchor: Optional[str] = None
    policy: str = "fixed_offset"  # advance_by_run|to_current_month|fixed_offset
    appears_in: List[str] = field(default_factory=list)
    template: Optional[str] = None
    match: Optional[str] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in {
            "name": self.name, "type": self.type, "anchor": self.anchor,
            "policy": self.policy, "appears_in": self.appears_in,
            "template": self.template, "match": self.match,
        }.items() if v not in (None, [], "")}

    @classmethod
    def from_dict(cls, d: dict) -> "Param":
        return cls(
            name=d["name"], type=d["type"], anchor=d.get("anchor"),
            policy=d.get("policy", "fixed_offset"), appears_in=d.get("appears_in", []),
            template=d.get("template"), match=d.get("match"),
        )


@dataclass
class Step:
    id: str
    kind: str
    enabled: bool = True
    description: str = ""
    target: Optional[Target] = None
    source: Optional[Target] = None  # copy_paste/copy_sheet 의 원본
    payload: dict = field(default_factory=dict)
    params_ref: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = {
            "id": self.id, "kind": self.kind, "enabled": self.enabled,
            "description": self.description, "payload": self.payload,
        }
        if self.target is not None:
            d["target"] = self.target.to_dict()
        if self.source is not None:
            d["source"] = self.source.to_dict()
        if self.params_ref:
            d["params_ref"] = self.params_ref
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Step":
        return cls(
            id=str(d["id"]), kind=d["kind"], enabled=bool(d.get("enabled", True)),
            description=d.get("description", ""),
            target=Target.from_dict(d["target"]) if d.get("target") else None,
            source=Target.from_dict(d["source"]) if d.get("source") else None,
            payload=d.get("payload") or {}, params_ref=d.get("params_ref", []),
        )


@dataclass
class Skill:
    name: str
    schema: str = "icr/1"
    version: int = 1
    engine: str = "com"  # com | com+vba
    anchor_period: Optional[str] = None
    params: List[Param] = field(default_factory=list)
    steps: List[Step] = field(default_factory=list)
    schedule: dict = field(default_factory=dict)
    low_spec: dict = field(default_factory=dict)
    created: Optional[str] = None  # 런타임에서 스탬프(스크립트 결정성 위해 외부 주입)

    def enabled_steps(self) -> List[Step]:
        return [s for s in self.steps if s.enabled]

    def manifest(self) -> dict:
        """steps 본문을 제외한 매니페스트(steps_order 만 포함)."""
        return {
            "schema": self.schema, "name": self.name, "version": self.version,
            "engine": self.engine, "anchor_period": self.anchor_period,
            "created": self.created,
            "params": [p.to_dict() for p in self.params],
            "schedule": self.schedule, "low_spec": self.low_spec,
            "steps_order": [s.id for s in self.steps],
        }

    @classmethod
    def from_manifest(cls, manifest: dict, steps: List[Step]) -> "Skill":
        order = manifest.get("steps_order")
        if order:
            by_id = {s.id: s for s in steps}
            steps = [by_id[i] for i in order if i in by_id]
        return cls(
            name=manifest.get("name", "skill"),
            schema=manifest.get("schema", "icr/1"),
            version=int(manifest.get("version", 1)),
            engine=manifest.get("engine", "com"),
            anchor_period=manifest.get("anchor_period"),
            created=manifest.get("created"),
            params=[Param.from_dict(p) for p in manifest.get("params", [])],
            steps=steps,
            schedule=manifest.get("schedule", {}),
            low_spec=manifest.get("low_spec", {}),
        )
