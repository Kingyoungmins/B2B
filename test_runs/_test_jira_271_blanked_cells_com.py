# -*- coding: utf-8 -*-
"""[지라 SBAGENT-271] 같은 열을 여러 단계가 다듬을 때 뒤 단계가 앞 단계 결과를 지우는 사고.

실측(첨부 로그 vba_pipeline_trace.jsonl, 2026-08-19 14:37 전체실행):
  16단계 스킬에서 13·14·15·16단계가 모두 W열('할인 후') 대상이었다.
  전부 fullrun.step.ok 로 끝났고 파일 크기도 커졌는데(3.03→3.59→3.61→4.61MB),
  응답의 liveSchema 를 보면 최종 W열이 **모든 데이터 행에서 빈칸**이다.
  15단계는 "기존 수식이나 값은 건드리지 않습니다"라고 해 놓고 W열을 읽지도 않았다
  (트레이스에 read 없음) — 조건에 안 맞는 행에 ""를 써서 13·14단계 결과를 통째로 날렸다.

  그런데도 모든 단계가 '적용됨'이었다. 사용자가 알 방법이 없었다.

이 테스트가 잠그는 것: 앞 단계가 채운 칸을 빈칸으로 덮으면 그 사실이 요약에 드러난다.
실제 Excel COM 으로 돌린다(이 동작은 COM 없이는 못 잡는다).
"""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pythoncom  # noqa: E402
import win32com.client as w32  # noqa: E402

import serve_b2b as S  # noqa: E402

fails = 0


def check(name, cond, detail=None):
    global fails
    if cond:
        print("  PASS  " + name)
    else:
        fails += 1
        print("  FAIL  " + name + (("  -> " + str(detail)[:200]) if detail is not None else ""))


def main():
    pythoncom.CoInitialize()
    app = w32.DispatchEx("Excel.Application")
    app.Visible = False
    app.DisplayAlerts = False
    tmp = Path(tempfile.mkdtemp())
    try:
        wb = app.Workbooks.Add()
        ws = wb.Worksheets(1)
        ws.Name = "VIEW"
        N = 40
        # H=분류, S=요금 (실측 스킬과 같은 모양)
        ws.Range("H1").Value = "서비스"
        ws.Range("S1").Value = "통화요금"
        for r in range(2, N + 1):
            ws.Cells(r, 8).Value = "국제" if r % 5 == 0 else "시내/시외"
            ws.Cells(r, 19).Value = float(r * 10)

        sess = {"path": str(tmp / "x.xlsx"), "name": "x.xlsx"}

        print("[1] 13·14단계 — W열을 조건부로 채운다")
        ctx1 = S.PythonComSkillContext(app, wb, sess)
        rows = [[f"=IF(H{r}=\"국제\",\"\",S{r}*0.8)"] for r in range(2, N + 1)]
        ctx1.write_formulas("VIEW", "W2", rows)
        s1 = ctx1.summary()
        filled = sum(1 for r in range(2, N + 1) if str(ws.Cells(r, 23).Text).strip() != "")
        check("조건에 맞는 행이 실제로 채워졌다", filled > 0, filled)
        check("이 단계는 아무것도 지우지 않았다(경고 없음)",
              int(s1.get("blankedCells") or ctx1._shared.get("blanked_cells") or 0) == 0,
              s1)

        print("[2] 15단계 — '기존 값은 건드리지 않는다'면서 열 전체를 덮어쓴다  <- 사고 재현")
        ctx2 = S.PythonComSkillContext(app, wb, sess)
        # K열 조건에 맞는 행이 하나도 없다고 치고, 조건 밖은 "" 로 덮는 (실측과 같은) 잘못된 코드
        bad = [[""] for _ in range(2, N + 1)]
        ctx2.write_formulas("VIEW", "W2", bad)
        blanked = int(ctx2._shared.get("blanked_cells") or 0)
        after = sum(1 for r in range(2, N + 1) if str(ws.Cells(r, 23).Text).strip() != "")
        check("실제로 앞 단계 결과가 지워졌다(재현 성공)", after == 0, after)
        check("지워진 칸 수가 집계된다(보이던 값 기준)", blanked == filled, f"blanked={blanked} filled={filled}")

        print("[3] 올바른 방식 — 먼저 읽고 조건 밖은 그대로 되돌려 쓴다")
        ctx3 = S.PythonComSkillContext(app, wb, sess)
        ctx3.write_formulas("VIEW", "W2", rows)          # 13·14단계 복원
        ctx4 = S.PythonComSkillContext(app, wb, sess)
        cur = ctx4.read("VIEW", f"W2:W{N}")
        good = []
        for i, r in enumerate(range(2, N + 1)):
            keep = cur[i][0]
            good.append([f"=S{r}*1.2" if r == 7 else keep])   # 한 행만 갱신, 나머지는 보존
        ctx4.write_formulas("VIEW", "W2", good)
        kept = sum(1 for r in range(2, N + 1) if str(ws.Cells(r, 23).Text).strip() != "")
        check("보존 방식은 앞 단계 결과를 유지한다", kept > 0, kept)
        check("보존 방식은 지움 경고가 안 뜬다",
              int(ctx4._shared.get("blanked_cells") or 0) == 0,
              ctx4._shared.get("blanked_cells"))

        print("[4] 원래 빈칸을 빈칸으로 두는 건 '지움'이 아니다(오탐 방지)")
        ws.Range("Z2:Z10").ClearContents()
        ctx5 = S.PythonComSkillContext(app, wb, sess)
        ctx5.write_formulas("VIEW", "Z2", [[""] for _ in range(9)])
        check("빈칸→빈칸은 집계되지 않는다",
              int(ctx5._shared.get("blanked_cells") or 0) == 0,
              ctx5._shared.get("blanked_cells"))

        wb.Close(SaveChanges=False)
    finally:
        try:
            app.Quit()
        except Exception:
            pass

    print("")
    print("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
