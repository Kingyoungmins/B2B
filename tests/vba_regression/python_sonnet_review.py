#!/usr/bin/env python3
"""Anthropic Sonnet review layer for generated B2B **Python** (openpyxl) skills.

`vba_sonnet_review` 의 openpyxl 짝. 정적 체크 다음 2차 검수로, Sonnet 이 생성된
`def transform(ctx):` 가 **openpyxl 인프로세스 엔진으로 실행됐을 때** 의도대로 동작할지
판정한다. 전송 계층(`_post_messages`/SSL/재시도 없음·구조화출력)은 VBA 모듈에서 그대로
재사용하므로 **VBA 검수 모듈은 변경하지 않는다**(회귀 0).

추가로(사용자 요청) Sonnet 이 **코드 자체를 검수**해서:
  - `suggested_code`  — openpyxl 로 더 정확/안전/견고하게 짰을 transform(ctx)
  - `openpyxl_capabilities` — 이 코드가 openpyxl 로 더 잘 할 수 있었던 것(능력/패턴)
  - `prompt_control_suggestions` — Qwen 을 그 방향으로 유도할 SYSTEM_PROMPT 추가 문구
  - `qwen_failure_pattern` — 전형적 실패 유형 한 줄(종합 집계 그룹 키)
를 함께 산출한다. 종합 평가(build_summary)는 이를 모아 "프롬프트에 추가하면 좋을
규칙 TOP N" 을 만든다 → 0.4.8 프롬프트 개선의 직접 재료.

개발/품질평가 전용(exe 패키징 대상 아님).
"""

from __future__ import annotations

import json
import urllib.error
from typing import Any

# 전송/엔드포인트/키/모델은 VBA 검수 모듈에서 그대로 재사용(중복 0, VBA 모듈 불변).
from vba_sonnet_review import (  # noqa: F401
    ANTHROPIC_VERSION,
    DEFAULT_ANTHROPIC_API_KEY,
    DEFAULT_ANTHROPIC_BASE_URL,
    DEFAULT_SONNET_MODEL,
    _messages_url,
    _post_messages,
    _ssl_context,
)


