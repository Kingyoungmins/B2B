#!/usr/bin/env python3
"""Static checks for generated B2B VBA skill code.

This intentionally does not require Excel or Windows. It catches format,
security, and intent-scope issues before Windows COM E2E testing.
"""

from __future__ import annotations

import re
from typing import Any

# CheckResult / extract_code_block 는 core.py 로 이전했다(VBA·Python 정적 체크 공용).
# 기존 import 경로(`from vba_static_checks import CheckResult, extract_code_block`)를
# 유지하기 위해 여기서 재노출한다. 동작은 이전과 동일.
from core import CheckResult, extract_code_block

__all__ = [
    "CheckResult",
    "extract_code_block",
    "has_vba_entrypoint",
    "has_end_sub",
    "validate_core_vba",
    "pattern_found",
    "run_expectation_checks",
    "apply_risk_rule",
]


def has_vba_entrypoint(code: str) -> bool:
    return bool(re.search(r"^\s*Sub\s+B2BSkill\s*\(\s*\)", code or "", re.I | re.M))


def has_end_sub(code: str) -> bool:
    return bool(re.search(r"\bEnd\s+Sub\b", code or "", re.I))


def validate_core_vba(code: str, intent_text: str = "") -> CheckResult:
    result = CheckResult()
    if not (code or "").strip():
        result.fail("VBA code is empty.")
        return result
    if not has_vba_entrypoint(code):
        result.fail("Missing exact entrypoint: Sub B2BSkill().")
    else:
        result.pass_("Sub B2BSkill() found.")
    if not has_end_sub(code):
        result.fail("Missing End Sub.")
    else:
        result.pass_("End Sub found.")

    blocked = [
        (r"\bOn\s+Error\s+Resume\s+Next\b", "On Error Resume Next hides failures."),
        (r"\bMsgBox\s*(?:\(|\s)", "MsgBox can block unattended execution."),
        (r"\bInputBox\s*(?:\(|\s)", "InputBox can block unattended execution."),
        (r"\bShell\s*(?:\(|\s)", "Shell execution is forbidden."),
        (r"\bWorkbooks\s*\.\s*Open\b", "Workbooks.Open is forbidden in generated skills."),
        (r"\bApplication\s*\.\s*Quit\b", "Application.Quit is forbidden."),
        (r"\.(?:Save|SaveAs|SaveCopyAs|Close)\b", "Save/Close calls are forbidden inside VBA skills."),
        (r"\b(?:Cells|UsedRange)\s*\.\s*Clear(?:Contents|Formats)?\b", "Whole-sheet Clear is destructive."),
        (r"\bActiveCell\s*\.\s*Offset\b", "ActiveCell.Offset write target is easy to misread."),
    ]
    for pattern, message in blocked:
        if re.search(pattern, code, re.I):
            result.fail(message)

    for prog_id in re.findall(r"\bCreateObject\s*\(\s*[\"']([^\"']+)[\"']\s*\)", code, re.I):
        if prog_id.lower() != "scripting.dictionary":
            result.fail(f'Forbidden CreateObject("{prog_id}").')
    if re.search(r'CreateObject\s*\(\s*["\']Scripting\.Dictionary["\']\s*\)', code, re.I):
        result.pass_("Scripting.Dictionary usage is allowed.")

    all_sheet_intent = re.search(r"(\b(all|every)\s+sheets?\b|전체\s*시트|모든\s*시트|전\s*시트|시트\s*전체)", intent_text or "", re.I)
    if not all_sheet_intent and re.search(r"\bFor\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets\b", code, re.I):
        result.fail("Loops over all Worksheets without all-sheet intent.")

    if re.search(r"\b(?:Rows|Columns)\s*(?:\([^)]*\))?\s*\.\s*Delete\b", code, re.I):
        result.warn("Deletes whole rows/columns; verify target scope in Windows E2E.")
    return result


def pattern_found(code: str, pattern: str) -> bool:
    return bool(re.search(pattern, code or "", re.I | re.M))


def run_expectation_checks(code: str, case: dict[str, Any], variant: dict[str, Any]) -> CheckResult:
    title = " / ".join(filter(None, [case.get("title"), variant.get("id")]))
    intent_text = "\n".join(filter(None, [case.get("title"), case.get("id"), variant.get("prompt")]))
    result = validate_core_vba(code, intent_text=intent_text)
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
        result.need_windows(note)

    return result


