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

- `run_report.status == "failed"` → `error` 에 실패 스텝과 사유가 있다. 입력 파일이
  잘못됐을 가능성이 크다 — 1단계 검사부터 다시 안내.
- 실행이 너무 오래 걸리거나 중단해야 하면 `axcell_runner__run_stop` `{"run_id": "..."}`.
- VBA 단계가 있는 스킬이 "VBA 프로젝트에 접근할 수 없습니다"로 실패하면: Excel →
  파일 → 옵션 → 보안 센터 → 매크로 설정에서 "VBA 프로젝트 개체 모델에 대한 액세스
  신뢰"를 켜야 한다고 사용자에게 안내.
