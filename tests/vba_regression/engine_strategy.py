#!/usr/bin/env python3
"""모드별(엔진별) 평가 전략 — VBA vs Python(openpyxl) 분기의 단일 지점.

러너(`vba_regression_runner.py`)는 모드 고유 동작(시스템 프롬프트 조립, 코드블록 언어,
정적 체크, Sonnet 검수 모듈, repair 프롬프트, exec 검증)을 전부 이 `Strategy` 객체를
통해 호출한다. `--mode vba` 는 기존 함수에 그대로 위임하므로 현행과 동일하게 동작한다.

개발/품질평가 전용(exe 패키징 대상 아님).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]  # vba_regression → tests → repo root
VENDOR_DIR = HERE / "vendor"


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


# ---- 시스템 프롬프트 조립 (모드별) -----------------------------------------
def _extract_js_template_constant(source: str, name: str) -> str:
    """`const NAME = \\`...\\`` 형태의 JS 템플릿 리터럴 본문을 그대로 뽑는다.
    러너의 동명 함수와 동일 로직(여기서도 독립적으로 필요하므로 중복 최소 복제)."""
    needle = f"const {name} = `"
    start = source.find(needle)
    if start < 0:
        raise RuntimeError(f"{name} not found")
    i = start + len(needle)
    out: list[str] = []
    escaped = False
    while i < len(source):
        ch = source[i]
        if escaped:
            out.append("\\" + ch)
            escaped = False
        elif ch == "\\":
            escaped = True
        elif ch == "`":
            return "".join(out).replace("\\`", "`")
        else:
            out.append(ch)
        i += 1
    raise RuntimeError(f"{name} template is not closed")


def build_vba_system_prompt(schema_summary: str, schema_js_path: "str | Path | None" = None) -> str:
    """현행 VBA 프롬프트: scripts/file-schema.js 의 VBA_SYSTEM_PROMPT + 스키마 요약."""
    path = Path(schema_js_path) if schema_js_path else (ROOT / "scripts" / "file-schema.js")
    js = _read_text(path)
    vba_prompt = _extract_js_template_constant(js, "VBA_SYSTEM_PROMPT")
    return vba_prompt + "\n\n## 현재 파일 스키마\n" + schema_summary


def build_python_system_prompt(schema_summary: str, schema_js_path: "str | Path | None" = None) -> str:
    """0.4.8 Python 프롬프트 조립: vendored file_schema_048.js 의 세 상수
    (PYTHON_EXCEL_SKILL_RULE / FORMULA_OVERWRITE_RULE / SYSTEM_PROMPT)를 추출·치환하고,
    openpyxl 엔진 안내(vendor/openpyxl_engine_note.txt)와 스키마 요약을 덧붙인다."""
    path = Path(schema_js_path) if schema_js_path else (VENDOR_DIR / "file_schema_048.js")
    js = _read_text(path)
    pesr = _extract_js_template_constant(js, "PYTHON_EXCEL_SKILL_RULE")
    forr = _extract_js_template_constant(js, "FORMULA_OVERWRITE_RULE")
    sysp = _extract_js_template_constant(js, "SYSTEM_PROMPT")
    # SYSTEM_PROMPT 본문은 ${PYTHON_EXCEL_SKILL_RULE}/${FORMULA_OVERWRITE_RULE} 보간을 포함 → 치환.
    assembled = (sysp
                 .replace("${PYTHON_EXCEL_SKILL_RULE}", pesr)
                 .replace("${FORMULA_OVERWRITE_RULE}", forr))
    note_path = VENDOR_DIR / "openpyxl_engine_note.txt"
    engine_note = _read_text(note_path) if note_path.exists() else ""
    return assembled + "\n" + engine_note + "\n\n## 현재 파일 스키마\n" + schema_summary


# ---- repair 프롬프트 (모드별) ----------------------------------------------
def vba_repair_prompt(prompt: str, reply: str, code: "str | None", status: dict[str, Any]) -> str:
    failures = "\n".join(f"- {item}" for item in status.get("failures", [])) or "- 정적 검사 실패"
    warnings = "\n".join(f"- {item}" for item in status.get("warnings", []))
    prior = code if code is not None else reply
    return f"""아래 VBA 생성 결과가 실행 전 정적 검사에서 실패했습니다.
원래 사용자 요청을 그대로 만족하되, 실패 사유를 모두 제거해서 VBA를 다시 작성하세요.

