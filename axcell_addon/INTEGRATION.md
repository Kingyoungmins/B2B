# B2B 스케줄러 모듈 — 통합 가이드

`스케줄 등록` / `스케줄 목록` 두 화면을 본체에 붙이는 방법입니다.

이 모듈은 **본체 코드가 계속 갱신되는 것을 전제로** 만들었습니다. 그래서
로직은 전부 모듈 파일 안에 있고, 본체에서 고치는 곳은 아래 **네 군데뿐**입니다.
버전이 올라가도 이 네 군데만 다시 넣으면 따라옵니다.

---

## 1. 파일 복사 (그대로 넣기, 수정 불필요)

| 애드온 파일 | 본체 위치 |
|---|---|
| `python/b2b_scheduler.py` | `serve_b2b.py` 와 **같은 폴더** |
| `python/b2b_telemetry.py` | `serve_b2b.py` 와 **같은 폴더** |
| `scripts/scheduler.js` | `scripts/` |
| `scripts/whoami.js` | `scripts/` |
| `scripts/embed.js` | `scripts/` |
| `styles/scheduler.css` | `styles/` |

기존 파일과 이름이 겹치지 않습니다. 덮어쓸 것이 없습니다.

> PyInstaller 로 빌드한다면 `launch_b2b.spec` 의 `datas` 는
> `collect('scripts')` / `collect('styles')` 로 폴더를 통째로 훑으므로
> **spec 수정이 필요 없습니다.** `b2b_scheduler.py` 는 `serve_b2b.py` 처럼
> 소스로 포함되므로 `hiddenimports` 에 `'b2b_scheduler'`, `'b2b_telemetry'` 를
> 추가하면 됩니다.

---

## 2. `serve_b2b.py`

### (a) import

```python
import base64          # 이미 있음
import b2b_scheduler   # ← 추가 (스케줄 등록/목록)
import b2b_telemetry   # ← 추가 (관측 로그)
```

### (b) `do_GET` 안, 다른 라우팅과 같은 위치에

```python
def do_GET(self):
    # ↓ 추가 (다른 if 들보다 앞이든 뒤든 무방)
    _sched = b2b_scheduler.handle_get(self.path)
    if _sched is not None:
        self.send_json(_sched)
        return
    ...
```

### (c) `do_POST` 안

```python
def do_POST(self):
    # ↓ 추가
    if b2b_scheduler.handles_post(self.path):
        self.send_json(b2b_scheduler.handle_post(self.path, self.read_json_body() or {}))
        return
    ...
```

`handle_get` 은 **자기 경로가 아니면 `None`** 을 돌려주므로 기존 라우팅에
영향을 주지 않습니다. `handles_post` 는 본문을 읽기 전에 판단만 합니다
(본문을 두 번 읽지 않도록 분리해 두었습니다).

### (d) 관측 로그 — `handle_excel_run_full_pipeline()` 안

스킬 전체실행 1건을 기록합니다. 성공/실패 세 갈래가 이 함수 안에서
갈리므로 여기 한 곳만 손보면 됩니다.

**함수 앞부분** — 시작 시각과 메타를 잡아 둡니다.

```python
total = sum(len((g.get("steps") or [])) for g in groups)   # 이미 있음
# ↓ 추가
_tel_t0 = time.time()
_tel_skill = str(payload.get("skillName") or "")
_tel_mode = str(payload.get("outputMode") or "sync")
_tel_langs = "/".join(sorted({str(st.get("language") or "python").lower()
                              for g in groups for st in (g.get("steps") or [])}))
```

**성공 직후**

```python
b2b_telemetry.log_skill_run(
    skill_name=_tel_skill, step_count=total, status="success",
    started_at=_tel_t0, file_count=len(result.get("outputFiles") or []),
    languages=_tel_langs, output_mode=_tel_mode)
```

**`except PipelineExecutionError` 안** (스킬 실패)

