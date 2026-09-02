# -*- coding: utf-8 -*-
"""[0.8.3 토큰 계측] LLM 프록시 usage 캡처 — 주입/추출/기록.

모든 LLM 호출이 serve_b2b 의 /v1 프록시를 지나므로 여기서 usage 를 남기면
채팅·AI도움·대시보드 질문까지 빠짐없이 잡힌다.
  · 스트리밍 요청에는 stream_options.include_usage 를 주입(vLLM 이 마지막 청크에 usage)
  · 응답 꼬리에서 usage 블록을 뽑아 llm.usage 트레이스로 기록
  · 실패해도 프록시 동작(요청/응답 중계)은 절대 안 막는다
"""
import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import serve_b2b as S

fails = []


def check(name, cond, detail=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:250]) if not cond else ""))
    if not cond:
        fails.append(name)


print("[1] 요청 주입 — 스트리밍이면 include_usage, 아니면 무변경")
body = json.dumps({"model": "Qwen3.6-27B-FP8", "stream": True,
                   "messages": [{"role": "user", "content": "안녕"}]}).encode("utf-8")
out, model, stream = S._inject_stream_usage(body)
data = json.loads(out)
check("모델/스트림 감지", model == "Qwen3.6-27B-FP8" and stream is True, (model, stream))
check("include_usage 주입", data.get("stream_options", {}).get("include_usage") is True, data)
check("원문 필드 보존", data["messages"][0]["content"] == "안녕")

body2 = json.dumps({"model": "m", "stream": False}).encode("utf-8")
out2, model2, stream2 = S._inject_stream_usage(body2)
check("비스트림은 본문 무변경", out2 == body2 and stream2 is False)

out3, model3, _ = S._inject_stream_usage(b"not-json{{{")
check("JSON 아니면 그대로 통과(요청 안 막음)", out3 == b"not-json{{{" and model3 == "")
check("빈 본문 안전", S._inject_stream_usage(None) == (None, "", False))

# 이미 stream_options 가 있으면 보존 + include_usage 만 추가
body4 = json.dumps({"model": "m", "stream": True, "stream_options": {"x": 1}}).encode("utf-8")
d4 = json.loads(S._inject_stream_usage(body4)[0])
check("기존 stream_options 보존", d4["stream_options"] == {"x": 1, "include_usage": True}, d4)

print("[2] 응답 추출 — 비스트림 JSON")
resp = json.dumps({"choices": [{"message": {"content": "답"}}],
                   "usage": {"prompt_tokens": 1200, "completion_tokens": 340, "total_tokens": 1540}}).encode("utf-8")
u = S._extract_llm_usage(resp)
check("usage 추출", u == {"prompt": 1200, "completion": 340, "total": 1540}, u)

print("[3] 응답 추출 — SSE 스트림(마지막 청크의 usage)")
sse = (b'data: {"choices":[{"delta":{"content":"a"}}]}\n\n'
       b'data: {"choices":[{"delta":{"content":"b"}}],"usage":null}\n\n'
       b'data: {"choices":[],"usage":{"prompt_tokens":50,"completion_tokens":7,"total_tokens":57}}\n\n'
       b'data: [DONE]\n\n')
u = S._extract_llm_usage(sse)
check("마지막 usage 블록을 잡는다", u == {"prompt": 50, "completion": 7, "total": 57}, u)
check("usage 없으면 None", S._extract_llm_usage(b'data: {"choices":[]}\n\n') is None)
check("빈 꼬리 안전", S._extract_llm_usage(b"") is None and S._extract_llm_usage(None) is None)

print("[4] 기록 — llm.usage 트레이스로 남는다(실패는 조용히)")
traced = []
orig = S._vba_trace
S._vba_trace = lambda ev, **kw: traced.append((ev, kw))
try:
    S._note_llm_usage(resp, "Qwen3.6-27B-FP8", False, "/v1/chat/completions")
    S._note_llm_usage(b"no-usage-here", "m", True, "/v1/chat/completions")   # usage 없음 → 기록 안 함
finally:
    S._vba_trace = orig
check("1건만 기록", len(traced) == 1, traced)
ev, kw = traced[0]
check("이벤트/필드", ev == "llm.usage" and kw["model"] == "Qwen3.6-27B-FP8"
      and kw["promptTokens"] == 1200 and kw["completionTokens"] == 340
      and kw["totalTokens"] == 1540 and kw["stream"] is False, kw)

print("[5] 트레이스 장치가 죽어도 프록시는 산다")
S._vba_trace = lambda ev, **kw: (_ for _ in ()).throw(RuntimeError("boom"))
try:
    S._note_llm_usage(resp, "m", False, "/x")     # 예외가 새면 프록시 응답이 죽는다
    check("예외 안 샘", True)
except Exception as e:
    check("예외 안 샘", False, e)
finally:
    S._vba_trace = orig

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL -> %s" % (len(fails), fails))
sys.exit(0 if not fails else 1)
