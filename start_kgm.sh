#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

export KGM_VLLM_BASE="${KGM_VLLM_BASE:-http://192.168.0.14:8080}"
export KGM_PORT="${KGM_PORT:-8090}"
export KGM_HOST="${KGM_HOST:-127.0.0.1}"
export KGM_LAUNCH_HOST="${KGM_LAUNCH_HOST:-127.0.0.1}"

PYTHON_BIN="${PYTHON_BIN:-python3}"
exec "$PYTHON_BIN" launch_kgm.py
