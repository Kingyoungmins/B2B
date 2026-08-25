# -*- coding: utf-8 -*-
"""AXCell Runner MCP 서버 — ixi-flow 빌트인 MCP 계약(stdio JSON-RPC) 구현.

도구 5개:
  check_inputs     스킬 요구 입력 ↔ 디렉토리 자동 매핑 검증 (동기, 수 초)
  run_start        스킬 실행 시작 (백그라운드 스레드) → run_id 즉시 반환
  run_report       실행 상태/진행(step/total)/이벤트 테일 (즉시 스냅샷 — 롱폴 없음)
  run_stop         실행 취소 (스텝 경계 취소 + Excel 프로세스 강제 종료)
  package_outputs  출력 검증 후 zip 생성 (동기)

ixi-flow 계약 준수사항:
  - stdout 은 JSON-RPC 응답만. 모든 로그는 stderr (builtin-mcp-integration-guide §1.1).
  - run_report 는 즉시 스냅샷 반환 — 뮤텍스를 오래 쥐지 않는다 (§1.2, §3.3).
  - 결과는 JSON 텍스트 (§1.3). 이벤트 테일은 after_cursor/max_events/include_events (§3.4).
  - 상태 어휘: running / completed / failed / cancelled (§3.1).

외부 의존성 0 — 표준 라이브러리만 사용(폐쇄망 self-contained).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
import uuid

from . import runner_core as core

PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "axcell_runner", "version": "0.1.0"}

# ---------------------------------------------------------------------------
# 런 레지스트리 (프로세스 내 메모리 — 서버 수명과 함께)
# ---------------------------------------------------------------------------
RUNS: dict[str, dict] = {}
RUNS_LOCK = threading.Lock()
MAX_FINISHED_RUNS = 20


def _log(*a):
    print("[axcell_runner-mcp]", *a, file=sys.stderr, flush=True)


def _active_run():
    with RUNS_LOCK:
        for r in RUNS.values():
            if r["status"] == "running":
                return r
    return None


def _trim_finished():
    with RUNS_LOCK:
        done = [r for r in RUNS.values() if r["status"] != "running"]
        done.sort(key=lambda r: r["ended_at"] or 0)
        while len(done) > MAX_FINISHED_RUNS:
            old = done.pop(0)
            RUNS.pop(old["run_id"], None)


def _event_summary(e):
    """ixi-flow 채팅 카드/로그가 뽑아 쓰는 사람용 한 줄(summary 키 우선 — DelegatedRunLog.tsx)."""
    t = e.get("type")
    if t == "step":
        label = e.get("step_label") or e.get("language") or ""
        return f"[{e.get('step')}/{e.get('total_steps')}] {label}".strip()
    if t == "open":
        return f"열기: {e.get('file')}"
    if t == "warning":
        return f"경고: {e.get('message')}"
    if t == "saved":
        return "저장 완료: " + ", ".join(e.get("files") or [])
    return t or "event"


def _run_worker(run):
    def on_event(e):
        with RUNS_LOCK:
            run["cursor"] += 1
            e = dict(e)
            # seq: ixi-flow event_batch 가 '숫자 seq 없는 이벤트는 버림'(background_runs.rs) — 필수.
            e["seq"] = run["cursor"]
            e["cursor"] = run["cursor"]   # 하위호환(우리 CLI/테스트용)
            e["summary"] = _event_summary(e)
            e["ts"] = time.time()
            run["events"].append(e)
            if e.get("type") == "step":
                run["step"] = e.get("step") or run["step"]
                run["total_steps"] = e.get("total_steps") or run["total_steps"]
                run["step_label"] = e.get("step_label") or ""
    try:
        result = core.run(run["skill_zip"], run["input_dir"], run["out_dir"],
                          on_event=on_event, cancel=run["cancel"],
                          excel_pid_holder=run["excel"])
        zip_info = None
        if run["make_zip"]:
            zip_info = core.package_outputs(result["out_dir"], run["zip_path"])
            if not zip_info.get("ok"):
                raise RuntimeError("출력 검증 실패: " + "; ".join(zip_info.get("problems") or []))
        with RUNS_LOCK:
            run["status"] = "completed"
            run["result"] = result
            if zip_info:
                run["result"]["out_zip"] = zip_info["zip_path"]
    except core.RunCancelled:
        with RUNS_LOCK:
            run["status"] = "cancelled"
    except Exception as e:
        _log("run failed:", repr(e))
        with RUNS_LOCK:
            run["status"] = "failed"
            run["error"] = str(e)
    finally:
        with RUNS_LOCK:
            run["ended_at"] = time.time()
        _trim_finished()


# ---------------------------------------------------------------------------
# 도구 구현
# ---------------------------------------------------------------------------
def tool_check_inputs(args):
    return core.check_inputs(args["skill_zip"], args["input_dir"])


def tool_run_start(args):
    if _active_run() is not None:
        return {"ok": False, "error": "이미 실행 중인 런이 있습니다. run_report 로 종료를 기다리거나 run_stop 후 다시 시작하세요."}
    # 시작 전 매핑 검증 — 실패를 3~5분 뒤가 아니라 즉시 알림
    chk = core.check_inputs(args["skill_zip"], args["input_dir"])
    if not chk["ok"]:
        return {"ok": False, "error": "입력 파일 매핑 실패", "unmatched": chk["unmatched"],
                "required": chk["required"]}
    run_id = "run_" + uuid.uuid4().hex[:12]
    out_dir = args.get("out_dir") or str(os.path.join(args["input_dir"], "skill_out"))
    make_zip = bool(args.get("make_zip", True))
    zip_path = args.get("zip_path") or (str(out_dir).rstrip("\\/") + ".zip")
    run = {
        "run_id": run_id, "status": "running",
        "skill": chk["skill"], "title": chk["skill"],
        "skill_zip": args["skill_zip"], "input_dir": args["input_dir"],
        "out_dir": out_dir, "make_zip": make_zip, "zip_path": zip_path,
        "step": 0, "total_steps": chk["total_steps"], "step_label": "",
        "events": [], "cursor": 0,
        "cancel": threading.Event(), "excel": {},
        "result": None, "error": None,
        "started_at": time.time(), "ended_at": None,
    }
    with RUNS_LOCK:
        RUNS[run_id] = run
    t = threading.Thread(target=_run_worker, args=(run,), name="axcell-runner-run", daemon=True)
    run["thread"] = t
    t.start()
    return {"ok": True, "run_id": run_id, "status": "running",
            "skill": chk["skill"], "total_steps": chk["total_steps"],
            "out_dir": out_dir, "make_zip": make_zip, "zip_path": zip_path if make_zip else None}


def tool_run_report(args):
    run_id = args.get("run_id")
    with RUNS_LOCK:
        run = RUNS.get(run_id)
    if run is None:
        return {"ok": False, "run_id": run_id, "status": "failed", "error": "unknown run_id"}
    after = args.get("after_cursor")
    limit = int(args.get("max_events") or 50)
    include = bool(args.get("include_events", after is not None))
    with RUNS_LOCK:
        events = []
        start = int(after or 0)          # 하네스는 next_cursor 문자열을 그대로 되돌려줌
        if include or after is not None:
            events = [e for e in run["events"] if e["seq"] > start][:limit]
        latest = events[-1]["seq"] if events else start
        rep = {
            "ok": True, "run_id": run_id, "status": run["status"],
            "skill": run["skill"],
            "step": run["step"], "total_steps": run["total_steps"],
            "step_label": run["step_label"],
            # ixi-flow event_batch 계약: {items, next_cursor(문자열)} — next_cursor 가 다음 폴의
            # after_cursor 로 돌아온다(plain 배열이면 커서가 안 이어져 매 폴 첫 페이지 재전송).
            "cursor": latest,
            "events": {"items": events, "next_cursor": str(latest)},
        }
        if run["status"] == "completed" and run["result"]:
            rep.update({"out_dir": run["result"]["out_dir"], "files": run["result"]["files"]})
            if run["result"].get("out_zip"):
                rep["out_zip"] = run["result"]["out_zip"]
        if run["status"] == "failed":
            rep["error"] = run["error"]
    return rep


def tool_run_stop(args):
    run_id = args.get("run_id")
    with RUNS_LOCK:
        run = RUNS.get(run_id)
    if run is None:
        return {"ok": False, "run_id": run_id, "status": "failed", "error": "unknown run_id"}
    if run["status"] != "running":
        return {"ok": True, "run_id": run_id, "status": run["status"]}
    run["cancel"].set()
    # 스텝 경계 취소를 기다리지 않고 Excel 프로세스를 직접 내린다 — 긴 VBA 스텝 중간에도 멈추게.
    pid = (run.get("excel") or {}).get("pid")
    if pid:
        try:
            subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"],
                           capture_output=True, timeout=15)
        except Exception as e:
            _log("taskkill failed:", repr(e))
    t = run.get("thread")
    if t is not None:
        t.join(timeout=20)
    with RUNS_LOCK:
        if run["status"] == "running":     # 워커가 아직 정리 중이어도 사용자 관점 상태는 확정
            run["status"] = "cancelled"
            run["ended_at"] = time.time()
    return {"ok": True, "run_id": run_id, "status": "cancelled"}


def tool_package_outputs(args):
    return core.package_outputs(args["out_dir"], args["zip_path"],
                                expect_files=args.get("expect_files"))


TOOLS = [
    {
        "name": "check_inputs",
        "description": "스킬(zip)이 요구하는 입력 파일이 디렉토리에 다 있는지 자동 매핑으로 검사한다. 실행하지 않는다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_zip": {"type": "string", "description": "스킬 zip 절대경로"},
                "input_dir": {"type": "string", "description": "입력 엑셀 파일들이 모인 디렉토리 절대경로"},
            },
            "required": ["skill_zip", "input_dir"],
        },
        "handler": tool_check_inputs,
    },
    {
        "name": "run_start",
        "description": "스킬 실행을 시작한다(백그라운드, 수 분 소요). run_id 를 즉시 반환하며 진행은 run_report 로 조회.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "skill_zip": {"type": "string", "description": "스킬 zip 절대경로"},
                "input_dir": {"type": "string", "description": "입력 디렉토리 절대경로"},
                "out_dir": {"type": "string", "description": "출력 디렉토리(기본: <input_dir>/skill_out). 원본은 수정되지 않음"},
                "make_zip": {"type": "boolean", "description": "완료 시 출력 검증 후 zip 생성(기본 true)"},
                "zip_path": {"type": "string", "description": "결과 zip 경로(기본: <out_dir>.zip)"},
            },
            "required": ["skill_zip", "input_dir"],
        },
        "handler": tool_run_start,
    },
    {
        "name": "run_report",
        "description": "실행 상태를 즉시 보고한다: status(running/completed/failed/cancelled), step/total_steps, 이벤트 테일.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "run_id": {"type": "string"},
                "after_cursor": {"type": "integer", "description": "이 커서 이후 이벤트만 반환"},
                "max_events": {"type": "integer", "description": "이벤트 최대 개수(기본 50)"},
                "include_events": {"type": "boolean", "description": "커서 없이 첫 페이지 이벤트 포함"},
                "max_wait_seconds": {"type": "integer", "description": "호환용 — 무시되고 항상 즉시 스냅샷"},
            },
            "required": ["run_id"],
        },
        "handler": tool_run_report,
    },
    {
        "name": "run_stop",
        "description": "실행 중인 런을 취소한다(Excel 프로세스 종료 포함).",
        "inputSchema": {
            "type": "object",
            "properties": {"run_id": {"type": "string"}},
            "required": ["run_id"],
        },
        "handler": tool_run_stop,
    },
    {
        "name": "package_outputs",
        "description": "출력 디렉토리의 엑셀 파일들을 검증(존재/0바이트/기대목록)하고 zip 으로 묶는다.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "out_dir": {"type": "string", "description": "출력 디렉토리 절대경로"},
                "zip_path": {"type": "string", "description": "만들 zip 절대경로"},
                "expect_files": {"type": "array", "items": {"type": "string"},
                                  "description": "반드시 포함돼야 할 파일명 목록(선택)"},
            },
            "required": ["out_dir", "zip_path"],
        },
        "handler": tool_package_outputs,
    },
]
_TOOL_BY_NAME = {t["name"]: t for t in TOOLS}


# ---------------------------------------------------------------------------
# JSON-RPC 2.0 / MCP stdio 루프
# ---------------------------------------------------------------------------
def _reply(msg_id, result=None, error=None):
    out = {"jsonrpc": "2.0", "id": msg_id}
    if error is not None:
        out["error"] = error
    else:
        out["result"] = result
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _handle(msg):
    method = msg.get("method")
    msg_id = msg.get("id")
    params = msg.get("params") or {}
    if method == "initialize":
        _reply(msg_id, {
            "protocolVersion": params.get("protocolVersion") or PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": SERVER_INFO,
        })
    elif method in ("notifications/initialized", "notifications/cancelled"):
        pass  # 알림 — 응답 없음
    elif method == "ping":
        _reply(msg_id, {})
    elif method == "tools/list":
        _reply(msg_id, {"tools": [
            {"name": t["name"], "description": t["description"], "inputSchema": t["inputSchema"]}
            for t in TOOLS]})
    elif method == "tools/call":
        name = params.get("name")
        args = params.get("arguments") or {}
        tool = _TOOL_BY_NAME.get(name)
        if tool is None:
            _reply(msg_id, error={"code": -32602, "message": f"unknown tool: {name}"})
            return
        try:
            result = tool["handler"](args)
            is_error = isinstance(result, dict) and result.get("ok") is False
            _reply(msg_id, {
                "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False)}],
                "isError": bool(is_error),
            })
        except Exception as e:
            _log(f"tool {name} error:", repr(e))
            _reply(msg_id, {
                "content": [{"type": "text",
                             "text": json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False)}],
                "isError": True,
            })
    else:
        if msg_id is not None:
            _reply(msg_id, error={"code": -32601, "message": f"method not found: {method}"})


def main():
    # Windows 콘솔 인코딩과 무관하게 항상 UTF-8 (한글 파일명/JSON)
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except Exception:
            pass
    try:
        sys.stdin.reconfigure(encoding="utf-8")
    except Exception:
        pass
    _log("axcell_runner MCP server start (pid=%d)" % os.getpid())
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception:
            _log("bad json line (ignored):", line[:200])
            continue
        try:
            _handle(msg)
        except Exception as e:
            _log("handler crash:", repr(e))
            if msg.get("id") is not None:
                _reply(msg.get("id"), error={"code": -32603, "message": str(e)})
    _log("stdin closed — exiting")


if __name__ == "__main__":
    main()