# VBA 의 VERDICT_SCHEMA 와 **공통 키는 동일**(compare_versions 호환) + Python 전용 강화 필드.
# com_will_run 키 이름은 유지하되 의미는 'openpyxl 인프로세스 실행 가능 여부'로 본다
# (집계/리포트 코드가 키 이름에 의존하므로 이름을 바꾸지 않는다).
VERDICT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["PASS", "RISK", "FAIL"],
            "description": "PASS=의도대로 안전 동작 예상, RISK=동작하나 주의/부분위험, FAIL=의도와 다르거나 런타임 실패 예상",
        },
        "com_will_run": {
            "type": "boolean",
            "description": "openpyxl 인프로세스 엔진(exec → transform(ctx))에서 예외 없이 끝까지 실행될 것으로 보이는가",
        },
        "intent_match": {
            "type": "boolean",
            "description": "사용자 요청 의도(숨김vs삭제, 대상 시트/셀/범위 한정, 수식/값 구분 등)와 코드 동작이 일치하는가",
        },
        "scope_correct": {
            "type": "boolean",
            "description": "대상 범위가 요청대로 한정되었는가(특정 시트만, 지정 셀만 등 - 과확장 없음)",
        },
        "preserves_formulas_formats": {
            "type": "boolean",
            "description": "수식 보존이 요구되는 경우 출력 워크북에서 수식 문자열이 그대로 유지되는가(해당 없으면 true)",
        },
        "simulated_cells": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "cell": {"type": "string", "description": "셀 주소(예: 회사별요약!B4 또는 B4)"},
                    "becomes": {"type": "string", "description": "transform(ctx) 를 openpyxl 로 실행한 뒤 그 셀이 갖게 될 값 또는 수식 문자열(예: '31139', '=B4-C4', '(변경 없음)')"},
                },
                "required": ["cell", "becomes"],
            },
            "description": "이 코드를 openpyxl 인프로세스 엔진으로 실행했다고 가정했을 때 영향을 받는 주요 셀들이 실제로 갖게 될 값/수식. **중요: openpyxl 은 수식을 재계산하지 않으므로, 보존된 수식 셀은 계산 숫자가 아니라 수식 문자열('=B4-C4')로 적을 것.** 값으로 덮였으면 그 값으로.",
        },
        "output_matches_expected": {
            "type": ["boolean", "null"],
            "description": "기대 결과(expected)가 주어진 경우, 위 시뮬레이션 결과가 expected 와 일치하는가. 없으면 null.",
        },
        "suggested_code": {
            "type": "string",
            "description": "같은 사용자 의도를 openpyxl 로 더 안전·정확히 달성하도록 당신(Sonnet)이라면 작성했을 개선 transform(ctx). 이미 충분히 좋으면 빈 문자열. ```python 펜스 없이 코드 본문만.",
        },
        "suggested_rationale": {
            "type": "string",
            "description": "suggested_code 가 왜 더 안전/정확한지(또는 왜 개선 불필요한지) 1~3문장 한국어. 없으면 빈 문자열.",
        },
        "openpyxl_capabilities": {
            "type": "array",
            "items": {"type": "string"},
            "description": "이 코드가 openpyxl 로 '더 잘 할 수 있었던 것' 목록(능력/패턴 제시). 예: '병합은 merge_cells/unmerge_cells 로 안전 처리', '수식 결과가 필요하면 openpyxl 재계산 불가이므로 Python 에서 직접 합산해 값 기입', '숨김은 column_dimensions[..].hidden 로 데이터 보존', '대량 쓰기는 행 리스트 → ctx.write_grid 1회'. 없으면 빈 배열.",
        },
        "prompt_control_suggestions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Qwen 이 이렇게(잘못/비효율로) 짰으니, SYSTEM_PROMPT/PYTHON_EXCEL_SKILL_RULE 에 넣으면 다음부터 더 잘 유도될 **구체 프롬프트 규칙 문장**(한국어, 바로 붙여넣을 수 있는 형태). 예: '복사/붙여넣기 요청에 src.Copy(dest) 를 쓰지 말 것 — openpyxl 엔진엔 없음. 원본 .value 를 읽어 대상에 대입하라.' 개선 불필요하면 빈 배열.",
        },
        "qwen_failure_pattern": {
            "type": "string",
            "description": "이 생성물이 보인 전형적 실패/비효율 유형 한 줄 태그(집계 그룹 키). 예: '수식 셀을 값으로 덮어씀', 'COM 전용 .Copy(dest) 사용', '전체 시트 순회', '없는 시트 참조'. 문제 없으면 '없음'.",
        },
        "risks": {
            "type": "array",
            "items": {"type": "string"},
            "description": "openpyxl 인프로세스 실행 시 발생 가능한 구체적 위험/오작동(한국어)",
        },
        "required_fixes": {
            "type": "array",
            "items": {"type": "string"},
            "description": "FAIL/RISK 라면 의도를 만족시키기 위한 구체적 수정 지시(한국어). PASS 면 빈 배열",
        },
        "rationale": {
            "type": "string",
            "description": "판정 근거를 2~4문장 한국어로",
        },
    },
    "required": [
        "verdict",
        "com_will_run",
        "intent_match",
        "scope_correct",
        "preserves_formulas_formats",
        "simulated_cells",
        "output_matches_expected",
        "suggested_code",
        "suggested_rationale",
        "openpyxl_capabilities",
        "prompt_control_suggestions",
        "qwen_failure_pattern",
        "risks",
        "required_fixes",
        "rationale",
    ],
}


SUMMARY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "overall": {
            "type": "string",
            "enum": ["PASS", "RISK", "FAIL"],
            "description": "체크리스트 전체에 대한 최종 종합 판정",
        },
        "markdown": {
            "type": "string",
            "description": "한국어 종합 평가 리포트(마크다운). '## Sonnet 종합 평가' 아래에 들어갈 본문만.",
        },
        "prompt_control_top": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "rule": {"type": "string", "description": "SYSTEM_PROMPT/PYTHON_EXCEL_SKILL_RULE 에 추가하면 좋을 규칙 문장(한국어, 바로 붙여넣기 가능)"},
                    "addresses": {"type": "string", "description": "이 규칙이 잡아주는 실패 패턴(qwen_failure_pattern 들)"},
                    "frequency": {"type": "integer", "description": "이 패턴이 관찰된 대략 케이스 수(빈도)"},
                },
                "required": ["rule", "addresses", "frequency"],
            },
            "description": "전 케이스의 prompt_control_suggestions/qwen_failure_pattern 을 빈도·영향도 순으로 합친 '프롬프트에 추가하면 좋을 규칙 TOP N'. 그대로 0.4.8 프롬프트 개선에 반영 가능.",
        },
    },
    "required": ["overall", "markdown", "prompt_control_top"],
}


