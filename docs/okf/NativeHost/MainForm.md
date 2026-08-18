---
type: endpoint
title: MainForm
module: NativeHost.cs
lang: csharp
extraction: regex   # 정규식 근사
signature: "()"
role: "(추정) 역할 주석 없음 — 담당자 1줄 보완 필요"   # (추정)
role_source: none
version: "0.7.4"
loc: "NativeHost.cs:214-214"

# ── 입출력 ──
inputs: []
returns: "(추정)"

# ── 사이드이펙트 (정적 추정) ──
side_effects:
  - "WebView2 조작"
raises: []

# ── 유기적 관계 ──
calls:
  - "ApplyInitialSplitterLayout"
  - "Cleanup"
  - "ExecuteWebScript"
  - "FindRootDir"
  - "FocusExcelChild"
  - "HandleHostResize"
  - "InitializeAsync"
  - "PublishNativeBounds"
  - "RestoreActiveExcelMirror"
  - "StartExcelFocusAssist"
  - "StartVbaDebugSuppressor"
calls_external:
  - "Action"
  - "Add"
  - "BeginInvoke"
  - "BringToFront"
  - "ColumnStyle"
  - "Event"
  - "FlowLayoutPanel"
  - "Focus"
  - "Font"
  - "FromArgb"
  - "Label"
  - "Padding"
  - "Panel"
  - "RowStyle"
  - "Size"
  - "SplitContainer"
  - "TableLayoutPanel"
  - "WebView2"
  - "async"
  - "dispatchEvent"
  - "python"
called_by:
  - "Main"
reads: []
writes: []
affects: []                # (수동 보완) 정적 추출 불가 — 이게 틀어지면 깨지는 상위 기능
timestamp: "0.7.4-gen"
---

## 역할
(추정) 역할 주석 없음 — 담당자 1줄 보완 필요  _(자동 추정 — 확인 필요)_

## 사이드이펙트 & 주의
- WebView2 조작

## 관계
- 호출: `ApplyInitialSplitterLayout`, `Cleanup`, `ExecuteWebScript`, `FindRootDir`, `FocusExcelChild`, `HandleHostResize`, `InitializeAsync`, `PublishNativeBounds`, `RestoreActiveExcelMirror`, `StartExcelFocusAssist`, `StartVbaDebugSuppressor`
- 피호출(영향 전파 경로): `Main`

## 실패/예외
- `(명시적 raise 없음/미탐지)`
