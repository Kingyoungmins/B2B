---
type: endpoint
title: ForegroundHostIfExcelActive
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "()"
role: "[제보 2026-08-25 결과편집 첫 클릭 먹힘] 실행기 전체실행 중 Excel 작업 창이 포그라운드를"
role_source: xmldoc/banner
version: "0.8.0"
loc: "NativeHost.cs:1028-1028"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "프로세스 실행/종료"
raises: []

# ── 유기적 관계 ──
calls:
  - "ForceHostForeground"
  - "Log"
calls_external:
  - "Equals"
  - "GetCurrentProcess"
  - "GetForegroundWindow"
  - "GetProcessById"
  - "GetWindowThreadProcessId"
called_by:
  - "HandleWebMessage"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.0-gen"
---

## 역할
[제보 2026-08-25 결과편집 첫 클릭 먹힘] 실행기 전체실행 중 Excel 작업 창이 포그라운드를

## 사이드이펙트 & 주의
- 프로세스 실행/종료

## 관계
- 호출: `ForceHostForeground`, `Log`
- 피호출(영향 전파 경로): `HandleWebMessage`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
