#!/usr/bin/env python3
import http.server
import os
import socketserver
import urllib.error
import urllib.request


HOST = os.environ.get("KGM_HOST", "127.0.0.1")
PORT = int(os.environ.get("KGM_PORT", "8090"))
VLLM_BASE = os.environ.get(
    "KGM_VLLM_BASE",
    "http://canvas-ns-1727666527880704.mng.ip.violet.uplus.co.kr",
).rstrip("/")


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
        if self.path.startswith("/v1/"):
            self.proxy()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.startswith("/v1/"):
            self.proxy()
            return
        self.send_error(404)

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

        req = urllib.request.Request(
            target,
            data=body,
            headers=headers,
            method=self.command,
        )
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
        httpd.serve_forever()
