# AX-Cell 애드온 — 스케줄 등록 · 관측 로그

AX-Cell 본체에 얹는 기능 묶음입니다. 본체 코드가 계속 갱신되는 것을 전제로,
**로직은 전부 이 폴더 안에** 두고 본체는 최소한만 건드리도록 만들었습니다.

통합 절차는 [INTEGRATION.md](INTEGRATION.md) 에 있습니다. 이 문서는 **왜 이렇게
만들었는지**를 설명합니다.

---

## 1. 배경 — 무엇을 풀려는 과제인가

전체 과제는 두 단계입니다.

```
[1단계] 데이터 수집    빌링 원본 데이터를 모아온다        (AX-Trace, 미착수)
[2단계] 청구서 생성    엑셀을 조합해 청구서를 만든다      (AX-Cell, 배포 완료)
```

2단계는 이미 배포됐고 현업이 스킬을 만들어 쓰고 있습니다. 문제는 **그 실행기가
사람용**이라는 점입니다. 화면에 들어가 파일을 올리고, 매핑을 눈으로 확인하고,
버튼을 눌러야 합니다. 에이전트가 대신 할 수 없습니다.

그래서 만드는 것이 **무인 실행 경로**입니다.

```
사람          스킬 실행기에서 직접 실행           (기존)
무인          등록해 둔 스케줄대로 알아서 실행     (이번 작업이 그 준비)
```

이 애드온은 그 최종 그림의 **등록·관리 화면**과, 전사 통합 통계를 위한
**관측 로그**를 담당합니다.

---

## 2. 이번에 추가된 것

### 2.1 E2E 작업 등록 (스킬 등록 / 스킬 목록)

무인 실행에 필요한 것을 한 폴더로 묶어 등록합니다.

```
1. 스킬 업로드
   ① AX-Cell 스킬 (.zip)  → 필요한 문서를 자동으로 찾아냄
   ② 문서마다 AX-Trace 스킬을 연결

2. 스케줄 등록
   주기(매일/매주/매달/한 번만) · 시각 · 결과 수령 방법
```

등록하면 바탕화면에 이렇게 남습니다.

```
바탕화면\ESTB\<OS계정>\<스킬명>\
    ├─ (업로드된 스킬 파일들)
    ├─ cron.txt        crontab 5필드 — 실행 주기의 유일한 근거
    ├─ config.txt      사람이 읽는 요약
    └─ schedule.json   기계용 원본(수신 방법 등 cron 이 못 담는 정보)
```

목록 화면에서 조회·수정·삭제할 수 있습니다.

### 2.2 관측 로그 (Agent Observability)

전사 통합 통계를 위해 **스킬 실행 1건 = 로그 1건**을 남깁니다.
자세한 내용은 아래 5장.

### 2.3 부수 화면

- **AX-Trace 스킬 생성기** — 외부 웹 에이전트를 iframe 으로 얹는 화면
- 좌상단 로그인 계정 표시 (`whoami`)
- 메뉴 3그룹 재편 (AX-Cell / AX-Trace / E2E 작업 등록)

---

## 3. 설계 원칙 — 검토하실 때 봐주실 부분

### 본체 의존을 최소로

본체가 계속 갱신되므로, **버전이 올라가도 이 폴더만 다시 넣으면** 되도록
만들었습니다. 본체에서 고치는 곳은 다음이 전부입니다.

| 파일 | 변경량 |
|---|---|
| `serve_b2b.py` | import 2줄 + 라우팅 2블록 + 로그 호출 3곳 |
| `index.html` | 메뉴 · 컨테이너 · script/link 태그 |
| `scripts/menu.js` | 제목 맵 · Excel 미러 비활성 대상 |
| `scripts/pipeline.js` | `skillName` 1줄 (로그용) |

프런트는 본체 전역(`state`/`$`/`pipeline`/`save-load`/`excelMirror`)을
**하나도 참조하지 않습니다.** 노출 전역은 `window.AXCellScheduler`,
`window.AXEmbed` 둘뿐이고 DOM id 는 `sched-`/`trace-gen-` 접두사로 격리했습니다.

### 외부 라이브러리 없음

스킬 zip 해제는 브라우저 내장 `DecompressionStream("deflate-raw")` 으로
직접 구현했습니다. `vendor/` 에 zip 라이브러리가 없기도 했고, 의존을 늘리면
이식이 어려워지기 때문입니다. 파이썬 쪽도 표준 라이브러리만 씁니다
(관측 로그 전송을 켤 때만 OTel 패키지가 필요).

### 스킬 해석 규칙을 세 곳이 공유

"이 스킬이 어떤 문서를 필요로 하는가"를 판정하는 규칙이 세 곳에 있습니다.

```
scripts/scheduler.js       화면이 문서 목록을 보여줄 때
python/b2b_scheduler.py    서버가 교체를 검사할 때
tools/auto_runner/skill.py 실제 실행 때 파일을 찾을 때 (별도 도구)
```

**세 곳이 같은 답을 내야** "화면에서 본 목록"과 "실제로 찾는 파일"이
어긋나지 않습니다. 실물 스킬로 결과가 일치하는 것을 확인했습니다.

