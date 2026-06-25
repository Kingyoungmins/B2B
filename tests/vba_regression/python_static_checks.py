#!/usr/bin/env python3
"""생성된 B2B Python 스킬(`def transform(ctx):`)의 정적 체크.

VBA 용 `vba_static_checks.py` 의 openpyxl 짝. 실행 없이(또는 exec 검증 전에) 형식/안전/
의도-범위 문제를 빠르게 잡는다. 평가 기준 엔진은 **openpyxl 인프로세스**이므로, COM
전용 호출(`src.Copy(dest)`, `.EntireColumn.Insert`, `AutoFilter`, `Range.End/Offset`,
`PasteSpecial`)은 이 엔진에서 동작하지 않아 위반으로 본다.

구조는 vba_static_checks 와 동일: `run_expectation_checks(code, case, variant)` 가
case/variant 의 `checks`(must_match / must_match_any / must_not_match / risk_rules /
windows_only)를 적용한다. CheckResult / extract_code_block 은 core.py 공용.

개발/품질평가 전용(exe 패키징 대상 아님).
"""

from __future__ import annotations

import ast
import re
from typing import Any

from core import CheckResult, extract_code_block  # noqa: F401  (러너 호환 재노출)

# openpyxl 엔진에서 import 가능한 표준 라이브러리(ver0.4.8 _SKILL_ALLOWED_IMPORTS 와 일치).
ALLOWED_IMPORTS = {
    "re", "datetime", "math", "json", "collections", "itertools",
    "functools", "string", "decimal", "statistics", "calendar",
    "textwrap", "unicodedata", "fractions", "random", "operator", "copy",
}

# COM 전용 — openpyxl 인프로세스 엔진에선 동작하지 않거나 불안정. (정규식, 코드 텍스트 대상)
COM_ONLY_PATTERNS = [
    (r"\.Copy\s*\(", "src.Copy(dest) 는 COM 전용 — openpyxl 에선 동작하지 않음. 원본 값을 읽어 대입하세요."),
    (r"\.PasteSpecial\b", "PasteSpecial 은 COM 전용 — openpyxl 불가."),
    (r"\.AutoFilter\b", "AutoFilter 는 COM 전용/미러 불안정 — ctx.filter_to_sheet 로 새 시트를 만드세요."),
    (r"\.EntireColumn\.Insert\b", "EntireColumn.Insert 는 COM 전용 — openpyxl 은 ws.insert_cols(idx,amount)."),
    (r"\.EntireRow\.Insert\b", "EntireRow.Insert 는 COM 전용 — openpyxl 은 ws.insert_rows(idx,amount)."),
    (r"\.Columns\s*\([^)]*\)\s*\.\s*Insert\b", "Columns(..).Insert 는 COM 전용 — ws.insert_cols 사용."),
    (r"\.Rows\s*\([^)]*\)\s*\.\s*Insert\b", "Rows(..).Insert 는 COM 전용 — ws.insert_rows 사용."),
    (r"\.End\s*\(", "Range.End 는 COM 전용 — ctx.rows(ws)/UsedRange 로 데이터 범위를 구하세요."),
    (r"\.Offset\s*\(", "Range.Offset 은 COM 전용 — ws.Cells(r,c) 로 명시 좌표를 쓰세요."),
    (r"\bWorksheet\.Copy\b|\.Copy\s*\(\s*(?:After|Before)\s*:?=", "Worksheet.Copy 는 COM 전용 — ctx.add_sheet 후 값 복사."),
    (r"ctx\.excel\b", "ctx.excel 은 openpyxl 엔진에서 None 입니다(COM 미사용)."),
    (r"win32com|pythoncom|comtypes", "win32com/COM 모듈은 샌드박스에서 import 불가."),
]

