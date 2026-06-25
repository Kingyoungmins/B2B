# VBA Regression Checklist

This harness checks whether Qwen-generated VBA follows B2B Excel skill rules
before Windows Excel COM E2E testing.

> **개발/품질평가 전용 — exe 런타임이 아님.** 이 폴더(`tests/vba_regression/`)의
> 모든 코드(러너 · Sonnet 검수 · 정적체크)는 **VBA 품질 개선 작업 시 Qwen 생성물의
> 품질을 체크리스트 기준으로 정량/정성 평가**하기 위한 것입니다. 배포되는 exe 의
> 추론 경로(채팅 → VBA 생성 → 적용)에는 **포함되지 않으며, Sonnet 검수는 실제
> 사용자 실행 시 절대 호출되지 않습니다.** (exe 패키징은 `launch_b2b.spec` 이
> `scripts/` 만 수집하고 `tests/` 는 수집하지 않습니다. exe 런타임의 안전망은
> `scripts/pipeline.js` 의 정적 검증 + `scripts/chat-ui.js` 의 에러 복구 루프이며,
> 이는 Anthropic 호출 없이 동작합니다.)

## 평가 모드 — Python(openpyxl) 이 디폴트

이 하네스는 두 가지 생성 언어를 평가한다. **기본값은 Python** 이다.

```sh
# 기본: Python(openpyxl) 평가 — 0.4.8 의 def transform(ctx) 스킬 기준
python3 tests/vba_regression/vba_regression_runner.py            # = --mode python
# 기존 VBA 평가
python3 tests/vba_regression/vba_regression_runner.py --mode vba
```

- **`--mode python`** (디폴트): `ver0.4.8` 가 생성하던 **Python 스킬**(`def transform(ctx):`,
  openpyxl)을 평가한다. 시스템 프롬프트는 `vendor/file_schema_048.js` 의 `SYSTEM_PROMPT`
  (+ `PYTHON_EXCEL_SKILL_RULE`/`FORMULA_OVERWRITE_RULE`) + `vendor/openpyxl_engine_note.txt`
  를 조립해 쓴다(0.4.8 원본에서 vendoring, `vendor/README.md` 참고).
- **`--mode vba`**: 현재 작업본 `scripts/file-schema.js` 의 `VBA_SYSTEM_PROMPT` 로 VBA 를
  평가한다(현행과 동일 — 회귀 없음).

리포트 파일은 모드 접두사로 구분된다: `reports/python_regression_*.{md,json}` /
`reports/vba_regression_*.{md,json}`.

### Python 평가의 4단계 (정답 기준 엔진 = openpyxl 인프로세스)

1. **생성** — Qwen 이 `def transform(ctx):` 코드를 만든다(VBA 와 동일 파라미터).
2. **정적 체크** (`python_static_checks.py`) — 진입점(`transform(ctx)` AST), 금지 import
   (os/sys/subprocess/pathlib…), **COM 전용 호출 차단**(openpyxl 엔진엔 없음: `src.Copy(dest)`,
   `PasteSpecial`, `AutoFilter`, `Range.End/Offset`, `Worksheet.Copy`, `EntireColumn/EntireRow.Insert`,
   `ctx.excel`), 각 risk_rule 의 openpyxl 판(숨김=`column_dimensions/row_dimensions[..].hidden`,
   삽입=`insert_cols/insert_rows`, 병합=`merge_cells/unmerge_cells`).
3. **exec 검증** (`python_exec_verifier.py`) — **0.4.8 의 openpyxl 엔진을 vendoring** 해
   생성 코드를 샌드박스에서 실제로 `exec → transform(ctx)` 한 뒤, 변형의 선택적 `assert`
   블록을 결과 워크북에 대조한다(Mac 로컬에서 끝까지 검증 가능). 입력은 `data_only=True`
   (계산값), 출력 템플릿은 매 호출 메모리 사본으로 연다(디스크 미기록).
   - **중요 한계:** openpyxl 은 **수식을 재계산하지 않는다.** 출력 수식 셀은 `=B4-C4` 문자열로
     보존되며, `data_only` 로도 캐시값이 없으면 `None`. → exec assert 는 Excel 재계산 '숫자'를
     확인할 수 없고, (a) **수식 문자열 보존**, (b) **Python 으로 계산 가능한 입력값**,
     (c) 숨김/병합/시트추가 같은 **구조 변화**만 본다. 수식 결과 숫자가 필요하면 코드가
     Python 으로 직접 계산해 넣어야 한다.
   - 또 `insert_cols/insert_rows` 는 openpyxl 에서 **수식 참조를 자동 보정하지 않는다**(VBA 와
     핵심 차이) — 그 결과는 NEEDS_WINDOWS 로 남긴다.