판정 순서는 이렇습니다.

1. v4 `requiredFiles` 의 `role=input`
2. `pipeline[].targetFileId` 의 `input:` 접두
3. 코드 리터럴 (`ctx.book("…")`, VBA `Workbooks("…")`)

> **v3 스킬에는 `requiredFiles` 가 없습니다.** 현업 스킬 상당수가 v3 이라
> 2·3번 경로가 필수입니다.

### 유령 입력 걸러내기

현업이 여러 파일을 띄워놓고 스킬을 만들면, 앱이 **그때 활성 탭**을
`targetFileId` 로 기록합니다. 코드는 `ctx.book()` 으로 다른 파일을 열었으므로
만들 때는 정상 동작했고 아무도 눈치채지 못합니다. 결과적으로 **실제로는 쓰지
않는 파일이 요구 목록에 남습니다.**

실물 스킬(한전 인천지부)에서 이 사례를 확인했습니다.

```python
# targetFileId = input:한국전력공사_202607_v1.1.xlsx   ← 폴더에 없는 파일
def transform(ctx):
    book = ctx.book("01. 전용회선_한전_DAS_…xlsx.xlsx")  # ← 실제로 여는 건 다른 파일
    book.delete_rows("Sheet1", "1:9")
```

이런 항목은 아래 **세 조건을 모두** 만족할 때만 요구에서 제외합니다.

1. 앱이 `unresolvedRefs` 에 "못 풀었다"고 스스로 기록했다
2. `requiredSheets` 가 비어 있다 (내용에 대한 요구가 없다)
3. 어느 코드도 그 이름으로 책을 열지 않는다

2·3 덕분에 **이름만 잘못 적힌 참조**(예: 확장자 중복 `.xlsx.xlsx`)는
유령으로 오해되지 않습니다. 그건 진짜 요구이고, 매처가 실물과 이어주면 됩니다.

### 애매하면 멈춘다

잘못된 파일로 청구서를 만드는 것이 실행 실패보다 나쁩니다. 그래서:

- 문서 하나라도 AX-Trace 가 안 붙으면 **등록 자체를 막습니다** (화면 + 서버 양쪽)
- AX-Cell 을 교체할 때 요구 문서가 하나라도 달라지면 **다른 작업으로 보고**
  재등록을 요구합니다 (기존 연결을 물려받을 수 없으므로)

---

## 4. 파일 구성

```
axcell_addon/
├── README.md              이 문서 (취지·설계)
├── INTEGRATION.md         통합 절차 (본체에 붙이는 법)
├── python/
│   ├── b2b_scheduler.py   스케줄 등록·목록 서버측
│   └── b2b_telemetry.py   관측 로그
├── scripts/
│   ├── scheduler.js       등록·목록 화면
│   ├── whoami.js          좌상단 계정 표시
│   └── embed.js           외부 웹 화면 임베드
├── styles/
│   └── scheduler.css      위 화면 전부의 스타일
├── _reference_본체수정본/  ★ 병합 참고용 (덮어쓰기 금지)
│   ├── index.html          우리가 수정한 본체 파일 5개
│   ├── serve_b2b.py
│   ├── launch_b2b.py
│   ├── scripts/menu.js
│   ├── scripts/pipeline.js
│   └── diff/               변경분만 뽑은 patch 5개
└── _backup_핑크버전/
    └── scheduler.css      색 변경 전 버전 (되돌릴 때)
```

### 병합 방법

`INTEGRATION.md` 에 붙일 코드가 전부 적혀 있습니다. 다만 본체 버전이 다르면
붙일 위치가 옮겨졌을 수 있으므로, **`_reference_본체수정본/` 과 diff 를 떠서**
비교하시는 편이 확실합니다.

```
새 파일 6개        그냥 복사 (이름 충돌 없음)
본체 5개 파일       diff 를 보며 조각만 옮기기 — 덮어쓰지 마세요
```

본체에 실제로 추가되는 양은 이 정도입니다.

| 파일 | 추가 | 비고 |
|---|---|---|
| `index.html` | +74 | 메뉴 · 화면 컨테이너 · script/link |
| `serve_b2b.py` | +28 | import 2 · 라우팅 2블록 · 로그 3곳 |
| `launch_b2b.py` | +16 | 관측 로그 초기화 |
| `scripts/menu.js` | +9 | 제목 맵 · 헤드리스 대상 |
| `scripts/pipeline.js` | +3 | `skillName` (관측 로그용) |

> `serve_b2b.py` 의 diff 에는 삭제 392줄이 보입니다. 저희가 스케줄러 로직을
> 잠시 본체에 넣었다가 모듈로 다시 빼낸 흔적이라, **본체 관점에서는 +28 뿐**입니다.

---

## 5. 관측 로그

### 어디서 남기는가

`handle_excel_run_full_pipeline()` — **스킬 전체실행** 한 곳입니다.
성공 / 스킬 실패 / 시스템 실패 세 갈래가 그 함수 안에서 갈리므로,
`status` · `latency_ms` · `error_code` 를 모두 정확히 잡을 수 있습니다.

