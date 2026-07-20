# [SBAGENT-209] 복붙 캡처가 코드에 박는 워크북 이름 — 내부 작업본명(excel_open_<hash>.xls)을
# 사용자 원본명으로 되돌리는 _user_facing_workbook_name_for_live 검증(순수 함수, COM 불필요).
# 배경: 위장 파일(.xls=OLE/HTML)은 라이브 wb.Name 이 excel_open_<hash> 라서 캡처가 그대로 저장하면
#       실행기 파일확인에 영원히 못 채우는 '파일 선택 필요' 행이 뜨고 재생도 깨졌다.
import sys
sys.path.insert(0, r"C:\Users\Admin\Desktop\KGM_git\B2B_ver0.6.2")
import serve_b2b as S

fails = 0
def ck(n, c, g=None):
    global fails
    print((" OK  " if c else "FAIL ") + n + ("" if c else " got=" + repr(g)))
    if not c: fails += 1

APP = object()
S._excel_process_id = lambda app: 1234  # pid 고정(모의 app)

ORIG = "가입자별청구내역_20260624_3월청구_581702980619_DSMC_260624.xls"
LIVE = "excel_open_bfbf3e127226ab1d4342a3adc927b77a49af983fda084c4533d2.xls"

# (1) 일반 파일명은 그대로(역별칭 조회 자체를 안 탐)
got = S._user_facing_workbook_name_for_live(APP, "월간정산_2026_06.xlsx")
ck("(1) 일반 파일명 불변", got == "월간정산_2026_06.xlsx", got)

# (2) 역별칭 없으면 내부명 그대로(현행 유지 — 못 풀면 안 건드림)
S._WB_NAME_REVERSE_ALIASES.clear()
got = S._user_facing_workbook_name_for_live(APP, LIVE)
ck("(2) 역별칭 없음 → 그대로", got == LIVE, got)

# (3) _stash 가 역별칭을 쌓고, 캡처 해석이 원본명을 되찾는다(왕복)
S._stash_workbook_name_alias(APP, ORIG, LIVE)
got = S._user_facing_workbook_name_for_live(APP, LIVE)
ck("(3) 역별칭 → 사용자 원본명", got == ORIG, got)

# (4) <hash>_원본명.xlsx 형태는 별칭 없어도 접두어 벗겨 원본명 복원
got = S._user_facing_workbook_name_for_live(APP, "a1b2c3d4e5f60718_원가내역_2026_06.xlsx")
ck("(4) 생성 접두어 제거 폴백", got == "원가내역_2026_06.xlsx", got)

# (5) live_reset_ 접두어도 내부명으로 인식
S._stash_workbook_name_alias(APP, "출력양식.xlsx", "live_reset_0123456789abcdef.xlsx")
got = S._user_facing_workbook_name_for_live(APP, "live_reset_0123456789abcdef.xlsx")
ck("(5) live_reset_ 역별칭 해석", got == "출력양식.xlsx", got)

# (6) 이름이 같으면(변환 없음) _stash 는 스킵 → 역별칭 미등록(회귀 0 보장 확인)
S._WB_NAME_REVERSE_ALIASES.clear()
S._stash_workbook_name_alias(APP, "그대로.xlsx", "그대로.xlsx")
ck("(6) 무변환 파일은 역별칭 미등록", not S._WB_NAME_REVERSE_ALIASES.get(1234), S._WB_NAME_REVERSE_ALIASES.get(1234))

# (7) _clear 가 역별칭도 지운다(인스턴스 재시작 후 옛 매핑 오염 방지)
S._stash_workbook_name_alias(APP, ORIG, LIVE)
S._clear_workbook_name_aliases(APP)
ck("(7) clear 시 역별칭 제거", 1234 not in S._WB_NAME_REVERSE_ALIASES, dict(S._WB_NAME_REVERSE_ALIASES))

print()
print("=== RESULT: " + ("ALL PASS" if fails == 0 else f"{fails} FAIL") + " ===")
sys.exit(1 if fails else 0)
