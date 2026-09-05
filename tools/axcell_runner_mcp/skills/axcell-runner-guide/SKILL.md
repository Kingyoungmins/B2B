---
name: axcell-runner-guide
description: b2b 스킬(zip)을 AXCell Runner MCP 도구로 실행하는 절차 — 입력 검사 → 실행 → 결과 압축. 사용자가 "스킬 실행", "스킬 돌려", "청구 스킬 처리" 등을 요청하면 이 절차를 따른다.
---

# b2b 스킬 실행 절차 (AXCell Runner)

b2b 프로그램을 켜지 않고, 저장된 스킬(zip)을 `axcell_runner__*` 도구로 직접 실행한다.
실행 PC 에 Excel 만 설치돼 있으면 된다.

## 절차 (반드시 이 순서)

### 1. 입력 검사 — `axcell_runner__check_inputs`

```json
{"skill_zip": "C:\\작업\\스킬.zip", "input_dir": "C:\\작업\\inputs"}
```

- `ok: true` → 2단계로.
- `ok: false` → `unmatched` 에 없는 파일 목록이 있다. **실행하지 말고** 사용자에게
  어떤 파일이 없는지 알려라. `required` 가 스킬이 원하는 전체 목록이다.
- 파일명이 스킬 저장 당시와 월/날짜만 달라도 자동 매칭된다(예: `_202606` ↔ `_202607`).
- `extra_files` 는 스킬이 안 쓰는 여분 — 있어도 무해하다.

### 2. 실행 — `axcell_runner__run_start`

```json
{"skill_zip": "C:\\작업\\스킬.zip", "input_dir": "C:\\작업\\inputs",
 "out_dir": "C:\\작업\\outputs", "make_zip": true}
```

- 즉시 `run_id` 가 반환되고 백그라운드로 실행된다(수 분 소요 — 저사양 PC 는 5분 이상).
- 종료 대기는 `bg_wait` 를 쓰면 된다(ixi-flow 가 `run_report` 를 자동 폴링).
  수동 확인은 `axcell_runner__run_report` `{"run_id": "..."}` — `status` 가
  `completed`/`failed`/`cancelled` 면 끝. `step`/`total_steps` 로 진행률을 알 수 있다.
- 동시에 한 런만 실행된다. 이미 실행 중이면 시작이 거부된다.
- **원본 입력 파일은 절대 수정되지 않는다** — 출력 폴더의 작업 사본에서만 처리.
- 실행은 로컬 스테이징 폴더(`%LOCALAPPDATA%\axcell_runner\runs`)에서 하고, 끝나면 결과만
  `out_dir` 로 복사된다. 입력/출력이 OneDrive·SharePoint 동기화 폴더여도 된다.
- `check_inputs`/`run_start` 응답의 `warnings` 가 비어 있지 않으면(예: OneDrive 자리표시자)
  실행 전에 사용자에게 그대로 전달하라. 실행은 되지만 오프라인이면 실패할 수 있다.

### 3. 결과 확인·압축

- `make_zip: true` 로 시작했으면 완료 시 자동으로 출력이 검증되고 zip 이 생성된다.
  `run_report` 의 `out_zip` 이 최종 산출물 경로다.
- 별도 압축이 필요하면 `axcell_runner__package_outputs`:

```json
{"out_dir": "C:\\작업\\outputs", "zip_path": "C:\\작업\\결과.zip",
 "expect_files": ["출력파일.xlsx"]}
```

- `ok: false` 면 `problems` 에 사유(출력 없음/0바이트/기대 파일 누락)가 있다.
  이때 zip 은 만들어지지 않는다 — 사용자에게 사유를 보고하라.

## 실패 대응

- `run_report.status == "failed"` → `error` 에 실패 단계(`[open 파일명]`/`[step N/M]`/`[finalize]`)와
  사유가 있다. COM 오류면 `COM 0x........ (뜻): Excel 설명문` 형식이다. 사용자에게 보고할 때
  이 문자열을 **그대로** 옮겨라(요약하지 말 것 — 원인 분석의 유일한 단서다).
- `error` 에 "Protected View" 가 있으면 조직의 Office 보안 정책 문제다 — 파일을 다른 폴더로
  옮겨도 해결되지 않으니 IT 담당에게 안내.
- `error` 에 "출력 폴더에 결과를 쓸 수 없습니다" 가 있으면 OneDrive 동기화가 파일을 잡고 있거나
  사용자가 같은 파일을 Excel 로 열어 둔 것이다 — 닫고 재실행하거나 `out_dir` 을 바꿔 재실행.
- 실행이 너무 오래 걸리거나 중단해야 하면 `axcell_runner__run_stop` `{"run_id": "..."}`.
- VBA 단계가 있는 스킬이 "VBA 프로젝트에 접근할 수 없습니다"로 실패하면: Excel →
  파일 → 옵션 → 보안 센터 → 매크로 설정에서 "VBA 프로젝트 개체 모델에 대한 액세스
  신뢰"를 켜야 한다고 사용자에게 안내.
