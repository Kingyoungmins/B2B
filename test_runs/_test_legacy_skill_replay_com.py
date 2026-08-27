# -*- coding: utf-8 -*-
"""[지시 2026-08-27] "예전에 만든 스킬들과 충돌하지 않도록" — 저장된 스킬을 실제로 재생해 대조한다.

방법: 같은 저장 스킬(test_mapping/mapping_test_saved_skill.zip)을
      ① 변경 '전' 백엔드와 ② 변경 '후' 백엔드에서 각각 돌려 결과를 **직접 비교**한다.
      추론("추가만 했으니 괜찮다")이 아니라 두 실행의 결과가 같은지를 본다.

주의: 이 자료는 실행기 '매핑' 기능 테스트용이라, 스킬이 일부러 옛 이름
      (expected_output.xlsx / ResultSheet)을 찾도록 만들어져 있고 실제 파일은
      actual_*.xlsx / ActualResult 다. 매핑 없이 그냥 돌리면 당연히 실패한다 —
      여기서 보는 것은 '성공하느냐'가 아니라 **전/후가 똑같이 동작하느냐**다.
      그래서 매핑을 적용한 판(성공해야 함)과 적용 안 한 판(실패해야 함)을 모두 대조한다.
"""
import io
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:300]) if not cond else ""))
    if not cond:
        fails.append(name)


# 저장 스킬이 찾는 옛 이름 → 실제 파일/시트 (test_mapping/README.md 의 매핑표)
FILE_MAP = {"expected_sales.xlsx": "actual_sales_2026_06.xlsx",
            "expected_adjustments.xlsx": "actual_adjustments_2026_06.xlsx",
            "expected_codes.xlsx": "actual_codes_2026_06.xlsx",
            "expected_output.xlsx": "actual_output_template_2026_06.xlsx"}
SHEET_MAP = {"SalesData": "ActualSales", "AdjustData": "ActualAdjust",
             "CodeMap": "ActualCodes", "ResultSheet": "ActualResult"}

RUNNER = r'''# -*- coding: utf-8 -*-
import io, json, sys, zipfile, tempfile, shutil
from pathlib import Path
sys.path.insert(0, sys.argv[1])          # 검사할 백엔드 폴더
import pythoncom; pythoncom.CoInitialize()
import win32com.client as win32
import serve_b2b as S

zip_path, apply_map = Path(sys.argv[2]), (sys.argv[3] == "1")
SHEET_MAP = json.loads(sys.argv[4]); FILE_MAP = json.loads(sys.argv[5])
fixtures = Path(sys.argv[6])

with zipfile.ZipFile(zip_path) as zf:
    logic = json.loads(zf.read("mapping_test_saved_skill.logic.json").decode("utf-8"))
steps = logic.get("pipeline") or logic.get("steps") or []

work = Path(tempfile.mkdtemp(prefix="legacy_"))
for want, have in FILE_MAP.items():
    name = have if apply_map else want          # 매핑판은 실제 이름 그대로 연다
    shutil.copy2(fixtures / have, work / name)

app = win32.DispatchEx("Excel.Application"); app.Visible = False; app.DisplayAlerts = False
out = []
try:
    books = {p.name: app.Workbooks.Open(str(p)) for p in sorted(work.glob("*.xlsx"))}
    anchor_name = FILE_MAP["expected_output.xlsx"] if apply_map else "expected_output.xlsx"
    anchor = books[anchor_name]
    for i, st in enumerate(steps, 1):
        code = st.get("code") or ""
        if not code.strip():
            continue
        if apply_map:                            # 실행기 매핑이 하는 일과 같은 치환
            for a, b in FILE_MAP.items():
                code = code.replace(a, b)
            for a, b in SHEET_MAP.items():
                code = code.replace(a, b)
        ctx = S.PythonComSkillContext(app, anchor, {"name": anchor_name}, timeout_s=300)
        try:
            S._python_com_static_check(code)
            g = {"__builtins__": dict(S._PY_SAFE_BUILTINS)}
            exec(compile(code, "<s%d>" % i, "exec"), g)
            g["transform"](ctx)
            out.append({"step": i, "ok": True})
        except Exception as e:
            out.append({"step": i, "ok": False, "err": str(e)[:120]})
    # 결과 시트의 값까지 지문으로 남긴다 — '돌았다'가 아니라 '같은 값이 나왔다'를 본다
    try:
        c = S.PythonComSkillContext(app, anchor, {"name": anchor_name}, timeout_s=300)
        sheet = SHEET_MAP["ResultSheet"] if apply_map else "ResultSheet"
        out.append({"values": [[str(v) for v in row] for row in c.read(sheet, "A1:H6")]})
    except Exception as e:
        out.append({"values_err": str(e)[:120]})
finally:
    try:
        for w in list(app.Workbooks):
            try: w.Close(SaveChanges=False)
            except Exception: pass
        app.Quit()
    except Exception: pass
    shutil.rmtree(work, ignore_errors=True)
print("@@RESULT@@" + json.dumps(out, ensure_ascii=False))
'''


