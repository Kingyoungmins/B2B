# -*- coding: utf-8 -*-
"""[새로고침 즉시복원] 백엔드 최종상태 스냅샷 저장소 계약.
Excel 없이 순수 로직만 검증한다(키 재현성·모드 3종·정리·유령항목).
핵심 전제: 라이브는 원본을 저장하지 않으므로(SaveChanges=False) 새로고침 뒤에도
원본 지문이 그대로 → 같은 키가 재현된다. 원본이 바뀌면 키가 달라져 옛 사본을 쓰지 않는다.
"""
import io
import os
import sys
import time
import types
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent

fails = 0


def check(name, cond, detail=""):
    global fails
    if cond:
        print("  PASS  " + name)
    else:
        fails += 1
        print("  FAIL  " + name + (("  -> " + str(detail)) if detail else ""))


# serve_b2b 를 통째로 import 하면 COM/서버가 붙는다 — 필요한 함수만 떼어 독립 모듈로 실행한다.
src = io.open(ROOT / "serve_b2b.py", encoding="utf-8-sig").read()


def grab(name):
    key = "def %s(" % name
    i = src.index(key)
    j = i
    lines = src[i:].split("\n")
    out = [lines[0]]
    for ln in lines[1:]:
        if ln and not ln[0].isspace() and not ln.startswith(")"):
            break
        out.append(ln)
    return "\n".join(out)


mod = types.ModuleType("lfs")
import hashlib, json, shutil, tempfile
mod.__dict__.update({
    "hashlib": hashlib, "json": json, "shutil": shutil, "time": time, "Path": Path, "os": os,
    "MAX_PIPELINE_STEP_SNAPSHOTS": 3,                 # 정리 검증용으로 작게
    "HOUSEKEEPING_SNAPSHOT_MAX_BYTES": 10 * 1024 * 1024,
    "LIVE_FINAL_SNAPSHOTS": {},
    "_warn_excel_nonfatal": lambda stage, err: None,
})
work = Path(tempfile.mkdtemp(prefix="b2b_lfs_test_"))
mod.__dict__["BACKEND_DIR"] = work / "backend"
mod.__dict__["BACKEND_DIR"].mkdir(parents=True, exist_ok=True)

code = "\n\n".join([
    grab("_workbook_fingerprint"),
    'LIVE_FINAL_SNAPSHOT_DIRNAME = "live_final_snapshots"',
    grab("_live_final_snapshot_key"),
    grab("_live_final_snapshot_stats"),
    grab("_cleanup_live_final_snapshots"),
    grab("_save_live_final_snapshot"),
    grab("_find_live_final_snapshot"),
])
exec(compile(code, "lfs", "exec"), mod.__dict__)

M = mod.__dict__
origin = work / "origin"
origin.mkdir()


def make_file(p, text):
    io.open(p, "w", encoding="utf-8").write(text)
    return p


def rec(name, path, wid=None):
    return {"id": wid or ("wb_" + name), "name": name, "path": str(path)}


print("[1] 키 재현성 — 원본이 그대로면 같은 키")
orig_a = make_file(origin / "a.xlsx", "original-a")
ra = rec("a.xlsx", orig_a)
k1 = M["_live_final_snapshot_key"](ra, "sig-1")
k2 = M["_live_final_snapshot_key"](rec("a.xlsx", orig_a), "sig-1")
check("같은 원본·같은 서명 → 같은 키", k1 == k2)
check("서명이 다르면 다른 키", k1 != M["_live_final_snapshot_key"](ra, "sig-2"))
time.sleep(0.02)
make_file(orig_a, "original-a-CHANGED")          # 원본이 바뀌면(재업로드 등)
check("원본이 바뀌면 다른 키", k1 != M["_live_final_snapshot_key"](ra, "sig-1"))
make_file(orig_a, "original-a")                  # 되돌려도 크기·mtime 이 달라 키는 다름(보수적)
check("빈 서명은 키 조회 자체를 안 함", M["_find_live_final_snapshot"](ra, "") is None)
check("워크북 레코드가 없으면 None", M["_find_live_final_snapshot"](None, "sig-1") is None)

