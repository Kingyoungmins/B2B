---
type: function
title: _exe_file_version
module: serve_b2b.py
lang: python
extraction: ast
signature: "(exe_path)"
role: "윈도우 exe 의 파일 버전 리소스를 읽는다(파일 속성 → 자세히 → 파일 버전)."
role_source: docstring
version: "0.8.2"
loc: "serve_b2b.py:242-266"

# ── 입출력 ──
inputs:
  - "exe_path"
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "없음(정적 분석 기준)"
raises: []

# ── 유기적 관계 ──
calls: []
calls_external:
  - "GetFileVersionInfoSizeW"
  - "GetFileVersionInfoW"
  - "POINTER"
  - "Path"
  - "VerQueryValueW"
  - "WinDLL"
  - "block"
  - "buf"
  - "byref"
  - "c_uint"
  - "c_void_p"
  - "c_wchar_p"
  - "cast"
  - "create_string_buffer"
  - "exe_path"
  - "exists"
  - "length"
  - "p"
  - "size"
  - "str"
called_by:
  - "_current_app_version"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.8.2-gen"
---

## 역할
윈도우 exe 의 파일 버전 리소스를 읽는다(파일 속성 → 자세히 → 파일 버전).

## 사이드이펙트 & 주의
- 없음(정적 분석 기준)

## 관계
- 호출: 없음
- 피호출(영향 전파 경로): `_current_app_version`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
