#!/usr/bin/env python3
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from functools import partial
from pathlib import Path

from serve_kgm import KGMHandler, PORT as DEFAULT_PORT, cleanup_node_worker

import socketserver


LAUNCH_HOST = os.environ.get("KGM_LAUNCH_HOST", "127.0.0.1")
SERVER_HOST = os.environ.get("KGM_HOST", "127.0.0.1")
BASE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
HEARTBEAT_TIMEOUT_SECONDS = 20
EMPTY_CLIENT_GRACE_SECONDS = 1


def candidate_ports() -> list[int]:
    requested = int(os.environ.get("KGM_PORT", str(DEFAULT_PORT)))
    ports = [requested, 18090, 18091, 18092, 18093, 18094, 18095]
    result = []
    for port in ports:
        if port not in result:
            result.append(port)
    return result


def wait_for_server(url: str, timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as resp:
                if 200 <= resp.status < 500:
                    return True
        except Exception:
            time.sleep(0.3)
    return False


def is_port_available(host: str, port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            sock.bind((host, port))
            return True
    except OSError:
        return False


class ReusableThreadingTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = False
    daemon_threads = True


class BrowserLifecycle:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.sessions = {}
        self.had_client = False
        self.empty_since = None

    def ping(self, session_id: str) -> None:
        now = time.time()
        with self.lock:
            self.sessions[session_id] = now
            self.had_client = True
            self.empty_since = None

    def close(self, session_id: str) -> None:
        now = time.time()
        with self.lock:
            self.sessions.pop(session_id, None)
            if self.had_client and not self.sessions and self.empty_since is None:
                self.empty_since = now

    def should_stop(self) -> bool:
        now = time.time()
        with self.lock:
            stale = [
                session_id for session_id, last_seen in self.sessions.items()
                if now - last_seen > HEARTBEAT_TIMEOUT_SECONDS
            ]
            for session_id in stale:
                self.sessions.pop(session_id, None)
            if self.had_client and not self.sessions:
                if self.empty_since is None:
                    self.empty_since = now
                return now - self.empty_since >= EMPTY_CLIENT_GRACE_SECONDS
            return False


def app_url(port: int) -> str:
    return f"http://{LAUNCH_HOST}:{port}/index.html"


def read_session_id(handler) -> str:
    length = int(handler.headers.get("content-length") or 0)
    raw = handler.rfile.read(length) if length else b""
    session_id = raw.decode("utf-8", errors="ignore").strip()
    return session_id or "default"


def make_handler(lifecycle: BrowserLifecycle):
    class LifecycleHandler(KGMHandler):
        def do_POST(self):
            if self.path == "/__kgm_ping":
                lifecycle.ping(read_session_id(self))
                self.send_response(204)
                self.end_headers()
                return
            if self.path == "/__kgm_close":
                lifecycle.close(read_session_id(self))
                self.send_response(204)
                self.end_headers()
                return
            super().do_POST()

    return partial(LifecycleHandler, directory=str(BASE_DIR))


def start_server(port: int, lifecycle: BrowserLifecycle) -> ReusableThreadingTCPServer:
    handler = make_handler(lifecycle)
    httpd = ReusableThreadingTCPServer((SERVER_HOST, port), handler)
    thread = threading.Thread(target=httpd.serve_forever, name="kgm-http-server", daemon=True)
    thread.start()
    return httpd


def start_lifecycle_monitor(lifecycle: BrowserLifecycle, shutdown_event: threading.Event) -> None:
    def monitor():
        while not shutdown_event.wait(1):
            if lifecycle.should_stop():
                shutdown_event.set()
                return

    thread = threading.Thread(target=monitor, name="kgm-browser-lifecycle", daemon=True)
    thread.start()


def show_control_window(url: str, on_close) -> None:
    try:
        import tkinter as tk
        from tkinter import messagebox
    except Exception:
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            on_close()
        return

    root = tk.Tk()
    root.title("KGM 업무망")
    root.geometry("360x150")
    root.resizable(False, False)

    tk.Label(root, text="KGM 업무망 실행 중", font=("Malgun Gothic", 12, "bold")).pack(pady=(18, 6))
    tk.Label(root, text=url, font=("Malgun Gothic", 9)).pack(pady=(0, 12))

    button_frame = tk.Frame(root)
    button_frame.pack()

    tk.Button(button_frame, text="브라우저 열기", width=14, command=lambda: webbrowser.open(url)).pack(
        side=tk.LEFT,
        padx=4,
    )
    tk.Button(button_frame, text="종료", width=10, command=root.destroy).pack(side=tk.LEFT, padx=4)

    def handle_close():
        if messagebox.askokcancel("KGM 업무망", "KGM 업무망 서버를 종료할까요?"):
            root.destroy()

    root.protocol("WM_DELETE_WINDOW", handle_close)
    root.mainloop()
    on_close()


def main() -> int:
    if not (BASE_DIR / "index.html").exists():
        print(f"Missing app file: {BASE_DIR / 'index.html'}", file=sys.stderr)
        return 1

    httpd = None
    shutdown_event = threading.Event()
    lifecycle = BrowserLifecycle()

    try:
        start_lifecycle_monitor(lifecycle, shutdown_event)
        errors = []
        selected_port = None
        for port in candidate_ports():
            if not is_port_available(SERVER_HOST, port):
                errors.append(f"{SERVER_HOST}:{port} -> already in use")
                continue
            try:
                httpd = start_server(port, lifecycle)
                selected_port = port
                break
            except OSError as err:
                errors.append(f"{SERVER_HOST}:{port} -> {err}")

        if httpd is None or selected_port is None:
            print("Failed to bind local server:\n" + "\n".join(errors), file=sys.stderr)
            return 1

        url = app_url(selected_port)
        if not wait_for_server(url):
            print(f"Failed to start local server: {url}", file=sys.stderr)
            return 1

        if os.environ.get("KGM_NO_BROWSER") != "1":
            webbrowser.open(url)
        print(f"KGM launcher started: {url}")
        if os.environ.get("KGM_SHOW_CONTROL") == "1":
            show_control_window(url, shutdown_event.set)
            return 0
        if os.environ.get("KGM_NO_WINDOW") == "1" or os.environ.get("KGM_SHOW_CONTROL") != "1":
            shutdown_event.wait()
    except KeyboardInterrupt:
        print("\nStopping...")
        return 0
    finally:
        shutdown_event.set()
        if httpd is not None:
            httpd.shutdown()
            httpd.server_close()
        cleanup_node_worker()


if __name__ == "__main__":
    raise SystemExit(main())
