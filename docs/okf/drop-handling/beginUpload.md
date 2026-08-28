---
type: endpoint
title: beginUpload
module: drop-handling.js
lang: js
extraction: regex   # 정규식 근사
signature: "(label, total)"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.8.1"
loc: "drop-handling.js:53-53"

# ── 입출력 ──
inputs:
  - "label"
  - "total"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경: uploadJob"
raises: []

# ── 유기적 관계 ──
calls:
  - "$"
  - "_uploadBusyText"
  - "uid"
  - "updateUiBusyLabel"
calls_external: []
called_by:
  - "loadInputFiles"
  - "loadOutputTemplates"
reads:
  - "state.uploadJob"
writes:
  - "uploadJob"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.1-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경: uploadJob
- 변경 상태 `uploadJob` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `$`, `_uploadBusyText`, `uid`, `updateUiBusyLabel`
- 피호출(영향 전파 경로): `loadInputFiles`, `loadOutputTemplates`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
