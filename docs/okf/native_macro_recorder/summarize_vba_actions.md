---
type: function
title: summarize_vba_actions
module: native_macro_recorder.py
lang: python
extraction: ast
signature: "(body: str, limit: int=3) -> str"
role: "카드 설명용 한 줄 요약 — 주요 동사(값입력/서식/정렬/병합 등) 등장 횟수."
role_source: docstring
version: "0.8.0"
loc: "native_macro_recorder.py:220-238"

# ── 입출력 ──
inputs:
  - "body: str"
  - "limit: int"
returns: "str"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "append"
calls_external:
  - "findall"
  - "join"
  - "len"
  - "pat"
  - "str"
called_by:
  - "stop_native_recording_impl"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
카드 설명용 한 줄 요약 — 주요 동사(값입력/서식/정렬/병합 등) 등장 횟수.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `append`
- 피호출(영향 전파 경로): `stop_native_recording_impl`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
