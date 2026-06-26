#!/usr/bin/env python3
"""Anthropic Sonnet review layer for generated B2B VBA skill code.

This is the second checking stage after ``vba_static_checks``: the static
checker catches forbidden patterns cheaply (regex), and Sonnet judges whether
the code will actually *behave as intended* when injected into a real Microsoft
Excel workbook over COM in the closed-network (offline) Windows build.

stdlib only — talks to ``POST /v1/messages`` with ``urllib`` so the runner has
no third-party dependency (matching the Qwen path). Structured outputs
(``output_config.format`` + ``json_schema``) force a machine-parseable verdict.
"""

from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.request
from typing import Any


# 사용자가 "키는 그냥 저장해도 괜찮다"고 했으므로 Qwen 키와 동일하게 기본값으로 저장.
# 환경변수 ANTHROPIC_API_KEY 가 있으면 그쪽이 우선 (runner 에서 처리).
DEFAULT_ANTHROPIC_API_KEY = ""
DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
# Sonnet 최신 버전(1M 컨텍스트, 구조화 출력 지원). 날짜 접미사를 붙이지 말 것.
DEFAULT_SONNET_MODEL = "claude-sonnet-4-6"
ANTHROPIC_VERSION = "2023-06-01"


def _ssl_context() -> ssl.SSLContext:
    """가능하면 certifi, 없으면 시스템 신뢰저장소. 둘 다 실패하면 검증 비활성(경고).

    폐쇄망 오프라인 빌드에는 certifi 가 없을 수 있고, 일부 환경은 시스템
    루트 인증서가 비어 있어 핸드셰이크가 실패한다. 이 러너는 개발/QA 도구이므로
    최후에는 미검증 컨텍스트로라도 동작하게 둔다(프로덕션 앱 경로가 아님).
    """
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        pass
    try:
        ctx = ssl.create_default_context()
        # 시스템 저장소가 비어 있으면 load 가 조용히 통과하므로 그대로 반환.
        return ctx
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx


# Sonnet 이 반드시 이 모양으로만 답하도록 강제하는 판정 스키마.
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
            "description": "실제 Excel COM 에서 런타임 오류 없이 끝까지 실행될 것으로 보이는가",
        },
        "intent_match": {
            "type": "boolean",
            "description": "사용자 요청 의도(숨김vs삭제, 대상 시트/셀/범위 한정, 수식/서식/병합 보존 등)와 코드 동작이 일치하는가",
        },
        "scope_correct": {
            "type": "boolean",
            "description": "대상 범위가 요청대로 한정되었는가(특정 시트만, 지정 셀만 등 - 과확장 없음)",
        },
        "preserves_formulas_formats": {
            "type": "boolean",
            "description": "수식/서식/병합/숨김 보존이 요구되는 경우 그것이 지켜지는가(해당 없으면 true)",
        },
        "simulated_cells": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "cell": {"type": "string", "description": "셀 주소(예: 회사별요약!B4 또는 B4)"},
                    "becomes": {"type": "string", "description": "이 VBA 를 COM 으로 실행한 뒤 그 셀이 갖게 될 값 또는 수식(예: '1435000', '=B4-C4', '(변경 없음)')"},
                },
                "required": ["cell", "becomes"],
            },
            "description": "이 VBA 를 폐쇄망 Windows + Python COM 으로 실제 워크북에 실행했다고 가정했을 때, 영향을 받는 주요 셀들이 실제로 갖게 될 값/수식. 수식 보존 여부를 여기서 드러낼 것(예: D/E 열 수식이 그대로면 '=B4-C4' 로, 값으로 덮였으면 그 값으로).",
        },
        "output_matches_expected": {
            "type": ["boolean", "null"],
            "description": "기대 결과(expected)가 주어진 경우, 위 시뮬레이션 결과가 expected 와 일치하는가. expected 가 제공되지 않았으면 null.",
        },
        "suggested_vba": {
            "type": "string",
            "description": "같은 사용자 의도를 더 안전·정확히 달성하도록 당신(Sonnet)이라면 작성했을 개선 VBA. 검수 대상이 이미 충분히 좋으면 빈 문자열. ```vba 펜스 없이 코드 본문만.",
        },
        "suggested_rationale": {
            "type": "string",
            "description": "suggested_vba 가 왜 더 안전/정확한지(또는 왜 개선 불필요한지) 1~3문장 한국어. 없으면 빈 문자열.",
        },
        "risks": {
            "type": "array",
            "items": {"type": "string"},
            "description": "폐쇄망 Windows Excel COM 실행 시 발생 가능한 구체적 위험/오작동(한국어)",
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
        "suggested_vba",
        "suggested_rationale",
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
            "description": "한국어 종합 평가 리포트(마크다운). '## Sonnet 종합 평가' 아래에 들어갈 본문만. 위험 요약/공통 패턴/권고를 포함",
        },
    },
    "required": ["overall", "markdown"],
}


