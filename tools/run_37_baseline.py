# -*- coding: utf-8 -*-
"""Run the old v3.7 JavaScript logic pipeline headlessly on the real workbooks.

This creates a baseline result to compare against the current 0.4.13 Python
pipeline. It does not open the browser or Excel windows.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time
import uuid


ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
V37_DIR = REPO_ROOT / "B2B_ver3.7"
V37_SERVER = V37_DIR / "serve_kgm.py"

EXPECTED_FILES = [
    "input_202602_SS001643_ENTR_BY_STACC_001.xlsx",
    "input_KGM월별정산_리스트_토레스.xlsx",
    "input_교체된 CCU 목록2026-02-12.xlsx",
    "input_테스트 차량 목록 - LG U  전달2026-03.xlsx",
    "output_02월 검증파일.xlsx",
    "output_03월 검증파일.xlsx",
]


def _safe_stdout() -> None:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def find_data_dir() -> Path:
    downloads = Path.home() / "Downloads"
    for path in downloads.iterdir():
        if path.is_dir() and all((path / name).exists() for name in EXPECTED_FILES):
            return path
    raise FileNotFoundError("expected workbook set not found under Downloads")


def find_logic_file() -> Path:
    downloads = Path.home() / "Downloads"
    matches = sorted(downloads.rglob("logic_2026-05-26-05-49.logic.json"))
    if not matches:
        raise FileNotFoundError("logic_2026-05-26-05-49.logic.json not found under Downloads")
    return matches[0]


def load_v37():
    if not V37_SERVER.exists():
        raise FileNotFoundError(V37_SERVER)
    os.environ["KGM_DISABLE_NODE_WORKER"] = "1"
    spec = importlib.util.spec_from_file_location("serve_kgm_v37_baseline", V37_SERVER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot import {V37_SERVER}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def copy_workbooks(data_dir: Path, run_dir: Path) -> dict[str, Path]:
    workbooks_dir = run_dir / "workbooks"
    workbooks_dir.mkdir(parents=True, exist_ok=True)
    copied = {}
    for name in EXPECTED_FILES:
        src = data_dir / name
        dst = workbooks_dir / name
        shutil.copy2(src, dst)
        copied[name] = dst
    return copied


def register_workbook(kgm, path: Path, name: str) -> str:
    wid = uuid.uuid4().hex
    kgm.WORKBOOKS[wid] = {
        "id": wid,
        "name": name,
        "path": str(path),
        "created": time.time(),
        "aoa_cache": None,
        "current_aoa_cache": None,
        "aoa_cache_created": None,
        "aoa_cache_hits": 0,
    }
    return wid


def safe_name(text: str) -> str:
    s = re.sub('[<>:"/\\\\|?*\x00-\x1f]+', "_", str(text or "file"))
    return s[:140] or "file"


def save_result(kgm, result_id: str, dest: Path) -> Path | None:
    rec = kgm.RESULTS.get(result_id)
    if not rec:
        return None
    if "workerWorkbookId" in rec and "sheets" not in rec:
        rec["sheets"] = kgm.export_node_worker_workbook(rec["workerWorkbookId"])
    out_name = safe_name(rec.get("name") or result_id)
    if not Path(out_name).suffix:
        out_name += ".xlsx"
    out_path = dest / out_name
    kgm.write_result_workbook(
        Path(rec["template_path"]),
        out_path,
        rec.get("sheets") or {},
        rec.get("forced_value_cells") or [],
    )
    return out_path


def run_baseline(logic_file: Path, data_dir: Path, run_dir: Path) -> dict:
    kgm = load_v37()
    kgm.BACKEND_DIR = run_dir / "backend"
    kgm.BACKEND_DIR.mkdir(parents=True, exist_ok=True)
    kgm.WORKBOOKS.clear()
    kgm.RESULTS.clear()
    kgm.PIPELINE_JOBS.clear()

    logic = json.loads(logic_file.read_text(encoding="utf-8"))
    copied = copy_workbooks(data_dir, run_dir)

    output_name = "output_02월 검증파일.xlsx"
    output_id = register_workbook(kgm, copied[output_name], output_name)
    inputs = []
    for name in EXPECTED_FILES:
        if name.startswith("input_"):
            inputs.append({
                "name": name,
                "backendWorkbookId": register_workbook(kgm, copied[name], name),
            })

    payload = {
        "inputs": inputs,
        "output": {"name": output_name, "backendWorkbookId": output_id},
        "pipeline": logic.get("pipeline") or [],
        "baseMode": "original",
        "current": {
            "fileId": "input:input_202602_SS001643_ENTR_BY_STACC_001.xlsx",
            "outputFileId": "output:0",
            "sheet": "Sheet1",
        },
    }

    started = time.time()
    result = kgm.run_backend_pipeline_payload(payload, job_id="logic37")
    elapsed = round(time.time() - started, 2)

    results_dir = run_dir / "results"
    results_dir.mkdir(parents=True, exist_ok=True)
    saved = {}
    for file_id, url in (result.get("downloadUrls") or {}).items():
        rid = str(url).rsplit("/", 1)[-1]
        path = save_result(kgm, rid, results_dir)
        if path:
            saved[file_id] = str(path)
    if result.get("downloadId"):
        path = save_result(kgm, result["downloadId"], results_dir)
        if path:
            saved["downloadId"] = str(path)

    summary = {
        "ok": bool(result.get("ok")),
        "elapsedSec": elapsed,
        "logicFile": str(logic_file),
        "dataDir": str(data_dir),
        "saved": saved,
        "downloadUrls": result.get("downloadUrls") or {},
        "diffKeys": list((result.get("diffs") or {}).keys()),
        "worker": bool(result.get("worker")),
    }
    (run_dir / "baseline_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def main() -> int:
    _safe_stdout()
    ap = argparse.ArgumentParser()
    ap.add_argument("--logic", type=Path, default=None)
    ap.add_argument("--data-dir", type=Path, default=None)
    ap.add_argument("--run-dir", type=Path, default=None)
    args = ap.parse_args()

    logic_file = args.logic or find_logic_file()
    data_dir = args.data_dir or find_data_dir()
    stamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = args.run_dir or (ROOT / "test_runs" / f"logic37_{stamp}")
    run_dir.mkdir(parents=True, exist_ok=True)
    summary = run_baseline(logic_file, data_dir, run_dir)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