```python
b2b_telemetry.log_skill_run(
    skill_name=_tel_skill, step_count=total, status="failed",
    started_at=_tel_t0, languages=_tel_langs, output_mode=_tel_mode,
    error_code="PipelineExecutionError", error_message=str(err))
```

**`except Exception` 안** (시스템 실패)

```python
b2b_telemetry.log_skill_run(
    skill_name=_tel_skill, step_count=total, status="failed",
    started_at=_tel_t0, languages=_tel_langs, output_mode=_tel_mode,
    error_code=type(err).__name__, error_message=str(err))
```

> `log_skill_run` 은 **어떤 예외도 밖으로 내보내지 않습니다.**
> 로그가 실패해도 스킬 실행에는 영향이 없습니다.

---

## 2-1. `launch_b2b.py` — 관측 로그 초기화 (기동 시 1회)

Arize 연동은 **애플리케이션 기동 시 단 1회만** 실행되어야 합니다.
`__init__.py` 가 아니라 진입점에서 부릅니다.

```python
def _init_telemetry() -> None:
    """[관측 로그] 기동 시 단 한 번만. 실패해도 앱은 그대로 뜬다."""
    try:
        import b2b_telemetry
        from serve_b2b import APP_BUILD_STAMP, writable_app_dir
        st = b2b_telemetry.init(app_version=APP_BUILD_STAMP,
                                writable_dir=str(writable_app_dir()))
        if st.get("missing_env"):
            print("[telemetry] 파일 기록만 (미설정: %s)" % ", ".join(st["missing_env"]))
        else:
            print("[telemetry] 수집 서버로 전송합니다")
    except Exception as err:
        print("[telemetry] 초기화 건너뜀: %r" % (err,))


def main() -> int:
    _init_telemetry()      # ← 첫 줄에 추가
    ...
```

---

## 2-2. `scripts/pipeline.js` — 스킬명 1줄 (관측 로그용)

서버는 지금 **어떤 스킬이 실행됐는지 모릅니다.** 로그에 남기려면
전체실행 요청에 스킬명을 실어 보내야 합니다.

```js
lastData = await postExcelMirror("/api/excel/run-full-pipeline", {
  groups: bgGroups,
  resetExcelIds,
  viewSheet: options.viewSheet || null,
  outputMode: options.outputMode || "sync",
  // ↓ 추가. 실행 동작에는 쓰이지 않고 서버가 로깅에만 사용합니다.
  skillName: (typeof state !== "undefined" && state.logicSaveBaseName) || "",
}, 0, {
```

---

## 3. `index.html` — 3곳

### (a) `<head>` 의 스타일 링크 마지막에

```html
<link rel="stylesheet" href="styles/scheduler.css">
```

### (b) 메뉴 목록 (`.menu-list`) 안

메뉴를 세 갈래로 나눠 씁니다. 그룹 라벨(`.menu-group`)과 구분선(`.menu-sep`)
스타일은 `styles/scheduler.css` 에 들어 있어 본체 `layout.css` 는 안 건드립니다.

```html
<div class="menu-group">AX-Cell</div>
<button class="menu-item active" data-page="generator" type="button">
  <span>🧩</span><span>스킬 생성기</span>
</button>
<button class="menu-item" data-page="runner" type="button">
  <span>▶</span><span>스킬 실행기</span>
</button>

<div class="menu-group">AX-Trace</div>
<button class="menu-item" data-page="trace-generator" type="button">
  <span>🛰</span><span>스킬 생성기</span>
</button>
<button class="menu-item" data-page="trace-runner" type="button">
  <span>⏩</span><span>스킬 실행기</span>
</button>

<div class="menu-group">E2E 작업 등록</div>
<button class="menu-item" data-page="scheduler" type="button">
  <span>🗓</span><span>스킬 등록</span>
</button>
<button class="menu-item" data-page="schedules" type="button">
  <span>📋</span><span>스킬 목록</span>
</button>

<div class="menu-sep"></div>
```

