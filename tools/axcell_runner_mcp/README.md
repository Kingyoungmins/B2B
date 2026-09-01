# AXCell Runner MCP — b2b 스킬 실행기 (ixi-flow 빌트인 통합)

b2b 로 저장한 스킬(zip)을 **b2b 프로그램/서버 없이** Excel COM 으로 직접 실행하는
도구를 ixi-flow 에 **빌트인 MCP**(stdio JSON-RPC, L1+L2+L3)로 제공한다.

참조 계약: `ixi-FLOW/docs/maintainers/builtin-mcp-integration-guide.ko.md`

> 현재 버전 **0.2.0** — ver0.8.2 브랜치에 병합되며 코드리뷰(12건) 반영 + **0.8.2 엔진** 기준으로
> 재검증했다(실제 Excel 종단 실행 포함). 상세는 아래 '0.8.2 병합에서 바뀐 것' 절.

## 제공 기능 (요구 3종 → MCP 도구 5개)

| 요구 | 도구 | 방식 |
|---|---|---|
| 1. 스킬 기반 입력 파일 검사 (자동 매핑) | `check_inputs` | 동기, 수 초 |
| 2. 스킬 실행 | `run_start` / `run_report` / `run_stop` | **L2 background_runs** (수 분, bg_wait·하네스 폴러 자동 편입) |
| 3. 출력 정상 확인 후 압축 | `package_outputs` (+ `run_start`의 `make_zip` 자동 압축) | 동기 |

자동 매핑은 새로 만들지 않고 **serve_b2b.py 의 기 개발 로직을 재사용**한다:
`_workbook_name_lookup_keys`(표기차 흡수) → `_match_workbook_by_stable_key`
(월/날짜/버전/순번/복사본 접미사 무시 안정키, 키 4자 미만은 오매칭 방지로 거부).
실행 엔진도 동일하게 재사용: `_exec_python_com_skill`(Python-COM ctx),
`_inject_and_run_vba`(VBA), `is_*_pipeline_step`. serve_b2b 는 `__main__` 가드가
있어 import 해도 HTTP 서버가 뜨지 않는다.

## 도구 명세 (JSON in/out)

### check_inputs
```
in : {skill_zip, input_dir}
out: {ok, skill, total_steps, languages, required[], mapping{요구명:실제경로},
      unmatched[], extra_files[], input_dir}
```
`unmatched` 가 비어야 실행 가능. `extra_files` 는 스킬이 안 쓰는 여분(무해).

### run_start  (L2 start_tool)
```
in : {skill_zip, input_dir, out_dir?, make_zip?=true, zip_path?}
out: {ok, run_id, status:"running", skill, total_steps, out_dir, zip_path}
```
- 시작 전에 check_inputs 를 내부 수행 — 매핑 실패면 즉시 `{ok:false, unmatched}`.
- 동시 1런만 허용(저사양 Excel 보호). 원본 입력은 절대 수정 안 함(출력폴더 작업사본).
- `make_zip:true` 면 완료 시 출력 검증(package_outputs) 후 zip 자동 생성.

### run_report  (L2 status_tool — 항상 즉시 스냅샷, 롱폴 없음)
```
in : {run_id, after_cursor?, max_events?, include_events?, max_wait_seconds?(무시)}
out: {ok, run_id, status: running|completed|failed|cancelled,
      step, total_steps, step_label, cursor,
      events: {items:[{seq:int, type, summary, ...}], next_cursor:str},
      완료시: out_dir, files[], out_zip? / 실패시: error}
```
이벤트 테일: `events.next_cursor` 를 다음 호출 `after_cursor` 로 이어받기
(ixi-flow event_batch 계약 — 숫자 `seq` 없는 이벤트는 하네스가 버린다).

### run_stop  (L2 end_tool)
```
in : {run_id}   out: {ok, run_id, status:"cancelled"}
```
스텝 경계 취소 + 격리 Excel 프로세스 taskkill(긴 VBA 스텝 중간에도 정지).
시작 직후처럼 Excel pid 가 아직 기록되지 않은 순간이면 최대 3초 기다렸다 죽인다.
중간에 죽여서 COM 예외로 끝난 런도 상태는 "failed" 가 아니라 "cancelled" 로 보고된다.

