# [실측] 한전 Step11 오류 재현: 백엔드 ctx.book 이 스킬의 옛 파일명으로 업로드된 새 파일을 찾는가?
# 클라(대상 해석)는 통과해도, 백엔드가 못 찾으면 "워크북이 열려 있지 않습니다"가 그대로 난다.
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.1")
import serve_b2b as S

WANT = "02. 한전_AMI_유선간선망_청구세부내역_2026-07-07 09_23_01_DSMC_260707.xlsx"   # 스킬 코드의 리터럴
OPEN = [                                                                          # 실제 열린 워크북들
    "한국전력공사_202606_v1.1_DSMC_260710.xlsx",
    "02. 한전_AMI_유선간선망_청구세부내역_2026-07-14 13_07_47_DSMC_260714.xlsx",
    "03. 한전_AMI_무선인입망합산_청구세부내역_2026-07-14 13_11_11_DSMC_260714.xlsx",
    "01. 한전_DAS_배전자동화_청구세부내역_도서_2026-07-14 13_25_33_DSMC_260714 - 복사본 (2).xlsx",
    "01. 한전_DAS_배전자동화_청구세부내역_시내_2026-07-14 13_25_33_DSMC_260714 - 복사본.xlsx",
]

print("[백엔드 안정키]")
print("  찾는이름 :", WANT)
print("  키       :", repr(S._stable_workbook_key(WANT)))
print()
for n in OPEN:
    print("  %-44s → %s" % (S._stable_workbook_key(n), n[:52]))
print()
m = S._match_workbook_by_stable_key(OPEN, WANT)
print("[_match_workbook_by_stable_key] →", repr(m))
print()
print("판정:", "OK 백엔드는 찾음" if m else "✗ 백엔드도 못 찾음 → ctx.book 이 '열려 있지 않습니다' 로 실패")

# 01 배전자동화(도서/시내)도 확인
WANT01 = "01. 한전_DAS_배전자동화_청구세부내역_2026-07-12 19_00_54_DSMC_260712.xlsx"
m01 = S._match_workbook_by_stable_key(OPEN, WANT01)
print()
print("[01 배전자동화] 찾는키:", repr(S._stable_workbook_key(WANT01)), "→ 매칭:", repr(m01))
