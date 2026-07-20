# 40 — [적용] 수 분 멈춤 = 정적검사 정규식 catastrophic backtracking [0.5.15.x]

## 증상
저사양 PC에서 채팅으로 만든 Python 스킬 **[적용]** 시 2~4분(저사양 체감 10분) 멈춤. 같은 작업이라도 **더 단순한 코드는 즉시** 끝남. "코드별로 느림이 갈린다(같은 python인데)"는 사용자 관찰이 핵심 단서였다.

## 오진 이력(중요 — 같은 함정 반복 금지)
백엔드 트레이스만 보고 가설을 5번 갈아끼우며 여러 턴 낭비:
1. 저장-전 recalc → 2. 버그 VBA 에러복구 → 3. 채팅 LLM Think 생각시간 → 4. 콜드/웜(재시작 후 첫 적용) → 5. EXCEL_LOCK/스냅샷 대기.
**전부 틀림.** `python_com.run`(~900ms)·`excel.save.snapshot`(254ms)·락 전부 빨랐고 Excel·백엔드 idle(낮은 CPU). Think 도 OFF였음.

## 진단 결정타 = 클라(JS) 단계 트레이스
`/api/client/trace` 엔드포인트 + 클라 단계 이벤트(`client.apply.validate.start/ok`, `client.pipeline.apply_live.prehide/snapshot/request`)를 심고 한 번 돌리니 즉시 드러남:
- `client.apply.validate.start`(17:04:58) → `client.apply.validate.ok`(17:06:58) = **검증 단계에서 119,672ms ≈ 2분**, 그동안 백엔드·Excel idle = **순수 클라 JS 연산**.
- 그 뒤 실제 적용은 totalClientMs **1567ms**. → 그래서 백엔드 트레이스에도, 디버그 패널 totalClientMs(적용 진입 *후* 측정)에도 4분이 안 잡혔던 것.

## 근본 원인
[적용] 시 도는 `validateAssistantCodeBeforeApply` → `pythonComStaticSafetyFailures` 의 `loopWriteRe`(루프 안 ctx.write 반복 검사) 정규식:
```
"(?:(?:\\1[ \\t]+[^\\n]*)?\\n)*?"   // 옵션(?) 안의 별표(*) = 고전적 지수폭발
```
for **본문 줄 수**에 지수적. else/try/except로 본문이 10줄이면 폭발(일반 PC 49,264ms, 저사양 2~4분), 단순 3줄은 0ms. → 코드가 "느림과 상관있어 보인" 진짜 이유(실행이 아니라 검사 정규식 시간).

## 수정
정규식 한방 매칭 → **줄 단위 스캔(O(줄수), 백트래킹 불가능)** 으로 교체. 의미 동일: 루프 헤더 들여쓰기보다 깊은 줄만 본문으로 보고, 본문에 `ctx[.book(...)].write/write_cell/...(` 가 있으면 차단. (chat-ui.js `pythonComStaticSafetyFailures`)

## 검증 / 전수 감사
- `test_runs/_re_backtrack_test.js`: 슬로우 **49,264ms → 0ms**, 슬로우/빠른 결과 동일(false=오탐 없음), 진짜 루프내 write/book.write 는 여전히 차단(true). **5/5**.
- `test_runs/_re_audit.js`: 나머지 다중 `[\s\S]{0,N}` 정규식(non_none 4연속, sort_header, re_sub, VBA rowDeleteLoop `[\s\S]{0,1800}`)을 적대적 입력으로 측정 → **전부 0ms**. `loopWriteRe` 가 유일한 폭발이었음(앵커가 구체적이면 다항이라도 즉시).

## 교훈
- "멈춤인데 백엔드는 빠르다(idle)" → 추론 말고 **클라 단계별 트레이스부터** 박는다. perfMs 차이가 어느 구간이 수 분인지 한 방에 가른다.
- 정규식의 **"옵션/별표 중첩"(`(a?)*`, `(?:(?:x)?\n)*`)** 과 **인접 가변 반복(`a*b*`)** 은 입력 구조에 따라 폭발한다. UI 스레드 검사에는 가변 반복 정규식 대신 줄 단위 스캔을 우선.
- (claude 메모리: `apply-slow-client-regex-backtracking`)

## 상태 (구현+검증 완료)
- [x] chat-ui.js `loopWriteRe` → 줄단위 스캔(백트래킹 제거)
- [x] 회귀/감사 테스트 2개(_re_backtrack_test.js 5/5, _re_audit.js 전부 안전)
- [x] 클라 단계 트레이스 인프라(`/api/client/trace` + `client.*` 이벤트) 상시 유지 — 향후 "멈춤" 진단의 1순위 도구
- [x] 빌드(0.5.15.1)