### package_outputs
```
in : {out_dir, zip_path, expect_files?[]}
out: {ok, zip_path, files[], total_bytes} | {ok:false, problems[]}
```
검증(파일 존재/0바이트/기대목록) 실패 시 zip 을 만들지 않는다.

## 디렉토리

```
tools/axcell_runner_mcp/
├── axcell_runner/
│   ├── runner_core.py   # check/run/package 핵심 (serve_b2b 엔진·매핑 재사용)
│   ├── mcp_server.py    # stdio JSON-RPC MCP 서버 (외부 의존성 0)
│   └── engine/          # (번들 빌드 시) serve_b2b.py 가 여기로 복사됨
├── ixi-flow/
│   ├── manifest.toml    # L3 매니페스트 (mcp_servers + background_runs + skills)
│   └── install.ps1      # 설치 훅 (멱등·검증만·네트워크 없음)
├── skills/axcell-runner-guide/SKILL.md   # 에이전트용 절차 스킬 (검사→실행→압축)
├── build_bundle.ps1     # Windows 번들 빌드 → dist/axcell_runner-deploy-<ver>-win64.tar.gz
├── install_manual.ps1   # 수동 설치기 (ixi-flow 범용 설치기가 생길 때까지)
├── dist/axcell_runner-deploy-0.2.0-win64.tar.gz   # 미리 빌드된 번들(0.8.2 엔진 내장)
├── test_core.py         # self-check (Excel 불필요 — 프로토콜/매핑/이벤트 계약)
├── test_run_com.py      # 실제 Excel COM 종단 실행 검증 (Windows 전용)
└── README.md
```

## 빌드 (Windows)

```powershell
# 1) self-contained Python 준비 (예: python-build-standalone *-install_only 압축 해제)
# 2) 빌드 — 온라인 PC:
.\build_bundle.ps1 -PythonDist C:\dl\cpython-3.11-win64
#    폐쇄망용 휠 미리 준비 시:
.\build_bundle.ps1 -PythonDist C:\dl\cpython-3.11-win64 -Wheels C:\dl\wheels
```
빌드가 BOM 검사 + 런타임 self-check(pywin32/엔진 로드)까지 수행한다.

## 미리 빌드된 번들 (저장소에 포함)

빌드 PC 가 없어도 되도록 Windows(x64)에서 빌드한 번들을 함께 넣어 둔다.

```
tools/axcell_runner_mcp/dist/axcell_runner-deploy-0.2.0-win64.tar.gz
```

번들에는 self-contained Python(+ pywin32 + openpyxl)과 **0.8.2 엔진**(serve_b2b.py)이
들어 있어 배포 PC 에 Python/b2b 설치가 필요 없다. 소스나 엔진을 고쳤으면
`build_bundle.ps1` 로 다시 만들어 이 파일을 교체한다(`dist/` 는 .gitignore 예외로
tar.gz 만 추적한다). 구 0.1.0 번들(0.8.0 엔진·리뷰 반영 전)은 제거했다.

## 설치 (배포 PC, 폐쇄망 OK)

> ⚠️ 현재 ixi-flow 의 `integrations install` 은 **gca 전용**(`src/integrations/mod.rs`
> 하드코딩)이라 `install axcell_runner` 는 "does not bundle an installer" 로 거부된다.
> 범용 설치기가 생길 때까지 **수동 설치기**를 쓴다 — gca 설치기와 동일하게
> config 관리 블록(마커) 렌더링 + workspace/skills 배포 + self-check 를 수행하고 멱등이다.

```powershell
.\install_manual.ps1 -Bundle .\dist\axcell_runner-deploy-0.2.0-win64.tar.gz
# 기본 설치 위치: %USERPROFILE%\.ixi-flow\integrations\axcell_runner
# config: %USERPROFILE%\.ixi-flow\config.toml 에 관리 블록 추가(기존 블록은 교체, 백업 생성)
```

설치 후 ixi-flow 를 재시작하면 도구가 `axcell_runner__check_inputs` 등으로 노출되고,
`axcell-runner-guide` 스킬이 배포되어 에이전트가 절차(검사→실행→압축)를 안다.
run_start 는 ixi-flow 의 런 레지스트리/bg_wait/체크리스트 진행표시("Step 4/32")에
자동 편입된다(L2 선언).

(ixi-flow 에 범용 매니페스트 설치기가 구현되면 아래 원커맨드로 대체:
`ixi-flow integrations install axcell_runner --bundle ...`)

