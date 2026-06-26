# v0.5.10 교훈: 강제재시작 후 작업 유실과 1회 자동 재적용 (저장 없이 종료→적용 전 상태로 복귀)

정리 기준일: 2026-06-22

## 증상

전체실행으로 적용을 끝낸 뒤 Excel COM이 연달아 멈췄다. UI에는 아래 류의 타임아웃 오류가 떴다.

```text
COM 작업이 8초 안에 끝나지 않았습니다.
```

타임아웃이 짧은 간격으로 반복되면 앱이 **Excel을 자동으로 강제재시작**한다. 그런데 재시작은 느렸고(종료→재오픈→창 준비), 더 큰 문제는 **재오픈된 워크북에 방금 적용한 결과가 사라져 있었다**는 점이다. 사용자는 "적용했는데 왜 다시 깨끗하지?" 상태에서 ▶ 전체실행을 **다시 눌러야** 했다.

## 원인 (코드로 입증)

1. **강제재시작 = 저장 없이 종료(근본 원인)**: `excel-mirror.js::forceRestartExcelMirrors`는 `/api/excel/force-restart` POST로 Excel을 **저장 없이** 죽인 뒤 `clearExcelMirrorClientState`로 클라이언트 매핑을 비운다. → 적용분은 메모리에만 있던 상태라 종료와 함께 날아간다.
2. **재오픈은 마지막 저장 상태(트리거)**: 이어서 `preopenAllExcelMirrors(current)`로 다시 여는데, 이건 **디스크의 마지막 저장본(보통 적용 전)** 부터다. 주석에도 "재오픈은 마지막 저장 상태(보통 적용 전)부터라 적용분이 유실됨"이라고 명시돼 있다. → 화면이 적용 전으로 되돌아간다.
3. **타임아웃 게이트는 정상(버그 아님)**: `noteExcelComTimeout`은 `COM 작업이 N초 안에 끝나지 않았습니다` 패턴일 때만, 그리고 `applying`/`preopening` 중이 아닐 때만 카운트한다. 최근 90초 내 2회 이상이고 쿨다운(`forceRestartCooldownUntil`)이 지났을 때만 재시작한다. 멈춘 Excel을 살리는 동작 자체는 옳다 → **문제는 "살린 뒤 적용분 복원이 없다"는 것**.

## 처방 (적용)

- **직전이 적용 상태였으면 재오픈 후 1회 자동 재적용**: `forceRestartExcelMirrors`가 재오픈 직후 `maybeAutoReapplyAfterRestart(wasApplied)`를 호출한다.
- **`wasApplied`는 invalidate 전에 캡처**: `pipeline.js::isLivePipelineApplied`는 `_lastLiveAppliedSignature`가 null이 아닐 때만 true다. 강제재시작은 곧바로 `invalidateLivePipelineApplied`로 이 시그니처를 null로 만들므로(이후엔 항상 false), **invalidate 직전에 `wasApplied`를 읽어** 보관한다.
- **`await` 하지 않는다**: `maybeAutoReapplyAfterRestart`는 `await` 없이 호출한다. `forceRestarting`을 먼저 풀어, 재적용 중 또 멈춰도(=`applying`) 재시작 큐가 막히지 않게 한다.
- **재적용 조건은 둘 다 만족**: `wasApplied`가 true이고, 활성(enabled) 스텝이 하나라도 있어야(`hasSteps`) 한다. 둘 중 하나라도 아니면 즉시 return.
- **3분 쿨다운 1회만**: `autoReapplyCooldownUntil = now + 180000`으로 1회만 자동 실행한다. 쿨다운 내 재발이면 재적용 없이 안내 토스트만 띄운다(무한 재시작 루프 방지).
- **실제 전체실행과 동일 절차**: ▶ 전체실행(`btn-run`)처럼 `clearPipelineExecutionMemory` 후 `runPipelineWithAutoRepair({source:'auto-restart-reapply'})`를 호출한다.
- **실패/재발 시 안내만**: 재적용이 throw로 실패하면 상태를 `error`로 표시하고 "직접 ▶ 전체 실행" 안내 토스트만 띄울 뿐 재시도하지 않는다.
- **applying 이중가드**: `beginExcelMirrorApplyLoading`이 `excelMirror.applying = true`로 두므로, 재적용 중 타임아웃이 또 떠도 `noteExcelComTimeout`이 `applying` 가드에 걸려 재시작을 잡지 않는다 → 재시작 중 재시작이 방지된다.

## 검증

- `clearExcelMirrorClientState`는 미러 세션 매핑/타이머/플래그(`sessionsByFileId`, `activeExcelId`, `applying` 등)만 비우고 `state.inputs`/`state.pipeline`은 건드리지 않는다 → 재적용에 필요한 입력/스텝이 보존됨을 확인한다.
- 재오픈은 `hasFiles`(state.inputs/outputTemplates/output 중 존재)일 때만 수행됨을 확인한다.

```powershell
python test_runs/_test_force_restart_reapply.py
```

기대 출력:

```text
force restart reapply smoke: ok
```

## 회귀 방지 기준

"적용했는데 재시작하니 사라졌다 / 다시 전체실행 눌러야 한다" 신고가 다시 오면 아래 순서로 본다.

1. 강제재시작이 실제로 발동했는지(`noteExcelComTimeout` 90초 2회 + 쿨다운) 확인한다.
2. 재시작 직전 `isLivePipelineApplied()`가 true였는지(=`wasApplied` 캡처값) 본다. **invalidate 이후 값을 읽으면 안 된다.**
3. `maybeAutoReapplyAfterRestart`가 `wasApplied && hasSteps`를 통과했는지, 3분 쿨다운에 걸려 안내만 했는지 구분한다.
4. 재적용은 1회만이어야 한다. 쿨다운/`applying` 이중가드가 풀려 재시작↔재적용이 반복되면 안 된다.

## 부차 발견 (미수정)

- 자동 재적용은 **저장 없이 종료된 마지막 적용분을 그대로 복원하는 게 아니라**, 보존된 스텝으로 다시 실행하는 것이다. 따라서 적용 후 사용자가 직접 손으로 고친 비-파이프라인 편집은 복원되지 않는다. 필요 시 강제재시작 직전 스냅샷 저장을 별도로 검토한다.

## 관련 (코드/문서)

- `15_v0510_idle_runtime_load.md`(idle/COM 호출 빈도·강제종료 PID 추적), `16_v0510_routing_mention_keyword_collision.md`/`17_v0510_vba_hidden_noop_smoke.md`(같은 v0.5.10 계열), `06_vba_full_run_investigation.md`(전체실행 경로).
- `excel-mirror.js::noteExcelComTimeout`
- `excel-mirror.js::forceRestartExcelMirrors`
- `excel-mirror.js::maybeAutoReapplyAfterRestart`
- `excel-mirror.js::clearExcelMirrorClientState`
- `excel-mirror.js::beginExcelMirrorApplyLoading`
- `pipeline.js::isLivePipelineApplied`
- `pipeline.js::invalidateLivePipelineApplied`
- `pipeline.js::runPipelineWithAutoRepair`

> 출처: 2026-06-22 강제재시작 후 적용분 유실/자동 재적용 조사 세션에서 신규 작성(단일 원본 복사 아님).