REVIEW_SYSTEM_PROMPT = """당신은 Microsoft Excel VBA 와 Windows COM 자동화에 정통한 시니어 코드 검수자입니다.
검수 대상은 어떤 LLM(Qwen)이 사용자 요청에 따라 생성한 VBA 매크로 `Sub B2BSkill()` 입니다.

**실행 전제(반드시 이 전제로 시뮬레이션할 것):**
이 매크로는 **저사양 폐쇄망(오프라인) Windows PC** 에서 **Python COM(win32com.client 로 Excel.Application 을 띄우고, 이 VBA 를 워크북 모듈에 주입한 뒤 Application.Run 으로 실행)** 되는 방식으로 실제 워크북에 적용됩니다. 즉 당신은 추상적으로 "코드를 읽는" 것이 아니라, **이 VBA 를 위 환경에서 실제로 실행했을 때 각 대상 셀이 어떤 값/수식이 되는지를 머릿속으로 시뮬레이션**해야 합니다.
- 저사양·COM 경로 특성상 다음이 실제로 자주 문제가 됩니다: `Range.Value = 2차원배열` 로 표 전체를 다시 쓰면 그 안의 수식이 계산값으로 풀려 사라짐; 병합셀에 쓰면 1004; 보호셀/필터 상태에서 1004; 없는 시트·워크북 참조 시 subscript out of range(9); 날짜/시간이 직렬화/형변환으로 깨짐; 재계산 타이밍 때문에 수식 셀이 0/빈값으로 보임.
- 먼저 `simulated_cells` 에 "이 VBA 실행 후 핵심 셀들이 실제로 갖게 될 값/수식"을 적으세요. 수식 보존이 핵심인 셀(예: 마진 D열 `=B-C`, 마진율 E열 `=IFERROR(D/B,0)`, 합계행 SUM/AVERAGE)은 실행 후에도 수식이 그대로인지, 아니면 값으로 덮였는지를 분명히 표시하세요.
- 기대 결과(expected)가 주어지면, 위 시뮬레이션과 대조해 `output_matches_expected` 를 채우세요(없으면 null).

다음을 특히 엄격히 보세요(이 앱에서 반복적으로 문제가 된 항목):
1. 숨김(.Hidden=True) 요청을 삭제/Clear 로 처리하지 않았는가. 숨김 후 데이터 범위가 줄었다고 잘못 가정하지 않는가.
2. 출력 대상 셀/범위가 사용자가 지정한 바로 그 셀인가(예: 요약!B2). ActiveCell.Offset/Selection 추측으로 엉뚱한 셀에 쓰지 않는가.
3. 여러 시트가 있을 때 특정 시트만 수정해야 하는데 For Each ws In Worksheets 로 전체를 건드리지 않는가.
4. 수식/서식/병합 보존이 필요한 복사인데 .Value=.Value 로 수식·서식을 날리지 않는가(Copy Destination / PasteSpecial xlPasteAll 인가).
5. 다운로드 후 재계산되어야 하는 수식 열(예: 이익/세금/합계)을 값으로 덮어쓰지 않는가.
6. 이번 요청 하나만 수행하는가. 과거 작업(초기화/삭제 등)을 다시 섞지 않는가. (멀티턴: 직전 대화가 있어도 이번 요청 범위만 수행해야 하며, 실패로 끝난 직전 작업을 조용히 재시도하면 안 된다. 단, 이번 요청이 직전 작업에 대한 '수정/개선 피드백'이면 새 작업으로 오해하지 말고 그 작업을 이어서 개선해야 한다.)
7. COM 런타임 관점: 1004(병합셀/보호), subscript out of range(없는 시트/워크북 참조), 변경 0건 no-op 가능성.
8. 금지: On Error Resume Next, MsgBox/InputBox, Workbooks.Open, Save/SaveAs/Close, Application.Quit, Shell, FileSystemObject 등.
   - 실패는 숨기지 말고 Err.Raise 로 드러나야 한다. 조용한 GoTo Cleanup/Exit Sub 종료는 '적용됨' 오보를 만든다.

**개선안 제시:** 판정과 별개로, 같은 사용자 의도를 더 안전·정확히 달성하도록 당신이라면 어떻게 짰을지를 `suggested_vba`(코드 본문) + `suggested_rationale`(왜 더 나은지) 로 제시하세요. 검수 대상이 이미 충분하면 둘 다 빈 문자열로 두세요. 이 제안은 품질 개선 작업의 직접 근거로 쓰입니다.

판정 기준:
- PASS: 지정 의도대로 안전하게 동작하고 COM 런타임 실패 가능성이 낮음.
- RISK: 대체로 동작하지만 의도 부분 불일치, 모호한 범위, 잠재적 1004/no-op 등 주의가 필요.
- FAIL: 의도와 명확히 다르거나(삭제↔숨김 혼동, 엉뚱한 셀, 전체 시트 오염, 수식 파괴 등) COM 런타임 실패가 예상됨.

반드시 제공된 JSON 스키마에 맞는 객체 하나만 출력하세요. 한국어로 작성하세요."""


