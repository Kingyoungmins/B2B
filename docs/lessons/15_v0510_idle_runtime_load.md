# v0.5.10 idle/runtime load lesson

## 배경

현장 실행 환경은 CPU 4스레드, RAM 12GB VM이다. 개발 PC에서는 티가 덜 나도, 네이티브 WebView + Excel COM + 로컬 서버가 동시에 떠 있는 상태에서 짧은 주기 폴링이 누적되면 1시간 idle 후 PC 전체가 버벅일 수 있다.

## 확인한 위험 패턴

- 프런트 health polling이 `/api/backend/health`를 4초마다 호출했고, health 응답이 매번 Excel diagnostics/reap 경로를 건드릴 수 있었다.
- lifecycle ping이 5초마다 서버로 POST를 보냈다.
- Excel overlay hide-inactive 안전망은 호스트가 비활성인 동안 0.7초마다 `/api/excel/hide-inactive`를 호출했다.
- 숨김 Python skill Excel 인스턴스는 보호 PID로 남아 있어, Python 작업 후 장시간 idle 상태에서도 계속 살아 있을 수 있었다.
- 스킬 단계가 많이 쌓이면 자동 백업 ZIP 생성과 파이프라인 DOM 재렌더링이 UI 버벅임을 키울 수 있다.

## 0.5.10 적용 기준

- 기본 생성/실행 엔진은 VBA로 둔다. 과거 로컬 저장값에 기본값처럼 남은 `python`은 새 기본값인 `vba`로 승격한다.
- health polling은 15초, lifecycle ping은 30초, hide-inactive 안전망은 5초 이상으로 둔다.
- health의 Excel diagnostics는 캐시한다. 앱 생존 확인 요청마다 tasklist/Excel PID 검사를 반복하지 않는다.
- 부하 로깅은 endpoint 의존으로 두지 않는다. 서버 시작 시 상시 sampler thread를 띄워 30초마다 runtime 상태를 기록한다.
- 10분 cleanup은 저위험 housekeeping만 한다. 오래된 copy source, pipeline job, snapshot metadata/file, 앱 소유 orphan PID, Python-side cache/gc 정도만 정리하고 Excel workbook 내부 상태는 건드리지 않는다.
- 앱이 만든 Excel PID만 추적/정리한다. 사용자 개인 Excel 프로세스는 절대 kill 대상에 넣지 않는다.
- VBA 실패 진단처럼 보조 `DispatchEx`를 쓰는 경로도 반드시 `_track_spawned_excel_app`으로 PID를 추적한다. 진단용 Excel이 추적 밖에 있으면 reaper가 회수할 수 없는 좀비가 된다.
- Python 숨김 Excel 인스턴스는 COM STA 워커 내부에서만 idle TTL 정리를 수행한다. HTTP 스레드에서 COM 객체를 직접 Quit하지 않는다.
- CutCopyMode/클립보드 감지는 매 polling마다 하지 않는다. Ctrl+C 직후 또는 5초 throttle 기준으로만 snapshot을 뜬다.
- NativeHost의 80ms 전역 창 탐색은 작업 중에만 허용한다. idle 상태에서는 1초 수준으로 backoff해서 4스레드 VM의 메시지 펌프 압박을 줄인다.
- 런타임 부하 판단은 UI 느낌만으로 하지 말고 앱 writable 폴더의 `runtime_load_trace.jsonl`을 본다.

## 로그에서 볼 신호

- `runtime.load`: backend RSS/thread 수, 앱 추적 Excel PID, session/orphan/python-skill 분류.
- `runtime.sample`: health 호출과 무관하게 찍히는 상시 샘플. queue size, Excel lock 경합, pipeline job/snapshot 누적량을 함께 본다.
- `runtime.housekeeping`: 10분 저위험 cleanup 결과. `skippedReason`이 `pipeline-or-queue-busy` 또는 `excel-lock-busy`이면 정상적으로 미룬 것이다.
- `excel.spawned`: 앱이 `DispatchEx`로 만든 Excel PID.
- `excel.force_kill`: 앱 소유 PID 강제 종료.
- `excel.cleanup.start/end`: 종료 요청 전후 생존 PID.
- `excel.python_skill.idle_quit`: 숨김 Python skill Excel이 TTL로 종료된 시점.

## 재발 방지

- idle 버벅임 이슈에서 먼저 볼 것은 LLM이나 Excel 파일 크기가 아니라, 주기 타이머와 COM 호출 빈도다.
- "사용자가 아무것도 안 했는데 느려짐"은 백그라운드 폴링/heartbeat/숨김 유지 루프를 의심한다.
- cleanup이 필요하다고 해서 Excel 내부를 주기적으로 만지면 안 된다. `StatusBar=False`, `CutCopyMode=False`, `Workbooks` 전체 순회, `UsedRange`, `CalculateFullRebuild`, save/reopen은 사용자 작업을 깨거나 COM lock을 악화시킬 수 있다.
- 자동 cleanup은 누적 찌꺼기 제거용이고, Excel.exe 내부 메모리 자체를 확실히 비우는 기능은 아니다. 그 영역은 추후 사용자 명시 실행형 soft recycle로 분리한다.
- 폴링을 줄일 때는 기능 자체를 제거하지 말고, 즉시 반응이 필요한 이벤트는 유지하고 장주기 안전망만 늦춘다.
- Excel COM 객체 정리는 반드시 STA 워커 스레드 경계를 지킨다.
