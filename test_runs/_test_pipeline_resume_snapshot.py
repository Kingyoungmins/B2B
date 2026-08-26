# -*- coding: utf-8 -*-
"""[SBAGENT-293 D] 스냅샷 접두 재사용(resume) 로직의 계약 — _run_excel_python_pipeline_impl 경로.

⚠ 적용 범위 주의(2026-08-26 확인, 내 오진 정정):
  이 resume 로직을 쓰는 것은 **/api/pipeline/start(백그라운드 파이프라인)** 경로뿐이다.
  **실행기 [전체실행]** 은 /api/excel/run-full-pipeline → _run_full_pipeline_single_instance_impl
  로 가는데, 그 함수에는 resume/스냅샷 키 재사용이 **아예 없다**(항상 1단계부터).
  실측(08-26 10:23·10:29 두 실행) 모두 stepIdx 0 부터 돈 것이 그 증거다.
  → 사용자에게 "전체실행을 다시 누르면 앞 단계를 건너뜁니다"라고 안내하면 안 된다.
     함수 단위 검증만 하고 '실제 호출 경로'를 확인하지 않아 생긴 오진이었다.

이 파일은 그 resume 로직 자체(키 구성·접두 매칭·주석 무시)를 잠근다.
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
        # 스텝 구분은 '실제 코드'로 해야 한다 — 주석으로만 구분하면 서명에서 주석을 뺀 뒤
        # 모든 스텝이 같아져 테스트가 거짓 통과/실패한다(픽스처 결함으로 한 번 겪음).
        code = f"def transform(ctx):\n    ctx.write('S', 'A{i}', [[{i}]])"
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
c[10]["code"] = "def transform(ctx):\n    ctx.write('S', 'A11', [[999]])"   # 실제 동작 변경
best_c = S._find_best_pipeline_snapshot(IN_ITEMS, IN_WBS, OUT_ITEM, WB, c)
check("11단계를 고치면 29단계 스냅샷은 안 잡힌다", best_c is None, best_c)

print("[4] 스냅샷 파일이 사라지면 재사용하지 않는다")
S.PIPELINE_STEP_SNAPSHOTS[key_a29]["files"]["output:output"] = r"C:\없는경로\없는파일.xlsx"
best_d = S._find_best_pipeline_snapshot(IN_ITEMS, IN_WBS, OUT_ITEM, WB, b)
check("파일 없으면 처음부터", best_d is None, best_d)

print("[5] 주석/설명만 바뀐 단계는 이어실행을 깨지 않는다(실측 2026-08-26)")
# AI 가 '기본요금'→'기본료' 일괄 치환을 하면서 3단계는 주석·설명만 바뀌었다(그 단계는 R열을
# 직접 지정해 동작 무변). 그 탓에 접두가 무효화돼 재사용 0 → 처음부터 전체 재실행이 됐다.
c1 = mk_steps("기본료")
c2 = mk_steps("기본료")
c2[2]["code"] = c2[2]["code"] + "  # 기본료 열 합계"   # 주석만 추가
c2[2]["description"] = "[DAS] 기본료 열 합계"                                   # 설명만
k1 = S._pipeline_snapshot_key(IN_ITEMS, IN_WBS, OUT_ITEM, WB, c1[:29])
k2 = S._pipeline_snapshot_key(IN_ITEMS, IN_WBS, OUT_ITEM, WB, c2[:29])
check("주석만 바뀌면 접두 키 동일", k1 == k2, f"{k1[:12]} vs {k2[:12]}")
check("설명(단계 이름)만 바뀌어도 동일", k1 == k2)
# 지시성 주석은 실행 경로를 바꾸므로 반드시 서명에 남아야 한다
c3 = mk_steps("기본료")
c3[2]["code"] = "# B2B_ENGINE_FALLBACK: excel-com" + chr(10) + c3[2]["code"]
k3 = S._pipeline_snapshot_key(IN_ITEMS, IN_WBS, OUT_ITEM, WB, c3[:29])
check("B2B_ 지시성 주석은 서명에 반영(엔진이 바뀜)", k1 != k3)
# 실제 코드가 바뀌면 당연히 달라야 한다
c4 = mk_steps("기본료")
c4[2]["code"] = c4[2]["code"] + chr(10) + "    x = 1"
check("코드가 바뀌면 키도 바뀐다", k1 != S._pipeline_snapshot_key(IN_ITEMS, IN_WBS, OUT_ITEM, WB, c4[:29]))

print("[6] 적용 범위 — 실행기 전체실행 경로에는 resume 이 없다(오진 재발 방지)")
src = open(r"serve_b2b.py", encoding="utf-8-sig").read()
i = src.find("def _run_full_pipeline_single_instance_impl")
j = src.find(chr(10) + "def ", i + 10)
runner_fn = src[i:j if j > 0 else len(src)]
check("실행기 경로에 _find_best_pipeline_snapshot 호출 없음", "_find_best_pipeline_snapshot" not in runner_fn)
check("실행기 경로에 resume_from 없음", "resume_from" not in runner_fn)
k = src.find("def _run_excel_python_pipeline_impl")
l = src.find(chr(10) + "def ", k + 10)
bg_fn = src[k:l if l > 0 else len(src)]
check("bg 파이프라인 경로에는 resume 이 있다", "_find_best_pipeline_snapshot" in bg_fn and "resume_from" in bg_fn)

print("")
print("RESULT: ALL PASS" if fails == 0 else "RESULT: %d FAIL" % fails)
sys.exit(0 if fails == 0 else 1)
