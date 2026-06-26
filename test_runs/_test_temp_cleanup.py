# -*- coding: utf-8 -*-
# [회귀] cleanup_stale_temp_artifacts 실제 함수 검증 — 가짜 temp 구조에서:
#  - stale(오래된) live_/prestep_/isopipe_/single_/_MEI_/Excel진단 → 삭제
#  - recent(최근) → 보존(동시실행 보호)
#  - auto_backups(사용자 스킬 백업) → 보존
# 기능 안 깨지는지(보존 규칙)까지 실제 코드로 확인.
import os, sys, time, tempfile, shutil
from pathlib import Path

sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.5.14")
import serve_b2b as S

fake = Path(tempfile.mkdtemp(prefix="b2b_cleanuptest_"))
backend = fake / "b2b_backend_v044"
backend.mkdir(parents=True, exist_ok=True)

now = time.time()
OLD = now - 100000   # 충분히 오래됨
NEW = now            # 최근

def mk_dir(p, mtime):
    p.mkdir(parents=True, exist_ok=True)
    (p / "x.dat").write_text("x")
    os.utime(p, (mtime, mtime))
def mk_file(p, mtime):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("x")
    os.utime(p, (mtime, mtime))

# BACKEND_DIR 내부
mk_dir(backend / "live_OLD", OLD)                 # 삭제 대상
mk_dir(backend / "live_RECENT", NEW)              # 보존(최근)
mk_dir(backend / "auto_backups", OLD)             # 보존(스킬 백업) — 오래돼도 유지
mk_file(backend / "prestep_OLD_a.xlsx", OLD)      # 삭제 대상
mk_file(backend / "deadbeef_src.xlsx", OLD)       # 삭제 대상(uuid_ 소스)
# Temp 루트
mk_dir(fake / "b2b_isopipe_OLD", OLD)             # 삭제
mk_dir(fake / "B2B_ver0.5.14_single_OLD", OLD)    # 삭제
mk_dir(fake / "B2B_ver0.5.14_single_NEW", NEW)    # 보존(최근)
mk_dir(fake / "_MEIOLD", OLD)                     # 삭제(보수적 나이 충족)
mk_dir(fake / "_MEINEW", NEW)                     # 보존(최근)
mk_file(fake / "Diagnostics" / "EXCEL" / "log_OLD.txt", OLD)  # 삭제
mk_file(fake / "Diagnostics" / "EXCEL" / "log_NEW.txt", NEW)  # 보존

# 진짜 함수가 fake temp 를 보도록 패치
S.BACKEND_DIR = backend
tempfile.gettempdir = (lambda _orig=str(fake): _orig)

stats = S.cleanup_stale_temp_artifacts(min_age_seconds=300, excel_diag_max_age_seconds=300, mei_max_age_seconds=300)

def gone(p): return not p.exists()
def kept(p): return p.exists()

checks = [
    ("live_OLD 삭제",            gone(backend / "live_OLD")),
    ("live_RECENT 보존",         kept(backend / "live_RECENT")),
    ("auto_backups 보존(중요)",  kept(backend / "auto_backups")),
    ("prestep_OLD 삭제",         gone(backend / "prestep_OLD_a.xlsx")),
    ("uuid_ 소스 삭제",          gone(backend / "deadbeef_src.xlsx")),
    ("b2b_isopipe_OLD 삭제",     gone(fake / "b2b_isopipe_OLD")),
    ("single_OLD 삭제",          gone(fake / "B2B_ver0.5.14_single_OLD")),
    ("single_NEW 보존(최근)",    kept(fake / "B2B_ver0.5.14_single_NEW")),
    ("_MEIOLD 삭제",             gone(fake / "_MEIOLD")),
    ("_MEINEW 보존(최근)",       kept(fake / "_MEINEW")),
    ("Excel진단 OLD 삭제",       gone(fake / "Diagnostics" / "EXCEL" / "log_OLD.txt")),
    ("Excel진단 NEW 보존",       kept(fake / "Diagnostics" / "EXCEL" / "log_NEW.txt")),
]
fails = 0
for name, ok in checks:
    print((" OK  " if ok else "FAIL ") + name)
    if not ok: fails += 1
print("\nstats =", stats)
shutil.rmtree(fake, ignore_errors=True)
print(f"\n=== RESULT: {len(checks)-fails}/{len(checks)} PASS ===")
sys.exit(1 if fails else 0)
