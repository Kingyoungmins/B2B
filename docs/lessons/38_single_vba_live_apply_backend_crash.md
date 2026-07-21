# 38 — 단일 VBA 적용 시 앱이 "내려갔다 올라옴"(백엔드 크래시) [0.5.15]

## 증상
생성기에서 VBA 코드가 나온 뒤 "적용"을 누르면 프로그램이 통째로 내려갔다가 다시 올라옴(무서움).
Python COM 적용은 멀쩡, **VBA 적용일 때만**.

## 근본원인 (코드로 확정)
- 생성기 단일 "적용": `applyLogic` → `applyVbaStepToLiveExcel`([pipeline.js]) → VBA 면 `/api/excel/run-vba`
  → `_run_vba_on_session_impl` = **라이브(임베드/오버레이) Excel 인스턴스에서 직접 VBA Application.Run**.
- 마지막 스텝 fast-apply: `applyLastEnabledStepFast` → `runLivePipelineStepSequentially` → 같은 `/api/excel/run-vba` (라이브 직접).
- [serve_b2b.py 주석]이 명시: "라이브(임베드/오버레이) Excel 인스턴스는 VBA Application.Run 이 간헐적으로
  RPC 로 사망한다 ... 새(비임베드) 인스턴스는 항상 정상." → 라이브에서 VBA 실행 중 COM/RPC 가 죽으면 파이썬
  백엔드 프로세스가 **하드 크래시(프로세스 종료)**.
- NativeHost.cs: `serverProcess.Exited` → `HandleServerCrash` → `RestartPythonServerAsync` = **백엔드 자동 재시작**.
  → 사용자 눈엔 "앱이 내려갔다 올라옴". Python COM 은 이 RPC 사망을 안 일으켜 무사.

## 수정
단일 VBA 적용 / 마지막 스텝 fast-apply 둘 다 **전체실행과 동일하게 '격리 인스턴스'에서** 실행하도록 변경:
- VBA → `/api/excel/run-vba-pipeline`, `{excelId, steps:[1스텝], reset:false}` (reset:false = 현재 라이브 상태
  위에 적용 → 결과만 라이브에 반영). **라이브 인스턴스에서 VBA 를 안 돌리므로 RPC 사망/백엔드 크래시 없음.**
- Python COM 은 기존 라이브 경로(`/api/excel/run-python`) 유지(크래시 안 남).
- 격리 spawn 포함이라 VBA 타임아웃 45/90s → 180s 로 완화.
- 두 함수: `applyVbaStepToLiveExcel`, `runLivePipelineStepSequentially`.

## 테스트
`_test_single_vba_isolated_reset_false_live.py` 4/4 (라이브 COM):
- reset:false 격리 → 현재 상태(기존 적용 시트) 보존 + 새 VBA 스텝 적용 + 원본 무손상 + **프로세스 정상 반환(크래시 없음)**.
- 회귀: bg client 12/12, per-group 14/14, last-step-fast-edit OK, snapshot 4/4, toggle 4/4, Bug2 4/4.

## 메모
- `/api/excel/run-vba` (라이브 직접) 백엔드 엔드포인트는 남겨둠(다른 호환 경로용). 클라는 더 이상 VBA 를 그쪽으로 안 보냄.
- 이로써 "라이브 임베드 인스턴스에서 VBA Application.Run" 크래시 클래스가 전 경로(단일/전체/fast)에서 제거됨.