REVIEW_SYSTEM_PROMPT = """당신은 Python + openpyxl 로 Excel 워크북을 자동화하는 코드에 정통한 시니어 코드 검수자입니다.
검수 대상은 어떤 LLM(Qwen)이 사용자 요청에 따라 생성한 Python 스킬 `def transform(ctx):` 입니다.

**실행 전제(반드시 이 전제로 시뮬레이션할 것):**
이 코드는 **순수 Python(openpyxl) 엔진** 에서 **COM/Excel 없이 인프로세스로** 실행됩니다(`exec(code)` 후 `transform(ctx)` 호출). ctx 는 COM 풍 API(`ctx.sheet`, `ctx.input`, `ctx.rows`, `ctx.col`, `ws.Range("B4").Value`, `ws.Cells(r,c).Value`)를 openpyxl 위에 얹은 shim 입니다. 즉 당신은 추상적으로 코드를 읽는 게 아니라, **이 코드를 openpyxl 로 실제 실행했을 때 각 대상 셀이 어떤 값/수식이 되는지를 시뮬레이션**해야 합니다.

**openpyxl 엔진의 결정적 특성(이걸 기준으로 판정):**
- openpyxl 은 **수식을 재계산하지 않는다.** 출력 워크북은 수식을 보존(`=B4-C4` 문자열 그대로)하지만, 그 셀을 코드 안에서 다시 읽으면 계산값이 아니라 수식 문자열이 나온다. **그러므로 "합계/마진 결과 값"이 필요하면 Python 에서 직접 계산해 셀에 써야 한다.** 수식 셀을 그대로 두면 Excel 에서 열 때 재계산된다.
- 입력 파일(input_*)은 `data_only=True` 로 열려 **저장된 계산값**을 돌려준다(읽기 전용).
- **COM 전용 API 는 openpyxl 에서 동작하지 않는다 → 쓰면 런타임 오류/무효:** `src.Copy(dest)`, `range.PasteSpecial`, `AutoFilter`, `Range.End`, `Range.Offset`, `Worksheet.Copy`, `Columns(i).Insert()`/`EntireColumn.Insert`/`EntireRow.Insert`, `ctx.excel`(=None).
- 숨김 = `ws.column_dimensions['B'].hidden=True` / `ws.row_dimensions[n].hidden=True`(삭제 아님). 병합 = `ws.merge_cells/unmerge_cells`. 삽입 = `ws.insert_cols/insert_rows`(단, **참조 자동 보정 안 됨** → 삽입 후 수식 참조가 깨질 수 있음). 대량 쓰기 = 행 리스트 만들어 `ctx.write_grid`/`ctx.set_range` 1회.

먼저 `simulated_cells` 에 "이 코드 실행 후 핵심 셀들이 실제로 갖게 될 값/수식"을 적으세요(수식 보존 셀은 `=..` 문자열로). 기대 결과(expected)가 있으면 대조해 `output_matches_expected` 를 채우세요(없으면 null).

다음을 특히 엄격히 보세요(이 앱에서 반복된 문제):
1. 숨김 요청을 delete_cols/delete_rows(삭제)로 처리하지 않았는가. 숨김은 dimensions.hidden.
2. 출력 대상 셀/범위가 사용자가 지정한 바로 그 셀인가. Range.End/Offset 추측으로 엉뚱한 셀에 쓰지 않는가.
3. 특정 시트만 수정해야 하는데 `for ws in wb.worksheets` 로 전체를 건드리지 않는가.
4. 복사/붙여넣기인데 COM 전용 `src.Copy(dest)` 를 쓰지 않았는가(openpyxl 엔 없음). 값/수식 보존 의도면 원본 `.value` 를 읽어 대입했는가.
5. 수식 결과 값이 필요한데 수식 셀을 그대로 읽어 None/수식문자열을 넣지 않았는가(openpyxl 재계산 안 함 → Python 으로 계산).
6. 수식 보존이 필요한 셀(마진 D열 `=B-C`, 마진율 E열 `=IFERROR(D/B,0)`)을 값으로 덮어쓰지 않았는가.
7. 이번 요청 하나만 수행하는가(과거 작업 재실행/혼합 금지). 멀티턴: 직전이 실패로 끝났어도 조용히 재시도 금지. 단 직전 작업에 대한 '수정/개선 피드백'이면 이어서 개선.
8. 변경 0건 no-op 가능성. 대상/조건 불충족이면 `raise` 로 실패를 드러내야 함(거짓 '적용됨' 방지).
9. 금지/차단 import(os/sys/subprocess/pathlib 등), eval/exec/open.

**코드 자체 검수(중요 — 품질 개선의 직접 근거):** 판정과 별개로 다음을 반드시 채우세요.
- `suggested_code`(+`suggested_rationale`): 같은 의도를 openpyxl 로 더 안전·정확·견고하게 짰을 transform(ctx). 이미 충분하면 빈 문자열.
- `openpyxl_capabilities`: 이 코드가 openpyxl 로 '더 잘 할 수 있었던 것'(능력/패턴) 목록.
- `prompt_control_suggestions`: Qwen 을 그 방향으로 유도하도록 SYSTEM_PROMPT 에 넣을 **구체 규칙 문장**(바로 붙여넣을 수 있는 한국어). 개선 불필요면 빈 배열.
- `qwen_failure_pattern`: 이 생성물의 전형적 실패/비효율 유형 한 줄(문제 없으면 '없음').

판정 기준:
- PASS: 의도대로 안전 동작, openpyxl 런타임 오류 가능성 낮음.
- RISK: 대체로 동작하나 의도 부분 불일치/모호 범위/잠재 오류·no-op 주의.
- FAIL: 의도와 명확히 다르거나(삭제↔숨김, 엉뚱한 셀, 전체 시트 오염, 수식 파괴, COM 전용 호출 등) 런타임 실패 예상.

반드시 제공된 JSON 스키마에 맞는 객체 하나만 출력하세요. 한국어로 작성하세요."""