> `trace-generator` / `trace-runner` 는 아직 빈 화면입니다(`.sx-soon`).
> AX-Trace 규격이 정해지면 그 컨테이너에 채우면 됩니다.

### (c) 좌측 `.left-body` 안, 마지막 `page-panel` 다음에

```html
<div class="page-panel" id="page-scheduler">
  <div class="sched-root" id="sched-root">
    <div id="sched-stage"></div>
    <input type="file" id="sched-file" accept=".zip" hidden>
    <input type="file" id="sched-trace-file" hidden>
  </div>
</div>

<div class="page-panel" id="page-schedules">
  <div class="sched-root" id="schedlist-root">
    <div id="schedlist-stage"></div>
    <input type="file" id="schedlist-file" hidden>
  </div>
</div>
```

### (d) 스크립트 태그 (`menu.js` 다음이면 어디든)

```html
<script src="scripts/whoami.js"></script>
<script src="scripts/scheduler.js"></script>
<script src="scripts/embed.js"></script>
```

> 좌상단에 로그인 계정을 표시하려면 `.brand-info` 안에 아래를 추가합니다(선택).
> 없어도 스케줄 기능은 동작하며, 등록자 표시만 빠집니다.
> ```html
> <div class="sub user-identity" id="user-identity" title="확인 중">
>   <span class="user-identity-dot" aria-hidden="true"></span>
>   <span id="user-identity-text">사용자 확인 중…</span>
> </div>
> ```

---

## 4. `scripts/menu.js` — 2곳

### (a) 페이지 제목

```js
$("page-title").textContent = page === "runner" ? "스킬 실행기" : "B2B 빌링 Agent";
```
위 한 줄을 아래로 바꾸거나, 이미 맵을 쓰고 있다면 두 항목만 추가합니다.

```js
const PAGE_TITLES = {
  generator: "AX-Cell · 스킬 생성기",
  runner: "AX-Cell · 스킬 실행기",
  "trace-generator": "AX-Trace · 스킬 생성기",
  "trace-runner": "AX-Trace · 스킬 실행기",
  scheduler: "E2E 작업 등록 · 스킬 등록",
  schedules: "E2E 작업 등록 · 스킬 목록",
};
$("page-title").textContent = PAGE_TITLES[page] || PAGE_TITLES.generator;
```

### (b) Excel 미러 비활성 (두 화면 모두 Excel 을 안 씁니다)

`setPage()` 안에서 실행기(runner)를 헤드리스로 돌리는 부분에 두 페이지를 함께 묶습니다.

```js
const isRunner = page === "runner";
const isScheduler = page === "scheduler" || page === "schedules"
  || page === "trace-generator" || page === "trace-runner";   // ← 추가
const noExcel = isRunner || isScheduler;                            // ← 추가
if (typeof excelMirror !== "undefined" && excelMirror) excelMirror.runnerHeadless = noExcel;
document.body.classList.toggle("page-runner-active", noExcel);      // ← isRunner → noExcel
```

그리고 오버레이를 내리는 분기에 `isScheduler` 를 추가합니다(실행기와 동일 처리).

```js
} else if (isScheduler) {
  const _h = (typeof hideAllExcelMirrorWindows === "function") ? hideAllExcelMirrorWindows() : null;
  Promise.resolve(_h).catch(() => {}).then(() => {
    if (typeof publishNativeRunnerMode === "function") publishNativeRunnerMode(true);
  });
} else {
  ...기존...
}
```

> 이 단계를 생략해도 화면은 뜹니다. 다만 Excel 오버레이 창이 스케줄 화면
> 위에 겹쳐 보일 수 있습니다.

---

## 설계 메모 (검토하실 때 참고)

**프런트는 본체에 의존하지 않습니다.**
`scheduler.js` 는 `state` / `$` / `pipeline` / `save-load` / `excelMirror` 등
본체 전역을 하나도 참조하지 않습니다. 노출하는 전역도 `window.AXCellScheduler`
하나뿐이고, DOM id 는 전부 `sched-` 접두사로 격리했습니다.

