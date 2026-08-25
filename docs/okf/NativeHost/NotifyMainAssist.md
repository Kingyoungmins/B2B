---
type: endpoint
title: NotifyMainAssist
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "(string json)"
role: "메인/팝업 페이지는 {\"__b2bAssist\": ...} 봉투로 받는다(다른 message 리스너와 충돌 방지)."
role_source: xmldoc/banner
version: "0.7.5"
loc: "NativeHost.cs:873-873"

# ── 입출력 ──
inputs:
  - "string json"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "WebView2 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "Log"
calls_external:
  - "PostWebMessageAsString"
called_by:
  - "EnsureAssistPopupAsync"
  - "HandleAssistPopupCommand"
  - "HandleAssistWebMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.5-gen"
---

## 역할
메인/팝업 페이지는 {"__b2bAssist": ...} 봉투로 받는다(다른 message 리스너와 충돌 방지).

## 사이드이펙트 & 주의
- WebView2 조작

## 관계
- 호출: `Log`
- 피호출(영향 전파 경로): `EnsureAssistPopupAsync`, `HandleAssistPopupCommand`, `HandleAssistWebMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
