# -*- coding: utf-8 -*-
"""[0.8.4] 세션 상세 API — 로그 파일·스킬 단계 조회 + 개별 파일 다운로드.

요청(2026-09-03): 실행 목록에서 개수만 보이던 로그/스킬을 '속살'까지 —
로그 파일 목록(크기), 스킬 zip 의 단계 수/켜짐 수/단계 제목, 파일 하나만 받기.

실행: python test_session_detail.py
"""
import json
import sys
import tempfile
import zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import collector
import main as M
from fastapi.testclient import TestClient

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)) if (not cond and detail) else ""))
    if not cond:
        fails += 1


root = Path(tempfile.mkdtemp(prefix="detail_"))
collector.configure(str(root))
client = TestClient(M.app)

r = client.post("/v1/logs/session/start", json={"sessionId": "det-1", "user": "CLOUDPC_s0min"})
sdir = Path(r.json()["path"])
(sdir / "logs" / "vba_pipeline_trace.jsonl").write_text('{"event":"x"}\n' * 100, "utf-8")
(sdir / "logs" / "runtime_load_trace.jsonl").write_text('{"event":"y"}\n', "utf-8")

manifest = {"name": "매출정리", "pipeline": [
    {"id": "s1", "title": "매출 시트에서 정지 회선만 필터", "language": "python", "enabled": True},
    {"id": "s2", "description": "합계 열 추가", "language": "python", "enabled": True},
    {"id": "s3", "prompt": "서식 정리해줘", "language": "vba", "enabled": False},
]}
with zipfile.ZipFile(sdir / "skills" / "매출정리.zip", "w") as z:
    z.writestr("매출정리.logic.json", json.dumps(manifest, ensure_ascii=False))
(sdir / "skills" / "깨진스킬.zip").write_bytes(b"not-a-zip")

Q = {"user": "CLOUDPC_s0min", "session": "det-1"}

print("[1] 상세 — 로그 파일과 크기")
d = client.get("/v1/admin/session/detail", params=Q).json()
check("ok", d.get("ok"), d)
names = [f["name"] for f in d["logs"]]
check("로그 2개(이름·크기)", names == ["runtime_load_trace.jsonl", "vba_pipeline_trace.jsonl"]
      and d["logs"][1]["sizeKb"] > 0, d["logs"])   # 초소형 파일은 0.0KB 로 반올림될 수 있다

print("[2] 상세 — 스킬 단계 수·켜짐 수·단계 제목")
sk = {x["name"]: x for x in d["skills"]}
good = sk.get("매출정리.zip") or {}
check("단계 수 3 · 켜짐 2", good.get("steps") == 3 and good.get("enabledSteps") == 2, good)
check("단계 제목(제목/설명/프롬프트 순 폴백)",
      good.get("stepTitles") == ["1. 매출 시트에서 정지 회선만 필터", "2. 합계 열 추가",
                                "3. 서식 정리해줘 (꺼짐)"], good.get("stepTitles"))
bad = sk.get("깨진스킬.zip") or {}
check("깨진 zip 은 사유와 함께 그대로 나열(전체 실패 아님)", "error" in bad and bad.get("steps") is None, bad)

print("[3] 파일 하나만 다운로드")
r = client.get("/v1/admin/session/file", params={**Q, "kind": "skills", "name": "매출정리.zip"})
check("스킬 zip 수신", r.status_code == 200 and r.content[:2] == b"PK", (r.status_code, r.content[:4]))
check("첨부 파일명", "attachment" in r.headers.get("content-disposition", ""), r.headers)
r = client.get("/v1/admin/session/file", params={**Q, "kind": "logs", "name": "runtime_load_trace.jsonl"})
check("로그 파일 수신", r.status_code == 200 and b'"event":"y"' in r.content)

print("[4] 경로 탈출/오입력 차단")
r = client.get("/v1/admin/session/file", params={**Q, "kind": "skills", "name": "../session.json"})
check("../ 세탁 → 404", r.status_code == 404, r.status_code)
r = client.get("/v1/admin/session/file", params={**Q, "kind": "meta", "name": "x"})
check("허용 외 kind 거부", r.status_code == 400, r.status_code)
r = client.get("/v1/admin/session/detail", params={"user": "없음", "session": "없음"})
check("없는 세션 404", r.status_code == 404, r.status_code)

print("")
print("RESULT: ALL PASS" if not fails else "RESULT: %d FAIL" % fails)
sys.exit(0 if not fails else 1)
