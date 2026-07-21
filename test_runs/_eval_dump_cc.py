import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
import _qwen_client as q
import _eval_gate as g

schema = "\n\n" + g.build_schema()
it = next(r for r in g.REQUESTS if "정확매칭" in r["name"])
REPS = 5

def classify(code):
    bad = bool(re.search(r'"contains"[^)\n]*기본료|기본료[^)\n]*"contains"', code))
    good = ("전국대표 포함한 기본료" in code) and not bad
    return "GOOD(정확)" if good else ("BAD(contains과포함)" if bad else "기타")

for label, path in [("BASE(수정전)", "test_runs/_prompt_base.txt"), ("FIX(contains규칙)", "test_runs/_prompt_current.txt")]:
    system = open(path, encoding="utf-8").read() + schema
    tally = {}
    for i in range(REPS):
        r = q.chat(system, it["req"], max_tokens=1400, temperature=0.0,
                   extra={"chat_template_kwargs": {"enable_thinking": False}})
        c = classify(g.extract_code(r["content"]))
        tally[c] = tally.get(c, 0) + 1
    print("%-20s %s" % (label, tally))