def apply_risk_rule(rule: str, code: str, result: CheckResult, title: str = "") -> None:
    if rule == "hide_not_delete":
        if re.search(r"\.Hidden\s*=\s*True\b", code, re.I):
            result.pass_("Uses Hidden=True for hide request.")
        else:
            result.fail("Hide request should use .Hidden = True.")
        if re.search(r"\.Delete\b|\.Clear(?:Contents|Formats)?\b", code, re.I):
            result.fail("Hide request must not delete or clear cells.")
        return

    if rule == "copy_preserve_formula_format":
        if re.search(r"\.Copy\b[\s\S]{0,160}(Destination\s*:=|\.\s*PasteSpecial\s+xlPasteAll|After\s*:=|Before\s*:=)", code, re.I):
            result.pass_("Uses Excel copy/paste style preserving formulas and formats.")
        else:
            result.warn("Formula/format preserving copy should prefer Range.Copy Destination or PasteSpecial xlPasteAll.")
        if re.search(r"\.Value\s*=\s*[^;\n]*\.Value", code, re.I):
            result.warn("Value-to-value copy can drop formulas/formats.")
        return

    if rule == "explicit_output_cell":
        if re.search(r"\.Range\s*\(\s*[\"'][A-Z]+\d+(?::[A-Z]+\d+)?[\"']\s*\)", code, re.I) or re.search(r"\.Cells\s*\(\s*\d+\s*,\s*\d+\s*\)", code, re.I):
            result.pass_("Uses explicit A1 output address.")
        else:
            result.warn("No explicit output address detected; target-cell misrecognition risk.")
        if re.search(r"\bActiveCell\b|\bSelection\b", code, re.I):
            result.warn("Uses ActiveCell/Selection; verify target cell in Windows E2E.")
        return

    if rule == "single_sheet_scope":
        if re.search(r"\bFor\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets\b", code, re.I):
            result.fail("Single-sheet request must not loop all worksheets.")
        else:
            result.pass_("No all-worksheet loop for single-sheet request.")
        return

    if rule == "no_destructive_clear_delete":
        if re.search(r"\b(?:Cells|UsedRange)\s*\.\s*Clear|\.ClearContents\b|\.Delete\b", code, re.I):
            result.fail("Destructive clear/delete detected.")
        else:
            result.pass_("No destructive clear/delete detected.")
        return

    if rule == "no_activecell_offset":
        if re.search(r"\bActiveCell\s*\.\s*Offset\b", code, re.I):
            result.fail("ActiveCell.Offset detected.")
        else:
            result.pass_("No ActiveCell.Offset detected.")
        return

    if rule == "formula_cells_not_overwritten":
        if re.search(r"\.Formula(?:R1C1)?\s*=", code, re.I):
            result.warn("Writes Formula; verify formula intent and preservation.")
        if re.search(r"\.Value\s*=", code, re.I) and re.search(r"\bFormula\b|\bHasFormula\b", code, re.I):
            result.warn("Formula-aware value writes need Windows E2E validation.")
        result.need_windows("Formula preservation requires real Excel workbook diff.")
        return

    if rule == "download_formula_preserve":
        result.need_windows("Download formula preservation is validated by Excel/openpyxl workbook diff, not static code alone.")
        return

    if rule == "value_copy_not_null":
        # 수식 셀을 .Value=.Value 로 옮기면 결과가 null/0 으로 들어가는 사례(이슈 43,48).
        # 수식·서식까지 옮기려면 Copy Destination/PasteSpecial, 값만 옮길 땐 원본의 .Value 를
        # 그대로 읽어 대입해야 한다(빈 변수/엉뚱한 좌표로 null 이 들어가지 않게).
        if re.search(r"\.Copy\b[\s\S]{0,160}(Destination\s*:=|\.\s*PasteSpecial\s+xlPasteAll|After\s*:=|Before\s*:=)", code, re.I):
            result.pass_("Uses Excel copy preserving value+format (won't null out).")
        elif re.search(r"\.Value2?\s*=\s*[\w.()\"' ]*\.Value2?", code, re.I):
            result.pass_("Copies source .Value into destination .Value (value carried).")
        else:
            result.warn("No value/format-preserving copy detected; result may land as null/empty.")
        result.need_windows("Verify pasted cells carry actual values (not null) in real Excel.")
        return

    if rule == "preserve_datetime":
        # 날짜/시간 서식 값이 'false'/직렬화 깨짐으로 들어가는 사례(이슈 55).
        # 불리언 캐스팅(CBool) 금지, 날짜는 CDate/serial 또는 원본 값을 그대로 옮길 것.
        if re.search(r"\bCBool\b", code, re.I):
            result.fail("CBool on date/time data turns it into True/False; preserve the value.")
        else:
            result.pass_("No boolean cast on date/time data.")
        result.need_windows("Verify date/time cells keep their value+number format (not 'false') in Excel.")
        return

    if rule == "entire_row_insert":
        # '빈 행 삽입' 이 셀 1개만 삽입되는 사례(이슈 59). 행 전체 삽입이어야 한다.
        if re.search(r"\.(?:Rows\s*\([^)]*\)|EntireRow)\s*\.\s*Insert\b", code, re.I) or re.search(r"\bRows\s*\(\s*\d+\s*(?::\s*\d+)?\s*\)\s*\.\s*Insert\b", code, re.I):
            result.pass_("Inserts whole row(s) (Rows/EntireRow.Insert).")
        elif re.search(r"\.Insert\b", code, re.I):
            result.warn("Insert detected but not clearly a whole-row insert; may shift a single cell only.")
        else:
            result.warn("No row insert detected for a row-insert request.")
        return

    if rule == "insert_no_residual_formula":
        # 열/행 삽입 시 밀린 셀에 수식이 잔존/중복 생성되는 사례(이슈 63).
        # 정석은 전체 열/행 Insert 로 Excel 이 참조를 자동 보정하게 하는 것. 빈 열 삽입에
        # 새 수식을 직접 써넣지 말 것.
        if re.search(r"\.(?:Columns\s*\([^)]*\)|EntireColumn)\s*\.\s*Insert\b", code, re.I) or re.search(r"\bColumns\s*\(\s*[\"']?[A-Z0-9:]+[\"']?\s*\)\s*\.\s*Insert\b", code, re.I):
            result.pass_("Uses whole-column Insert (Excel auto-adjusts references).")
        else:
            result.warn("Column insert not clearly whole-column; merged/formula shift risk.")
        if re.search(r"\.Formula(?:R1C1)?\s*=\s*[\"']=", code, re.I):
            result.warn("Writes a new formula during an insert; verify it isn't a leftover/duplicate.")
        return

    if rule == "sort_key_matches_request":
        # 정렬 대상 열을 오인식하는 사례(이슈 46: T열 요청인데 X열 정렬).
        # 정렬 키는 헤더 이름으로 찾아 지정해야 하며 ActiveCell/Selection 추측 금지.
        if re.search(r"\.Sort\b", code, re.I) or re.search(r"\bSort\s+Key1\s*:=", code, re.I):
            result.pass_("Performs an explicit Sort.")
            if re.search(r"Key1\s*:=\s*(?:ActiveCell|Selection)", code, re.I):
                result.fail("Sort key uses ActiveCell/Selection; wrong-column risk.")
        else:
            result.warn("No explicit Sort detected for a sort request.")
        result.need_windows("Verify the sort key column matches the requested column header.")
        return

    if rule == "formula_vs_value_intent":
        # 자연어 해석 편차: '구해줘'=수식, '적어줘'=값 등(이슈 64).
        # 한쪽으로 단정하기 어려워 정적으로는 둘 중 하나라도 명확히 했는지 + Windows 확인.
        wrote_formula = bool(re.search(r"\.Formula(?:R1C1)?\s*=", code, re.I))
        wrote_value = bool(re.search(r"\.Value2?\s*=", code, re.I))
        if wrote_formula and wrote_value:
            result.warn("Writes both Formula and Value; ensure it matches the requested form.")
        elif wrote_formula or wrote_value:
            result.pass_("Writes a single clear form (formula XOR value).")
        else:
            result.warn("Neither Formula nor Value write detected.")
        result.need_windows("Verify formula-vs-value output matches the natural-language intent.")
        return

    if rule == "raise_when_no_change":
        # 미적용인데 '적용됨'으로 보고되는 사례(이슈 45,57,58,60).
        # 변경 0건일 수 있는 코드는 Err.Raise 로 실패를 드러내고 조용한 Exit Sub/GoTo 금지.
        if re.search(r"Err\.Raise\b", code, re.I):
            result.pass_("Raises an error when target/condition not met (no false 'applied').")
        else:
            result.warn("No Err.Raise; a no-op could be falsely reported as applied.")
        if re.search(r"\bGoTo\s+Cleanup\b", code, re.I):
            result.warn("GoTo Cleanup may exit silently; prefer Err.Raise on failure.")
        return

    result.warn(f"Unknown risk rule: {rule}")
