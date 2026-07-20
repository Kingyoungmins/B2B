# 39 — 실행기 파일출력 모드 (생성기=뷰 / 실행기=파일출력) [0.5.15.x 설계]

## 배경 / 결정
저사양에서 전체실행이 75/75 후 '최종 동기화(통째 시트 교체)'로 수 분 걸려 타임아웃 거짓실패([[38]]/타임아웃패치).
근본 개선: **실행기 전체실행은 라이브에 동기화하지 말고 결과를 '파일로 출력'**한다(뷰 미반영). 동기화(`_copy_
source_workbook_into_target`, 시트 한 장씩 COM 복사)가 통째로 빠져 빠르고 안전(라이브 무손상).
- 생성기 = 라이브 뷰 + 스텝 편집(스냅샷 기반 이어실행) 유지.
- 실행기 = 배치 파일출력(뷰/편집 없음 — 실행기엔 원래 스텝 편집 UI 없음, 파일+스킬수+실행+다운로드 뷰).
- 중간 스킬 수정: '뷰'가 아니라 '스냅샷(스텝 직전 상태)'에 의존 → 파일출력이어도 가능. 편집은 생성기에서(공유
  state.pipeline). 실행기 실행 후 생성기로 가면 즉시 편집(라이브). 즉 파일출력이 편집을 막지 않음.
- 결과 수령(사용자 선택): **자동저장 + 다운로드 둘 다**.

## 설계
### 백엔드
- `run_full_pipeline_single_instance(..., output_mode="sync")` 에 `output_mode` 추가.
  - `"sync"`(기본/생성기): 현행 — 변경 파일을 `_copy_source_workbook_into_target` 로 라이브 반영.
  - `"file"`(실행기): 라이브 동기화 **생략**. 변경된 각 파일을:
    1. `default_output_dir()`(=`writable_app_dir()/output`)에 `결과_{원본스템}_{타임스탬프}.xlsx` 로 `SaveCopyAs`(자동저장).
    2. RESULTS 에 등록(downloadId) → 다운로드 가능.
    3. 라이브 wb 는 건드리지 않음(무손상). perFileLiveSchema 도 스킵(뷰 안 씀).
  - 반환에 `outputFiles: [{excelId,name,path,downloadId,downloadUrl}]` 추가.
- 진행률: 'syncing' 대신 'saving' phase(파일 저장 i/n). (타임아웃 패치와 동형)
- `default_output_dir()` 신설(=writable_app_dir/output) + `.gitignore` 에 `output/`.

### 클라
- 실행기 run(`runner-run-btn`) → `runPipelineWithAutoRepair({source:"runner", backgroundMode:true, outputMode:"file"})`.
- `outputMode` 를 runPipelineWithAutoRepair→runPipelinePreferBackend→runVbaPipelinePreferLive→runIsolatedLive
  PipelineSteps(bg 분기)→`/api/excel/run-full-pipeline` 페이로드로 전파.
- bg 분기: outputMode 를 payload 에 실음. 성공 시 동기화/스키마 갱신 대신 **outputFiles 로 결과 안내**:
  "완료 — 결과 N개 저장(폴더경로) · 다운로드". `runnerSetProgress`/완료 UI 에 표시.
- `runner-download-btn`: 직전 run 의 outputFiles(downloadId) 를 zip 으로 받게 연결(window.lastRunnerOutputs).
- 생성기 run(`btn-run`)은 outputMode 생략 → "sync"(현행).

### 불변/주의
- 원본/라이브 무손상(파일모드는 라이브 안 건드림) → Bug1류 위험 원천 제거.
- 스텝별 prestep 스냅샷은 파일모드에서도 계속 생성(생성기에서의 후속 편집/이어실행 대비). cleanup 은 stale 만.
- output_mode 분기는 sync 경로를 그대로 두고 file 경로만 추가(회귀 최소).

## 테스트
- 라이브 COM: file 모드 2파일 → output/결과_*.xlsx 2개 생성 + 라이브 무손상 + outputFiles 반환.
- 클라 라우팅: 실행기 run 이 outputMode:"file" 로 1콜, 생성기 run 은 "sync".
- 회귀: 기존 sync 경로(생성기) 5/5·12/12 유지.

## 상태 (구현+테스트 완료)
- [x] 백엔드 output_mode="file" + default_output_dir(writable_app_dir/output) + outputFiles(RESULTS 등록)
- [x] 클라 outputMode 전파(실행기=file/생성기=sync) + 완료 안내(runnerSetProgress) + runner-download-btn 연결(window.lastRunnerOutputs)
- [x] .gitignore output/
- [x] 라이브 `_test_fullrun_file_output_live.py` 7/7 (라이브 무손상·output 2파일·결과시트 포함·RESULTS 등록)
- [x] 클라 라우팅 `_test_fullrun_background_client.js` 16/16 (sync 기본 + file 모드 + lastRunnerOutputs)
- [x] 회귀: sync 모드(생성기) 라이브 단일인스턴스 5/5 · 동반참조 4/4 유지
- [ ] 빌드는 지시 시 (현재 미빌드)
