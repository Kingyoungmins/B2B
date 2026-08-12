---
type: function
title: ensure_node_worker
module: serve_b2b.py
lang: python
extraction: ast
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.3"
loc: "serve_b2b.py:20366-20397"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "상태 변경(전역/세션): NODE_WORKER, NODE_WORKER_SCRIPT_MTIME"
  - "서브프로세스/OS 호출"
raises:
  - "RuntimeError"

# ── 유기적 관계 ──
calls:
  - "app_base_dir"
  - "clear"
  - "hidden_subprocess_kwargs"
  - "node_executable"
calls_external:
  - "Popen"
  - "RuntimeError"
  - "exists"
  - "kill"
  - "poll"
  - "stat"
  - "str"
  - "worker_path"
called_by:
  - "node_worker_command"
reads:
  - "NODE_WORKER"
  - "NODE_WORKER_READY"
  - "NODE_WORKER_SCRIPT_MTIME"
writes:
  - "NODE_WORKER"
  - "NODE_WORKER_SCRIPT_MTIME"
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.3-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- 상태 변경(전역/세션): NODE_WORKER, NODE_WORKER_SCRIPT_MTIME
- 서브프로세스/OS 호출
- 변경 상태 `NODE_WORKER, NODE_WORKER_SCRIPT_MTIME` — 수정 시 이 상태를 읽는 곳 동반 점검.

## 관계
- 호출: `app_base_dir`, `clear`, `hidden_subprocess_kwargs`, `node_executable`
- 피호출(영향 전파 경로): `node_worker_command`

## 실패/예외
- `RuntimeError`
