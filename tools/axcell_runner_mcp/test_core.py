# -*- coding: utf-8 -*-
"""AXCell Runner self-check (Excel 불필요 — Mac/Windows 공통).

검증: 스킬 로드/핸들복원, 자동 매핑(serve_b2b 로직), 출력 검증/압축,
MCP 서버 프로토콜(initialize/tools/list/tools/call) + 런 생명주기(실패 경로).
실제 Excel COM 실행은 Windows+Excel 에서만 가능(여기선 미검증).

실행: python3 test_core.py
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from axcell_runner import runner_core as core  # noqa: E402


def make_skill_zip(pipeline, required):
    manifest = {"version": 4, "name": "테스트스킬", "pipeline": pipeline, "requiredFiles": required}
    tmp = Path(tempfile.mkdtemp()) / "skill.zip"
    with zipfile.ZipFile(tmp, "w") as z:
        z.writestr("t.logic.json", json.dumps(manifest, ensure_ascii=False))
    return tmp


def test_load_and_handle_restore():
    z = make_skill_zip(
        [{"language": "python",
          "code": 'def transform(ctx):\n    b = ctx.book("@@FILE_1@@")\n'}],
        [{"name": "매출_202606.xlsx", "handle": "@@FILE_1@@", "role": "input"}])
    data = core.load_skill(z)
    code = data["pipeline"][0]["code"]
    assert "@@FILE_" not in code and 'ctx.book("매출_202606.xlsx")' in code, code
    print("ok  load_and_handle_restore")


def test_check_inputs_mapping():
    z = make_skill_zip(
        [{"language": "python", "code": "def transform(ctx):\n    pass\n"}],
        [{"name": "한국전력_202606_v1.1.xlsx", "role": "input"},
         {"name": "KB카드_260709.xls", "role": "input"}])
    d = Path(tempfile.mkdtemp())
    (d / "한국전력_202607_v1.1.xlsx").write_bytes(b"x")   # 달만 다름 → 안정키 매칭
    (d / "KB카드_260709.xls").write_bytes(b"x")            # 정확명
    (d / "여분파일.xlsx").write_bytes(b"x")
    r = core.check_inputs(z, d)
    assert r["ok"], r
    assert r["mapping"]["한국전력_202606_v1.1.xlsx"].endswith("한국전력_202607_v1.1.xlsx"), r["mapping"]
    assert "여분파일.xlsx" in r["extra_files"], r
    print("ok  check_inputs_mapping")


def test_check_inputs_unmatched():
    z = make_skill_zip(
        [{"language": "python", "code": "def transform(ctx):\n    pass\n"}],
        [{"name": "없는파일_999999.xlsx", "role": "input"}])
    d = Path(tempfile.mkdtemp())
    (d / "엉뚱한것.csv").write_bytes(b"x")
    r = core.check_inputs(z, d)
    assert not r["ok"] and "없는파일_999999.xlsx" in r["unmatched"], r
    print("ok  check_inputs_unmatched")


def test_package_outputs():
    d = Path(tempfile.mkdtemp())
    (d / "결과.xlsx").write_bytes(b"data")
    zp = d / "out" / "결과.zip"
    r = core.package_outputs(d, zp, expect_files=["결과.xlsx"])
    assert r["ok"] and Path(r["zip_path"]).exists(), r
    # 실패 경로: 기대 파일 누락 → zip 안 만듦
    r2 = core.package_outputs(d, d / "out2" / "x.zip", expect_files=["없는것.xlsx"])
    assert not r2["ok"] and r2["problems"] and not (d / "out2" / "x.zip").exists(), r2
    # 실패 경로: 0바이트
    d3 = Path(tempfile.mkdtemp())
    (d3 / "빈것.xlsx").write_bytes(b"")
    r3 = core.package_outputs(d3, d3 / "z.zip")
    assert not r3["ok"], r3
    print("ok  package_outputs")


FAKE_RUN_SERVER = """# 테스트 전용 — core.run 을 가짜(즉시 open/step/saved 방출)로 바꾼 MCP 서버.
# [리뷰 2026-09-01] 원래 테스트는 진짜 run 에 의존해서, Excel 없는 환경(맥/리눅스)이나
# 깨진 입력에선 이벤트가 0개라 seq/summary 계약 검증이 '한 번도' 돌지 않았다(공허한 통과).
import axcell_runner.mcp_server as m

def _fake_run(skill_zip, input_dir, out_dir, on_event=None, cancel=None, excel_pid_holder=None):
    emit = on_event or (lambda e: None)
    emit({"type": "open", "file": "가짜.xlsx"})
    emit({"type": "step", "step": 1, "total_steps": 1, "language": "python", "step_label": "가짜 스텝"})
    emit({"type": "saved", "files": ["가짜.xlsx"]})
    return {"ok": True, "out_dir": str(out_dir), "files": ["가짜.xlsx"], "skill": "가짜"}