## 실행 PC 요구사항

- Windows + **Microsoft Excel** (스킬이 Excel COM 위에서 동작 — 유일한 외부 요구)
- VBA 스텝이 있는 스킬: Excel 매크로 설정 "VBA 프로젝트 개체 모델에 대한 액세스 신뢰" ON
- Python/b2b 설치 불필요 (번들에 self-contained 포함)

## 0.8.2 병합에서 바뀐 것 (코드리뷰 반영 — 2026-09-01)

실행 결과에 영향 있는 것 위주. 도구 구성/MCP 계약/매핑 로직은 그대로다.

- **매크로 보안**: AutomationSecurity 를 ForceDisable(3)이 아니라 **Low(1)** 로 열고
  Auto_Open 류는 `EnableEvents=False` 로 막는다. 3으로 '열면' 일부 Office 빌드에서 그
  인스턴스의 매크로가 영구 비활성화되어 VBA 스텝이 전부 실패한다(엔진이 이미 밟았던 지뢰).
- **파일 열기**: 맨 `Workbooks.Open` 대신 엔진 `excel_workbooks_open` — 형식 위장 파일
  (.xls 인데 HTML/CSV) 변환, UpdateLinks/CorruptLoad 재시도, 원본명 별칭 등록 재사용.
- **코드 정규화**: 실행 전 `normalize_python_pipeline_code` + stepFile 은 utf-8-sig 로 읽음.
  (판별은 정규화하면서 실행은 원문 컴파일하던 불일치 — 앱에선 돌던 zip 이 러너에서만 죽었다)
- **스텝 간 강제 재계산**: 수동계산으로 저장된 워크북의 미계산 값이 다음 스텝에 읽히는
  무성 오답 방지(엔진 격리 전체실행과 같은 규칙). 열 때 Calculation 도 자동으로 강제.
- **엔진 atexit 해제**: serve_b2b import 가 걸어 두는 종료 훅을 해제 — 러너 종료가 같은 PC
  의 진짜 B2B 앱 스냅샷(%TEMP% 공유 경로)을 지우고 20초 행 걸리던 것.
- **출력 파일명**: 실행 중엔 스킬이 기억하는 이름(코드 리터럴 해석용)으로 열되, 저장 후
  **사용자가 준 입력 이름으로 복원**(4월 스킬 + 5월 파일 → 결과도 5월 이름. 실행기 앱과 동일).
- **읽기전용 방어**: copy2 가 복사한 읽기전용 속성 해제(저장 무성 실패/재실행 PermissionError 방지).
- **매핑 유일성**: 표기차 매칭 후보가 2개 이상이면 unmatched 로 알림(엔진 규칙).
  `output:N` 대상 스텝은 role=output 파일이 유일할 때 그 파일로 바인딩.
- **MCP 서버 안정성**: dict 아닌 JSON-RPC 입력(배치/스칼라)에 서버가 죽지 않음.
- **설치/빌드 스크립트**: PS 5.1 함정 수정 — `-notmatch` 배열 필터 오판(성공을 실패로),
  EAP=Stop + 네이티브 stderr 의 NativeCommandError(pip 포함), BOM 스캔 범위
  (파이썬 표준 라이브러리·BOM 유지 파일인 engine/serve_b2b.py 는 제외).

## 검증 현황

- `python test_core.py` → **6개 통과**: 스킬 로드/핸들복원, 자동 매핑(실제 serve_b2b
  로직), unmatched 검출, 출력 검증/압축, MCP 프로토콜 + 런 생명주기(+비정상 입력 생존),
  **이벤트 seq/summary/커서 계약**(가짜 run 서버로 플랫폼 무관 결정적 검증).
- `python test_run_com.py` (Windows+Excel) → **실제 Excel COM 종단 실행 통과**:
  python+VBA+교차파일 스텝, 다른 달 파일명 자동 매핑, 원본 무수정, 이벤트 순서,
  출력 파일명 복원, package_outputs. 0.8.2 엔진 기준.
- 번들 빌드(`build_bundle.ps1`) Windows 실측 통과(BOM/self-check 포함) → 0.2.0.
- **미검증**: 실제 ixi-flow 에 설치·하네스 편입 — 배포 환경에서 확인 필요
  (가이드 §8 수용 테스트 체크리스트 참고).