# 시스템/파일 접근 — 금지 import.
FORBIDDEN_IMPORT_ROOTS = {
    "os", "sys", "subprocess", "shutil", "pathlib", "socket", "requests",
    "urllib", "http", "ctypes", "importlib", "pickle", "marshal", "builtins",
    "win32com", "pythoncom", "comtypes", "threading", "multiprocessing",
}


def _parse(code: str) -> "ast.Module | None":
    try:
        return ast.parse(code or "")
    except SyntaxError:
        return None


def has_transform_entrypoint(tree: "ast.Module | None") -> bool:
    if tree is None:
        return False
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name == "transform":
            args = node.args.args
            return len(args) >= 1 and args[0].arg == "ctx"
    return False


def collect_imports(tree: "ast.Module | None") -> list[str]:
    roots: list[str] = []
    if tree is None:
        return roots
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            roots.extend(a.name.split(".")[0] for a in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level and node.level > 0:
                roots.append("<relative>")
            elif node.module:
                roots.append(node.module.split(".")[0])
    return roots


def toplevel_offenders(tree: "ast.Module | None") -> list[str]:
    """모듈 최상위에 허용되지 않는 자유문이 있는지(import/def/class/상수/docstring 외)."""
    bad: list[str] = []
    if tree is None:
        return bad
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom, ast.FunctionDef,
                             ast.AsyncFunctionDef, ast.ClassDef, ast.Assign,
                             ast.AnnAssign, ast.Pass)):
            continue
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant):
            continue  # 문서 문자열/상수식
        bad.append(type(node).__name__)
    return bad


def validate_core_python(code: str, intent_text: str = "") -> CheckResult:
    result = CheckResult()
    if not (code or "").strip():
        result.fail("Python code is empty.")
        return result

    tree = _parse(code)
    if tree is None:
        result.fail("코드를 파싱할 수 없습니다(SyntaxError).")
        return result

    if has_transform_entrypoint(tree):
        result.pass_("def transform(ctx) entrypoint found.")
    else:
        result.fail("필수 진입점 def transform(ctx): 가 없습니다.")

    # 금지 import
    for root in collect_imports(tree):
        if root == "<relative>":
            result.fail("상대 import 는 허용되지 않습니다.")
        elif root in FORBIDDEN_IMPORT_ROOTS:
            result.fail(f"금지된 import: {root} (시스템/네트워크/파일 접근 모듈).")
        elif root not in ALLOWED_IMPORTS:
            result.warn(f"허용 목록 밖 import: {root} (샌드박스에서 차단될 수 있음).")

    # 최상위 자유문(부작용 코드)
    offenders = toplevel_offenders(tree)
    if offenders:
        result.warn(f"모듈 최상위에 자유문이 있습니다: {offenders} (transform 안으로 옮기세요).")

    # eval/exec/open 등 위험 호출
    if re.search(r"\b(?:eval|exec|open|compile|__import__|globals|locals)\s*\(", code):
        result.fail("eval/exec/open/compile/__import__ 등 위험 호출은 금지됩니다.")

    # COM 전용 호출(openpyxl 불가)
    for pattern, message in COM_ONLY_PATTERNS:
        if re.search(pattern, code, re.I):
            result.fail(message)

    # 응답 형식 힌트(제목 줄) — 코드 블록만 검사하므로 경고 수준.
    # (러너가 코드 블록만 넘기면 제목은 보이지 않음 → 정보성으로만 둠.)

    all_sheet_intent = re.search(
        r"(\b(all|every)\s+sheets?\b|전체\s*시트|모든\s*시트|전\s*시트|시트\s*전체)",
        intent_text or "", re.I,
    )
    if not all_sheet_intent and re.search(
        r"for\s+\w+\s+in\s+[\w.]+\.(?:worksheets|sheetnames)\b", code, re.I
    ):
        result.fail("전체-시트 의도가 없는데 wb.worksheets/sheetnames 를 전부 순회합니다.")

    return result


def pattern_found(code: str, pattern: str) -> bool:
    return bool(re.search(pattern, code or "", re.I | re.M))


