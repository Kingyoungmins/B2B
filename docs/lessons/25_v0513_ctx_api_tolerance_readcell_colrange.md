# 25. 자주 뜨던 ctx 에러 — read_cell 없음 / 열·행 범위 문자열 거부 (SBAGENT-138, v0.5.13)

## 증상 (에러복구창이 자주 뜸)
모델이 만든 Python ctx 스킬이 실행 즉시 실패:
1. `'PythonComSkillContext' object has no attribute 'read_cell'` — `ctx.read_cell(...)` 호출.
2. `잘못된 열 문자: Q:AU` — `ctx.delete_cols(시트, "Q:AU")` 호출.

## 근본 원인
ctx API 가 **모델이 합리적으로 호출하는 형태를 안 받아줘서** 매번 실패 → 에러복구 루프.
1. **비대칭**: `write_cell` 은 있는데 `read_cell` 이 없었다. 모델은 (당연히 짝이 있을 거라 보고) `read_cell` 을 자주 호출.
2. **인자 형식**: `delete_cols(col)` 이 `col` 을 단일 열 문자(`_col_index`)로만 파싱 → `"Q:AU"`(범위)는 ":" 때문에 "잘못된 열 문자". 그런데 `hide_cols` 는 이미 `ws.Columns("B:D")` 로 Excel 에 그대로 위임해 잘 됨 — 같은 식이면 됐을 것.

## 수정 (백엔드 ctx 관대화 + 프롬프트 안내)
- `read_cell(sheet, a1)` 추가: `read` 로 단일 셀 스칼라 반환(빈 셀 None). write_cell 의 읽기 짝.
- `delete_cols`/`insert_cols`/`delete_rows`/`insert_rows`: 인자가 `"Q:AU"`/`"5:9"` 같은 **범위 문자열**이면
  `ws.Columns(spec)`/`ws.Rows(spec)` 로 **Excel 에 그대로 위임**(hide_cols 와 동일 방식). 단일 letter/숫자+count 는 기존대로.
- 프롬프트(file-schema.js): `ctx.read_cell` 문서화 + 열/행 삭제가 범위 문자열("Q:AU","5:9")도 받는다고 명시 →
  모델이 애초에 올바르게 쓰도록 유도(백엔드 관대화가 1차 방어, 프롬프트가 2차).

## 검증
- `test_runs/_test_ctx_col_row_range_and_readcell.py`(신규, COM E2E): 한 워크북에서
  `delete_cols("Q:AU")`(52→21열), `read_cell("A2")*10 → write_cell("B2")`(B2=50),
  `delete_rows("5:9")`(20→15행) 가 에러 없이 정확히 동작. PASS.
- `_test_isolated_delete_sheet.py` 회귀 PASS. py_compile / node --check OK.

## 교훈
- ctx API 는 **대칭(read_cell↔write_cell)** 과 **Excel 네이티브 표기 허용**(열 "Q:AU", 행 "5:9")을 지키면
  모델 환각 호출의 상당수가 그냥 동작한다. 모델을 프롬프트로만 교정하기보다 **흔한 호출 형태를 받아주는** 게
  에러복구 루프를 줄이는 가장 견고한 방법(이 프로젝트의 반복 패턴: 결정적 백엔드 관대화 > 모델과 싸우기).
- 신규 ctx 메서드를 추가하면 file-schema.js 문서도 같이 갱신(모델이 존재를 알아야 덜 헤맨다).
