"""ctx 헬퍼 통합의 '등가 게이트' + LLM 통합기.

목표(사용자 요청): 녹화가 여러 개의 저수준 ctx 호출로 남긴 것을, **기존 ctx 헬퍼**로
최대한 묶어(스킬 남발/대기 감소) 재작성한다. 새 헬퍼는 만들지 않는다.

안전 원칙: LLM 재작성은 틀릴 수 있으므로, 원본과 후보를 MemCtx(COM 없는 인메모리 재현)로
각각 돌려 **전 시트 상태 digest 가 완전히 같을 때만** 채택한다. 다르면 원본 유지(무해).
따라서 순서/의미가 꼬이는 재작성은 게이트에서 자동 탈락한다.

등가 판정은 결정론 write/서식 계열에 한정한다(상태 의존 sort/insert/delete/paste/filter 가
섞인 그룹은 빈-시드 재현으로는 등가를 보증할 수 없어 통합 대상에서 제외 → 원본 유지)."""
from __future__ import annotations

import ast
import re

from .memctx import MemCtx

# 상태 무관(빈 시드 재현으로 등가 판정이 건전한) 헬퍼 — 통합 허용 대상.
# [주의] 이 목록은 B2B 서버 실행 ctx(serve_b2b.PythonComSkillContext)에 실제로 존재하는
# 헬퍼만 담아야 한다. MemCtx 에만 있는 헬퍼(과거 set_fill/set_borders)를 넣으면 등가
# 게이트는 통과하는데 실행 시 AttributeError 로 죽는 시한폭탄이 된다 — 정합은
# test_record_service.TestExecutorContract 가 정적으로 검사한다.
STATE_INDEP_HELPERS = frozenset({
    "write", "write_formulas", "clear", "merge", "unmerge",
    "set_number_format", "apply_format_state",
})

# 위험 구문(record-review.js RECORD_INTENT_FORBIDDEN 과 동일 계열).
_FORBIDDEN = [re.compile(p) for p in (
    r"\bimport\b", r"__\w", r"\bexec\s*\(", r"\beval\s*\(", r"\bcompile\s*\(",
    r"\bopen\s*\(", r"\bsubprocess\b", r"\bos\.", r"\bsys\.", r"\bglobals\s*\(",
    r"\blocals\s*\(", r"\bgetattr\s*\(", r"\bsetattr\s*\(",
)]

_SAFE_BUILTINS = {
    "range": range, "len": len, "list": list, "dict": dict, "tuple": tuple,
    "min": min, "max": max, "sum": sum, "abs": abs, "round": round,
    "enumerate": enumerate, "zip": zip, "sorted": sorted, "reversed": reversed,
    "map": map, "filter": filter, "str": str, "int": int, "float": float,
    "bool": bool, "set": set, "any": any, "all": all, "None": None,
    "True": True, "False": False,
}

_CTX_CALL = re.compile(r"\bctx\.(\w+)\s*\(")


def _type_tag(v):
    """등가 비교용 값 타입 태그 — 숫자/문자/빈값을 구분(타입만 바뀐 후보 검출용)."""
    if v is None or v == "":
        return "empty"
    if isinstance(v, bool):
        return "bool"
    if isinstance(v, (int, float)):
        return "num"
    s = str(v)
    if s.startswith("="):
        return "formula"
    return "str"


def ctx_helpers_used(code: str):
    """코드가 호출하는 ctx.<helper> 이름 목록(중복 포함, 등장 순)."""
    return _CTX_CALL.findall(code or "")


def _is_safe(code: str) -> bool:
    if "def transform" not in code:
        return False
    if not _CTX_CALL.search(code):
        return False
    return not any(p.search(code) for p in _FORBIDDEN)


def _run_digest(code: str):
    """transform(ctx) 를 샌드박스에서 MemCtx 로 돌려 전 시트 digest 반환. 실패 시 None."""
    if not _is_safe(code):
        return None
    from record_service import digest_grid  # 지연 임포트(순환 방지)
    try:
        ast.parse(code)
        ctx = MemCtx()
        ns = {"__builtins__": _SAFE_BUILTINS}
        exec(compile(code, "<skill>", "exec"), ns, ns)  # noqa: S102 — 샌드박스 exec
        fn = ns.get("transform")
        if not callable(fn):
            return None
        fn(ctx)
        return ctx.state_digest(digest_grid), ctx.calls
    except Exception:
        return None


def equivalent(code_a: str, code_b: str):
    """두 스킬 코드가 재현 결과(전 시트 상태)가 동일한가. (bool, callsA, callsB)."""
    ra = _run_digest(code_a)
    rb = _run_digest(code_b)
    if ra is None or rb is None:
        return False, None, None
    (da, ca), (db, cb) = ra, rb
    return da == db, ca, cb


def _run_touched(code: str):
    """샌드박스 실행 후 (전 시트 digest, 건드린 셀 맵). 실패 시 None.

    건드린 셀 맵은 write/write_formulas 한 좌표→정규화값(None 포함) — digest 와 달리
    'None 을 쓴 셀'과 '안 건드린 셀'을 구분한다(gap 덮어쓰기 검출)."""
    if not _is_safe(code):
        return None
    from record_service import digest_grid, _norm_cell  # 지연 임포트(순환 방지)
    try:
        ast.parse(code)
        ctx = MemCtx()
        ns = {"__builtins__": _SAFE_BUILTINS}
        exec(compile(code, "<skill>", "exec"), ns, ns)  # noqa: S102 — 샌드박스 exec
        fn = ns.get("transform")
        if not callable(fn):
            return None
        fn(ctx)
        # 타입 태그를 붙여 비교 — _norm_cell 단독은 1/1.0/"1" 을 같은 "1" 로 붕괴시켜
        # 타입만 바뀐 후보를 수용할 수 있다(C2). 태그(num/str/empty)를 함께 키로 써
        # 타입 변경을 검출한다. digest(부동소수 오차 흡수)는 건드리지 않는다.
        wmap = {k: (_type_tag(v), _norm_cell(v)) for k, v in ctx.writes.items()}
        return ctx.state_digest(digest_grid), wmap
    except Exception:
        return None


