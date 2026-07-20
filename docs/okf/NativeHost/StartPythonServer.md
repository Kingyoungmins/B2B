---
type: endpoint
title: StartPythonServer
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.5.19"
loc: "NativeHost.cs:945-945"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "파일시스템 변경/IO"
  - "프로세스 실행/종료"
raises: []

# ── 유기적 관계 ──
calls:
  - "FindPython"
  - "HandleServerCrash"
  - "Log"
calls_external:
  - "BeginErrorReadLine"
  - "BeginOutputReadLine"
  - "Combine"
  - "Exists"
  - "FileNotFoundException"
  - "GetCurrentProcess"
  - "InvalidOperationException"
  - "IsNullOrEmpty"
  - "ProcessStartInfo"
  - "ReferenceEquals"
  - "Start"
  - "ToString"
  - "delegate"
called_by:
  - "InitializeAsync"
  - "RestartPythonServerAsync"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.5.19-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO
- 프로세스 실행/종료

## 관계
- 호출: `FindPython`, `HandleServerCrash`, `Log`
- 피호출(영향 전파 경로): `InitializeAsync`, `RestartPythonServerAsync`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
