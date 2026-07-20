# OKF (Open Knowledge Format) — 소스 자동 명세화

레포의 각 함수/메서드를 **입력·출력·역할·사이드이펙트·유기적 관계(calls/called_by/reads/writes)** 로
구조화한 마크다운(함수 1개 = 문서 1개)과 전체 콜그래프 인덱스(`_graph.json`)를 **코드에서 자동 추출**한다.
목적: 평가/개선 측이 grep 추정이 아니라 **사실 기반**으로 소스검토·사이드이펙트(영향)분석·버전 회귀분석을 수행.

## 산출물
- `docs/okf/<모듈>/<함수>.md` — 함수별 OKF(YAML frontmatter + 사람용 본문).
- `docs/okf/_graph.json` — 전체 노드(함수) + 엣지(calls) + reads/writes/side_effects 인덱스. 영향분석·버전 diff 용.

## 도구
| 스크립트 | 역할 |
|---|---|
| `tools/okf/okf_gen.py` | 소스 → OKF 생성기(엔진). py=`ast`(정확), js/cs=정규식(근사). |
| `tools/okf/regen.py` | 전체 재생성 드라이버. 소스 자동 수집 + 버전은 `build_exe.bat` APP_VERSION 에서 파싱. |
| `tools/okf/check_okf.py` | 최신성 게이트. 재생성본 vs 커밋본 비교. 기본 warn-only, `--strict` 로 차단. |
| `tools/okf/okf_diff.py` | 버전간 diff. 두 `_graph.json` 비교 → 추가/삭제/변경(시그니처·관계·사이드이펙트) 함수 리포트. |

### 사용
```bash
python tools/okf/regen.py                 # docs/okf 전체 재생성
python tools/okf/check_okf.py             # 코드와 어긋난 OKF 경고(warn-only)
python tools/okf/okf_diff.py A/_graph.json B/_graph.json --out diff.md   # 버전간 변경만
```

## 버전업 워크플로우
```
코드 수정 → tools/okf/regen.py 실행 → docs/okf 갱신 → 함께 커밋
릴리즈(버전 bump) → regen → 버전 태그와 함께 커밋·푸시  → OKF 가 항상 그 버전 코드와 일치
```
- **pre-commit 훅**: `tools/okf/hooks/pre-commit` 를 `.git/hooks/` 로 복사(설치법은 파일 상단 주석).
- **CI**: `.github/workflows/okf.yml` (warn-only). 순수 파싱이라 win32com/Excel 없이 어떤 러너에서도 동작.
- **게이트 승격**: 안정화 후 `check_okf.py --strict` 로 바꾸면 OKF 미갱신 시 커밋/빌드 차단.

## 추출 신뢰도 (사실 vs 추정 — 명세에 구분 표기)
- **사실(자동, 신뢰)**: signature, inputs, calls/called_by(디스패치 `excel_call(fn,…)` 포함), reads/writes, side_effects(COM/파일IO/락/전역/네트워크), raises. Python 은 `ast` 라 정확.
- **`extraction: regex`** (JS/C#): 정규식 근사. 관계·사이드이펙트는 best-effort — frontmatter 의 `extraction` 필드로 신뢰도 표시.
- **추정/수동 보완**:
  - `role`(의도): docstring/배너 주석에서 뽑되, 없으면 `"(추정)"` 표기 → 담당자가 함수 상단에 **역할 한 줄 주석**만 달면 자동 반영.
  - `affects`(이게 틀어지면 깨지는 상위 기능): 정적 추출 불가 → `[]` 로 두고 수동 보완.
  - `returns` 타입: 어노테이션 없으면 `"(추정)"`.

## 알려진 한계 / TODO
- JS/C# 는 정규식 기반이라 화살표-표현식 본문(`=> expr`)·중첩 함수 일부를 놓칠 수 있음. 필요 시 Node(acorn)/Roslyn 로 승격.
- `called_by`/`calls` 는 단순명 기준이라 동명이인(다른 클래스의 동일 메서드명)이 합쳐질 수 있음(그래프는 언어별로 분리).
- 파일명 충돌(같은 qual)은 `__L<lineno>` 접미사로 회피.
