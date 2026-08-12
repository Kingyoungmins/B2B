---
type: endpoint
title: HandleAssistPopupCommand
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "(string action)"
role: "── [AI 도움 팝업] ─────────────────────────────────────────────────────────"
role_source: xmldoc/banner
version: "0.7.3"
loc: "NativeHost.cs:746-746"

# ── 입출력 ──
inputs:
  - "string action"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "EnsureAssistPopupAsync"
  - "NotifyMainAssist"
calls_external:
  - "Hide"
called_by:
  - "HandleAssistWebMessage"
  - "HandleWebMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
── [AI 도움 팝업] ─────────────────────────────────────────────────────────

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `EnsureAssistPopupAsync`, `NotifyMainAssist`
- 피호출(영향 전파 경로): `HandleAssistWebMessage`, `HandleWebMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
