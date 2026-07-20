# -*- coding: utf-8 -*-
"""완료 이슈 재점검 러너 — 패치 누적으로 인한 사이드이펙트를 개발 PC 에서 일괄 검사한다.

프로그램 내 기능이 아니라 개발자 외부 도구다. registry.json 의 (이슈 ↔ 회귀 테스트) 매핑을 읽어
등록된 테스트를 전부 실행하고 이슈 단위 PASS/FAIL 스코어보드를 출력한다.

사용법 (레포 루트에서):
  python tools/issue_recheck/recheck.py              # 빠른 검사(node + 순수 python; Excel 불필요)
  python tools/issue_recheck/recheck.py --com        # 실제 Excel 을 띄우는 COM 실측까지 포함
  python tools/issue_recheck/recheck.py --only 한전   # id/제목 부분일치 필터
  python tools/issue_recheck/recheck.py --list       # 레지스트리 목록만 출력
  python tools/issue_recheck/recheck.py --csv 지라내보내기.csv   # 지라 완료 이슈와 대조(미자동화 목록)
  python tools/issue_recheck/recheck.py --serve      # 관리 대시보드(dashboard.html) 로컬 서버 기동
종료코드: 실패 있으면 1.
"""
import argparse
import csv
import io
import json
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent          # tools/issue_recheck/ → 레포 루트
HISTORY = HERE / "results_history.jsonl"

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

TIMEOUT = {"node": 120, "python": 180, "com": 420}


def load_registry():
    data = json.loads((HERE / "registry.json").read_text(encoding="utf-8"))
    return data["issues"]


def save_registry(issues):
    path = HERE / "registry.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    data["issues"] = issues
    backup = HERE / "registry.json.bak"
    backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_check(kind, rel_path):
    """단일 체크 실행. 반환: (ok, 초, 실패시 출력 꼬리)."""
    path = ROOT / rel_path
    if not path.exists():
        return False, 0.0, f"파일 없음: {rel_path}"
    cmd = ["node", str(path)] if kind == "node" else [sys.executable, str(path)]
    t0 = time.monotonic()
    try:
        p = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True,
                           encoding="utf-8", errors="replace",
                           timeout=TIMEOUT.get(kind, 180))
    except subprocess.TimeoutExpired:
        return False, time.monotonic() - t0, f"타임아웃({TIMEOUT.get(kind)}초)"
    tail = "\n".join(((p.stdout or "") + "\n" + (p.stderr or "")).strip().splitlines()[-6:])
    return p.returncode == 0, time.monotonic() - t0, tail


def run_issue(issue, include_com):
    """이슈 1건의 체크 전부 실행 → {id,title,status,checks:[...]}"""
    checks = []
    for kind, rel in issue["checks"]:
        if kind == "com" and not include_com:
            checks.append({"kind": kind, "path": rel, "status": "SKIP", "secs": 0.0, "tail": ""})
            continue
        ok, secs, tail = run_check(kind, rel)
        checks.append({"kind": kind, "path": rel, "status": "PASS" if ok else "FAIL",
                       "secs": round(secs, 1), "tail": "" if ok else tail})
    if any(c["status"] == "FAIL" for c in checks):
        status = "FAIL"
    elif any(c["status"] == "PASS" for c in checks):
        status = "PASS"
    else:
        status = "SKIP"
    return {"id": issue["id"], "title": issue["title"], "status": status, "checks": checks}