def build_review_user_prompt(code: str, case: dict[str, Any], variant: dict[str, Any], schema_summary: str) -> str:
    intent = "\n".join(
        filter(
            None,
            [
                f"체크리스트 주제: {case.get('title') or case.get('id')}",
                f"사용자 요청(프롬프트): {variant.get('prompt')}",
                ("정확 참조:\n" + "\n".join(variant.get("exact_refs", []))) if variant.get("exact_refs") else "",
            ],
        )
    )
    expected = variant.get("expected")
    expected_block = (
        f"\n[기대 결과(expected) — 이 요청이 올바로 수행됐을 때 워크북이 가져야 할 상태]\n{expected}\n"
        if expected else
        "\n[기대 결과(expected)]\n(이 변형에는 명시적 expected 가 없습니다 → output_matches_expected 는 null 로 두세요.)\n"
    )
    return f"""아래는 검수 대상입니다.

[사용자 의도]
{intent}
{expected_block}
[대상 파일/시트/셀 스키마 (이 워크북에 실제로 존재하는 것)]
{schema_summary}

[Qwen 이 생성한 Python 스킬]
```python
{code}
```

이 코드를 **openpyxl 인프로세스 엔진으로 실행했다고 가정**하고(수식 재계산 없음, COM 전용 API 무효),
각 대상 셀이 실제로 갖게 될 값/수식을 먼저 `simulated_cells` 로 산출한 뒤 expected(있으면)와 대조해 판정하세요.
정적 검사는 이미 통과했으므로 표면 금지패턴이 아니라 '의도 부합 · 수식 보존 · 범위 한정 · openpyxl 런타임 동작'에 집중하고,
같은 의도를 더 잘 달성하는 `suggested_code` 와, Qwen 을 유도할 `prompt_control_suggestions` 를 반드시 제시하세요."""


def review_python(
    code: str,
    case: dict[str, Any],
    variant: dict[str, Any],
    schema_summary: str,
    *,
    api_key: str,
    base_url: str = DEFAULT_ANTHROPIC_BASE_URL,
    model: str = DEFAULT_SONNET_MODEL,
    max_tokens: int = 6000,
    timeout: int = 120,
) -> dict[str, Any]:
    """단일 Python 스킬에 대한 Sonnet 판정 + 코드/프롬프트 개선안. 실패 시 error 키.

    max_tokens 기본 6000 — simulated_cells + suggested_code(여러 줄) + 제안 배열까지
    담아야 하므로 작으면 응답이 잘려 JSON 파싱이 깨진다(VBA 검수와 동일 교훈).
    """
    try:
        user = build_review_user_prompt(code, case, variant, schema_summary)
        result = _post_messages(
            base_url, api_key, model, REVIEW_SYSTEM_PROMPT, user, VERDICT_SCHEMA, max_tokens, timeout
        )
        result.setdefault("verdict", "RISK")
        result.setdefault("simulated_cells", [])
        result.setdefault("output_matches_expected", None)
        result.setdefault("suggested_code", "")
        result.setdefault("suggested_rationale", "")
        result.setdefault("openpyxl_capabilities", [])
        result.setdefault("prompt_control_suggestions", [])
        result.setdefault("qwen_failure_pattern", "")
        return result
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as err:
        return {
            "verdict": "ERROR",
            "error": f"Sonnet 검수 호출 실패: {err}",
            "rationale": "",
            "risks": [],
            "required_fixes": [],
            "simulated_cells": [],
            "output_matches_expected": None,
            "suggested_code": "",
            "suggested_rationale": "",
            "openpyxl_capabilities": [],
            "prompt_control_suggestions": [],
            "qwen_failure_pattern": "",
        }


