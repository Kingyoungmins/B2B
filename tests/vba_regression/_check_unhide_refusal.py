#!/usr/bin/env python3
"""행 숨김취소 거부 회귀 점검(생성만, 엑셀 미사용).

수정한 VBA_SYSTEM_PROMPT(file-schema.js) 를 그대로 추출해, "3~5행 숨기기 취소"
같은 trivial 구조 작업에 대해 모델이 코드 없이 거부하던 버그가 사라졌는지 확인한다.
PASS = ```vba 코드 블록 + Hidden = False(또는 .Hidden=0) 포함.  FAIL = 코드 블록 없음(거부).
"""
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from engine_strategy import build_vba_system_prompt          # noqa: E402
from vba_regression_runner import call_openai_compat, DEFAULT_BASE_URL, DEFAULT_API_KEY, DEFAULT_MODEL  # noqa: E402

FNAME = "input)_기업DW추출_131 통화상세내역(마스킹)_2026-03-13 10_02_56_DSMC_260527.xlsx"
SCHEMA = f"""## 입력 파일 목록 (수정 가능)
### {FNAME}
- 시트: Sheet1 (행 32606)
  - [A=번호][B=과금번호][C=발신번호][D=이용(사용)번호][E=착신번호][F=착신지역][G=호유형]
  - 상단 일부 행(3~5행)이 숨김 상태입니다.

## 사용자가 현재 보고 있는 대상 (명령에 파일/시트가 없을 때 기본 대상)
[입력] 파일: "{FNAME}"
기본 대상: Workbooks("{FNAME}")
현재 활성 시트: "Sheet1"
사용자가 파일/시트를 명시하지 않으면 이 시트를 기본 대상으로 사용하세요.
선택 셀: "Sheet1!A3"
사용자가 결과 위치를 직접 클릭한 경우 '여기', '선택한 셀', '이 셀'은 이 선택 위치를 의미합니다."""

PROMPTS = [
    "3~5행 숨기기 취소해줘",
    "선택한 3~5행 다시 보이게 숨김취소",
    "3행부터 5행까지 숨김 해제",
]

CODE_RE = re.compile(r"```(?:vba|vb|vbscript)\b(.*?)```", re.IGNORECASE | re.DOTALL)


def grade(reply: str) -> tuple[str, str]:
    m = CODE_RE.search(reply or "")
    if not m:
        first = (reply or "").strip().splitlines()
        return "FAIL(no-code)", (first[0] if first else "")[:80]
    code = m.group(1)
    if not re.search(r"Sub\s+B2BSkill\s*\(", code, re.IGNORECASE):
        return "FAIL(no-entry)", "no Sub B2BSkill"
    if re.search(r"Hidden\s*=\s*(False|0)", code, re.IGNORECASE):
        return "PASS", "Hidden=False present"
    return "RISK(code-no-unhide)", "code but no Hidden=False"


def main() -> int:
    system = build_vba_system_prompt(SCHEMA)
    base, key, model = DEFAULT_BASE_URL, DEFAULT_API_KEY, DEFAULT_MODEL
    samples = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    npass = ntot = 0
    for p in PROMPTS:
        for i in range(samples):
            ntot += 1
            try:
                reply = call_openai_compat(base, key, model, system, p + "\n\n/no_think",
                                           1500, 120, 0.2)
            except Exception as e:  # noqa: BLE001
                print(f"[ERR ] {p!r} #{i+1}: {e}")
                continue
            verdict, note = grade(reply)
            if verdict == "PASS":
                npass += 1
            print(f"[{verdict:18}] {p!r} #{i+1}: {note}")
    print(f"\n== PASS {npass}/{ntot} ==")
    return 0 if npass == ntot else 1


if __name__ == "__main__":
    raise SystemExit(main())
