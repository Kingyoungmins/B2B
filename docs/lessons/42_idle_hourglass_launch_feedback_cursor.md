# 42. 유휴 상태 모래시계 깜빡임 — 숨김 subprocess 의 '앱 시작' 피드백 커서

## 증상 (0.6.0 에서 보고, 실제로는 0.5.x 부터 존재)

프로그램을 가만히 켜 두기만 해도 마우스 커서가 주기적으로 '작업 중'(모래시계/빙글이)으로
바뀌었다가 풀리기를 반복한다. 파일을 하나도 안 열어도 발생. 네이티브 셸 실행에서만 발생.

## 원인 — 두 겹

1. **1초마다 tasklist.exe 를 새로 띄움**: `_runtime_maintenance_loop`(1초 주기)가
   `_native_parent_watch_once` → `_is_pid_alive(NATIVE_HOST_PID)` 를 부르는데, 이 함수가
   생존 확인을 `subprocess.run(["tasklist", "/FI", "PID eq N"])` 로 구현. 네이티브 셸이
   `B2B_NATIVE_HOST_PID` 를 넘길 때만 도는 경로라 브라우저 모드에서는 재현 안 됨.
   (보조: 30초 샘플러/60초 health 진단/10분 하우스키핑도 추적 Excel PID 당 tasklist,
   reap 시 taskkill 을 띄움.)
2. **`hidden_subprocess_kwargs()` 가 창만 숨기고 커서는 못 숨김**: `STARTF_USESHOWWINDOW`
   + `CREATE_NO_WINDOW` 는 콘솔 **창**만 없앤다. Windows 는 CreateProcess 기본 동작으로
   새 프로세스가 뜨는 동안 '앱 시작 중' 피드백 커서를 보여 주므로, 숨김 spawn 마다 커서가
   잠깐 돌았다 풀렸다 반복.

## 수정 (serve_b2b.py)

1. `hidden_subprocess_kwargs()` 에 `STARTF_FORCEOFFFEEDBACK`(0x80) 추가 — 모든 숨김
   spawn(tasklist/taskkill/node 워커/VBA 러너)에서 시작 피드백 커서 차단.
   `subprocess.STARTF_FORCEOFFFEEDBACK` 상수는 **Python 3.13+** 에만 있어
   `getattr(subprocess, "STARTF_FORCEOFFFEEDBACK", 0x00000080)` 로 하위 호환.
2. `_is_pid_alive` 를 프로세스 생성 없는 확인으로 교체: psutil.pid_exists →
   ctypes OpenProcess(QUERY_LIMITED_INFORMATION)+GetExitCodeProcess(STILL_ACTIVE=259) →
   tasklist 는 최후 폴백만. OpenProcess 실패 시 ERROR_ACCESS_DENIED(5)=존재로 판정,
   그 외는 단정하지 않고 폴백으로 확정(부모 감시가 오탐하면 서버가 자살하는 경로라 보수적으로).

## 함정 메모

- **Windows 에서 `os.kill(pid, 0)` 은 생존 확인이 아니라 TerminateProcess** — 대상 프로세스가
  즉사한다. 절대 쓰지 말 것.
- 이 파일의 부모 감시는 판정 실패 방향에 따라 결과가 극단적: false-dead → 서버 자기 종료
  (os._exit), false-alive → 고아 서버/Excel 잔존. 판정 로직 변경 시 양방향 모두 확인.
- 검증 방법: `python -c` 로 `hidden_subprocess_kwargs()['startupinfo'].dwFlags & 0x80`,
  `_is_pid_alive(os.getpid())`(True)/`_is_pid_alive(4000000)`(False) 확인.