def _messages_url(base_url: str) -> str:
    """`/v1/messages` 로 정규화. base_url 이 `/v1` 으로 끝나든 안 끝나든 동작.

    환경변수 ANTHROPIC_BASE_URL 이 `https://api.anthropic.com`(버전 없음) 으로
    설정된 경우가 흔해서, 버전 세그먼트를 보정하지 않으면 404 가 난다.
    """
    base = base_url.rstrip("/")
    if base.endswith("/messages"):
        return base
    if not base.endswith("/v1"):
        base += "/v1"
    return base + "/messages"


def _post_messages(
    base_url: str,
    api_key: str,
    model: str,
    system: str,
    user: str,
    schema: dict[str, Any],
    max_tokens: int,
    timeout: int,
) -> dict[str, Any]:
    url = _messages_url(base_url)
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
        "output_config": {"format": {"type": "json_schema", "schema": schema}},
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "x-api-key": api_key,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    parsed = json.loads(raw)
    text = ""
    for block in parsed.get("content", []) or []:
        if block.get("type") == "text":
            text += block.get("text", "") or ""
    stop_reason = parsed.get("stop_reason")
    try:
        out = json.loads(text) if text.strip() else {}
    except json.JSONDecodeError as err:
        if stop_reason == "max_tokens":
            raise ValueError(
                f"Sonnet 응답이 max_tokens({max_tokens})에서 잘려 JSON 이 불완전합니다. "
                f"max_tokens 를 늘리세요. (원오류: {err})"
            ) from err
        raise
    out["_usage"] = parsed.get("usage")
    out["_stop_reason"] = stop_reason
    return out


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

[Qwen 이 생성한 VBA]
```vba
{code}
```