# 러너가 모드 무관하게 `review_module.review_vba(...)` 로 호출할 수 있도록 별칭 제공.
# (engine_strategy 가 module.review_vba 를 단일 진입점으로 쓴다.)
review_vba = review_python


def build_summary(
    results: list[dict[str, Any]],
    *,
    api_key: str,
    base_url: str = DEFAULT_ANTHROPIC_BASE_URL,
    model: str = DEFAULT_SONNET_MODEL,
    max_tokens: int = 4000,
    timeout: int = 180,
) -> dict[str, Any]:
    """전체 결과 → 한국어 종합 평가 + '프롬프트 제어 TOP N' 집계.

    각 케이스 Sonnet 의 prompt_control_suggestions / qwen_failure_pattern / openpyxl_capabilities
    를 모아 Sonnet 에게 빈도·영향도 순으로 합치게 한다 → 0.4.8 프롬프트 개선 재료.
    """
    compact = []
    for item in results:
        sonnet = item.get("sonnet") or {}
        compact.append(
            {
                "case": item.get("case_id"),
                "variant": item.get("variant_id"),
                "static_status": (item.get("check") or {}).get("status"),
                "exec_ok": (item.get("exec_verify") or {}).get("ok"),
                "sonnet_verdict": sonnet.get("verdict"),
                "intent_match": sonnet.get("intent_match"),
                "scope_correct": sonnet.get("scope_correct"),
                "preserves_formulas_formats": sonnet.get("preserves_formulas_formats"),
                "output_matches_expected": sonnet.get("output_matches_expected"),
                "qwen_failure_pattern": sonnet.get("qwen_failure_pattern", ""),
                "prompt_control_suggestions": sonnet.get("prompt_control_suggestions", []),
                "openpyxl_capabilities": sonnet.get("openpyxl_capabilities", []),
                "required_fixes": sonnet.get("required_fixes", []),
            }
        )
    system = (
        "당신은 Python(openpyxl) Excel 자동화 코드 검수 결과를 정리하는 시니어 QA 리드입니다. "
        "여러 체크리스트 케이스의 정적 검사 + openpyxl exec 검증 + Sonnet 판정 결과를 받아, "
        "한국어 종합 평가와 함께 'SYSTEM_PROMPT 에 추가하면 좋을 프롬프트 제어 규칙 TOP N'을 집계합니다. "
        "반드시 제공된 JSON 스키마 객체 하나만 출력하세요."
    )
    user = (
        "아래는 B2B Python(openpyxl) 스킬 회귀 체크리스트의 케이스별 결과입니다.\n"
        "(1) 종합 평가 마크다운을 작성하세요. 포함:\n"
        "  - 한 줄 총평과 통과/위험/실패 분포\n"
        "  - openpyxl 인프로세스 관점 가장 위험한 케이스 Top 과 이유\n"
        "  - 반복되는 공통 실패/비효율 패턴(qwen_failure_pattern 빈도)\n"
        "  - 다음 액션 권고\n"
        "  마크다운 본문에 '## Sonnet 종합 평가' 헤더는 넣지 말고 그 아래 본문만.\n"
        "(2) prompt_control_top: 케이스별 prompt_control_suggestions 와 qwen_failure_pattern 을 "
        "의미가 같은 것끼리 합치고 중복 제거해, SYSTEM_PROMPT/PYTHON_EXCEL_SKILL_RULE 에 그대로 넣을 수 있는 "
        "규칙 문장으로 정리하세요. 빈도가 높은(여러 케이스에서 반복된) 것부터. 최대 8개.\n\n"
        f"결과 데이터(JSON):\n{json.dumps(compact, ensure_ascii=False, indent=2)}"
    )
    try:
        return _post_messages(base_url, api_key, model, system, user, SUMMARY_SCHEMA, max_tokens, timeout)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as err:
        return {
            "overall": "RISK",
            "markdown": f"_Sonnet 종합 평가 생성 실패: {err}_",
            "prompt_control_top": [],
            "error": str(err),
        }
