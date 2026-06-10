#!/usr/bin/env python3
"""Run Qwen-backed VBA generation regression checks.

Usage:
  python scripts/vba_regression_runner.py --api-key khkim

The runner uses OpenAI-compatible /chat/completions and writes reports under
tests/vba_regression/reports.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from core import extract_code_block
import engine_strategy
# Anthropic 키/URL/모델 기본값은 모드 무관(Python 검수 모듈도 이 상수를 재노출). argparse 기본값용.
import vba_sonnet_review


# 이 파일은 tests/vba_regression/ 에 있다(개발/품질평가 전용 — exe 패키징 대상 아님).
# 레포 루트 = parents[2] (vba_regression → tests → repo root).
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CASES_DIR = HERE / "cases"
REPORTS_DIR = HERE / "reports"
DEFAULT_BASE_URL = "http://192.168.219.111:8000/v1"
DEFAULT_MODEL = "Qwen/Qwen3.6-27B-FP8"
DEFAULT_API_KEY = "khkim"

# 재시도/이력 정책은 exe 의 scripts/llm-api.js 와 동일하게 맞춘다(사용자: "exe 로직 기준").
#   OPENAI_COMPAT_MAX_ATTEMPTS=3, RETRY_BASE_MS=700, 재시도 상태=408/429/5xx + 네트워크.
#   getLLMChatHistory: 최근 18메시지 / 32000자 캡, user 로 시작하도록 트리밍.
OPENAI_COMPAT_MAX_ATTEMPTS = 3
OPENAI_COMPAT_RETRY_BASE_MS = 700
RETRYABLE_STATUSES = {408, 429, 500, 502, 503, 504}
LLM_HISTORY_MAX_MESSAGES = 18
LLM_HISTORY_MAX_CHARS = 32000
# exe 의 shouldRetryOpenAICompatError 와 동일한 네트워크 오류 메시지 패턴.
_RETRYABLE_MSG_RE = re.compile(
    r"failed to fetch|networkerror|proxy error|connection|timeout|timed out|"
    r"econnreset|ecconnreset|socket|502|503|504",
    re.I,
)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def extract_js_template_constant(source: str, name: str) -> str:
    needle = f"const {name} = `"
    start = source.find(needle)
    if start < 0:
        raise RuntimeError(f"{name} not found")
    i = start + len(needle)
    out: list[str] = []
    escaped = False
    while i < len(source):
        ch = source[i]
        if escaped:
            out.append("\\" + ch)
            escaped = False
        elif ch == "\\":
            escaped = True
        elif ch == "`":
            return "".join(out).replace("\\`", "`")
        else:
            out.append(ch)
        i += 1
    raise RuntimeError(f"{name} template is not closed")


_SCHEMA_SUMMARY_CACHE: "str | None" = None


def get_schema_summary() -> str:
    """실 test_data 기반 스키마 요약(1회 계산 후 캐시). test_data 를 못 읽으면
    경고 후 mock_schema_summary() 로 폴백(병렬화만이라도 동작하게)."""
    global _SCHEMA_SUMMARY_CACHE
    if _SCHEMA_SUMMARY_CACHE is None:
        try:
            import test_data_schema
            _SCHEMA_SUMMARY_CACHE = test_data_schema.build_real_schema_summary()
        except Exception as err:  # noqa: BLE001 — 폴백이 목적
            print(f"[SCHEMA] 실 test_data 로드 실패 → mock 폴백: {err}", file=sys.stderr, flush=True)
            _SCHEMA_SUMMARY_CACHE = mock_schema_summary()
    return _SCHEMA_SUMMARY_CACHE


def build_system_prompt(strategy: "engine_strategy.Strategy", schema_js_path: "str | Path | None" = None) -> str:
    # 모드별 프롬프트 조립을 strategy 에 위임한다.
    #   - vba:    scripts/file-schema.js 의 VBA_SYSTEM_PROMPT (+ --schema-js 로 다른 버전 비교)
    #   - python: vendored 0.4.8 SYSTEM_PROMPT + openpyxl 엔진 안내 (+ --schema-js 로 다른 JS)
    # 둘 다 끝에 실 test_data 스키마 요약을 붙인다.
    return strategy.prompt_builder(get_schema_summary(), schema_js_path)


def mock_schema_summary() -> str:
    return """## 입력 파일 목록 (수정 가능)

### input_업로드_샘플.xlsx
시트 "1번시트": 전체 30행
  행 1: ["회사명", "A값", "B값", "C값", "O열", "비고"]
  행 2: ["가나상사", 100, 200, 300, "삭제대상", ""]