def run_expectation_checks(code: str, case: dict[str, Any], variant: dict[str, Any]) -> CheckResult:
    title = " / ".join(filter(None, [case.get("title"), variant.get("id")]))
    intent_text = "\n".join(filter(None, [case.get("title"), case.get("id"), variant.get("prompt")]))
    result = validate_core_python(code, intent_text=intent_text)
    checks = dict(case.get("checks") or {})
    checks.update(variant.get("checks") or {})

    for pattern in checks.get("must_match", []):
        if pattern_found(code, pattern):
            result.pass_(f"Required pattern matched: {pattern}")
        else:
            result.fail(f"Missing required pattern: {pattern}")

    for group in checks.get("must_match_any", []):
        patterns = group.get("patterns") if isinstance(group, dict) else group
        label = group.get("label", "one of required patterns") if isinstance(group, dict) else "one of required patterns"
        if any(pattern_found(code, p) for p in patterns):
            result.pass_(f"Matched {label}.")
        else:
            result.fail(f"Missing {label}: {patterns}")

    for pattern in checks.get("must_not_match", []):
        if pattern_found(code, pattern):
            result.fail(f"Forbidden pattern matched: {pattern}")
        else:
            result.pass_(f"Forbidden pattern absent: {pattern}")

    for rule in checks.get("risk_rules", []):
        apply_risk_rule(rule, code, result, title)

    for note in checks.get("windows_only", []):
        # Python/openpyxl 엔진은 Mac 로컬 exec 로 상당 부분 검증 가능 → 정보성 노트로만.
        result.need_windows(note)

    return result