이 VBA 를 **저사양 폐쇄망 Windows PC 에서 Python COM 으로 위 워크북에 주입·실행했다고 가정**하고,
각 대상 셀이 실제로 갖게 될 값/수식을 먼저 `simulated_cells` 로 산출한 뒤, expected(있으면)와 대조해 판정하세요.
정적 검사는 이미 통과했으므로 표면적 금지패턴이 아니라 '의도 부합 · 수식/서식/범위 보존 · COM 런타임 동작'에 집중하고,
같은 의도를 더 잘 달성하는 `suggested_vba` 개선안도 함께 제시하세요."""


def review_vba(
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
    """단일 VBA 코드에 대한 Sonnet 판정. 실패 시 error 키가 채워진 dict 반환.

    max_tokens 기본을 넉넉히(6000) 둔다 — simulated_cells + suggested_vba(여러 줄 개선 코드)
    까지 담아야 하므로 작으면 응답이 잘려 JSON 파싱이 깨진다(Unterminated string).
    4000 에서도 긴 개선코드는 가끔 잘렸다 → 6000.
    """
    try:
        user = build_review_user_prompt(code, case, variant, schema_summary)
        result = _post_messages(
            base_url, api_key, model, REVIEW_SYSTEM_PROMPT, user, VERDICT_SCHEMA, max_tokens, timeout
        )
        # 필수 키 방어(스키마 강제지만 만약을 대비).
        result.setdefault("verdict", "RISK")
        result.setdefault("simulated_cells", [])
        result.setdefault("output_matches_expected", None)
        result.setdefault("suggested_vba", "")
        result.setdefault("suggested_rationale", "")
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
            "suggested_vba": "",
            "suggested_rationale": "",
        }


def build_summary(
    results: list[dict[str, Any]],
    *,
    api_key: str,
    base_url: str = DEFAULT_ANTHROPIC_BASE_URL,
    model: str = DEFAULT_SONNET_MODEL,
    max_tokens: int = 3000,
    timeout: int = 180,
) -> dict[str, Any]:
    """전체 결과를 Sonnet 에 넘겨 한국어 종합 평가 마크다운을 생성."""
    compact = []
    for item in results:
        sonnet = item.get("sonnet") or {}
        compact.append(
            {
                "case": item.get("case_id"),
                "variant": item.get("variant_id"),
                "static_status": (item.get("check") or {}).get("status"),
                "sonnet_verdict": sonnet.get("verdict"),
                "com_will_run": sonnet.get("com_will_run"),
                "intent_match": sonnet.get("intent_match"),
                "scope_correct": sonnet.get("scope_correct"),
                "preserves_formulas_formats": sonnet.get("preserves_formulas_formats"),
                "output_matches_expected": sonnet.get("output_matches_expected"),
                "risks": sonnet.get("risks", []),
                "required_fixes": sonnet.get("required_fixes", []),
                "suggested_rationale": sonnet.get("suggested_rationale", ""),
            }
        )
    system = (
        "당신은 Excel VBA/Windows COM 검수 결과를 정리하는 시니어 QA 리드입니다. "
        "여러 체크리스트 케이스의 정적 검사 + Sonnet 판정 결과를 받아, 한국어 종합 평가를 작성합니다. "
        "반드시 제공된 JSON 스키마 객체 하나만 출력하세요."
    )
    user = (
        "아래는 B2B VBA 회귀 체크리스트의 케이스별 결과입니다(정적 검사 + Sonnet COM 동작 판정).\n"
        "이를 바탕으로 종합 평가 마크다운을 작성하세요. 포함할 것:\n"
        "- 한 줄 총평과 통과/위험/실패 분포\n"
        "- 폐쇄망 Windows Excel COM 관점에서 가장 위험한 케이스 Top 항목과 이유\n"
        "- 반복되는 공통 실패/위험 패턴(있다면)\n"
        "- 다음 액션 권고(코드/프롬프트/추가 검증)\n\n"
        "마크다운 본문에는 '## Sonnet 종합 평가' 헤더를 직접 넣지 말고 그 아래 본문만 쓰세요.\n\n"
        f"결과 데이터(JSON):\n{json.dumps(compact, ensure_ascii=False, indent=2)}"
    )
    try:
        return _post_messages(base_url, api_key, model, system, user, SUMMARY_SCHEMA, max_tokens, timeout)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError) as err:
        return {"overall": "RISK", "markdown": f"_Sonnet 종합 평가 생성 실패: {err}_", "error": str(err)}