4. **Sonnet 검수** (`python_sonnet_review.py`) — premise 가 "이 코드를 **openpyxl 인프로세스로
   실행**했을 때"로 바뀐다. 판정(verdict/simulated_cells/output_matches_expected …) 키는 VBA 와
   동일하게 유지하되, **코드 자체를 검수**해서 다음을 추가 산출한다:
   `suggested_code`(openpyxl 로 더 잘 짠 코드) · `openpyxl_capabilities`(openpyxl 로 더 가능한 것)
   · `prompt_control_suggestions`(Qwen 을 유도할 SYSTEM_PROMPT 추가 규칙 문장)
   · `qwen_failure_pattern`(실패 유형 태그). 리포트 종합 평가는 이를 모아
   **"프롬프트에 추가하면 좋을 규칙 TOP N"**(`prompt_control_top`) 표로 집계한다 — 0.4.8 프롬프트
   개선의 직접 재료.

### 변형 `assert` 블록 스키마 (exec 검증용, 선택)

케이스/변형에 `"assert": {...}` 를 달면 exec 검증이 결과 워크북에 머신 체크한다(없으면 '실행만'
확인하고 Sonnet 에 위임). 시트 지정은 `회사별요약!D4` 또는 `assert_sheet` 사용.

```jsonc
"assert": {
  "assert_sheet": "회사별요약",
  "expect_cells": { "월별실적!B4": { "value": 31139 },        // 값(approx 허용)
                    "월별실적!C4": { "is_formula": true },    // 수식 문자열인가
                    "회사별요약!A1": { "text": "청구 요약" } },// 텍스트 일치
  "expect_formula_preserved": ["회사별요약!D4", "회사별요약!B24"], // '=' 로 시작(수식 보존)
  "expect_hidden_cols": ["B","C","D"],   // column_dimensions[..].hidden
  "expect_hidden_rows": [4,5],           // row_dimensions[..].hidden
  "expect_merged":   ["A1:E1"],          // 병합 유지
  "expect_unmerged": ["A1:E1"],          // 병합 해제
  "expect_sheet_added": "완료건",         // 실행 전 없던 시트가 생김
  "expect_no_change_to": ["회사별요약!D4"], // 실행 전 대비 불변
  "expect_raises": true                  // 대상 없음/0건이면 raise 해야 통과
}
```

케이스는 `checks_by_mode: { "vba": {...}, "python": {...} }` 로 두 모드의 정적 체크를 함께
담는다(로더가 모드별로 `checks` 로 끌어올림; 없으면 top-level `checks` 를 vba 폴백).

The (VBA) flow is two-stage:

1. **Qwen generation** — the local vLLM endpoint generates VBA from each
   checklist prompt, using the same generation parameters as the packaged exe
   (`temperature=0.2`, `max_tokens=4096`, `/no_think`). A static failure is fed
   back once for a repair attempt. The prompt the model sees is grounded in the
   **real `test_data/` workbooks** (회사별요약/매출/원가/월별실적), auto-summarized
   by `test_data_schema.py` — not a synthetic schema.
2. **Static checks** (`vba_static_checks.py`) — fast regex/intent gate for
   forbidden patterns (`On Error Resume Next`, `MsgBox`, destructive
   `Delete`/`Clear`, all-worksheet loops, wrong output cell, etc.).
3. **Sonnet review** (`vba_sonnet_review.py`) — code that passes the static
   gate is sent to Anthropic Sonnet (`claude-sonnet-4-6`). The review premise is
   explicit: Sonnet predicts the result of **running this VBA via Python COM
   (`win32com.client` → `Excel.Application`, inject + `Application.Run`) on a
   low-spec closed-network (offline) Windows PC**. It first writes
   `simulated_cells` (what each target cell actually *becomes* — value or
   formula), compares against the case's `expected` (→ `output_matches_expected`),
   then judges intent/scope/formula-preservation and COM-runtime failure
   (subscript-out-of-range, latent 1004 on merged/protected cells, formula loss
   from rewriting a whole range, no-op). It also returns a `suggested_vba`
   ("how Sonnet would have written it") + `suggested_rationale`, used as the
   direct basis for prompt/logic improvements. A Sonnet `FAIL` promotes the case
   to `FAIL`; a `RISK` adds a warning. Sonnet also writes a Korean
   "종합 평가/위험 요약/권고" section at the top of each report.

### Parallelism, multi-turn, retry

- **Parallel** — variants run concurrently via a thread pool. Control with
  `--concurrency N` (default 8, env `B2B_CONCURRENCY`); each variant is
  self-contained network I/O, so the full 45-variant suite finishes in minutes
  instead of ~50. Result order is preserved; one variant's error is isolated as
  a `FAIL` and does not stop the run.