def apply_risk_rule(rule: str, code: str, result: CheckResult, title: str = "") -> None:
    """각 risk_rule 의 openpyxl 판(VBA 판과 의미는 같되 정답 idiom 이 다름)."""

    if rule == "hide_not_delete":
        # 숨김 = column_dimensions/row_dimensions[..].hidden = True. 삭제/Clear/값 비우기 금지.
        if re.search(r"\.(?:column_dimensions|row_dimensions)\s*\[[^\]]+\]\s*\.\s*hidden\s*=\s*True", code, re.I):
            result.pass_("openpyxl dimensions.hidden=True 로 숨김 처리.")
        else:
            result.fail("숨김은 ws.column_dimensions['B'].hidden=True / row_dimensions[n].hidden=True 를 쓰세요.")
        if re.search(r"\.(?:delete_cols|delete_rows)\b", code, re.I):
            result.fail("숨김 요청에 delete_cols/delete_rows(삭제) 를 쓰면 안 됩니다.")
        if re.search(r"\.Value\s*=\s*(?:None|\"\"|'')", code):
            result.warn("셀 값을 비우는 코드가 있습니다 — 숨김은 값 삭제가 아닙니다.")
        return

    if rule == "single_sheet_scope":
        if re.search(r"for\s+\w+\s+in\s+[\w.]+\.(?:worksheets|sheetnames)\b", code, re.I):
            result.fail("단일-시트 요청인데 전체 워크시트를 순회합니다.")
        else:
            result.pass_("전체-시트 순회 없음(단일 시트 한정).")
        return

    if rule == "no_activecell_offset":
        # openpyxl 판: Range.End/Offset(상대 좌표 추측) 금지 — 명시 좌표 사용.
        if re.search(r"\.(?:End|Offset)\s*\(", code, re.I):
            result.fail("Range.End/Offset(상대 추측) 사용 — ws.Cells(r,c)/ctx.rows 로 명시 좌표를 쓰세요.")
        else:
            result.pass_("상대 좌표 추측(End/Offset) 없음.")
        return

    if rule == "copy_preserve_formula_format":
        # openpyxl 엔 src.Copy(dest) 없음 → 원본 .value(수식 문자열/값) 읽어 대입이 정답.
        # 서식까지 보존은 openpyxl 단순 대입으론 불가(범위 밖) → 경고로만.
        if re.search(r"\.Copy\s*\(", code, re.I):
            result.fail("openpyxl 엔진엔 src.Copy(dest) 가 없습니다 — 원본 .value 를 읽어 대상에 대입하세요.")
        elif re.search(r"\.Value\s*=", code) and (re.search(r"ctx\.rows\b", code) or re.search(r"\.Value\b", code)):
            result.pass_("원본 값을 읽어 대상에 대입(openpyxl 방식).")
        else:
            result.warn("복사 방식이 불명확합니다 — 원본 .value 를 읽어 대입했는지 확인.")
        result.need_windows("서식(테두리/숫자서식)까지 보존하려면 Excel(COM) 엔진 필요 — openpyxl 단순 대입은 값/수식만.")
        return

    if rule == "value_copy_not_null":
        # 수식 셀 결과를 '값'으로 옮길 때 null 방지. openpyxl 은 수식 재계산 안 하므로
        # 결과 값이 필요하면 Python 으로 계산해 대입해야 한다(수식 셀을 그대로 읽으면 '=..' 문자열).
        if re.search(r"\.Value\s*=\s*(?:None|Empty)\b", code, re.I):
            result.fail("대상에 None/Empty 를 대입 — null 로 들어갑니다.")
        elif re.search(r"sum\s*\(|=\s*[\w.]+\s*$|\.Value\s*=\s*\w", code):
            result.pass_("값을 계산/대입하는 형태(빈값 아님).")
        else:
            result.warn("값 대입이 불명확 — 수식 결과가 필요하면 Python 으로 계산해 넣으세요(openpyxl 재계산 안 함).")
        result.need_windows("대상 셀이 실제 값을 담는지(빈/None 아님) 확인.")
        return

    if rule == "preserve_datetime":
        # 날짜/시간 값을 불리언/엉뚱한 형으로 캐스팅하지 말 것.
        if re.search(r"\bbool\s*\(", code):
            result.warn("날짜/시간 값에 bool() 캐스팅이 있으면 True/False 로 깨집니다 — 원래 값을 그대로 옮기세요.")
        else:
            result.pass_("날짜/시간 불리언 캐스팅 없음.")
        result.need_windows("날짜/시간 셀이 원래 값/표시형식을 유지하는지 확인(openpyxl 은 값 보존, 서식은 COM).")
        return

    if rule == "entire_row_insert":
        # openpyxl: ws.insert_rows(idx[, amount]). 셀 1개 삽입이 아니라 행 전체.
        if re.search(r"\.insert_rows\s*\(", code, re.I):
            result.pass_("ws.insert_rows 로 행 전체 삽입.")
        elif re.search(r"\.EntireRow\.Insert\b|\.Rows\s*\([^)]*\)\s*\.Insert\b", code, re.I):
            result.fail("EntireRow.Insert 는 COM 전용 — openpyxl 은 ws.insert_rows(idx) 를 쓰세요.")
        else:
            result.warn("행 삽입(ws.insert_rows)이 보이지 않습니다.")
        return

    if rule == "insert_no_residual_formula":
        # openpyxl insert_cols/rows 는 수식 참조를 '자동 보정하지 않는다'(VBA 와 핵심 차이).
        # 따라서 삽입 후 수식이 깨질 수 있음 → 새 수식 직접 써넣기 경고 + Windows 확인.
        if re.search(r"\.insert_cols\s*\(", code, re.I):
            result.pass_("ws.insert_cols 로 열 삽입.")
        elif re.search(r"\.EntireColumn\.Insert\b|\.Columns\s*\([^)]*\)\s*\.Insert\b", code, re.I):
            result.fail("EntireColumn.Insert 는 COM 전용 — openpyxl 은 ws.insert_cols(idx).")
        else:
            result.warn("열 삽입(ws.insert_cols)이 보이지 않습니다.")
        if re.search(r"\.Value\s*=\s*[\"']=", code):
            result.warn("삽입 중 새 수식을 직접 써넣습니다 — 잔존/중복인지 확인.")
        result.need_windows("openpyxl insert 는 수식 참조를 자동 보정하지 않습니다 — 참조 깨짐을 Excel 에서 확인.")
        return

    if rule == "sort_key_matches_request":
        if re.search(r"ctx\.sort\s*\(", code, re.I):
            result.pass_("ctx.sort(ws, '컬럼명', ...) 로 헤더명 기준 정렬.")
        elif re.search(r"\.Sort\b", code, re.I):
            result.warn("COM .Sort 사용 — openpyxl 엔진에선 ctx.sort 헬퍼를 권장.")
        else:
            result.warn("정렬(ctx.sort)이 보이지 않습니다.")
        result.need_windows("정렬 키가 요청한 열 헤더와 일치하는지 확인.")
        return

    if rule == "formula_vs_value_intent":
        # '구해줘/수식'=  ws.Range(..).Value = "=SUM(...)"(문자열) vs '값'= 계산된 숫자.
        wrote_formula_str = bool(re.search(r"\.Value\s*=\s*[\"']=", code))
        wrote_value = bool(re.search(r"\.Value\s*=\s*(?!['\"]=)", code))
        if wrote_formula_str and wrote_value:
            result.warn("수식 문자열과 값 대입이 섞여 있습니다 — 요청 형태에 맞는지 확인.")
        elif wrote_formula_str or wrote_value:
            result.pass_("한 가지 형태(수식 문자열 XOR 값)로 명확히 대입.")
        else:
            result.warn("수식/값 대입이 보이지 않습니다.")
        result.need_windows("수식 vs 값 출력이 자연어 의도와 일치하는지 확인(수식이면 Excel 에서 재계산됨).")
        return

    if rule == "raise_when_no_change":
        if re.search(r"\braise\b", code):
            result.pass_("대상/조건 불충족 시 raise 로 실패를 드러냅니다(거짓 '적용됨' 방지).")
        else:
            result.warn("raise 가 없습니다 — 변경 0건이 '적용됨'으로 오인될 수 있습니다.")
        return

    if rule == "no_destructive_clear_delete":
        if re.search(r"\.(?:delete_cols|delete_rows)\b", code, re.I) or re.search(r"\.Value\s*=\s*None\b", code):
            result.warn("delete_cols/delete_rows/값 None 대입 — 파괴적 변경인지 확인.")
        else:
            result.pass_("파괴적 삭제/초기화 없음.")
        return

    if rule == "merge_safe":
        # 병합 영역 처리: merge_cells/unmerge_cells 사용. 병합 셀 좌상단 외에 값 쓰면 손실 위험.
        if re.search(r"\.(?:merge_cells|unmerge_cells)\s*\(", code, re.I):
            result.pass_("merge_cells/unmerge_cells 로 병합 영역을 명시 처리.")
        else:
            result.warn("병합 관련 작업에 merge_cells/unmerge_cells 가 보이지 않습니다.")
        result.need_windows("병합 셀의 좌상단에만 값이 들어가고 영역이 의도대로 유지/해제되는지 확인.")
        return

    if rule == "download_formula_preserve":
        result.need_windows("다운로드 수식 보존은 openpyxl 워크북 수식 문자열 유지 + Excel 재계산으로 확인.")
        return

    if rule == "formula_cells_not_overwritten":
        if re.search(r"\.Value\s*=", code):
            result.warn("Value 대입이 있습니다 — 수식 셀을 덮어쓰지 않는지(입력 셀만 채우는지) 확인.")
        result.need_windows("수식 셀 보존은 결과 워크북 수식 문자열 유지로 확인(exec 검증의 expect_formula_preserved).")
        return

    result.warn(f"Unknown risk rule: {rule}")
