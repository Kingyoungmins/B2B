# 46. Display* 속성 '쓰기'는 값 무관하게 복사 마퀴를 죽인다 — 교차파일 Ctrl+V 사망의 진범

**버전**: 0.7.0 (2026-07-27) · **증상**: 녹화 중 A파일 복사 → 앱 탭으로 B파일 전환 → Ctrl+V 무반응. 같은 파일 안에서는 정상.

## 증거 사슬
1. 10:39 녹화 VBA에 실패가 그대로 찍힘: `Copy → Windows(B).Activate → Range.Select`(붙여넣기 없음) ×3회, 파일 내 `ActiveSheet.Paste`는 성공 — **매 전환마다 CutCopyMode 사망**, 1회성 아님.
2. 이전 프로브는 recUnlockDone 재적용 블록 안(SHOW.TOOLBAR)만 이등분 — 항상 도는 전환 코어는 미검사였다.
3. 실Excel 프로브(`diagnostics/_probe_marquee_killers.py`)로 전환 경로 14개 조작 개별 이등분:
   - **무해**: 파킹(SetWindowPos -32000), TOOLWINDOW 스타일, owner 지정, SW_SHOWNA/배치, WindowState, win.Visible 토글, app.Interactive/UserControl/EnableEvents/ScreenUpdating, COM Activate/Select, win32clipboard 읽기, SetForegroundWindow
   - **킬러**: `DisplayFormulaBar/StatusBar/Headings/Gridlines/WorkbookTabs/H·VScrollBar` **대입 7종 전부 — 같은 값 재대입(no-op)도 킬러. 읽기는 무해.**
4. `_ensure_excel_workbook_view`가 탭 전환마다(6170) 이 속성들을 무조건 대입 → 진범.

## 수정
`_set_display_prop_if_changed(obj, name, value)` — 읽고 비교해 **다를 때만 쓰기**. `_show_excel_formula_bar`·미러 설정·`_ensure_excel_workbook_view` 3곳 전부 교체. 실Excel E2E: 수정판 전환 후 마퀴 생존 + 교차창 붙여넣기 성공 + 연속 2회 전환 내성 ✅.

## 같은 날 정지 흐름 강건화
- 분할 LLM 인위 타임아웃 제거(끝까지 대기): 조각 20개급은 정상 부하에서도 생성 23s+, vLLM 동시부하면 40s 컷을 초과해 **멀쩡한 분할이 1스텝 폴백**됐다(소스는 3/3 분할 성공인데 앱만 1개였던 미스터리의 정체). 사용자 지시로 무제한 — 폴백 비용이 대기 비용보다 크다.
- sanitize에 죽은 타이핑 중간산물 제거: 같은 셀 연속 대입의 앞줄(`="=SUM"` 후 확정 수식). LLM이 이 죽은 줄을 버리면 데이터보존 검증(b)이 분할 전체를 폐기했다.
- 녹화 버튼 자가복구: 서버 세션 사망(재현 실패/Excel 재시작) → 폴이 forget → "파일을 열어 주세요" 막힘. 현재 탭 파일로 세션 재오픈 후 진행.
- save-load 화이트리스트에 recordedWorkbook/recordedSheet/intentNeeded/intentReason 추가 — durable 도장이 zip 왕복에서 통째로 유실되고 있었다.

## 교훈
- **Excel COM 속성 대입은 no-op라도 부작용이 있을 수 있다** — "이미 True인데 또 True 쓰는 건 공짜"라는 가정은 CutCopyMode 앞에서 무너진다. 핫패스(전환/폴링)의 모든 속성 대입은 read-compare-set.
- 상태 파괴 버그는 **1회성 경로와 반복 경로를 구분해 이등분**할 것: 이전 프로브는 1회성 블록에서 킬러(SHOW.TOOLBAR)를 찾고 종료했지만, 증상 재현 주기("매 전환")는 반복 경로를 가리키고 있었다.
- 저장 화이트리스트는 새 스텝 필드의 만성 유실 지점 — 필드를 추가하면 save-load 왕복 테스트까지가 한 세트.
