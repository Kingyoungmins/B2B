# -*- coding: utf-8 -*-
"""[설명서 동기화] docs/user-guide/AX-Cell_스킬_함수_설명서 가 실제 ctx 와 어긋나지 않는지.

Excel 없이 수 초에 끝난다(배포 전 일괄 점검용). 실제로 도는지는
_test_ctx_manual_examples_com.py 가 진짜 Excel 로 확인한다.

이 문서는 사업팀이 '무엇을 시킬 수 있는가'의 근거로 본다. 명령이 추가/삭제/개명될 때
문서만 옛날 것으로 남으면 없느니만 못하므로, 어긋나면 여기서 바로 실패시킨다.
"""
import ast
import io
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "docs" / "user-guide" / "AX-Cell_스킬_함수_설명서_v0.8.0.txt"

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:400]) if not cond else ""))
    if not cond:
        fails.append(name)


tree = ast.parse(io.open(ROOT / "serve_b2b.py", encoding="utf-8-sig").read())
cls = [n for n in ast.walk(tree) if isinstance(n, ast.ClassDef) and n.name == "PythonComSkillContext"][0]
methods = {}
for m in cls.body:
    if isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)) and not m.name.startswith("_"):
        methods[m.name] = [a.arg for a in m.args.args if a.arg != "self"]
methods.pop("summary", None)     # 내부 집계용 — 사용자 문서 대상 아님

print("[1] 문서가 존재한다")
check("설명서 파일", DOC.exists(), DOC)
doc = DOC.read_text(encoding="utf-8") if DOC.exists() else ""

print("[2] 빠진 명령·없는 명령이 없다")
named = set(re.findall(r"ctx\.([a-z_]+)", doc))
missing = sorted(set(methods) - named)
ghost = sorted(n for n in named - set(methods) if n not in ("book",))
check("실제 명령이 전부 문서에 있다 (%d개)" % len(methods), not missing, missing)
check("문서에만 있는 유령 명령이 없다", not ghost, ghost)

print("[3] 표제부에 적은 인자 이름이 실제와 같다")
bad = []
titles = 0
for line in doc.split("\n"):
    m = re.match(r"^ctx\.([a-z_]+)\((.*?)\)", line.strip())
    if not m:
        continue
    titles += 1
    fn, args = m.group(1), m.group(2)
    if fn not in methods:
        bad.append("없는 함수: " + fn)
        continue
    for kv in re.finditer(r"([A-Za-z_]\w*)=", args):     # 영문 키워드 인자만(한글은 자리표시자)
        if kv.group(1) not in methods[fn]:
            bad.append("%s: '%s' 라는 인자는 없다" % (fn, kv.group(1)))
check("표제부 %d개의 인자 이름이 실제와 일치" % titles, not bad, bad)

print("[4] 한글 자리표시자에 '=기본값'을 붙이지 않는다(그대로 복사하면 실패한다)")
ko_kw = re.findall(r"^ctx\.[a-z_]+\([^)]*?([가-힣]+)=", doc, re.M)
check("한글 인자명에 = 없음", not ko_kw, ko_kw)

print("[5] 개수 표기가 실제와 맞는다")
m = re.search(r"명령\(ctx\)\s*(\d+)\s*가지", doc)
check("머리말의 명령 개수", bool(m) and int(m.group(1)) == len(methods),
      (m.group(1) if m else None, len(methods)))
cat = re.findall(r"^\s*[가-힣]\.\s+.*?\((\d+)개\)", doc, re.M)
check("분류별 합계 = 전체 개수", sum(int(x) for x in cat) == len(methods),
      (sum(int(x) for x in cat), len(methods), cat))

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
