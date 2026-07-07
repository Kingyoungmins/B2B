---
type: endpoint
title: codeUsesSafeCtxHelper
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(code)"
role: "전용(네이티브) ctx 헬퍼를 쓰는 코드인지. 이 헬퍼들은 '읽기루프/행삭제 반복'이 아니라 Range 기반"
role_source: banner
version: "0.5.19"
loc: "chat-ui.js:1624-1624"

# ── 입출력 ──
inputs:
  - "code"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "test"
called_by:
  - "pythonComMustUseVbaReason"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
전용(네이티브) ctx 헬퍼를 쓰는 코드인지. 이 헬퍼들은 '읽기루프/행삭제 반복'이 아니라 Range 기반

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `pythonComMustUseVbaReason`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