[원래 사용자 요청]
{prompt}

[실패 사유]
{failures}

[주의 경고]
{warnings}

[이전 생성 결과]
```vba
{prior}
```

반드시 하나의 ```vba 코드 블록만 출력하세요.
MsgBox/InputBox/On Error Resume Next/파일 저장·닫기/조용한 GoTo Cleanup 종료를 쓰지 마세요.
대상을 찾지 못하거나 작업이 불가능하면 Err.Raise vbObjectError + 513, "B2BSkill", "사유" 로 실패를 알리세요.
/no_think"""


def python_repair_prompt(prompt: str, reply: str, code: "str | None", status: dict[str, Any]) -> str:
    failures = "\n".join(f"- {item}" for item in status.get("failures", [])) or "- 정적 검사 실패"
    warnings = "\n".join(f"- {item}" for item in status.get("warnings", []))
    prior = code if code is not None else reply
    return f"""아래 Python(openpyxl) 스킬 생성 결과가 실행 전 정적 검사에서 실패했습니다.
원래 사용자 요청을 그대로 만족하되, 실패 사유를 모두 제거해서 코드를 다시 작성하세요.

[원래 사용자 요청]
{prompt}

[실패 사유]
{failures}

[주의 경고]
{warnings}

[이전 생성 결과]
```python
{prior}
```

반드시 하나의 ```python 코드 블록만 출력하고, 정확히 `def transform(ctx):` 하나만 정의하세요.
- COM 전용 호출 금지(openpyxl 엔진엔 없음): src.Copy(dest), PasteSpecial, AutoFilter, Range.End/Offset, Worksheet.Copy, EntireColumn/EntireRow.Insert, Columns(i).Insert, ctx.excel.
- 숨김=column_dimensions/row_dimensions[..].hidden=True, 병합=merge_cells/unmerge_cells, 삽입=insert_cols/insert_rows.
- os/sys/subprocess/pathlib 등 시스템 모듈 import 금지, eval/exec/open 금지.
- 수식 결과 값이 필요하면 openpyxl 은 재계산하지 않으므로 Python 으로 직접 계산해 넣으세요.
- 대상을 찾지 못하거나 작업이 불가능하면 raise RuntimeError("사유") 로 실패를 알리세요(조용한 return 금지).
/no_think"""


# ---- Strategy 정의 ----------------------------------------------------------
@dataclass
class Strategy:
    name: str                       # "python" | "vba"
    code_lang: str                  # 코드블록 기대 언어("python" | "vba")
    accepted_langs: tuple           # 허용 코드블록 언어 집합
    prompt_builder: Callable[..., str]
    static_check: Callable[[str, dict, dict], Any]   # → CheckResult-like(.to_dict() 가능) 또는 dict
    sonnet_module: Any              # review_vba(...) / build_summary(...) 를 가진 모듈
    repair_prompt: Callable[[str, str, "str | None", dict], str]
    exec_verify: "Callable[..., dict] | None"        # Python 만; VBA 는 None
    report_label: str               # 리포트 제목용("Python Skill" / "VBA")
    code_fence: str                 # repair/표시용 펜스 언어


def _vba_strategy() -> Strategy:
    import vba_static_checks
    import vba_sonnet_review
    return Strategy(
        name="vba",
        code_lang="vba",
        accepted_langs=("vba", "vb", "vbscript"),
        prompt_builder=build_vba_system_prompt,
        static_check=vba_static_checks.run_expectation_checks,
        sonnet_module=vba_sonnet_review,
        repair_prompt=vba_repair_prompt,
        exec_verify=None,
        report_label="VBA",
        code_fence="vba",
    )


def _python_strategy() -> Strategy:
    import python_static_checks
    import python_sonnet_review
    import python_exec_verifier
    return Strategy(
        name="python",
        code_lang="python",
        accepted_langs=("python", "py"),
        prompt_builder=build_python_system_prompt,
        static_check=python_static_checks.run_expectation_checks,
        sonnet_module=python_sonnet_review,
        repair_prompt=python_repair_prompt,
        exec_verify=python_exec_verifier.verify,
        report_label="Python Skill",
        code_fence="python",
    )


def get_strategy(mode: str) -> Strategy:
    mode = (mode or "python").strip().lower()
    if mode == "vba":
        return _vba_strategy()
    if mode in ("python", "py"):
        return _python_strategy()
    raise SystemExit(f"알 수 없는 --mode: {mode!r} (python | vba)")
