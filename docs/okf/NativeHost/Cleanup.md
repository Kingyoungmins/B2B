---
type: endpoint
title: Cleanup
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "NativeHost.cs:1790-1790"

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
  - "HideAllExcelMirrors"
  - "HideExcelChildren"
  - "Log"
  - "TryPostShutdownJson"
calls_external:
  - "Create"
  - "Delete"
  - "Exists"
  - "GetBytes"
  - "GetRequestStream"
  - "GetResponse"
  - "IsNullOrEmpty"
  - "Kill"
  - "Stop"
  - "WaitForExit"
  - "Write"
  - "all"
  - "detected"
  - "join"
  - "taskkill"
called_by:
  - "MainForm"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 파일시스템 변경/IO
- 프로세스 실행/종료

## 관계
- 호출: `HideAllExcelMirrors`, `HideExcelChildren`, `Log`, `TryPostShutdownJson`
- 피호출(영향 전파 경로): `MainForm`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
