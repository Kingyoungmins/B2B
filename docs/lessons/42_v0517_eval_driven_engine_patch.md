# 42. eval 리포트 기반 엔진 패치 — 무엇을 반영/보류했나 (v0.5.17)

## 입력
- `eval_report_0.5.16_*.md` + `engine_improvement_0.5.16_*.md` (채점기=claude-opus-4-8, 실행모델=qwen3.6/실서버 환경).
- 0.5.16 전체 성공률 48.5%(33/68). VBA 37% vs python-COM 68%. 값 보존율 99.1%인데 성공률 48.5% →
  **"내용은 맞는데 엉뚱한 곳에 적용/미적용"**이 주범(대상 시트 오인·병합 1004·헤더 비1행).
- 주의: 리포트는 완벽하지 않음. 우리가 이미 깊게 고친 건(정규식 catastrophic backtracking 다운 = lesson 40)이나
  자체 검증 완료 항목은 우리가 맞으니 패스.

## 핵심 판단: 프롬프트는 이미 대부분 갖춰져 있다
리포트가 권고한 규칙 대부분이 **0.5.16 VBA 프롬프트(`scripts/file-schema.js`)에 이미 존재**한다 →
실패는 "프롬프트 부재"가 아니라 **qwen3.6 미준수**가 큰 비중. (그래서 규칙을 더 쌓는 것은 한계가 있고,
명확한 *공백*만 보강 + 결정론적 처리를 선호.)
- 대상 시트 명시 바인딩(ActiveSheet 금지·For Each 이름매칭·미발견 Err.Raise): 이미 있음(파일스키마 "작업 대상 결정").
- 헤더 비1행 가정 금지 + [열문자=헤더명] 스키마 주입: 이미 있음.
- 값/수식 의도(.Value2 / .Formula) + **값 복사 전 `ws.Calculate`(manual 대비 stale 방지)**: 이미 있음.
- 병합 범위 `rng.Value=arr` 금지: 이미 있음.

## 반영(패치)
- **병합셀 위 '구조 작업'(열 이동/맞바꿈·Cut·ClearContents) 1004 안전패턴**을 VBA 프롬프트에 추가
  (`file-schema.js`, 기존 병합 `rng.Value=arr` 규칙 바로 뒤):
  - 비우기는 MergeArea 단위(`If c.MergeCells Then c.MergeArea.ClearContents Else c.ClearContents`).
  - 이동/맞바꿈은 `MergeArea.UnMerge → 값+서식 교환 → 재병합` 3단계.
  - **1004 를 `On Error Resume Next`/`Err.Clear` 로 삼키지 말 것**(삼키면 변경0인데 '적용됨'으로 보임) → 못 하면 `Err.Raise`.
  - 근거 caseId: `rearrange_keep_data`, `reorder_billing_columns`, `replace_deleted_logic`, `sb_delete_rows_cond`(1004 군집 4건).
  - 이게 유일하게 '명확한 공백'이었음(다른 권고는 이미 프롬프트에 있음).

## 보류(이번 패치 제외) — 이유
- **라우팅 변경(단순 값쓰기 VBA→python)**: 회귀 위험 큼(검증된 라우팅 체계 + "현재 시트만" 의도 오이관 위험).
  리포트 자체도 §5에서 false-positive 경고. 별도 A/B 재채점 없이 손대지 않음.
- **정적 게이트 신설(ActiveSheet/ActiveWorkbook 거부)**: false-positive 로 정당한 활성시트 코드까지 막을 위험.
  프롬프트 steering 으로 충분(이미 있음). 하드 게이트는 비용 대비 위험 높음.
- **결정론적 사전추출(병합맵/시트스키마 프롬프트 주입)**: 헤더 스키마는 이미 주입 중. 병합맵 주입은 시트별
  MergeArea COM 스캔 비용(저사양·폐쇄망에서 COM 최소화 원칙과 충돌, 리포트 §4 자기모순) → 보류. 효과 측정 후 검토.
- **자기검증 재생성(changed=0/1004 시 1회 재생성)**: 추론 1회 추가·비결정성↑. 폐쇄망/저사양 기본 OFF 전제라
  지금 도입 안 함. 필요시 환경플래그로 옵션화 검토.

## 한계 / 후속
- qwen3.6 미준수가 병목이면 프롬프트 보강 효과는 점증적. 다음 eval 에서 1004 군집 재채점으로 본 패치 효과를
  측정하고, 효과가 작으면 병합맵 결정론적 주입(비용 감수)을 다음 후보로.
- 회귀 점검 권장 caseId(통과 유지 확인): `merged_cell_block__unmerge_title`, `single_sheet_scope__current_sheet_only`,
  `rh_join`(병합/현재시트/조인이 멀쩡한지).
