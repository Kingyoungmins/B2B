---
type: endpoint
title: _clarifyResolveSheet
module: chat-ui.js
lang: js
extraction: regex   # 정규식 근사
signature: "(text)"
role: "되물음 대상 시트 추정: @범위[파일/시트!범위] / @시트[..] / \"○○ 시트\" / 현재 활성 시트."
role_source: banner
version: "0.8.2"
loc: "chat-ui.js:3649-3649"

# ── 입출력 ──
inputs:
  - "text"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "String"
  - "_"
  - "exec"
  - "trim"
called_by: []
reads:
  - "state.currentSheet"
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
되물음 대상 시트 추정: @범위[파일/시트!범위] / @시트[..] / "○○ 시트" / 현재 활성 시트.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): 없음

## 실패/예외
- `(명시적 raise 없음/미탐지)`
