# vendor/ — ver0.4.8 에서 가져온 평가용 사본 (dev-only)

이 폴더는 **Python(openpyxl) 평가 경로**가 0.4.8 의 생성 프롬프트/엔진을 그대로
재현하기 위해 가져온 사본이다. exe 패키징 대상이 아니며(`launch_b2b.spec` 은
`scripts/` 만 수집), 런타임 추론 경로에 포함되지 않는다.

- `file_schema_048.js` — `git show ver0.4.8:scripts/file-schema.js` 그대로.
  - provenance: ver0.4.8 commit `32f443d` (2026-06-08, "복붙 수식 보존 안전장치 추가").
  - 러너가 여기서 `PYTHON_EXCEL_SKILL_RULE`, `FORMULA_OVERWRITE_RULE`, `SYSTEM_PROMPT`
    템플릿 상수를 추출·조립한다(`build_system_prompt(mode="python")`).
  - `SYSTEM_PROMPT` 본문은 `${PYTHON_EXCEL_SKILL_RULE}` 같은 JS 보간을 포함하므로,
    러너가 세 상수를 각각 추출해 치환한다.
- `openpyxl_engine_note.txt` — 0.4.8 `skillEnginePromptNote()` 의 openpyxl 안내 본문.
  JS **함수**라 템플릿 상수로 추출 불가 → 본문만 별도 파일로 보관(숨김/병합 idiom 보강).
  Python 모드 시스템 프롬프트 끝에 덧붙인다.

원본(0.4.8)과 드리프트가 생길 수 있으니, 0.4.8 프롬프트를 수정·재평가할 땐 이 사본을
다시 `git show` 로 갱신하라.
