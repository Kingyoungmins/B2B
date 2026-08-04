# 49. 다른 달 파일/시트명 혼재 — 역할(안정키) 정규화로 해결 + v4 자리표 실패 조사

## 증상 (사용자 실측 zip 2건, 2026-08-04)
- ① 4월 스킬을 5월 파일로 전체실행→결과편집→수정→저장 → zip 에 step1=4월, step2=5월 꼬리표 혼재.
- ② 생성기에서 새로 만들어도 @범위 선택 에코("...4월.xlsx/원가!F3")가 prompt 에 남아 동일 증상.
- 결과: 6월 파일확인이 "4월 파일도, 5월 파일도 필요"로 같은 파일을 여러 줄 요구.
- 시트도 동일 문제 소지: 시트명에 월/날짜가 박히면("원가_4월", "202605_..._P") 자동 연결 불가 +
  envConfig 필터가 시트 요구를 오귀속으로 강등해 치환이 끊김.

## 원인 구조
- 요구 추출(runnerExtractMappingRequirements)은 스텝별 targetFileId·@범위 에코·코드 리터럴을
  '원문 이름 그대로' union → 같은 파일의 시기별 이름이 각각 행이 됨.
- envConfig 교집합 필터는 안정키 폴백으로 옛 달 이름도 "정본에 있음" 통과 → 걸러지지 않음.
- 실행 치환은 요구 행의 book/sheet 원문 기준 → 행 이름을 함부로 바꾸면 코드 속 옛 이름을 못 바꿈.

## 해결 (3중 방어, 전부 "유일 매칭만·모호하면 무수정" 원칙)
1. **저장 시**(save-load.js): stale targetFileId·prompt/설명 속 파일명을 현재 업로드로 재해석해 기록
   (normalizeStaleTargetFileIdForSave / normalizeStaleBooksInSavedText). 라이브 상태 불변.
2. **로드 시**(save-load.js): 기존 zip 도 envConfig 정본 기준으로 꼬리표·prompt 교정
   (repairStaleTargetFileIds / repairStalePromptBookNames). 구버전 zip(정본 없음)은 무수정.
3. **파일확인 시**(drop-handling.js) — 핵심: runnerCanonicalizeRequirementsByEnv 가 요구 book/sheet 를
   정본 이름으로 정규화해 한 행으로 병합. **원문 이름은 req.aliases / req.sheetAliases 로 보존**하고
   buildRunnerMappedPipeline 치환이 canonical+별칭 전부를 실제 이름으로 바꿈(코드 훼손 없음).
   시트는 runnerFindSheet 4단계(안정키 유일, 생성시트 제외, 키 하한 2자)로 월 변형 자동 연결,
   envConfig 필터도 안정키 인정으로 오강등 방지.

## v4(자리표) 조사 — 왜 그 길로 안 갔나 (0.6.2 lesson 44 + git 계보 실측)
0.6.2 가 코드 파일명을 @@FILE_n@@ 자리표로 저장하는 v4 를 시도했다가 사장됨(0.7 계열은 v4 이전
0.6.1 에서 분기, 복원 shim 만 이식). 실패 원인:
- 자리표가 **저장 파일 자체**에 박혀, v4 를 모르는 소비자(구버전 고객 배포본·하네스)가 열면
  "워크북 '@@FILE_1@@'" 로 영구 파손 — 후방호환 구조적 붕괴.
- 표(requiredFiles)와 코드 리터럴이라는 **두 개의 진실**이 재저장마다 갈라져 내부 불일치 zip 생산.
- (book,sheet) 조인 키가 핸들로 오염 → 생성시트 판정 붕괴 → 유령 업로드 요구.
- 선언표가 기존 퍼지 추론(사실상의 안전망)을 꺼버려 옛 이름이 실행까지 생존.
- targetFileId/@범위 에코는 핸들화에서 누락(이름이 나오는 경로는 코드만이 아니다).

**이번 설계가 그 함정을 피하는 방식**: 저장 포맷 불변(v3, 리터럴 유지) → 구버전 호환 자동 보장.
정규화는 경계(요구 산출·실행 치환)에서만, 원문은 별칭으로 보존. envConfig 는 저장 시 파생값이고
요구는 여전히 추론이 산출(표는 힌트, 추론이 백스톱). 모호 항목은 숨기지 않고 행으로 노출.

## 검증
- test_runs/_test_runner_role_canonicalize.js 14/14 (실측 zip 2건 시나리오 + 시트 월 변형 + 별칭 치환 e2e
  + 모호/구버전/생성시트 가드), _test_stale_targetfile_repair.js 17/17.
- 기존 계약 무회귀: _test_runner_requirements 23/23, _test_runner_mapping 16/16, _test_runner_automap.
- recheck 레지스트리: SKILL-SAVE-MIXED-MONTH-TARGETS, RUNNER-ROLE-CANONICALIZE.

## 교훈
- "이름 추상화"는 저장 파일이 아니라 **경계에서**: 아티팩트는 항상 그 자체로 실행 가능해야 한다.
- 요구/치환처럼 원문 문자열에 묶인 경로를 정규화할 땐 반드시 **별칭을 함께 운반**해야 실행이 안 깨진다.
- 같은 증상이라도 유출 경로는 여러 개(꼬리표→에코→코드 리터럴) — 한 곳 막고 끝내지 말고 경로별 전수.
