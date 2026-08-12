---
type: endpoint
title: HandleServerCrash
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "()"
role: "서버 프로세스가 예기치 않게 종료되면 자동 재시작(짧은 시간 내 반복 크래시는 중단)."
role_source: xmldoc/banner
version: "0.7.3"
loc: "NativeHost.cs:1356-1356"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls:
  - "ExecuteWebScript"
  - "Log"
  - "RestartPythonServerAsync"
calls_external:
  - "Action"
  - "BeginInvoke"
  - "Event"
  - "dispatchEvent"
called_by:
  - "StartPythonServer"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
서버 프로세스가 예기치 않게 종료되면 자동 재시작(짧은 시간 내 반복 크래시는 중단).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: `ExecuteWebScript`, `Log`, `RestartPythonServerAsync`
- 피호출(영향 전파 경로): `StartPythonServer`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
