---
type: endpoint
title: ClickHiddenButton
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "(string id)"
role: "[0.7.1] UI 에서 숨긴 버튼(녹화/AI 도움)의 기존 onclick 을 그대로 실행 — 로직 재사용(분기 없음)."
role_source: xmldoc/banner
version: "0.7.4"
loc: "NativeHost.cs:405-405"

# ── 입출력 ──
inputs:
  - "string id"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "WebView2 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "JsString"
  - "Log"
calls_external:
  - "ExecuteScriptAsync"
  - "click"
  - "failed"
  - "function"
  - "getElementById"
called_by:
  - "WndProc"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
[0.7.1] UI 에서 숨긴 버튼(녹화/AI 도움)의 기존 onclick 을 그대로 실행 — 로직 재사용(분기 없음).

## 사이드이펙트 & 주의
- WebView2 조작

## 관계
- 호출: `JsString`, `Log`
- 피호출(영향 전파 경로): `WndProc`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
