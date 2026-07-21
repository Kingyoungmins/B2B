# exe(CArchive)에서 프런트 스크립트를 추출해 최신 변경이 들어갔는지 확인.
import os
import sys
from PyInstaller.archive.readers import CArchiveReader

EXE = os.path.join(os.path.dirname(__file__), "..", "dist", "B2B_ver0.6.1", "B2B_Server.exe")
r = CArchiveReader(os.path.abspath(EXE))

names = []
for e in r.toc:
    nm = e[-1] if isinstance(e, (list, tuple)) else e
    names.append(str(nm))

CHECKS = {
    # DOUBLE_SLOP/swallowable = 이중발화·드래그 오발화·label 자기삼킴 수정본이 번들됐는지 확인.
    "scripts\\click-recovery.js": ["__b2bClickRecovery", "DOUBLE_MS", "DOUBLE_SLOP", "swallowable"],
    "scripts\\debug-panel.js": ["__b2bSynthetic", "선클릭"],
    "index.html": ["click-recovery.js"],
    # WaitForSingleObject = 259 좀비 오판 수정본, waitRestoreOrStall = 중단 진행률 기반 승격.
    "serve_b2b.py": ["STARTF_FORCEOFFFEEDBACK", "_is_pid_alive", "WaitForSingleObject"],
    "scripts\\pipeline.js": ["waitRestoreOrStall", "PIPELINE_VOLATILE_SUFFIX_TOKENS"],
    # [구분자 공백/소수점] 0건 매칭 · '20, 0' 오답 방어가 번들됐는지(프롬프트 + 클라 게이트).
    "scripts\\file-schema.js": ["구분자", "소수점"],
    "scripts\\chat-ui.js": ["decimalSplitNumberExtractFailures", "_clarifySeparatorWhitespaceQuestion"],
}

fails = 0
for target, markers in CHECKS.items():
    if target not in names:
        print("MISS 엔트리 없음:", target)
        fails += 1
        continue
    data = r.extract(target)
    if isinstance(data, tuple):
        data = data[1] if len(data) > 1 else data[0]
    if isinstance(data, str):
        data = data.encode("utf-8", "ignore")
    txt = data.decode("utf-8", "ignore")
    print("[" + target + "] len=" + str(len(txt)))
    for m in markers:
        ok = m in txt
        print(("  OK  " if ok else "  MISS ") + m)
        if not ok:
            fails += 1

print("\n=== " + ("ALL BUNDLED" if fails == 0 else str(fails) + " MISSING") + " ===")
# [게이트화] 예전엔 마커가 전부 빠져도 종료코드 0 이라, 배치/CI 에 `&&` 로 물리면 stale 번들이
# 그대로 통과했다(이 프로젝트 단골 함정인 '프로즌 exe vs 소스' 를 잡으려고 만든 스크립트인데
# 사람이 stdout 을 눈으로 읽을 때만 동작했다).
sys.exit(1 if fails else 0)