def run(backend_dir, apply_map):
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as f:
        f.write(RUNNER)
        runner = f.name
    try:
        r = subprocess.run(
            [sys.executable, runner, str(backend_dir), str(ROOT / "test_mapping" / "mapping_test_saved_skill.zip"),
             "1" if apply_map else "0", json.dumps(SHEET_MAP), json.dumps(FILE_MAP), str(ROOT / "test_mapping")],
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=600)
        for line in (r.stdout or "").splitlines():
            if line.startswith("@@RESULT@@"):
                return json.loads(line[len("@@RESULT@@"):])
        return {"crash": ((r.stdout or "") + (r.stderr or ""))[-400:]}
    finally:
        Path(runner).unlink(missing_ok=True)


# 변경 '전' 백엔드를 git 에서 꺼내 임시 폴더에 둔다(현재 트리와 나란히 비교)
base = subprocess.run(["git", "rev-parse", "HEAD"], cwd=str(ROOT), capture_output=True, text=True).stdout.strip()
prev_dir = Path(tempfile.mkdtemp(prefix="backend_before_"))
try:
    src = subprocess.run(["git", "show", "cc83f298~1:serve_b2b.py"], cwd=str(ROOT),
                         capture_output=True, text=True, encoding="utf-8", errors="replace")
    if not src.stdout or "PythonComSkillContext" not in src.stdout:
        print("  SKIP  변경 전 백엔드를 꺼내지 못했습니다(얕은 클론 등) — 대조를 건너뜁니다.")
        sys.exit(0)
    (prev_dir / "serve_b2b.py").write_text(src.stdout, encoding="utf-8")
    check("변경 전 백엔드에는 filter_to_range 가 없다",
          "filter_to_range" not in src.stdout)
    check("현재 백엔드에는 있다",
          "filter_to_range" in (ROOT / "serve_b2b.py").read_text(encoding="utf-8-sig"))

    print("[1] 매핑을 적용한 정상 재생 — 전/후 결과가 같아야 한다")
    a = run(prev_dir, True)
    b = run(ROOT, True)
    check("전/후 단계별 성공·실패가 동일", json.dumps(a) == json.dumps(b),
          {"before": a, "after": b})
    steps_ok = [x for x in b if isinstance(x, dict) and x.get("ok") is True]
    check("실제로 단계가 돌았다(빈 비교가 아님)", len(steps_ok) >= 3, b)
    vals = [x for x in b if isinstance(x, dict) and "values" in x]
    check("결과 시트 값까지 읽혔다", bool(vals), b[-1] if b else None)

    print("[2] 매핑 없이 재생 — 전/후가 '같은 이유로' 같이 실패해야 한다")
    c = run(prev_dir, False)
    d = run(ROOT, False)
    check("전/후 실패 사유까지 동일", json.dumps(c) == json.dumps(d),
          {"before": c, "after": d})
finally:
    shutil.rmtree(prev_dir, ignore_errors=True)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
