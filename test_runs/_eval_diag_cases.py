# 특정 케이스를 여러 프롬프트 x 여러 회 돌려 '재현 회귀 vs 노이즈' 판별.
# 사용: python _eval_diag_cases.py "케이스이름부분,케이스이름부분" [반복]
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
import _qwen_client as q
import _eval_gate as g

names = [x.strip() for x in (sys.argv[1] if len(sys.argv) > 1 else "필터,월 +1").split(",")]
reps = int(sys.argv[2]) if len(sys.argv) > 2 else 2
cases = [r for r in g.REQUESTS if any(n in r["name"] for n in names)]
schema = "\n\n" + g.build_schema()
PROMPTS = [("BASE(공통계약 없음)", "test_runs/_prompt_base.txt"),
           ("CC(공통계약 추가)", "test_runs/_prompt_current.txt")]

for label, path in PROMPTS:
    system = open(path, encoding="utf-8").read() + schema
    print("\n### %s ###" % label)
    for it in cases:
        results = []
        for i in range(reps):
            ok, reason, code, usage = g.score_one(system, it)
            results.append("OK" if ok else "FAIL(%s)" % ",".join(reason))
        print("  %-24s %s" % (it["name"], " | ".join(results)))