**외부 라이브러리를 쓰지 않습니다.**
스킬 zip 해제는 브라우저 내장 `DecompressionStream("deflate-raw")` 으로
직접 구현했습니다(`vendor/` 에 zip 라이브러리가 없어서, 그리고 의존을
늘리면 이식이 어려워지므로).

**스킬 해석 규칙은 파이썬 러너와 동일합니다.**
`tools/auto_runner/skill.py` 와 같은 규칙(v4 `requiredFiles` → `targetFileId`
→ 코드 리터럴, 유령 입력 제외)을 씁니다. 두 곳이 같은 답을 내야
"화면에서 본 문서 목록"과 "실제 실행 때 찾는 파일"이 어긋나지 않습니다.
실물 스킬로 두 구현의 결과가 일치함을 확인했습니다.

**유령 입력 처리**
현업이 여러 파일을 띄워놓고 스킬을 만들면 앱이 '활성 탭'을 `targetFileId` 로
기록합니다. 코드는 `ctx.book()` 으로 다른 파일을 여니 만들 때는 정상 동작하고
아무도 눈치채지 못합니다. 그래서 실제로는 안 쓰는 파일이 요구 목록에 남습니다.
아래 세 조건을 **모두** 만족할 때만 요구에서 제외합니다.

1. `unresolvedRefs` 에 있다 (앱이 스스로 "못 풀었다"고 기록)
2. `requiredSheets` 가 비었다 (내용에 대한 요구가 없다)
3. 어느 코드도 그 이름으로 책을 열지 않는다

2·3 덕분에 '이름만 잘못 적힌 참조'(예: 확장자 중복 `.xlsx.xlsx`)는
유령으로 오해되지 않습니다.

---

## 아직 안 되어 있는 것

**등록한 스케줄을 정해진 시각에 실행하는 부분은 없습니다.**
`cron.txt` 는 현재 기록일 뿐입니다. 실행 주체(작업 스케줄러 등록이든
상주 프로세스든)는 다음 단계이며, 이 모듈은 그때 읽을 **입력 형식**을
확정해 두는 역할입니다.

저장 위치와 형식:

```
바탕화면\ESTB\<OS계정>\<스킬명>\
    ├─ (업로드된 스킬 파일들)
    ├─ cron.txt        crontab 5필드 — 실행 주기의 유일한 근거
    ├─ config.txt      사람이 읽는 요약
    └─ schedule.json   기계용 원본(수신 방법 등 cron 이 못 담는 정보)
```

목록 카드의 버튼은 둘로 나뉩니다.

| 버튼 | 바뀌는 것 |
|---|---|
| `스킬 수정` | 폴더 안 **스킬 파일**만 (교체/추가/삭제). 메타 파일은 손대지 않음 |
| `스케줄 수정` | **`cron.txt`** 한 줄만 |

둘 다 화면을 옮기지 않고 카드 안에서 처리합니다. 스킬 파일 편집은
`cron.txt` / `config.txt` / `schedule.json` 을 보호 목록으로 두어 지우거나
덮어쓰지 못하게 막고, `schedule.json` 의 파일 목록만 실제 폴더 상태에
맞춰 갱신합니다(목록 화면이 그 값을 읽습니다).

`스케줄 수정` 은 의도적으로 **`cron.txt` 만** 다시 씁니다. 폴더명·수신 방법·
스킬 파일은 건드리지 않습니다. 이 때문에 수정 후 `config.txt` 의 요약 문장은
옛 값으로 남습니다 — 실행을 가르는 것은 `cron.txt` 한 줄이므로 동작에는
문제가 없지만, 두 파일이 달라 보일 수 있습니다. 필요하면
`b2b_scheduler.update_schedule()` 에서 `_write_schedule_files()` 를 부르도록
바꾸면 둘 다 갱신됩니다.
