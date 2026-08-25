# SkillRunner MCP — b2b 스킬 실행기 (ixi-flow 빌트인 통합)

b2b 로 저장한 스킬(zip)을 **b2b 프로그램/서버 없이** Excel COM 으로 직접 실행하는
도구를 ixi-flow 에 **빌트인 MCP**(stdio JSON-RPC, L1+L2+L3)로 제공한다.

참조 계약: `ixi-FLOW/docs/maintainers/builtin-mcp-integration-guide.ko.md`

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
      step, total_steps, step_label, cursor, events[],
      완료시: out_dir, files[], out_zip? / 실패시: error}
```
이벤트 테일: `events[].cursor` 를 다음 호출 `after_cursor` 로 이어받기(§3.4 계약).

### run_stop  (L2 end_tool)
```
in : {run_id}   out: {ok, run_id, status:"cancelled"}
```
스텝 경계 취소 + 격리 Excel 프로세스 taskkill(긴 VBA 스텝 중간에도 정지).

### package_outputs
```
in : {out_dir, zip_path, expect_files?[]}
out: {ok, zip_path, files[], total_bytes} | {ok:false, problems[]}
```
검증(파일 존재/0바이트/기대목록) 실패 시 zip 을 만들지 않는다.

## 디렉토리

```
tools/skillrunner_mcp/
├── skillrunner/
│   ├── runner_core.py   # check/run/package 핵심 (serve_b2b 엔진·매핑 재사용)
│   ├── mcp_server.py    # stdio JSON-RPC MCP 서버 (외부 의존성 0)
│   └── engine/          # (번들 빌드 시) serve_b2b.py 가 여기로 복사됨
├── ixi-flow/
│   ├── manifest.toml    # L3 매니페스트 (mcp_servers + background_runs + skills)
│   └── install.ps1      # 설치 훅 (멱등·검증만·네트워크 없음)
├── skills/skillrunner-guide/SKILL.md   # 에이전트용 절차 스킬 (검사→실행→압축)
├── build_bundle.ps1     # Windows 번들 빌드 → dist/skillrunner-deploy-<ver>-win64.tar.gz
├── test_core.py         # self-check (Excel 불필요)
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

## 설치 (배포 PC, 폐쇄망 OK)

```
ixi-flow integrations install skillrunner --bundle skillrunner-deploy-0.1.0-win64.tar.gz
```
설치되면 도구는 `skillrunner__check_inputs` 등으로 노출되고, `skillrunner-guide`
스킬이 배포되어 에이전트가 절차(검사→실행→압축)를 안다. run_start 는 ixi-flow 의
런 레지스트리/bg_wait/체크리스트 진행표시("Step 4/32")에 자동 편입된다(L2 선언).

## 실행 PC 요구사항

- Windows + **Microsoft Excel** (스킬이 Excel COM 위에서 동작 — 유일한 외부 요구)
- VBA 스텝이 있는 스킬: Excel 매크로 설정 "VBA 프로젝트 개체 모델에 대한 액세스 신뢰" ON
- Python/b2b 설치 불필요 (번들에 self-contained 포함)

## 검증 현황

- `python3 test_core.py` → **5개 통과** (Mac에서): 스킬 로드/핸들복원, 자동 매핑
  (실제 serve_b2b 로직으로), unmatched 검출, 출력 검증/압축(성공·실패 경로),
  **MCP 프로토콜 + 런 생명주기**(run_start→실패 경로→run_report 상태 보고, 서브프로세스 실측).
- **미검증**: 실제 Excel COM 스텝 실행, 번들 빌드, ixi-flow 설치 — 전부 Windows 에서
  확인 필요 (가이드 §8 수용 테스트 체크리스트 참고).