def append_history(entry):
    try:
        with open(HISTORY, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass


def read_history(limit=20):
    try:
        lines = HISTORY.read_text(encoding="utf-8").strip().splitlines()
        return [json.loads(l) for l in lines[-limit:]][::-1]
    except Exception:
        return []


def filter_issues(issues, only):
    if not only:
        return issues
    needle = only.lower()
    return [i for i in issues if needle in i["id"].lower() or needle in i["title"].lower()]


def cross_check_csv_text(text, issues):
    """지라 내보내기 CSV 텍스트와 레지스트리 대조 → dict 보고."""
    covered = {i["id"].upper() for i in issues}
    reader = csv.reader(io.StringIO(text.lstrip("﻿")))
    header = next(reader, [])

    def col(names):
        for n in names:
            for idx, h in enumerate(header):
                if n.lower() in str(h).lower():
                    return idx
        return -1

    k, s, st = col(["issue key", "이슈 키", "키"]), col(["summary", "요약"]), col(["status", "상태"])
    if k < 0:
        return {"error": "'이슈 키' 열을 찾지 못했습니다 — 지라에서 CSV(현재 필드) 내보내기를 사용하세요."}
    rows = []
    for row in reader:
        if len(row) <= k or not row[k].strip():
            continue
        key = row[k].strip().upper()
        status = row[st].strip() if 0 <= st < len(row) else ""
        summary = row[s].strip() if 0 <= s < len(row) else ""
        done = any(w in status for w in ("완료", "Done", "닫힘", "Closed", "Resolved"))
        rows.append({"key": key, "summary": summary, "status": status, "done": done,
                     "covered": key in covered})
    done_rows = [r for r in rows if r["done"]]
    uncovered = [r for r in done_rows if not r["covered"]]
    return {"total": len(rows), "done": len(done_rows),
            "coveredDone": len(done_rows) - len(uncovered), "uncovered": uncovered}


# ── CLI ──────────────────────────────────────────────────────────────────────

def cli_run(args):
    issues = filter_issues(load_registry(), args.only)
    if args.list:
        for i in issues:
            kinds = ",".join(sorted({k for k, _ in i["checks"]}))
            print(f"{i['id']:<28} [{kinds}] {i['title']}")
        return 0

    total_fail = 0
    skipped = 0
    results = []
    print(f"이슈 {len(issues)}건 재점검 시작 (COM 실측 {'포함' if args.com else '제외 — --com 으로 포함'})\n")
    for issue in issues:
        r = run_issue(issue, args.com)
        results.append(r)
        mark = {"PASS": "✅", "FAIL": "❌", "SKIP": "⏭"}[r["status"]]
        print(f"{mark} {r['id']} — {r['title']}")
        for c in r["checks"]:
            line = f"     {c['status']:<4} [{c['kind']}] {c['path']}"
            if c["status"] != "SKIP":
                line += f" ({c['secs']}s)"
            print(line)
            if c["status"] == "FAIL" and c["tail"]:
                for tl in c["tail"].splitlines():
                    print(f"          | {tl}")
            if c["status"] == "FAIL":
                total_fail += 1
            if c["status"] == "SKIP":
                skipped += 1
    print(f"\n=== 결과: {'전체 통과' if total_fail == 0 else str(total_fail) + '개 체크 실패'}"
          f"{f' (COM 실측 {skipped}건 건너뜀)' if skipped else ''} ===")
    append_history({"ts": datetime.now().isoformat(timespec="seconds"), "com": bool(args.com),
                    "only": args.only, "fail": total_fail,
                    "issues": [{"id": r["id"], "status": r["status"]} for r in results]})

    if args.csv:
        rep = cross_check_csv_text(Path(args.csv).read_text(encoding="utf-8-sig"), load_registry())
        if rep.get("error"):
            print("[CSV]", rep["error"])
        else:
            print(f"\n[지라 대조] 총 {rep['total']}건, 완료 {rep['done']}건, 자동화 커버 {rep['coveredDone']}건")
            for r in rep["uncovered"]:
                print(f"  {r['key']:<14} {r['summary'][:60]}")
    return 1 if total_fail else 0


# ── 대시보드 서버 (--serve) ──────────────────────────────────────────────────

RUN_STATE = {"running": False, "com": False, "startedAt": "", "results": [], "total": 0, "done": False}
RUN_LOCK = threading.Lock()


def _run_all_bg(include_com, only):
    issues = filter_issues(load_registry(), only)
    with RUN_LOCK:
        RUN_STATE.update({"running": True, "com": include_com, "results": [],
                          "startedAt": datetime.now().isoformat(timespec="seconds"),
                          "total": len(issues), "done": False})
    fail = 0
    for issue in issues:
        r = run_issue(issue, include_com)
        fail += sum(1 for c in r["checks"] if c["status"] == "FAIL")
        with RUN_LOCK:
            RUN_STATE["results"].append(r)
    with RUN_LOCK:
        RUN_STATE.update({"running": False, "done": True})
    append_history({"ts": datetime.now().isoformat(timespec="seconds"), "com": include_com,
                    "only": only, "fail": fail,
                    "issues": [{"id": r["id"], "status": r["status"]}
                               for r in RUN_STATE["results"]]})


def serve(port):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

    class H(BaseHTTPRequestHandler):
        def _json(self, obj, status=200):
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _body(self):
            n = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(n).decode("utf-8")) if n else {}

        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path in ("/", "/dashboard.html"):
                body = (HERE / "dashboard.html").read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            if self.path == "/api/registry":
                return self._json({"issues": load_registry()})
            if self.path == "/api/status":
                with RUN_LOCK:
                    return self._json(dict(RUN_STATE))
            if self.path == "/api/history":
                return self._json({"runs": read_history()})
            self.send_response(404)
            self.end_headers()

        def do_POST(self):
            try:
                if self.path == "/api/run":
                    with RUN_LOCK:
                        if RUN_STATE["running"]:
                            return self._json({"error": "이미 실행 중입니다."}, 409)
                    p = self._body()
                    threading.Thread(target=_run_all_bg,
                                     args=(bool(p.get("com")), str(p.get("only") or "")),
                                     daemon=True).start()
                    return self._json({"ok": True})
                if self.path == "/api/registry":
                    p = self._body()
                    issues = p.get("issues")
                    if not isinstance(issues, list) or not all(
                            isinstance(i, dict) and i.get("id") and i.get("title")
                            and isinstance(i.get("checks"), list) for i in issues):
                        return self._json({"error": "형식 오류: issues[{id,title,checks[[type,path]]}]"}, 400)
                    save_registry(issues)
                    return self._json({"ok": True})
                if self.path == "/api/csv":
                    p = self._body()
                    return self._json(cross_check_csv_text(str(p.get("content") or ""), load_registry()))
            except Exception as err:
                return self._json({"error": str(err)}, 500)
            self.send_response(404)
            self.end_headers()

    srv = ThreadingHTTPServer(("127.0.0.1", port), H)
    print(f"이슈 재점검 대시보드: http://127.0.0.1:{port}/  (Ctrl+C 로 종료)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


def main():
    ap = argparse.ArgumentParser(description="완료 이슈 재점검 러너")
    ap.add_argument("--com", action="store_true", help="실제 Excel COM 실측 테스트 포함")
    ap.add_argument("--only", default="", help="id/제목 부분일치 필터")
    ap.add_argument("--list", action="store_true", help="레지스트리 목록만 출력")
    ap.add_argument("--csv", default="", help="지라 내보내기 CSV 로 완료 이슈 커버리지 대조")
    ap.add_argument("--serve", action="store_true", help="관리 대시보드 로컬 서버 기동")
    ap.add_argument("--port", type=int, default=8765, help="--serve 포트(기본 8765)")
    args = ap.parse_args()
    if args.serve:
        return serve(args.port)
    return cli_run(args)


if __name__ == "__main__":
    sys.exit(main())
