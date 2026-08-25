# -*- coding: utf-8 -*-
"""[SBAGENT-293 D] '전체실행을 다시 누르면 앞 단계를 건너뛴다'가 사실인지 실증한다.

AI 카드/지시문에 그렇게 안내하기로 했으므로, 근거 없이 쓰면 안 된다.
백엔드의 스냅샷 키·resume 판정 함수를 실제로 호출해 확인한다(Excel 불필요 — 순수 로직).
"""
import sys

sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.8.0")
import serve_b2b as S

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:200]) if (not cond and detail) else ""))
    if not cond:
        fails += 1


def mk_steps(step30_header="기본요금"):
    steps = []
    for i in range(1, 37):
        code = f"def transform(ctx):\n    pass  # step{i}"
        desc = f"Step {i}"
        if i == 30:
            code = f'def transform(ctx):\n    c = ctx.find_header("Sheet1", "{step30_header}")'
            desc = f"[DAS도서] {step30_header} 열 합계"
        steps.append({"id": f"s{i}", "language": "python", "enabled": True,
                      "code": code, "description": desc})
    return steps


# 워크북 레코드/아이템은 지문 계산에만 쓰인다 — 같은 값이면 같은 지문.
WB = {"name": "out.xlsx", "path": __file__}          # 존재하는 파일이면 지문 계산 가능
IN_ITEMS = [{"name": "in.xlsx"}]
IN_WBS = [{"name": "in.xlsx", "path": __file__}]
OUT_ITEM = {"name": "out.xlsx"}

print("[1] 스텝 서명 — 30단계만 고치면 1~29 접두 키는 그대로여야 이어실행이 성립한다")
a = mk_steps("기본요금")
b = mk_steps("기본료")           # AI 가 30단계만 수정한 상태
key_a29 = S._pipeline_snapshot_key(IN_ITEMS, IN_WBS, OUT_ITEM, WB, a[:29])
key_b29 = S._pipeline_snapshot_key(IN_ITEMS, IN_WBS, OUT_ITEM, WB, b[:29])
check("1~29 접두 키 동일(= 앞 29단계 재사용 가능)", key_a29 == key_b29, f"{key_a29[:12]} vs {key_b29[:12]}")
key_a30 = S._pipeline_snapshot_key(IN_ITEMS, IN_WBS, OUT_ITEM, WB, a[:30])
key_b30 = S._pipeline_snapshot_key(IN_ITEMS, IN_WBS, OUT_ITEM, WB, b[:30])
check("30 포함 키는 달라짐(= 고친 단계부터 다시 실행)", key_a30 != key_b30)

print("[2] resume 판정 — 29단계 스냅샷이 있으면 resume_from=29 로 잡히는가")
S.PIPELINE_STEP_SNAPSHOTS.clear()
S.PIPELINE_STEP_SNAPSHOTS[key_a29] = {
    "key": key_a29, "stepIdx": 29, "created": 0,
    # _snapshot_files_exist 가 실제 존재를 확인하므로 실존 파일을 가리킨다
    "files": {"output:output": __file__, "input:in.xlsx": __file__},
}
best = S._find_best_pipeline_snapshot(IN_ITEMS, IN_WBS, OUT_ITEM, WB, b)
check("수정본으로 다시 돌려도 스냅샷이 잡힌다", best is not None, best)
if best:
    check("resume_from = 29 (앞 29단계 건너뜀)", best[0] == 29, best[0])

print("[3] 앞 단계를 고치면 재사용하지 않는다(정합성)")
c = mk_steps("기본료")
c[10]["code"] = "def transform(ctx):\n    pass  # step11 수정됨"
best_c = S._find_best_pipeline_snapshot(IN_ITEMS, IN_WBS, OUT_ITEM, WB, c)
check("11단계를 고치면 29단계 스냅샷은 안 잡힌다", best_c is None, best_c)

print("[4] 스냅샷 파일이 사라지면 재사용하지 않는다")
S.PIPELINE_STEP_SNAPSHOTS[key_a29]["files"]["output:output"] = r"C:\없는경로\없는파일.xlsx"
best_d = S._find_best_pipeline_snapshot(IN_ITEMS, IN_WBS, OUT_ITEM, WB, b)
check("파일 없으면 처음부터", best_d is None, best_d)

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)
