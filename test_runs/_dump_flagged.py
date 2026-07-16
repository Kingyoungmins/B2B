# 플래그된 인덱스만 재실행해서 전체 모델 출력 덤프 → 사람이 판정.
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
import _qwen_client as q
import _eval_batch as b

HERE = os.path.dirname(__file__)
reqs = [l.strip() for l in open(os.path.join(HERE, "_batch_requests.txt"), encoding="utf-8") if l.strip()]
schema = b.build_schema_all()
system = open(os.path.join(HERE, "_prompt_current.txt"), encoding="utf-8").read() + "\n\n" + schema

IDX = [int(x) for x in sys.argv[1].split(",")]
out = open(os.path.join(HERE, "_flagged_dump.txt"), "w", encoding="utf-8")
for i in IDX:
    req = reqs[i-1]
    r = q.chat(system, req, max_tokens=1400, temperature=0.0,
               extra={"chat_template_kwargs": {"enable_thinking": False}})
    c = r["content"] or ""
    out.write("\n" + "="*90 + "\n#%d  %s\n" % (i, req) + "-"*90 + "\n")
    out.write(c.strip() + "\n")
    out.flush()
out.close()
print("done", IDX)
