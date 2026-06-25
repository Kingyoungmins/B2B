# 21. 교차파일 쓰기 결과 유실 — 동반본(companion) writeback (SBAGENT-138, v0.5.12)

## 증상
37단계 스킬 전체실행에서 **깨지는 지점이 판마다 바뀜**(1차 8번, 2차 8번 통과·22번 실패).
- 22번 "시트 복사" = "적용됨"인데 한전 파일에 시트가 안 생김 → 23번(그 시트 rename)이 "시트 없음" 오류.
- 8번은 어떤 판은 막히고 어떤 판은 통과 → 사용자 표현 "계속 우연임?".

## 근본 원인 (코드 확정)
격리 실행(`_run_vba_pipeline_on_session_impl` → `_setup_isolated_pipeline_instance`)은
**대상(ftarget) 워크북 하나만** 결과를 라이브에 반영하고(`ftarget.SaveCopyAs` →
`_copy_source_workbook_into_target`), 같이 연 **동반본(companion)은 `Close(SaveChanges=False)`로 폐기**한다.

교차파일 스텝(A를 읽어 B에 쓰기)이 **자기가 '쓰는' 파일의 세션이 아닌 다른 세션에서** ftarget으로 돌면,
실제 쓰기 대상은 동반본이 되어 **결과가 통째로 버려진다**(에러 없이 "적용됨"). 다음 스텝이
그 결과(시트/값)에 의존하면 그제서야 "없음"으로 실패한다.

비결정성의 정체: 스텝의 실행 세션은 `pipelineStepMutationFileId`(pipeline.js)가
`crossOutputFileIdsReferencedInCode`(출력 파일명이 코드에 '등장'만 하면 그 output 세션)로 정한다.
**출력(한전)이 outputTemplates에 등록됐는지** 한 스위치로 라우팅이 통째로 갈린다:
- 등록됨(시나리오 A): 한전을 '읽기만' 하는 8번까지 한전 세션으로 끌려가 8번의 DAS 쓰기 유실.
- 미등록(시나리오 B): 폴백이 저장된 targetFileId(=읽기 원본)로 가, 22/13/33번의 한전 쓰기 유실.
등록 상태가 실행/에러복구마다 달라져 실패 지점이 8↔22로 이동 → "우연"처럼 보임.

## 수정 (백엔드 근본수정)
격리 실행 후 **변경된(`Saved=False`) 동반본을 각자의 라이브 세션으로 되돌려쓴다**
(`_sync_modified_companions_into_live`). 라우팅이 어느 세션을 ftarget으로 잡았든
'다른 파일에 쓴 결과'가 보존되어 유실·비결정성이 원천 제거된다.
- `_setup_isolated_pipeline_instance`: 동반본 `{excelId, name, wb}` 목록을 함께 반환.
- 실행 후 ftarget 반영 직후, `Saved=False`인 동반본만 SaveCopyAs→그 라이브 세션에
  `_copy_source_workbook_into_target`로 반영 + `rev`/`appliedStepSigs` 무효화 + 창 복원.
- 읽기만 한 동반본(`Saved=True`)은 건너뜀 → 단일파일/정상라우팅 스텝은 동작 불변(회귀 0).

## 검증
- `test_runs/_test_isolated_companion_writeback.py` (신규, COM E2E): A의 Sheet1을 B에 복사하는
  스텝을 일부러 'A 세션'(B=동반본)으로 실행 → 라이브 B에 시트가 실제로 생기는지 확인. PASS.
- `test_runs/_test_isolated_delete_sheet.py`(단일세션, companions=[]) 회귀 PASS.
- 라우팅 JS 회귀(_test_ctx_helper_routing/_test_routing_cause) PASS.

## 한계 / 후속
- 대상 파일이 **세션으로 아예 안 열려 있으면** 동반본도 없어 그 스텝은 "X가 열려있지 않음"으로
  하드에러(유실 아님). 필요 시 '코드가 참조하는 출력 파일 자동 오픈/등록'을 별도로 보강.
- 클라이언트 라우팅(`pipelineStepMutationFileId`의 읽기/쓰기 미구분)은 그대로 둠 — 백엔드 writeback이
  유실을 막으므로 급하지 않음. 추후 '쓰기 대상 기준 라우팅'으로 개선하면 동반 sync 빈도도 준다.
- 전체실행 격리 경로는 코덱스 공유 영역 — 병합 시 충돌 주의(이 변경은 가산적: 교차쓰기 없을 땐 무영향).