- **Multi-turn cases** — a case variant may define `turns: [{prompt, ...}]`
  instead of a single `prompt`. The runner replays prior turns to build real
  conversation history (`messages=[system, *history, user]`, capped at 18
  msgs / 32000 chars, matching the exe's `getLLMChatHistory`) and **grades only
  the last turn**. A prior turn with `inject_assistant: "..."` injects a fixed
  assistant message instead of calling Qwen — used to deterministically
  reproduce an "interrupted/failed previous task" state. See
  `cases/multiturn_context.json` (separate / feedback-refine / failure-then-next).
- **Retry** — the Qwen (and Sonnet) call mirrors the exe's
  `scripts/llm-api.js`: up to 3 attempts, `700ms × attempt` linear backoff,
  retrying only on 408/429/5xx and network errors (timeout/connection/socket);
  never on a clean response.

## Run

API defaults are already configured for the current local vLLM endpoint:

```bat
set B2B_QWEN_BASE_URL=http://192.168.219.111:8000/v1
set B2B_QWEN_API_KEY=khkim
set B2B_QWEN_MODEL=Qwen/Qwen3.6-27B-FP8
```

Run the full checklist (8-way parallel by default):

```bat
python tests\vba_regression\vba_regression_runner.py
:: tune parallelism
python tests\vba_regression\vba_regression_runner.py --concurrency 8
```

On macOS/Linux:

```sh
B2B_QWEN_BASE_URL=http://192.168.219.111:8000/v1 \
B2B_QWEN_API_KEY=khkim \
B2B_QWEN_MODEL=Qwen/Qwen3.6-27B-FP8 \
python3 tests/vba_regression/vba_regression_runner.py --concurrency 8
```

Default generation settings match the packaged exe (`callOpenAICompatOnce`):

```text
temperature=0.2
max_tokens=4096
repair_attempts=1
```

Run one case:

```bat
python tests\vba_regression\vba_regression_runner.py --case hidden_columns
```

Reports are written to:

```text
tests\vba_regression\reports\
```

## Sonnet COM review

The Sonnet review stage is **on by default**. The Anthropic key is stored as a
default in `vba_sonnet_review.py` (override with `ANTHROPIC_API_KEY`), so it runs
out of the box on a network that can reach `api.anthropic.com`.

```bat
:: default — Qwen generate + static + Sonnet review + Sonnet summary
python tests\vba_regression\vba_regression_runner.py

:: static checks only (no Anthropic calls, e.g. fully offline)
python tests\vba_regression\vba_regression_runner.py --no-sonnet-review

:: keep per-case Sonnet review but skip the synthesized summary section
python tests\vba_regression\vba_regression_runner.py --no-summary
```

Relevant env vars / flags:

```text
ANTHROPIC_API_KEY     overrides the stored default key (recommended)
ANTHROPIC_BASE_URL    default https://api.anthropic.com/v1 (a bare host is also normalized)
B2B_SONNET_MODEL      default claude-sonnet-4-6   (--sonnet-model)
B2B_SONNET_REVIEW=0   disable Sonnet review       (--no-sonnet-review)
B2B_SONNET_TIMEOUT    per-call timeout seconds    (--sonnet-timeout)
```

Cost note: report writing itself uses no credits. Only the Qwen generate/repair
calls (local vLLM) and the Sonnet review/summary calls (Anthropic) consume
resources. Sonnet is only called on statically-passing code, so a static `FAIL`
that survives repair never reaches Sonnet.

## Result Status

- `PASS`: static, checklist, and Sonnet checks all passed.
- `WARN`: likely usable, but has risk patterns (incl. a Sonnet `RISK`).
- `FAIL`: format/safety/checklist violation, or a Sonnet `FAIL` (intent or COM mismatch).
- `NEEDS_WINDOWS`: static checks are fine; real Excel COM/workbook diff still required.

Each per-case block also carries a **Sonnet COM 검수** line with the verdict
(`PASS`/`RISK`/`FAIL`), the COM-run / intent-match / scope / formula-preservation
flags, the rationale, and any risks / required fixes. The JSON report stores the
full Sonnet object per result under `sonnet`, aggregate `sonnet_counts`, and the
synthesized `sonnet_summary`.

Each report also includes `Attempts`. Attempt `0` is the first model output.
Attempt `1` means the runner gave the static failure reasons back to the model
and accepted the repaired VBA.

## Current Checklist Themes

- Hidden columns must use `.Hidden = True`, not delete/clear.
- Explicit output cell requests must target the requested cell.
- Formula/format preserving copy should use Excel `Copy Destination` or `PasteSpecial xlPasteAll`.
- Single-sheet requests must not loop over every worksheet.
- Formula columns should not be overwritten with fixed values.
- New requests should not repeat or erase previous pipeline work.