def touched_equivalent(code_a: str, code_b: str) -> bool:
    """두 스킬이 '건드린 셀 집합과 값' + 전 시트 상태가 완전히 같은가.

    equivalent(digest만) 와 달리 gap 좌표에 None 을 쓴 코드를 '안 건드린' 코드와
    구분한다 → 붙여넣기 통합이 원본이 안 만지던 칸을 빈값으로 덮는지 검출."""
    ra = _run_touched(code_a)
    rb = _run_touched(code_b)
    if ra is None or rb is None:
        return False
    return ra[0] == rb[0] and ra[1] == rb[1]


def extract_python(raw: str):
    """LLM 응답에서 ```python 코드 추출 + 안전 검증. 실패 시 None."""
    m = re.search(r"```(?:python)?\s*\n([\s\S]*?)```", raw or "")
    code = (m.group(1) if m else (raw or "")).strip()
    if not code:
        return None
    code = code + "\n"
    return code if _is_safe(code) else None


CONSOLIDATE_SYSTEM = (
    "당신은 엑셀 자동화 스킬 코드를 '기존 ctx 헬퍼로 최대한 묶어' 간결하게 만드는 "
    "최적화 도우미입니다.\n"
    "- 입력은 def transform(ctx): 함수 하나. ctx 의 기존 헬퍼만 씁니다. 새 헬퍼/함수/import 금지.\n"
    "- 허용 헬퍼: ctx.write(sheet,start,grid), ctx.write_formulas(sheet,start,grid), "
    "ctx.clear(sheet,range), ctx.merge/unmerge(sheet,range), "
    "ctx.set_number_format(sheet,range,fmt), ctx.apply_format_state(sheet,range,fmt).\n"
    "  채우기색/테두리는 apply_format_state 의 fmt 로만 표현하세요(전용 헬퍼 없음).\n"
    "- 목표: 같은 시트의 인접/연속 저수준 호출을 '범위 하나로 합친' 벌크 호출로 줄입니다.\n"
    "  (예: 셀마다 ctx.write 한 것을 한 범위 ctx.write 로; 행마다 같은 수식을 write_formulas 한 것을\n"
    "  한 범위로; 인접 셀 같은 서식을 한 범위 호출로.)\n"
    "- 절대 규칙: 최종 셀 값/서식과 '동작 순서에 따른 결과'가 원본과 완전히 동일해야 합니다.\n"
    "  값이 하나라도 바뀌면 안 됩니다. 확신이 없으면 그 부분은 원본 그대로 두세요.\n"
    "- 출력은 수정된 코드 전체를 ```python 블록 하나로만. 설명 금지."
)


def consolidate_via_llm(code: str, llm_fn):
    """녹화 스킬 코드를 기존 ctx 헬퍼로 통합 재작성. llm_fn(system,user)->str 주입.

    반환: (통합코드, 원본호출수, 통합호출수) — 통합 성공 시. 실패/부적격/등가아님이면 None.
    정책: 상태 무관 헬퍼만 쓰는 그룹만 시도(그 외는 등가 보증 불가 → 원본 유지).

    관측성: 통합이 왜 안 됐는지 알 수 없으면(특히 vLLM 불통 시 조용히 원본 유지)
    운영에서 통합이 영구 비활성돼도 아무도 모른다. consolidate_via_llm_reason 이
    (결과, 사유) 를 함께 돌려주고, 이 함수는 하위호환을 위해 결과만 반환한다."""
    res, _reason = consolidate_via_llm_reason(code, llm_fn)
    return res


def consolidate_via_llm_reason(code: str, llm_fn):
    """consolidate_via_llm 의 사유 노출 버전. 반환: ((cand, ca, cb) 또는 None, reason).

    reason 코드: already_minimal / state_dependent(상태의존 헬퍼) / llm_unreachable(vLLM 오류) /
    empty_candidate(코드 추출 실패) / unsafe_candidate(허용 밖 헬퍼) / gate_rejected(비등가) /
    no_gain(더 짧지 않음) / consolidated(성공)."""
    used = ctx_helpers_used(code)
    if len(used) < 2:
        return None, "already_minimal"  # 이미 1호출 이하 — 통합 여지 없음
    if any(h not in STATE_INDEP_HELPERS for h in used):
        return None, "state_dependent"  # 상태 의존 헬퍼 포함 → 등가 게이트 부적격, 원본 유지
    user = "```python\n" + code + "```\n위 코드를 기존 ctx 헬퍼로 최대한 묶어 재작성하세요."
    try:
        raw = llm_fn(CONSOLIDATE_SYSTEM, user)
    except Exception:
        return None, "llm_unreachable"  # vLLM 오류/타임아웃 — 조용히 삼키지 말고 노출
    cand = extract_python(raw)
    if cand is None:
        return None, "empty_candidate"
    cand_used = ctx_helpers_used(cand)
    if any(h not in STATE_INDEP_HELPERS for h in cand_used):
        return None, "unsafe_candidate"  # 후보가 허용 밖 헬퍼 사용 → 거부
    ok, ca, cb = equivalent(code, cand)
    if not ok:
        return None, "gate_rejected"  # 등가 아님 → 원본 유지
    if cb is None or cb >= (ca or 0):
        return None, "no_gain"  # 더 짧지 않음 → 원본 유지
    return (cand, ca, cb), "consolidated"
