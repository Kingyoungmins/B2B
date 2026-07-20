# 완료 이슈 재점검 도구 (issue_recheck)

패치가 누적되면서 **과거에 고친 이슈가 사이드이펙트로 다시 깨지지 않았는지** 개발 PC에서 일괄
재검사하는 외부 도구다(프로그램 내 기능 아님). 이슈별로 만들어 둔 회귀 테스트(diagnostics/,
test_runs/)를 `registry.json` 매핑으로 묶어 한 번에 돌린다.

## 사용법 (레포 루트에서)

```
python tools/issue_recheck/recheck.py              # 빠른 검사 — node/순수 python (Excel 불필요, ~2분)
python tools/issue_recheck/recheck.py --com        # 실제 Excel 을 띄우는 COM 실측까지 포함 (~5분+)
python tools/issue_recheck/recheck.py --only 한전   # id/제목 부분일치 필터
python tools/issue_recheck/recheck.py --list       # 등록된 이슈 목록만
python tools/issue_recheck/recheck.py --csv 지라.csv  # 지라 내보내기와 대조(아래 참고)
python tools/issue_recheck/recheck.py --serve      # ★ 관리 대시보드 → http://127.0.0.1:8765/
```

## 관리 대시보드 (--serve)

`--serve` 로 로컬 서버를 띄우면 브라우저에서 전부 관리할 수 있다(dashboard.html):

- 이슈 목록 + 마지막 실행 결과 배지, 이슈별 [실행] 버튼
- ▶ 전체 재점검(진행률 실시간), COM 실측 포함 체크박스, 필터
- 실행 이력(시각·모드·통과/실패 — results_history.jsonl, git 미추적)
- 지라 CSV 붙여넣기 대조(완료됐는데 자동화 없는 이슈 목록)
- 레지스트리 편집(이슈 추가/삭제/체크 수정 → 저장 시 registry.json.bak 백업)

- 결과는 이슈 단위 ✅/❌ 스코어보드 + 실패 체크의 출력 꼬리. 실패가 있으면 종료코드 1.
- 권장 시점: 고객 배포 빌드 직전, 큰 수정 묶음 머지 후.

## 운영 규칙 (중요)

**이슈를 고칠 때마다** ① 회귀 테스트를 diagnostics/(프런트 로직) 또는 test_runs/(백엔드/COM)에
만들고 ② `registry.json` 의 `issues` 에 등록한다. 등록 형식:

```json
{ "id": "SBAGENT-000 또는 슬러그",
  "title": "증상 한 줄",
  "checks": [["node|python|com", "레포 상대경로"]] }
```

- `node`: diagnostics/*.js — 실제 소스에서 함수를 추출해 구동(가장 싸고 빠름)
- `python`: Excel 없이 도는 순수 파이썬(serve_b2b 함수 단위)
- `com`: 실제 Excel 을 띄우는 실측 — 반드시 종료 시 `_force_kill_pid` 로 프로세스 정리(좀비 방지)

## 지라 완료 이슈와 대조 (--csv)

지라 목록에서 CSV 를 내보내 커버리지 구멍(완료됐는데 자동화 없는 이슈)을 찾는다:

1. 이슈 목록: https://lgucorp.atlassian.net/jira/software/projects/SBAGENT/list
   (JQL: `project = SBAGENT ORDER BY cf[10019] ASC`)
2. 우상단 내보내기 → **CSV(현재 필드)** 로 저장
3. `python tools/issue_recheck/recheck.py --csv 받은파일.csv`
   → "완료됐지만 회귀 자동화가 없는 이슈" 목록이 나온다 → 수동 재점검하거나 테스트를 추가해 등록

### 사내망 지라 로그인 메모

사내망에서 로그인이 막히면: 브라우저 F12 → 우상단 ⋮ → More tools → **Network conditions** →
User agent 의 "Use browser default" 해제 → **Chrome — iPhone** 선택 → 그 상태로 로그인.
(모바일 UA 로만 SSO 가 통과하는 사내 프록시 특성. 로그인 후에는 UA 를 되돌려도 세션 유지.)

## 현재 커버리지

`--list` 로 확인. 2026-07-20 기준 20개 이슈 / 28개 체크(비COM 24 + COM 4) 등록.
COM 실측 4건: 시트명 31자(rename), 무변경 게이트, 최소화 창 은닉, 네이티브 피벗.