m.core.run = _fake_run
m.main()
"""


class McpClient:
    """stdio MCP 서버 스모크 테스트용 최소 클라이언트."""

    def __init__(self, fake_run=False):
        if fake_run:
            script = Path(tempfile.mkdtemp()) / "_fake_run_server.py"
            script.write_text(FAKE_RUN_SERVER, encoding="utf-8")
            cmd = [sys.executable, str(script)]
        else:
            cmd = [sys.executable, "-m", "axcell_runner.mcp_server"]
        env = dict(os.environ)
        env["PYTHONPATH"] = str(HERE) + os.pathsep + env.get("PYTHONPATH", "")
        self.proc = subprocess.Popen(
            cmd, cwd=str(HERE), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, encoding="utf-8", env=env)
        self._id = 0

    def call(self, method, params=None):
        self._id += 1
        msg = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            msg["params"] = params
        self.proc.stdin.write(json.dumps(msg, ensure_ascii=False) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        assert line, f"서버 무응답: {method}"
        return json.loads(line)

    def tool(self, name, args):
        resp = self.call("tools/call", {"name": name, "arguments": args})
        assert "result" in resp, resp
        return json.loads(resp["result"]["content"][0]["text"]), resp["result"].get("isError")

    def close(self):
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()


def test_mcp_protocol_and_lifecycle():
    c = McpClient()
    try:
        init = c.call("initialize", {"protocolVersion": "2024-11-05", "capabilities": {}})
        assert init["result"]["serverInfo"]["name"] == "axcell_runner", init
        tools = c.call("tools/list")
        names = {t["name"] for t in tools["result"]["tools"]}
        assert names == {"check_inputs", "run_start", "run_report", "run_stop", "package_outputs"}, names

        # check_inputs 정상/실패 (안정키 매칭은 키 4자 이상에서만 — 엔진의 오매칭 방지 가드)
        z = make_skill_zip(
            [{"language": "python", "code": "def transform(ctx):\n    pass\n"}],
            [{"name": "청구내역_202606.xlsx", "role": "input"}])
        d = Path(tempfile.mkdtemp())
        (d / "청구내역_202607.xlsx").write_bytes(b"x")
        r, is_err = c.tool("check_inputs", {"skill_zip": str(z), "input_dir": str(d)})
        assert r["ok"] and not is_err, r

        # 실제 run 시작 → 상태 어휘 확인(플랫폼별 completed/failed — Excel/입력 유무에 따라)
        r, _ = c.tool("run_start", {"skill_zip": str(z), "input_dir": str(d),
                                     "out_dir": str(d / "out"), "make_zip": False})
        assert r["ok"] and r["run_id"] and r["total_steps"] == 1, r
        run_id = r["run_id"]
        status = None
        for _ in range(150):                      # 실 Excel 이면 열기까지 수십 초 걸릴 수 있다
            rep, _ = c.tool("run_report", {"run_id": run_id, "include_events": True})
            status = rep["status"]
            if status in ("completed", "failed", "cancelled"):
                break
            time.sleep(0.2)
        assert status in ("completed", "failed"), rep

        # unknown run_id
        r, is_err = c.tool("run_report", {"run_id": "run_none"})
        assert not r["ok"] and is_err, r

        # run_stop: 이미 끝난 런 → 현재 상태 그대로
        r, _ = c.tool("run_stop", {"run_id": run_id})
        assert r["ok"] and r["status"] in ("failed", "completed", "cancelled"), r

        # [리뷰 2026-09-01] 서버는 dict 아닌 JSON-RPC 입력(배치/스칼라)에 죽지 않아야 한다.
        c.proc.stdin.write("[1,2,3]\n"); c.proc.stdin.flush()
        c.proc.stdin.write("null\n"); c.proc.stdin.flush()
        pong = c.call("ping")                     # 죽었다면 여기서 무응답으로 실패한다
        assert "result" in pong, pong
    finally:
        c.close()
    print("ok  mcp_protocol_and_lifecycle")


def test_event_contract_with_fake_run():
    """seq/summary/커서 계약을 '실제로 이벤트가 있는' 런으로 검증한다(가짜 run — 플랫폼 무관 결정적)."""
    c = McpClient(fake_run=True)
    try:
        c.call("initialize", {"protocolVersion": "2024-11-05", "capabilities": {}})
        z = make_skill_zip(
            [{"language": "python", "code": "def transform(ctx):\n    pass\n"}],
            [{"name": "청구내역_202606.xlsx", "role": "input"}])
        d = Path(tempfile.mkdtemp())
        (d / "청구내역_202607.xlsx").write_bytes(b"x")
        r, _ = c.tool("run_start", {"skill_zip": str(z), "input_dir": str(d),
                                     "out_dir": str(d / "out"), "make_zip": False})
        assert r["ok"], r
        run_id = r["run_id"]
        status, items = None, []
        for _ in range(50):
            rep, _ = c.tool("run_report", {"run_id": run_id, "after_cursor": 0, "max_events": 50})
            status = rep["status"]
            items = rep["events"]["items"]
            if status in ("completed", "failed", "cancelled"):
                break
            time.sleep(0.1)
        assert status == "completed", (status, rep)
        # ixi-flow event_batch 계약 — 이번엔 이벤트가 '반드시' 있으므로 공허하지 않다
        assert len(items) == 3, items
        assert [it["type"] for it in items] == ["open", "step", "saved"], items
        for it in items:
            assert isinstance(it.get("seq"), int) and it.get("summary"), it
        assert [it["seq"] for it in items] == [1, 2, 3], items
        assert isinstance(rep["events"]["next_cursor"], str) and rep["events"]["next_cursor"] == "3", rep["events"]
        # 커서 이어받기: next_cursor 이후에는 새 이벤트가 없어야 한다
        rep2, _ = c.tool("run_report", {"run_id": run_id, "after_cursor": 3})
        assert rep2["events"]["items"] == [], rep2["events"]
        assert rep["step"] == 1 and rep["total_steps"] == 1, rep
    finally:
        c.close()
    print("ok  event_contract_with_fake_run")


if __name__ == "__main__":
    test_load_and_handle_restore()
    test_check_inputs_mapping()
    test_check_inputs_unmatched()
    test_package_outputs()
    test_mcp_protocol_and_lifecycle()
    test_event_contract_with_fake_run()
    print("\nALL PASS")