시트 "2번시트": 전체 30행
  행 1: ["회사명", "A값", "B값", "C값", "O열", "비고"]
시트 "3번시트": 전체 30행
  행 1: ["회사명", "A값", "B값", "C값", "O열", "비고"]

## 사용자가 현재 보고 있는 대상 (명령에 파일/시트가 없을 때 기본 대상)
[출력] 파일: "output_검증_템플릿.xlsx"
기본 대상 객체: ctx.workbook / ctx.sheet(...)
현재 활성 시트: "1번시트"
사용자가 파일/시트를 명시하지 않으면 이 시트를 기본 대상으로 사용하세요.

## 출력 템플릿 (원본, 수정 가능): output_검증_템플릿.xlsx

### output_검증_템플릿.xlsx
시트 "1번시트": 전체 40행
  수식 셀 3개 (예: D2==B2+C2, E2==D2*0.1, F2==SUM(B2:D2))
  행 1: ["회사명", "매출", "원가", "이익", "세금", "합계"]
  행 2: ["가나상사", "", "", 0, 0, 0]
시트 "요약": 전체 20행
  행 1: ["구분", "결과"]
  행 2: ["출력위치", ""]

선택 셀: "요약!B2"
사용자가 결과 위치를 직접 클릭한 경우 '여기', '선택한 셀', '이 셀'은 이 선택 위치를 의미합니다.
"""


def _resolve_mode_checks(obj: dict[str, Any], mode: str) -> None:
    """checks_by_mode[mode] 가 있으면 그것을 effective `checks` 로 끌어올린다(in-place).

    하위호환: checks_by_mode 가 없으면 기존 top-level `checks` 를 그대로 둔다(=vba 기준).
    한 케이스 파일이 vba/python 양쪽 체크를 함께 담을 수 있게 하는 핵심.
    """
    by_mode = obj.get("checks_by_mode")
    if isinstance(by_mode, dict):
        if mode in by_mode and isinstance(by_mode[mode], dict):
            obj["checks"] = by_mode[mode]
        elif mode != "vba" and "checks" not in obj:
            # python 모드인데 python 블록이 없으면 빈 체크(코어 정적검사만) — vba 폴백 금지.
            obj["checks"] = {}


def load_cases(selected: list[str] | None = None, mode: str = "python") -> list[dict[str, Any]]:
    cases = []
    selected_set = set(selected or [])
    for path in sorted(CASES_DIR.glob("*.json")):
        data = json.loads(read_text(path))
        if selected_set and data.get("id") not in selected_set:
            continue
        data["_path"] = str(path)
        _resolve_mode_checks(data, mode)
        for variant in data.get("variants", []):
            _resolve_mode_checks(variant, mode)
            for turn in variant.get("turns", []) or []:
                _resolve_mode_checks(turn, mode)
        cases.append(data)
    return cases


def trim_history(history: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """exe 의 getLLMChatHistory 동등: 최근 user/assistant 메시지를 18개/32000자 캡으로
    뒤에서부터 모으고, 시간순으로 되돌린 뒤 첫 메시지가 user 가 되도록 앞을 자른다."""
    source = [m for m in (history or [])
              if isinstance(m, dict) and m.get("role") in ("user", "assistant")]
    picked: list[dict[str, Any]] = []
    total = 0
    for msg in reversed(source):
        if len(picked) >= LLM_HISTORY_MAX_MESSAGES:
            break
        content = str(msg.get("content") or "")
        if picked and total + len(content) > LLM_HISTORY_MAX_CHARS:
            break
        picked.append({"role": msg["role"], "content": content})
        total += len(content)
    picked.reverse()
    while picked and picked[0]["role"] != "user":
        picked.pop(0)
    return picked


def _should_retry(err: Exception) -> bool:
    """exe 의 shouldRetryOpenAICompatError 동등(상태코드 + 네트워크 메시지)."""
    status = getattr(err, "status", None)
    if status and int(status) in RETRYABLE_STATUSES:
        return True
    if isinstance(err, (urllib.error.URLError, TimeoutError, ConnectionError)):
        return True
    return bool(_RETRYABLE_MSG_RE.search(str(getattr(err, "message", "") or err)))


def _post_chat_once(
    base_url: str, api_key: str, model: str, messages: list[dict[str, Any]],
    max_tokens: int, timeout: int, temperature: float,
) -> str:
    url = base_url.rstrip("/") + "/chat/completions"
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={
            "Content-Type": "application/json",
            "Api-Key": api_key,
            "Authorization": f"Bearer {api_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        # 재시도 판정을 위해 상태코드를 보존(408/429/5xx 면 _should_retry 가 True).
        err.status = err.code
        raise
    parsed = json.loads(raw)
    return parsed.get("choices", [{}])[0].get("message", {}).get("content", "") or ""


def call_openai_compat(
    base_url: str,
    api_key: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int,
    timeout: int,
    temperature: float,
    history: list[dict[str, Any]] | None = None,
) -> str:
    """exe(scripts/llm-api.js) 와 동일한 messages=[system, *history, user] 구성 +
    최대 3회·700ms×attempt 백오프 재시도. 재시도 대상이 아니거나 마지막 시도면 그대로 raise."""
    messages = [{"role": "system", "content": system}]
    messages.extend(trim_history(history))
    messages.append({"role": "user", "content": user})

    last_err: Exception | None = None
    for attempt in range(1, OPENAI_COMPAT_MAX_ATTEMPTS + 1):
        try:
            return _post_chat_once(
                base_url, api_key, model, messages, max_tokens, timeout, temperature
            )
        except (urllib.error.URLError, TimeoutError, ConnectionError,
                json.JSONDecodeError) as err:
            if not _should_retry(err) or attempt >= OPENAI_COMPAT_MAX_ATTEMPTS:
                raise
            last_err = err
            time.sleep((OPENAI_COMPAT_RETRY_BASE_MS * attempt) / 1000.0)
    raise last_err or RuntimeError("LLM request failed")


def build_turn_history(
    case: dict[str, Any], variant: dict[str, Any], args: argparse.Namespace, system: str,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """멀티턴 variant 의 이전 turn 들을 순차 실행해 누적 이력을 만든다.

    `variant["turns"]` 의 마지막 turn 은 채점 대상이므로 여기서 실행하지 않고 반환한다.
    각 prior turn 은 `inject_assistant` 가 있으면 그 고정 텍스트를 assistant 이력으로
    주입(실패 상태 등 확정 재현), 없으면 실제 Qwen 으로 생성해 이력에 쌓는다.
    반환: (history, graded_turn).
    """
    turns = variant["turns"]
    history: list[dict[str, Any]] = []
    for turn in turns[:-1]:
        user_text = turn["prompt"]
        history.append({"role": "user", "content": user_text})
        if turn.get("inject_assistant") is not None:
            # 결정적 재현: Qwen 호출 없이 고정 assistant 응답을 주입.
            print(f"    [TURN inject] {case['id']}/{variant['id']}: assistant 고정 주입", flush=True)
            history.append({"role": "assistant", "content": str(turn["inject_assistant"])})
            continue
        if args.dry_run:
            history.append({"role": "assistant", "content": turn.get("mock_reply", "")})
            continue
        print(f"    [TURN gen] {case['id']}/{variant['id']}: 이전 턴 생성", flush=True)
        reply = call_openai_compat(
            args.base_url, args.api_key, args.model, system,
            user_text + "\n\n/no_think",
            args.max_tokens, args.timeout, args.temperature, history=history[:-1],
        )
        history.append({"role": "assistant", "content": reply})
    return history, turns[-1]


def run_case_variant(case: dict[str, Any], variant: dict[str, Any], args: argparse.Namespace, system: str) -> dict[str, Any]:
    started = time.time()
    attempts: list[dict[str, Any]] = []

    # 멀티턴 variant: 이전 turn 들로 이력을 만들고, 마지막 turn 을 채점 대상으로 삼는다.
    history: list[dict[str, Any]] = []
    if variant.get("turns"):
        history, graded_turn = build_turn_history(case, variant, args, system)
        prompt = graded_turn["prompt"]
        # 채점은 마지막 turn 기준이므로, expected/checks 도 turn 에 있으면 그것을 우선 사용.
        variant = {**variant, "prompt": prompt}
        if graded_turn.get("expected") is not None:
            variant["expected"] = graded_turn["expected"]
        if graded_turn.get("checks") is not None:
            variant["checks"] = graded_turn["checks"]
    else:
        prompt = variant["prompt"]
    if variant.get("exact_refs"):
        prompt += "\n\n[정확 참조]\n" + "\n".join(variant["exact_refs"])

    if args.dry_run:
        if not variant.get("mock_reply"):
            return {
                "case_id": case["id"],
                "variant_id": variant["id"],
                "prompt": prompt,
                "reply": "",
                "language": None,
                "code": None,
                "check": {
                    "status": "SKIP",
                    "passed": ["Case loaded; model call skipped by --dry-run."],
                    "warnings": [],
                    "failures": [],
                    "needs_windows": [],
                },
                "elapsed_seconds": round(time.time() - started, 2),
            }
        reply = variant.get("mock_reply", "")
    else:
        reply = call_openai_compat(
            args.base_url,
            args.api_key,
            args.model,
            system,
            prompt + "\n\n/no_think",
            args.max_tokens,
            args.timeout,
            args.temperature,
            history=history,
        )

    strategy = args.strategy

    def evaluate(model_reply: str) -> tuple[str | None, str | None, dict[str, Any]]:
        language, code = extract_code_block(model_reply)
        if code is None:
            return language, code, {
                "status": "FAIL",
                "passed": [],
                "warnings": [],
                "failures": ["No fenced code block found."],
                "needs_windows": [],
            }
        check = strategy.static_check(code, case, variant)
        if language and language not in strategy.accepted_langs:
            check.fail(f"Code block language is not {strategy.code_lang}: {language}")
        return language, code, check.to_dict()

    language, code, status = evaluate(reply)
    attempts.append({
        "attempt": 0,
        "status": status["status"],
        "failures": status.get("failures", []),
        "warnings": status.get("warnings", []),
    })

    for repair_idx in range(1, args.repair_attempts + 1):
        if args.dry_run or status["status"] != "FAIL":
            break
        repair_prompt = strategy.repair_prompt(prompt, reply, code, status)
        reply = call_openai_compat(
            args.base_url,
            args.api_key,
            args.model,
            system,
            repair_prompt,
            args.max_tokens,
            args.timeout,
            args.temperature,
            history=history,
        )
        language, code, status = evaluate(reply)
        attempts.append({
            "attempt": repair_idx,
            "status": status["status"],
            "failures": status.get("failures", []),
            "warnings": status.get("warnings", []),
        })

    # exec 검증(Python 모드만): 정적 통과(또는 NEEDS_WINDOWS/WARN) 코드를 openpyxl 로 실제
    # 실행하고 variant assert 블록을 대조한다. assert 불일치/실행 예외면 상태를 FAIL 로 승격.
    # VBA 모드는 strategy.exec_verify=None 이라 이 블록을 건너뛴다(현행과 동일).
    exec_result: dict[str, Any] | None = None
    if (
        strategy.exec_verify is not None
        and not args.dry_run
        and code
        and status["status"] != "FAIL"
    ):
        print(f"  [EXEC] running {case['id']}/{variant['id']}", flush=True)
        exec_result = strategy.exec_verify(code, case, variant)
        if exec_result.get("available"):
            if exec_result.get("ok") is False:
                status = dict(status)
                status["status"] = "FAIL"
                detail = exec_result.get("error") or "exec 검증 실패"
                failed_checks = [
                    c for c in ((exec_result.get("asserts") or {}).get("checks") or [])
                    if not c.get("ok")
                ]
                extra = [f"openpyxl exec 검증 실패: {detail}"]
                extra += [f"assert 불일치: {c['name']} ({c.get('detail','')})" for c in failed_checks]
                status["failures"] = list(status.get("failures", [])) + extra
            elif exec_result.get("matches_expected") is True:
                status = dict(status)
                status["passed"] = list(status.get("passed", [])) + ["openpyxl exec 검증: assert 통과"]
        else:
            # openpyxl 미설치 등 — 검증 불가 노트만 남기고 상태는 유지.
            status = dict(status)
            status["warnings"] = list(status.get("warnings", [])) + [
                f"exec 검증 skip: {exec_result.get('error')}"
            ]

    # 정적/​exec 를 통과(또는 NEEDS_WINDOWS/WARN)한 코드만 Sonnet 심층 검수에 보낸다.
    # FAIL 이 끝까지 남으면 이미 탈락이므로 API 비용을 쓰지 않는다.
    sonnet: dict[str, Any] | None = None
    if (
        getattr(args, "sonnet_review", False)
        and not args.dry_run
        and code
        and status["status"] != "FAIL"
    ):
        print(f"  [SONNET] reviewing {case['id']}/{variant['id']}", flush=True)
        sonnet = strategy.sonnet_module.review_vba(
            code,
            case,
            variant,
            get_schema_summary(),
            api_key=args.anthropic_api_key,
            base_url=args.anthropic_base_url,
            model=args.sonnet_model,
            timeout=args.sonnet_timeout,
        )
        verdict = sonnet.get("verdict")
        # Sonnet 이 FAIL 로 보면 최종 상태를 FAIL 로 승격(정적/exec 는 통과했지만 의도/동작이 어긋남).
        if verdict == "FAIL":
            status = dict(status)
            status["status"] = "FAIL"
            extra = ["Sonnet 검수 FAIL: " + (sonnet.get("rationale") or "")]
            extra += [f"수정 필요: {fix}" for fix in (sonnet.get("required_fixes") or [])]
            status["failures"] = list(status.get("failures", [])) + extra
        elif verdict == "RISK":
            status = dict(status)
            note = "Sonnet 검수 RISK: " + (sonnet.get("rationale") or "")
            status["warnings"] = list(status.get("warnings", [])) + [note]
            if status["status"] == "PASS":
                status["status"] = "WARN"

    result: dict[str, Any] = {
        "case_id": case["id"],
        "variant_id": variant["id"],
        "prompt": prompt,
        "reply": reply,
        "language": language,
        "code": code,
        "check": status,
        "attempts": attempts,
        "elapsed_seconds": round(time.time() - started, 2),
    }
    if exec_result is not None:
        result["exec_verify"] = exec_result
    if sonnet is not None:
        result["sonnet"] = sonnet
    return result


# (build_repair_prompt 는 engine_strategy 의 vba_repair_prompt/python_repair_prompt 로 이전됨.)


def status_rank(status: str) -> int:
    return {"SKIP": 0, "PASS": 0, "NEEDS_WINDOWS": 1, "WARN": 2, "FAIL": 3}.get(status, 4)


def summarize(results: list[dict[str, Any]]) -> dict[str, Any]:
    counts: dict[str, int] = {}
    worst = "PASS"
    for item in results:
        status = item["check"]["status"]
        counts[status] = counts.get(status, 0) + 1
        if status_rank(status) > status_rank(worst):
            worst = status
    return {"status": worst, "counts": counts, "total": len(results)}


def sonnet_counts(results: list[dict[str, Any]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in results:
        sonnet = item.get("sonnet")
        if sonnet:
            verdict = sonnet.get("verdict", "ERROR")
            counts[verdict] = counts.get(verdict, 0) + 1
    return counts


def exec_counts(results: list[dict[str, Any]]) -> dict[str, int]:
    """openpyxl exec 검증 결과 집계: pass(assert 통과) / fail / no_assert(실행만) / skip."""
    counts: dict[str, int] = {}
    for item in results:
        ev = item.get("exec_verify")
        if not ev:
            continue
        if not ev.get("available"):
            key = "skip"
        elif ev.get("ok") is False:
            key = "fail"
        elif ev.get("matches_expected") is True:
            key = "pass"
        else:
            key = "no_assert"  # 실행 성공했으나 assert 가 없어 Sonnet 에 위임
        counts[key] = counts.get(key, 0) + 1
    return counts


def _bool_mark(value: Any) -> str:
    if value is True:
        return "예"
    if value is False:
        return "아니오"
    return "-"


def write_reports(results: list[dict[str, Any]], args: argparse.Namespace) -> tuple[Path, Path]:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    strategy = args.strategy
    mode = strategy.name
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    # 모드 접두사로 파일을 구분(python_* / vba_*). 기존 vba 리포트와 충돌하지 않음.
    json_path = REPORTS_DIR / f"{mode}_regression_{stamp}.json"
    md_path = REPORTS_DIR / f"{mode}_regression_{stamp}.md"

    has_sonnet = any(item.get("sonnet") for item in results)
    has_exec = any(item.get("exec_verify") for item in results)
    summary_block: dict[str, Any] | None = None
    if getattr(args, "summary", False) and has_sonnet:
        print("[SONNET] writing 종합 평가 ...", flush=True)
        summary_block = strategy.sonnet_module.build_summary(
            results,
            api_key=args.anthropic_api_key,
            base_url=args.anthropic_base_url,
            model=args.sonnet_model,
            timeout=max(args.sonnet_timeout, 180),
        )

    payload = {
        "created_at": dt.datetime.now().isoformat(timespec="seconds"),
        "mode": mode,
        "label": getattr(args, "label", None),
        "schema_js": getattr(args, "schema_js", None),
        "base_url": args.base_url,
        "model": args.model,
        "sonnet_model": args.sonnet_model if has_sonnet else None,
        "summary": summarize(results),
        "sonnet_counts": sonnet_counts(results),
        "exec_counts": exec_counts(results) if has_exec else None,
        "sonnet_summary": summary_block,
        "results": results,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    lines = [
        f"# {strategy.report_label} Regression Report",
        "",
        f"- Mode: `{mode}`",
        f"- Generator (Qwen) model: `{args.model}`",
        f"- Base URL: `{args.base_url}`",
        f"- Summary: `{payload['summary']['status']}` {payload['summary']['counts']}",
    ]
    if has_exec:
        lines.append(f"- openpyxl exec 검증: {payload['exec_counts']}")
    if has_sonnet:
        lines.append(f"- Reviewer (Sonnet) model: `{args.sonnet_model}`")
        lines.append(f"- Sonnet verdicts: {payload['sonnet_counts']}")
    lines.append("")

    if summary_block:
        lines.append(f"## Sonnet 종합 평가 — {summary_block.get('overall', '-')}")
        lines.append("")
        lines.append(summary_block.get("markdown", "").strip())
        lines.append("")
        # Python 모드: Sonnet 이 집계한 'SYSTEM_PROMPT 에 추가하면 좋을 규칙 TOP N'.
        pct = summary_block.get("prompt_control_top") or []
        if pct:
            lines.append("### 권장 프롬프트 제어 (SYSTEM_PROMPT 추가안 TOP)")
            lines.append("")
            lines.append("| 빈도 | 규칙(그대로 프롬프트에 추가 가능) | 잡아주는 실패 패턴 |")
            lines.append("| ---: | --- | --- |")
            for entry in pct:
                if isinstance(entry, dict):
                    rule = str(entry.get("rule", "")).replace("|", "\\|").replace("\n", " ")
                    addr = str(entry.get("addresses", "")).replace("|", "\\|").replace("\n", " ")
                    lines.append(f"| {entry.get('frequency', '-')} | {rule} | {addr} |")
            lines.append("")

    for item in results:
        check = item["check"]
        lines.append(f"## {item['case_id']} / {item['variant_id']} — {check['status']}")
        lines.append("")
        lines.append("Prompt:")
        lines.append("```text")
        lines.append(item["prompt"])
        lines.append("```")
        for label, key in [("Failures", "failures"), ("Warnings", "warnings"), ("Needs Windows", "needs_windows"), ("Passed", "passed")]:
            if check.get(key):
                lines.append(f"{label}:")
                for msg in check[key]:
                    lines.append(f"- {msg}")

        # openpyxl exec 검증 결과(Python 모드).
        exec_v = item.get("exec_verify")
        if exec_v:
            if not exec_v.get("available"):
                lines.append(f"\nopenpyxl exec 검증 — skip ({exec_v.get('error')})")
            else:
                verdict = "통과" if exec_v.get("ok") else "실패"
                lines.append(f"\nopenpyxl exec 검증 — **{verdict}** (실행: {_bool_mark(exec_v.get('ran'))}"
                             f" · assert: {_bool_mark(exec_v.get('matches_expected'))})")
                if exec_v.get("error"):
                    lines.append(f"- 오류: {exec_v['error']}")
                for c in (exec_v.get("asserts") or {}).get("checks", []) or []:
                    mark = "✓" if c.get("ok") else "✗"
                    lines.append(f"- {mark} {c.get('name')} — {c.get('detail','')}")

        sonnet = item.get("sonnet")
        if sonnet:
            verdict = sonnet.get("verdict", "-")
            run_label = "COM 실행" if mode == "vba" else "exec 실행"
            sim_label = "COM 실행 시뮬레이션" if mode == "vba" else "openpyxl 실행 시뮬레이션"
            lines.append("")
            lines.append(f"Sonnet 검수 — **{verdict}**")
            if sonnet.get("error"):
                lines.append(f"- 오류: {sonnet['error']}")
            else:
                lines.append(
                    "- {}: {} · 의도 일치: {} · 범위 한정: {} · 수식 보존: {}".format(
                        run_label,
                        _bool_mark(sonnet.get("com_will_run")),
                        _bool_mark(sonnet.get("intent_match")),
                        _bool_mark(sonnet.get("scope_correct")),
                        _bool_mark(sonnet.get("preserves_formulas_formats")),
                    )
                )
                ome = sonnet.get("output_matches_expected")
                if ome is not None:
                    lines.append(f"- 기대결과 일치(expected): {_bool_mark(ome)}")
                if sonnet.get("qwen_failure_pattern"):
                    lines.append(f"- 실패 패턴 태그: {sonnet['qwen_failure_pattern']}")
                sim = sonnet.get("simulated_cells") or []
                if sim:
                    lines.append(f"- {sim_label}(셀→결과):")
                    for sc in sim:
                        if isinstance(sc, dict):
                            lines.append(f"  - `{sc.get('cell','?')}` → {sc.get('becomes','?')}")
                if sonnet.get("rationale"):
                    lines.append(f"- 근거: {sonnet['rationale']}")
                for risk in sonnet.get("risks", []) or []:
                    lines.append(f"- 위험: {risk}")
                for fix in sonnet.get("required_fixes", []) or []:
                    lines.append(f"- 수정 필요: {fix}")
                for cap in sonnet.get("openpyxl_capabilities", []) or []:
                    lines.append(f"- openpyxl 로 더 가능: {cap}")
                for pc in sonnet.get("prompt_control_suggestions", []) or []:
                    lines.append(f"- 권장 프롬프트 제어: {pc}")
                # 개선안: VBA 는 suggested_vba, Python 은 suggested_code.
                suggested = (sonnet.get("suggested_code") or sonnet.get("suggested_vba") or "")
                if suggested.strip():
                    lines.append("")
                    lines.append("<details><summary>Sonnet 개선안 (이렇게 짰을 것)</summary>")
                    lines.append("")
                    if (sonnet.get("suggested_rationale") or "").strip():
                        lines.append(f"_{sonnet['suggested_rationale'].strip()}_")
                        lines.append("")
                    lines.append(f"```{strategy.code_fence}")
                    lines.append(suggested.strip())
                    lines.append("```")
                    lines.append("</details>")

        if item.get("code"):
            lines.append("")
            lines.append(f"Generated {strategy.report_label}:")
            lines.append(f"```{strategy.code_fence}")
            lines.append(item["code"])
            lines.append("```")
        if item.get("attempts"):
            lines.append("")
            lines.append("Attempts:")
            for attempt in item["attempts"]:
                lines.append(f"- {attempt['attempt']}: {attempt['status']}")
        lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return json_path, md_path


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    # 평가 디폴트는 Python(openpyxl). VBA 평가는 --mode vba 로.
    parser.add_argument("--mode", default=os.environ.get("B2B_EVAL_MODE", "python"),
                        choices=["python", "vba"],
                        help="평가 엔진/언어 모드(기본 python=openpyxl 인프로세스). vba 는 기존 VBA 평가.")
    parser.add_argument("--base-url", default=os.environ.get("B2B_QWEN_BASE_URL", DEFAULT_BASE_URL))
    parser.add_argument("--api-key", default=os.environ.get("B2B_QWEN_API_KEY", DEFAULT_API_KEY))
    parser.add_argument("--model", default=os.environ.get("B2B_QWEN_MODEL", DEFAULT_MODEL))
    parser.add_argument("--max-tokens", type=int, default=int(os.environ.get("B2B_QWEN_MAX_TOKENS", "4096")))
    parser.add_argument("--timeout", type=int, default=int(os.environ.get("B2B_QWEN_TIMEOUT", "180")))
    # exe 기본값(callOpenAICompatOnce)과 일치: temperature=0.2.
    parser.add_argument("--temperature", type=float, default=float(os.environ.get("B2B_QWEN_TEMPERATURE", "0.2")))
    parser.add_argument("--repair-attempts", type=int, default=int(os.environ.get("B2B_QWEN_REPAIR_ATTEMPTS", "1")))
    parser.add_argument("--concurrency", type=int, default=int(os.environ.get("B2B_CONCURRENCY", "8")),
                        help="변형 동시 실행 수(기본 8). 변형은 자기완결적이라 스레드로 병렬화된다.")
    parser.add_argument("--case", action="append", help="Run only a specific case id. Can be repeated.")
    parser.add_argument("--dry-run", action="store_true", help="Do not call the model; only validate mock replies if present.")
    parser.add_argument("--schema-js", default=os.environ.get("B2B_SCHEMA_JS"),
                        help="VBA_SYSTEM_PROMPT 를 읽을 file-schema.js 경로(버전 비교용). 기본: 현재 작업본.")
    parser.add_argument("--label", default=os.environ.get("B2B_RUN_LABEL"),
                        help="리포트에 기록할 실행 라벨(예: baseline-0.4.9 / current).")

    # --- Sonnet 검수(폐쇄망 Windows COM 동작 판정) ---
    sonnet_group = parser.add_mutually_exclusive_group()
    sonnet_group.add_argument("--sonnet-review", dest="sonnet_review", action="store_true",
                              help="정적 통과 코드를 Anthropic Sonnet 으로 COM 동작/의도 검수(기본 켜짐).")
    sonnet_group.add_argument("--no-sonnet-review", dest="sonnet_review", action="store_false",
                              help="Sonnet 검수를 끄고 정적 검사만 수행.")
    parser.set_defaults(sonnet_review=os.environ.get("B2B_SONNET_REVIEW", "1") != "0")
    parser.add_argument("--summary", dest="summary", action="store_true", default=None,
                        help="Sonnet 으로 종합 평가 섹션 작성(기본: Sonnet 검수가 켜져 있으면 켜짐).")
    parser.add_argument("--no-summary", dest="summary", action="store_false",
                        help="종합 평가 섹션 생략.")
    parser.add_argument("--anthropic-api-key",
                        default=os.environ.get("ANTHROPIC_API_KEY", vba_sonnet_review.DEFAULT_ANTHROPIC_API_KEY))
    parser.add_argument("--anthropic-base-url",
                        default=os.environ.get("ANTHROPIC_BASE_URL", vba_sonnet_review.DEFAULT_ANTHROPIC_BASE_URL))
    parser.add_argument("--sonnet-model",
                        default=os.environ.get("B2B_SONNET_MODEL", vba_sonnet_review.DEFAULT_SONNET_MODEL))
    parser.add_argument("--sonnet-timeout", type=int, default=int(os.environ.get("B2B_SONNET_TIMEOUT", "120")))

    args = parser.parse_args(argv)
    if args.summary is None:
        args.summary = args.sonnet_review
    args.strategy = engine_strategy.get_strategy(args.mode)
    return args


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if not args.dry_run and not args.api_key:
        print("Missing API key. Set B2B_QWEN_API_KEY or pass --api-key.", file=sys.stderr)
        return 2
    if args.sonnet_review and not args.dry_run and not args.anthropic_api_key:
        print("Sonnet 검수가 켜졌지만 ANTHROPIC_API_KEY 가 없습니다. --no-sonnet-review 또는 --anthropic-api-key 사용.", file=sys.stderr)
        return 2
    print(f"[MODE] {args.strategy.name} ({args.strategy.report_label})", flush=True)
    cases = load_cases(args.case, mode=args.strategy.name)
    if not cases:
        print("No cases found.", file=sys.stderr)
        return 2
    system = build_system_prompt(args.strategy, args.schema_js)
    if args.schema_js:
        print(f"[SCHEMA] system prompt from {args.schema_js}", flush=True)
    if args.label:
        print(f"[LABEL] {args.label}", flush=True)
    # (case, variant) 평탄화 후 ThreadPoolExecutor 로 병렬 실행. run_case_variant 는
    # 자기완결적·순수 I/O 라 스레드 적합(네트워크 대기 중 GIL 해제). 결과는 제출 순서대로
    # 복원한다. 멀티턴 variant 는 내부에서 turn 을 순차 처리하므로 병렬 모델과 충돌 없음.
    pairs: list[tuple[dict[str, Any], dict[str, Any]]] = [
        (case, variant) for case in cases for variant in case.get("variants", [])
    ]

    def _error_result(case: dict[str, Any], variant: dict[str, Any], err: Exception) -> dict[str, Any]:
        return {
            "case_id": case["id"],
            "variant_id": variant["id"],
            "prompt": variant.get("prompt", ""),
            "reply": "",
            "language": None,
            "code": None,
            "check": {
                "status": "FAIL", "passed": [], "warnings": [],
                "failures": [f"Model request failed: {err}"], "needs_windows": [],
            },
            "elapsed_seconds": 0,
        }

    def _run_one(case: dict[str, Any], variant: dict[str, Any]) -> dict[str, Any]:
        label = f"{case['id']}/{variant['id']}"
        print(f"[RUN] {label}", flush=True)
        try:
            return run_case_variant(case, variant, args, system)
        except Exception as err:  # noqa: BLE001 — 한 변형 실패가 전체를 멈추지 않게 FAIL 로 격리
            print(f"[ERR] {label}: {err}", flush=True)
            return _error_result(case, variant, err)

    results: list[dict[str, Any]] = [None] * len(pairs)  # type: ignore[list-item]
    workers = max(1, min(args.concurrency, len(pairs))) if pairs else 1
    print(f"[PARALLEL] {workers} workers, {len(pairs)} variants", flush=True)
    if workers == 1:
        for i, (case, variant) in enumerate(pairs):
            results[i] = _run_one(case, variant)
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
            fut_to_idx = {pool.submit(_run_one, case, variant): i
                          for i, (case, variant) in enumerate(pairs)}
            for fut in concurrent.futures.as_completed(fut_to_idx):
                results[fut_to_idx[fut]] = fut.result()

    json_path, md_path = write_reports(results, args)
    summary = summarize(results)
    print(f"[DONE] {summary}", flush=True)
    if any(item.get("sonnet") for item in results):
        print(f"[SONNET] verdicts {sonnet_counts(results)}", flush=True)
    print(f"[REPORT] {json_path}", flush=True)
    print(f"[REPORT] {md_path}", flush=True)
    return 1 if summary["status"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