print("[2] 저장 모드 3종")
ra = rec("a.xlsx", orig_a)
res_copy = make_file(work / "result_copy.xlsx", "applied-state")
snap = M["_save_live_final_snapshot"](ra, "sigA", res_copy)
check("기본=복사: 원본 결과 파일이 남아있다", res_copy.exists())
check("기본=복사: 사본이 스냅샷 폴더 안", snap and "live_final_snapshots" in snap["path"])
check("복사본 내용 일치", io.open(snap["path"], encoding="utf-8").read() == "applied-state")

res_move = make_file(work / "result_move.xlsx", "applied-move")
snap_m = M["_save_live_final_snapshot"](rec("b.xlsx", make_file(origin / "b.xlsx", "ob")), "sigB", res_move, move=True)
check("move: 원본 결과 파일이 사라짐(전체실행 임시파일)", not res_move.exists())
check("move: 사본은 존재", snap_m and Path(snap_m["path"]).exists())

res_link = make_file(work / "result_link.xlsx", "applied-link")
snap_l = M["_save_live_final_snapshot"](rec("c.xlsx", make_file(origin / "c.xlsx", "oc")), "sigC", res_link, link=True)
check("link: 그 자리를 가리킨다(복사 안 함)", snap_l and Path(snap_l["path"]) == res_link)

print("[3] 조회")
check("저장한 뒤 찾으면 나온다", M["_find_live_final_snapshot"](ra, "sigA") is not None)
check("다른 서명으로는 안 나온다", M["_find_live_final_snapshot"](ra, "sigZ") is None)
# link 대상이 정리로 사라지면 → 없음으로 떨어지고 유령 항목도 제거돼야 한다
before = len(M["LIVE_FINAL_SNAPSHOTS"])
res_link.unlink()
check("파일이 사라지면 없음으로 떨어짐",
      M["_find_live_final_snapshot"](rec("c.xlsx", origin / "c.xlsx"), "sigC") is None)
check("유령 항목이 제거됨", len(M["LIVE_FINAL_SNAPSHOTS"]) == before - 1)

print("[4] 정리(개수 한도) — 오래된 것부터")
M["LIVE_FINAL_SNAPSHOTS"].clear()
kept = []
for i in range(6):
    p = make_file(work / f"r{i}.xlsx", "x" * 100)
    r = rec(f"f{i}.xlsx", make_file(origin / f"f{i}.xlsx", f"o{i}"))
    s = M["_save_live_final_snapshot"](r, "sigLoop", p)
    if s:
        s["created"] = 1000 + i          # 결정적 순서(시계 의존 제거)
        kept.append((r, s))
    M["_cleanup_live_final_snapshots"]()
check("개수 한도(3) 이하로 유지", len(M["LIVE_FINAL_SNAPSHOTS"]) <= 3, len(M["LIVE_FINAL_SNAPSHOTS"]))
check("최신 것이 살아남음", M["_find_live_final_snapshot"](kept[-1][0], "sigLoop") is not None)
check("가장 오래된 것은 정리됨", M["_find_live_final_snapshot"](kept[0][0], "sigLoop") is None)

print("[5] 실패해도 예외를 올리지 않는다(부가기능)")
check("없는 소스 파일 → None", M["_save_live_final_snapshot"](ra, "sigX", work / "no_such.xlsx") is None)
check("서명 없음 → None", M["_save_live_final_snapshot"](ra, "", res_copy) is None)
check("레코드 없음 → None", M["_save_live_final_snapshot"](None, "sigX", res_copy) is None)

shutil.rmtree(work, ignore_errors=True)
print("")
print("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL")
sys.exit(0 if fails == 0 else 1)
