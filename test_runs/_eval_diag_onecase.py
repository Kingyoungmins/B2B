# '정확매칭 합산' 한 케이스를 원본/현재 프롬프트로 각각 2회 생성해 코드를 덤프(회귀 vs 노이즈 판별).
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
import _qwen_client as q
import _eval_gate as g

REQ = next(r for r in g.REQUESTS if r["name"].startswith("정확매칭"))
schema = "\n\n" + g.build_schema()

def code_for(prompt_path, n):
    system = open(prompt_path, encoding="utf-8").read() + schema
    r = q.chat(system, REQ["req"], max_tokens=1400, temperature=0.0,
               extra={"chat_template_kwargs": {"enable_thinking": False}})
    code = g.extract_code(r["content"])
    has = {rx: bool(re.search(rx, code)) for rx in (REQ.get("any") or [])}
    return code, has

for label, path in [("원본", "test_runs/_prompt_orig.txt"), ("현재", "test_runs/_prompt_current.txt")]:
    for i in (1, 2):
        code, has = code_for(path, i)
        print("\n" + "=" * 70)
        print("[%s #%d] any매칭:" % (label, i), has)
        print("-" * 70)
        print(code[:1400])
