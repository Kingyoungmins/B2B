# -*- coding: utf-8 -*-
# [result-edit 정체성 보존] 실행기 파일출력 전체실행 결과(결과_<stem>_<ts>[_난수].xlsx)를 result-edit 로
# 라이브에 되불러올 때, 라이브 wb 의 정체성 이름이 '원래 세션 이름' 으로 보존되는지(데코명이 새지 않는지)
# 검증한다. + 스냅샷 복원 회귀 0 + %20↔공백 lookup 동치.
import io, sys, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import serve_b2b as S

passed = 0
failed = 0
def ck(name, cond):
    global passed, failed
    if cond:
        passed += 1; print(" OK  " + name)
    else:
        failed += 1; print("FAIL " + name)

R = S._resolve_live_identity_name

# 1) 핵심: 실행기 결과명이 들어와도 세션 원본명 보존
ck("[1] 결과_<stem>_<ts>_난수 → 세션 원본명 보존",
   R("원본.xlsx", "결과_원본_20260630_164500_3a4f9c.xlsx", "결과_원본_20260630_164500_3a4f9c.xlsx") == "원본.xlsx")

# 2) 타임스탬프만 붙은 결과명도 보존
ck("[2] 결과_<stem>_<ts>(난수없음) → 보존",
   R("DSMC_260616.xlsx", "결과_DSMC_260616_20260630_164500.xlsx", "결과_DSMC_260616_20260630_164500.xlsx") == "DSMC_260616.xlsx")

# 3) 스냅샷 복원(prestep_<32hex>_원본) — 세션명과 동일 결과(회귀 0)
hex32 = "0123456789abcdef0123456789abcdef"
ck("[3] 스냅샷 prestep_<hex>_원본 + 세션원본 → 원본 (회귀0)",
   R("원본.xlsx", "prestep_%s_원본.xlsx" % hex32, "prestep_%s_원본.xlsx" % hex32) == "원본.xlsx")

# 4) 세션 이름이 없을 때(엣지) → 들어온 파일명을 접두사 정리해서 사용
ck("[4] 세션명 없음 + <32hex>_원본 → 접두사 정리(원본)",
   R("", "%s_원본.xlsx" % hex32, "%s_원본.xlsx" % hex32) == "원본.xlsx")
ck("[4b] 세션명 없음 + 결과데코 → (벗길 패턴 아님) 데코 그대로(최소동작)",
   R(None, "결과_원본_20260630_1.xlsx", "결과_원본_20260630_1.xlsx") == "결과_원본_20260630_1.xlsx")

# 5) 세션명 자체가 prestep 데코였어도 정리되어 보존
ck("[5] 세션명이 <32hex>_원본 이어도 정리 보존",
   R("%s_원본.xlsx" % hex32, "결과_원본_x.xlsx", "결과_원본_x.xlsx") == "원본.xlsx")

# 6) %20 ↔ 공백 lookup 동치(VBA/ctx 해석이 변형명도 같은 책으로 보는지)
k = S._workbook_name_lookup_key
ck("[6] %20 == 공백 정규화 동일키",
   k("LGU%20농협생명보험_DSMC_260630.xlsx") == k("LGU 농협생명보험_DSMC_260630.xlsx"))
ck("[6b] lookup_keys 교집합 존재(%20 vs 공백)",
   bool(S._workbook_name_lookup_keys("LGU%20농협_260630.xlsx") & S._workbook_name_lookup_keys("LGU 농협_260630.xlsx")))

print("\n=== RESULT: %d PASS / %d FAIL ===" % (passed, failed))
sys.exit(1 if failed else 0)
