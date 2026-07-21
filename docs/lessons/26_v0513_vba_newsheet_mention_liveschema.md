# 26. VBA로 만든 새 시트가 @멘션에 안 뜸 — 단일 VBA 적용이 liveSchema 누락 (SBAGENT-138, v0.5.13)

## 증상
채팅에서 **VBA 스킬로 새 시트를 생성**하면 시트는 잘 만들어지는데, 이후 `@`(범위/시트 멘션)으로
그 새 시트를 검색하면 안 나온다. (전체실행으로 만들거나 Python 스킬로 만들면 @ 에 잘 뜸.)

## 근본 원인
@멘션은 `file.sheetNames`(mentions.js)에서 시트 목록을 읽는다. 적용 응답에 실린 경량 스키마
(`liveSchema = {sheetNames, sheets, dims}`)를 클라가 `applyLiveSchemaToFileCache → syncFileMetadata` 로
`file.sheetNames` 에 반영해야 새 시트가 보인다. 그런데 적용 경로별로 liveSchema 반환이 달랐다:
- 격리 파이프라인(전체실행) `_run_vba_pipeline_on_session_impl`: liveSchema 반환 O (0.5.12 수정).
- 단일 Python `_run_python_on_session_impl`: liveSchema 반환 O.
- **단일 VBA `_run_vba_on_session_impl`(/api/excel/run-vba): liveSchema 반환 X** ← 누락.

클라(`applyVbaStepToLiveExcel` @pipeline.js:1178, `runLivePipelineStepSequentially` @1259)는
`if (data && data.liveSchema) applyLiveSchemaToFileCache(...)` 로 받기만 하면 반영하는데, 단일 VBA 응답엔
liveSchema 가 없어 `file.sheetNames` 가 안 갱신 → 채팅에서 VBA 로 만든 새 시트만 @ 에서 누락.

## 수정
`_run_vba_on_session_impl` 의 성공 반환에 `_live_preview_schema(wb)` 를 실어 단일 Python/격리 파이프라인과
동형으로 맞춤(매크로 차단 fallback 으로 격리 실행을 탄 경우에도 최종 wb 기준으로 캡처되므로 함께 반영).
```python
result = {"ok": True, "excelId": excel_id, "entry": entry}
try: result["liveSchema"] = _live_preview_schema(wb)
except Exception: pass
return result
```

## 검증
- `test_runs/_test_vba_newsheet_liveschema.py`(신규, COM E2E): 단일 VBA 로 새 시트 생성 →
  반환 `result["liveSchema"]["sheetNames"]` 에 새 시트가 포함되는지 확인. PASS.
- py_compile OK.

## 교훈
- '적용 후 구조변경(새 시트/열삭제 등)'을 클라 캐시에 반영하는 liveSchema 는 **모든 적용 경로에서 일관**되게
  실어야 한다. 한 경로(단일 VBA)만 빠지면 그 경로로 만든 구조가 @멘션·다음 단계 스키마에서 통째로 누락된다.
- 0.5.12 의 "새 시트 @멘션" 수정은 격리 파이프라인만 손봤고 단일 VBA 경로를 빠뜨려, "전체실행은 되는데
  채팅 단일 적용만 안 되는" 형태로 남아 있었다.
