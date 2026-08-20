---
type: endpoint
title: RestartPythonServerAsync
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "(bool fromCrash)"
role: "죽었거나 멈춘 서버를 강제 종료 후 같은 포트로 다시 띄운다. 웹 페이지는 그대로 유지."
role_source: xmldoc/banner
version: "0.7.4"
loc: "NativeHost.cs:1404-1404"

# ── 입출력 ──
inputs:
  - "bool fromCrash"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "프로세스 실행/종료"
raises: []

# ── 유기적 관계 ──
calls:
  - "ExecuteWebScript"
  - "Log"
  - "StartPythonServer"
  - "WaitForServerAsync"
calls_external:
  - "Event"
  - "FromSeconds"
  - "Kill"
  - "WaitForExit"
  - "dispatchEvent"
  - "server"
called_by:
  - "HandleServerCrash"
  - "HandleWebMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
죽었거나 멈춘 서버를 강제 종료 후 같은 포트로 다시 띄운다. 웹 페이지는 그대로 유지.

## 사이드이펙트 & 주의
- 프로세스 실행/종료

## 관계
- 호출: `ExecuteWebScript`, `Log`, `StartPythonServer`, `WaitForServerAsync`
- 피호출(영향 전파 경로): `HandleServerCrash`, `HandleWebMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
