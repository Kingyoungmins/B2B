---
type: endpoint
title: toBase64
module: scheduler.js
lang: js
extraction: regex   # 정규식 근사
signature: "(file)"
role: "파일 → base64. 서버가 바탕화면에 그대로 써야 하므로 원본 바이트를 보낸다."
role_source: banner
version: "0.8.2"
loc: "scheduler.js:612-612"

# ── 입출력 ──
inputs:
  - "file"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "Error"
  - "FileReader"
  - "Promise"
  - "String"
  - "indexOf"
  - "readAsDataURL"
  - "reject"
  - "resolve"
  - "slice"
called_by:
  - "saveSchedule"
  - "saveSkillFiles"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
파일 → base64. 서버가 바탕화면에 그대로 써야 하므로 원본 바이트를 보낸다.

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `saveSchedule`, `saveSkillFiles`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
