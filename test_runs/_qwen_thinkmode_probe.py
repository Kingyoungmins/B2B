import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import _qwen_client as q   # sets utf-8 stdout

r = q.chat("너는 간결한 도우미다.", "1 더하기 1은? 숫자만 답해.", max_tokens=120,
           extra={"chat_template_kwargs": {"enable_thinking": False}})
print("[enable_thinking=False] finish:", r["finish"], "| content:", repr(r["content"][:200]))

r2 = q.chat("너는 간결한 도우미다.", "/no_think 1 더하기 1은? 숫자만 답해.", max_tokens=120)
print("[/no_think] finish:", r2["finish"], "| content:", repr(r2["content"][:200]))
