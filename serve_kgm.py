#!/usr/bin/env python3
import http.server
import json
import os
import socketserver
import threading
import urllib.error
import urllib.request
from pathlib import Path

HOST = os.environ.get("KGM_HOST", "127.0.0.1")
PORT = int(os.environ.get("KGM_PORT", "8090"))
VLLM_BASE = os.environ.get(
    "KGM_VLLM_BASE",
    "http://canvas-ns-1727666527880704.mng.ip.violet.uplus.co.kr",
).rstrip("/")

BASE_DIR = Path(os.environ.get("KGM_DATA_DIR", Path(__file__).resolve().parent))
DATA_DIR = BASE_DIR / "data"
SKILLS_FILE = DATA_DIR / "skills.json"
RUNS_FILE = DATA_DIR / "runs.json"

_file_lock = threading.Lock()


def _read_skills() -> list:
    try:
        return json.loads(SKILLS_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_skills(records: list) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    SKILLS_FILE.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_runs() -> list:
    try:
        return json.loads(RUNS_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _write_runs(records: list) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    RUNS_FILE.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


class KGMHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        if os.environ.get("KGM_LOG_REQUESTS") == "1":
            super().log_message(format, *args)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "authorization, content-type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/v1/"):
            self.proxy()
        elif path == "/api/dashboard":
            self.api_dashboard()
        else:
            super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path.startswith("/v1/"):
            self.proxy()
        elif path == "/api/skills":
            self.api_save_skill()
        elif path == "/api/runs":
            self.api_save_run()
        else:
            self.send_error(404)

    # ------------------------------------------------------------------
    # API handlers
    # ------------------------------------------------------------------
    def api_dashboard(self):
        with _file_lock:
            skills = _read_skills()
            runs = _read_runs()
        self._json_response({"skills": skills, "runs": runs})

    def api_save_skill(self):
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length) if length else b"{}"
        try:
            record = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        with _file_lock:
            records = _read_skills()
            records.append(record)
            _write_skills(records)
        self._json_response({"ok": True, "total": len(records)}, status=201)

    def api_save_run(self):
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length) if length else b"{}"
        try:
            record = json.loads(body)
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return
        with _file_lock:
            records = _read_runs()
            records.append(record)
            _write_runs(records)
        self._json_response({"ok": True, "total": len(records)}, status=201)

    def _json_response(self, data: dict, status: int = 200):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    # ------------------------------------------------------------------
    # VLLM proxy
    # ------------------------------------------------------------------
    def proxy(self):
        body = None
        if self.command in {"POST", "PUT", "PATCH"}:
            length = int(self.headers.get("content-length") or 0)
            body = self.rfile.read(length) if length else None

        target = VLLM_BASE + self.path
        headers = {}
        for key in ("authorization", "api-key", "content-type", "accept"):
            value = self.headers.get(key)
            if value:
                headers[key] = value
        if body is not None and "content-type" not in headers:
            headers["content-type"] = "application/json"

        req = urllib.request.Request(target, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                payload = resp.read()
                self.send_response(resp.status)
                for key, value in resp.headers.items():
                    if key.lower() in {"connection", "transfer-encoding", "content-encoding"}:
                        continue
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as err:
            payload = err.read()
            self.send_response(err.code)
            self.send_header("content-type", err.headers.get("content-type", "text/plain"))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as err:
            payload = f"Proxy error: {err}".encode("utf-8")
            self.send_response(502)
            self.send_header("content-type", "text/plain; charset=utf-8")
            self.send_header("content-length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)


if __name__ == "__main__":
    with socketserver.ThreadingTCPServer((HOST, PORT), KGMHandler) as httpd:
        httpd.allow_reuse_address = True
        print(f"KGM serving on http://{HOST}:{PORT}")
        print(f"Proxying /v1/* to {VLLM_BASE}/v1/*")
        print(f"Data dir: {DATA_DIR}")
        httpd.serve_forever()
