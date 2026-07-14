# [실측][한전 지원건] 워크북 안정키 — 중복 다운로드 접미사 "(2)"/"- 복사본" 흡수 검증.
# 배경: 파일명에 다운로드 타임스탬프가 박힌 청구세부내역을 재다운로드하면 " (2)" 가 붙어
#       stable key 에 숫자 2 가 남아 ctx.book 폴백 매칭이 깨졌다(스킬 수정 후 재실행 실패).
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.0")
import serve_b2b as S

fails = 0
def ck(n, c, g=None):
    global fails
    print((" OK  " if c else "FAIL ") + n + ("" if c else " got=" + repr(g)))
    if not c: fails += 1

OLD = "02. 한전_AMI_유선간선망_청구세부내역_2026-07-07 09_23_01_DSMC_260707.xlsx"

ck("(1) 타임스탬프만 다른 재다운로드 매칭",
   S._match_workbook_by_stable_key(["02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 10_55_33_DSMC_260714.xlsx"], OLD) is not None)
ck("(2) ' (2)' 접미사 매칭",
   S._match_workbook_by_stable_key(["02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 10_55_33_DSMC_260714 (2).xlsx"], OLD) is not None)
ck("(3) '- 복사본' 접미사 매칭",
   S._match_workbook_by_stable_key(["02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 10_55_33_DSMC_260714 - 복사본.xlsx"], OLD) is not None)
ck("(4) 같은 종류 2개 열림(모호) → 매칭 안 함(안전)",
   S._match_workbook_by_stable_key([
       "02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 10_55_33_DSMC_260714.xlsx",
       "02. 한전_AMI_유선간선망_청구세부내역_2026-07-13 08_00_00_DSMC_260713.xlsx"], OLD) is None)
ck("(5) 무관 파일(배전자동화) 불일치",
   S._match_workbook_by_stable_key(["01. 한전_DAS_배전자동화_청구세부내역_2026-07-12 19_00_54_DSMC_260712.xlsx"], OLD) is None)
ck("(6) 이름 중간의 (2)는 키에 보존(과잉 제거 방지)",
   S._stable_workbook_key("한전(2)공사_리스트.xlsx") != S._stable_workbook_key("한전공사_리스트.xlsx"))

print("\n=== RESULT: " + ("ALL PASS" if fails == 0 else str(fails) + " FAIL") + " ===")
sys.exit(1 if fails else 0)