호출부는 한 줄입니다.

```python
b2b_telemetry.log_skill_run(
    skill_name=..., step_count=32, status="success",
    started_at=t0, file_count=6, languages="python/vba", output_mode="file")
```

### 안전장치

**로그 때문에 본체가 느려지거나 죽으면 안 됩니다.**

- 전송은 백그라운드 스레드 — 호출부는 즉시 반환
- 모든 예외를 삼킴 — 로그 실패가 스킬 실행을 막지 않음
- 큐가 차면 버림 — 본체를 막지 않음
- 접속 정보가 없으면 조용히 no-op

### 지금 상태 — 아직 전송하지 않습니다

수집 측 접속 정보를 아직 못 받았습니다. 그래서 **로컬 파일에만 기록**합니다.

```
telemetry_preview.jsonl     무엇이 나갈 예정인지 눈으로 확인하는 용도
```

아래 환경변수가 채워지면 **코드 수정 없이** 전송이 켜집니다.

```
ARIZE_COLLECTOR_ENDPOINT    OTLP gRPC 주소
ARIZE_API_KEY
ARIZE_SPACE_ID
ARIZE_PROJECT_NAME
ENCRYPTION_KEY              Base64 AES-256
```

필요 패키지(전송을 켤 때만):
```
opentelemetry-sdk
opentelemetry-exporter-otlp
cryptography
```

### 확정되지 않은 값

`python/b2b_telemetry.py` 상단에 상수로 모아 뒀습니다. 수집 측 답변이 오면
**그 블록만** 고치면 됩니다.

| 상수 | 현재값 | 상태 |
|---|---|---|
| `TENANT_ID` | `lguplus` | 확정 |
| `ENVIRONMENT` | `prod` | 확정 (문서에 허용값 명시) |
| `ACTOR_TYPE` | `user` | 확정 (문서에 허용값 명시) |
| `SERVICE_NAME` | `b2b-billing-agent` | ★ 명명 규칙 확인 필요 |
| `AGENT_ID` | `b2b-billing` | ★ 배정받는지 확인 필요 |
| `AGENT_TYPE` | `desktop_agent` | ★ 문서 **예시값**을 가져온 것. 허용 목록 확인 필요 |
| `EVENT_TYPE_RUN` | `agent.run` | ★ enum 확인 필요 |
| `SPAN_KIND_WORKFLOW` | `WORKFLOW` | ★ enum 확인 필요 |
| `PROVIDER` | `internal` | ★ LLM 미사용 시 표기 확인 필요 |
| `COST_USD` | `0` | 확정 (내재화) |
| `CLOUD` | `U+ Cloud` | 확정 |

`region` / `availability_zone` 은 뺐습니다 — AWS 전제 필드이고 사내 VDI 에는
해당 개념이 없습니다. 토큰 필드(`prompt_tokens` 등)도 뺐습니다 — 이 이벤트는
LLM 호출이 아니라 Excel 실행입니다. 조직 필드는 `actor_id` 로 수집 측이
조인하기로 협의했습니다.

### 개인정보 · 고객사명

`skill_name` 에 고객사명이 들어갑니다(예: `한전 인천지부 월마감`).
`error_message` 에도 파일명·시트명이 섞일 수 있습니다.

취급 기준이 정해지기 전까지의 안전장치를 넣어 뒀습니다.

```python
MASK_BUSINESS_TEXT = False   # True 로 바꾸면 해시 처리(집계는 되고 내용은 안 보임)
```

가이드에 언급된 **마스킹·암호화 샘플 코드는 아직 못 받았습니다.**
`ENCRYPTION_KEY` 가 AES-256 인 것으로 보아 input/output 을 암호화해 보내는
설계로 보이는데, 임의로 구현하면 수집 측에서 복호화할 수 없으므로
그 코드를 받아 채워야 합니다.

---

## 6. 아직 안 되어 있는 것

**등록한 스케줄을 정해진 시각에 실제로 실행하는 부분이 없습니다.**

`cron.txt` 는 현재 기록일 뿐입니다. 실행 주체(작업 스케줄러 등록이든 상주
프로세스든)는 다음 단계이며, 이 애드온은 그때 읽을 **입력 형식을 확정해 두는
역할**입니다.

AX-Trace 스킬 실행기 화면도 비어 있습니다(규격 미정).

---

## 7. 검증

실물 스킬(한전 인천지부, v4 · 32단계 · 문서 6개)로 확인했습니다.

| 항목 | 결과 |
|---|---|
| 스킬 해석이 파이썬 러너와 일치 | 문서 6/6, 유령 1개 동일 판정 |
| 스케줄 CRUD | 27개 통과 |
| AX-Cell 교체 검사 | 18개 통과 |
| 완결성 가드(AX-Trace 누락) | 9개 통과 |
| 파일 편집 API | 19개 통과 |
| cron 전용 수정 | 18개 통과 |
| 화면 렌더·클릭 | 135개 통과 |
| 메뉴 구성 | 44개 통과 |
| 관측 로그 | 실제 32단계 실행 1건 기록 확인 |
