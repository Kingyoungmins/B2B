# -*- coding: utf-8 -*-
"""B2B 에이전트 관측 로그 — 전사 Agent Observability 수집용 (독립 모듈)

호출부는 딱 한 줄이면 된다.

    import b2b_telemetry
    b2b_telemetry.log_skill_run(
        skill_name="한전 인천지부 월마감",
        step_count=32,
        status="success",          # success | failed
        started_at=t0,             # time.time() 값
        file_count=6,
        languages="python/vba",
        output_mode="file",
    )

── 왜 별도 파일인가 ────────────────────────────────────────────────────────
본체(serve_b2b.py)는 계속 갱신된다. 로그 스키마·전송 방식·마스킹 규칙은
수집 측 사정으로 자주 바뀔 텐데, 그때마다 본체를 건드리면 병합이 지옥이 된다.
그래서 이 파일 하나만 교체하면 되도록 전부 여기에 모았다.

── 지금 상태 ──────────────────────────────────────────────────────────────
접속 정보(엔드포인트·API 키·Space ID·암호화 키)를 아직 못 받았다.
그래서 기본 동작은 '로컬 파일로만 기록'이다. 무엇이 나가는지 눈으로 보고,
그 파일을 그대로 담당자에게 보여주며 스키마를 확정하기 위한 것이다.

환경변수가 채워지면 자동으로 전송이 켜진다. 코드는 안 고쳐도 된다.

    ARIZE_COLLECTOR_ENDPOINT   OTLP gRPC 주소 (예: host:4317)
    ARIZE_API_KEY
    ARIZE_SPACE_ID
    ARIZE_PROJECT_NAME
    ENCRYPTION_KEY             Base64 AES-256

── 절대 원칙 ──────────────────────────────────────────────────────────────
로그 때문에 본체가 느려지거나 죽으면 안 된다.
  · 전송은 백그라운드 스레드에서 (호출부는 즉시 반환)
  · 어떤 예외도 밖으로 안 나감 (전부 삼킴)
  · 값이 없으면 조용히 no-op
"""
import atexit
import json
import os
import queue
import socket
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ══════════════════════════════════════════════════════════════════════════
#  1. 식별자 — 수집 측이 정해주면 여기만 고치면 된다
#     ★ 표시는 아직 확정 안 된 값(제가 임의로 정함). 문의 답변 오면 교체.
# ══════════════════════════════════════════════════════════════════════════
TENANT_ID = "lguplus"                    # 회사/테넌트
ENVIRONMENT = "prod"                     # prod | dev | staging | test (문서 명시)
SERVICE_NAME = "b2b-billing-agent"       # ★ 명명 규칙 확인 필요
AGENT_ID = "b2b-billing"                 # ★ 배정받는지 확인 필요
AGENT_TYPE = "desktop_agent"             # ★ 문서 예시값. 허용 목록 확인 필요
ACTOR_TYPE = "user"                      # user | service | system (문서 명시)
EVENT_TYPE_RUN = "agent.run"             # ★ enum 확인 필요
SPAN_KIND_WORKFLOW = "WORKFLOW"          # ★ enum 확인 필요
PROVIDER = "internal"                    # ★ LLM 미사용 시 표기 확인 필요
MODEL = "n/a"                            # 이 이벤트는 LLM 호출이 아님
COST_USD = 0                             # 내재화 — 과금 없음
CLOUD = "U+ Cloud"                       # 전 임직원 사내 VDI
                                         # region/AZ 는 안 씀(AWS 전제 필드)

# 개인정보·고객사명 취급 기준이 정해지기 전까지의 안전장치.
# True 로 두면 스킬명과 오류 메시지를 해시해서 보낸다(집계는 되고 내용은 안 보임).
# 담당자가 "그대로 보내도 된다"고 하면 False 로 바꾼다.
MASK_BUSINESS_TEXT = False

_PREVIEW_FILENAME = "telemetry_preview.jsonl"


# ══════════════════════════════════════════════════════════════════════════
#  2. 내부 상태
# ══════════════════════════════════════════════════════════════════════════
_state = {
    "ready": False,
    "session_id": uuid.uuid4().hex,
    "app_version": "",
    "preview_path": None,
    "sender": None,        # 전송 함수 (없으면 None → 파일 기록만)
    "queue": None,
    "worker": None,
    "provider": None,     # OTel TracerProvider — 종료 시 force_flush 하려고 잡아 둔다
}
_lock = threading.Lock()


def _utc(ts=None):
    dt = datetime.fromtimestamp(ts, timezone.utc) if ts else datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (dt.microsecond // 1000)


def _whoami():
    """cmd whoami 와 같은 값. serve_b2b 에 같은 함수가 있지만 의존하지 않는다
    — 이 파일만 들고 옮겨도 동작해야 한다."""
    name = os.environ.get("USERNAME") or ""
    domain = os.environ.get("USERDOMAIN") or ""
    if not name:
        try:
            import getpass
            name = getpass.getuser()
        except Exception:
            name = ""
    if domain and name:
        return ("%s\\%s" % (domain, name)).lower()
    return (name or "unknown").lower()


def _mask(text):
    """업무 텍스트(스킬명·오류 메시지) 가리기. 기준이 정해지기 전 기본은 원문."""
    if not text or not MASK_BUSINESS_TEXT:
        return text
    import hashlib
    return "sha256:" + hashlib.sha256(str(text).encode("utf-8")).hexdigest()[:16]


# ══════════════════════════════════════════════════════════════════════════
#  3. 초기화 — 앱 기동 시 1회만 (launch_b2b.py 에서 호출)
# ══════════════════════════════════════════════════════════════════════════
def init(app_version="", writable_dir=None):
    """관측 로그 준비. 두 번 불러도 안전하다.

    접속 정보가 없으면 파일 기록만 켜고 조용히 지나간다 — 실패로 보지 않는다.
    """
    with _lock:
        if _state["ready"]:
            return _status_dict()

        _state["app_version"] = str(app_version or "")

        # 미리보기 파일 — 무엇이 나가는지 눈으로 확인하는 용도
        try:
            base = Path(writable_dir) if writable_dir else Path.cwd()
            _state["preview_path"] = base / _PREVIEW_FILENAME
        except Exception:
            _state["preview_path"] = None

        # 전송 준비 (접속 정보가 다 있을 때만)
        _state["sender"] = _build_sender()

        # 보내는 일은 별도 스레드에서. 호출부를 절대 기다리게 하지 않는다.
        _state["queue"] = queue.Queue(maxsize=1000)
        t = threading.Thread(target=_worker, name="b2b-telemetry", daemon=True)
        t.start()
        _state["worker"] = t

        _state["ready"] = True
        atexit.register(shutdown)
        return _status_dict()


def _status_dict():
    return {
        "ready": _state["ready"],
        "sending": _state["sender"] is not None,
        "preview": str(_state["preview_path"] or ""),
        "session_id": _state["session_id"],
        "missing_env": _missing_env(),
    }


def status():
    """지금 어떤 상태인지 (진단용)."""
    return _status_dict()


_REQUIRED_ENV = ("ARIZE_COLLECTOR_ENDPOINT", "ARIZE_API_KEY",
                 "ARIZE_SPACE_ID", "ARIZE_PROJECT_NAME")


def _missing_env():
    return [k for k in _REQUIRED_ENV if not os.environ.get(k)]


def _build_sender():
    """OTLP 전송 함수를 만든다. 준비가 안 됐으면 None.

    [의도] 값이나 패키지가 없다고 앱이 죽으면 안 된다. 조용히 파일 기록만 한다.
    """
    if _missing_env():
        return None
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    except Exception:
        return None      # 패키지 미설치 — 파일 기록만

    try:
        headers = {
            "space_id": os.environ["ARIZE_SPACE_ID"],
            "api_key": os.environ["ARIZE_API_KEY"],
        }
        exporter = OTLPSpanExporter(
            endpoint=os.environ["ARIZE_COLLECTOR_ENDPOINT"],
            headers=headers,
        )
        provider = TracerProvider(resource=Resource.create({
            "service.name": SERVICE_NAME,
            "model_id": os.environ["ARIZE_PROJECT_NAME"],
        }))
        provider.add_span_processor(BatchSpanProcessor(exporter))
        _state["provider"] = provider
        trace.set_tracer_provider(provider)
        tracer = trace.get_tracer(__name__)
    except Exception:
        return None

    def send(event):
        # 스팬 1개 = 실행 1건. 속성은 평탄화해서 넣는다(OTel 은 중첩 dict 를 안 받는다).
        start_ns = int(event["_start_ts"] * 1_000_000_000)
        end_ns = int(event["_end_ts"] * 1_000_000_000)
        span = tracer.start_span(EVENT_TYPE_RUN, start_time=start_ns)
        try:
            for k, v in _flatten(event).items():
                span.set_attribute(k, v)
        finally:
            span.end(end_time=end_ns)

    return send


def _flatten(event, prefix=""):
    out = {}
    for k, v in event.items():
        if k.startswith("_"):
            continue
        key = prefix + k
        if isinstance(v, dict):
            out.update(_flatten(v, key + "."))
        elif v is None:
            continue
        elif isinstance(v, (str, bool, int, float)):
            out[key] = v
        else:
            out[key] = json.dumps(v, ensure_ascii=False)
    return out


# ══════════════════════════════════════════════════════════════════════════
#  4. 공개 API — 실행기가 부르는 한 줄
# ══════════════════════════════════════════════════════════════════════════
def log_skill_run(skill_name="", step_count=0, status="success",
                  started_at=None, ended_at=None, file_count=0,
                  languages="", output_mode="", error_code=None,
                  error_message=None, extra=None):
    """스킬 전체실행 1건을 기록한다.

    어떤 이유로도 예외를 밖으로 내보내지 않는다 — 로그 때문에 실행이 실패하면 안 된다.
    """
    try:
        _log_skill_run_impl(skill_name, step_count, status, started_at, ended_at,
                            file_count, languages, output_mode,
                            error_code, error_message, extra)
    except Exception:
        pass


def _log_skill_run_impl(skill_name, step_count, status, started_at, ended_at,
                        file_count, languages, output_mode,
                        error_code, error_message, extra):
    if not _state["ready"]:
        init()

    t1 = ended_at if ended_at is not None else time.time()
    t0 = started_at if started_at is not None else t1
    actor = _whoami()

    event = {
        # ── MANDATORY ────────────────────────────────────────────────────
        "tenant_id": TENANT_ID,
        "environment": ENVIRONMENT,
        "service_name": SERVICE_NAME,
        "actor_type": ACTOR_TYPE,
        "actor_id": actor,
        "trace_id": uuid.uuid4().hex,              # 실행 1건 = 1 trace
        "span_id": uuid.uuid4().hex[:16],
        "span_kind": SPAN_KIND_WORKFLOW,
        "agent_id": AGENT_ID,
        "agent_type": AGENT_TYPE,
        "event_type": EVENT_TYPE_RUN,
        "status": status,
        "timestamp": _utc(t0),
        "input": {
            "skill_name": _mask(skill_name),
            "step_count": int(step_count or 0),
        },
        "output": {
            "result": status,                      # 문서 내용·경로는 안 보낸다
            "file_count": int(file_count or 0),
        },

        # ── RECOMMENDED ──────────────────────────────────────────────────
        "session_id": _state["session_id"],        # 앱 기동~종료 1회분
        "user_id": actor,
        "latency_ms": int(max(0.0, t1 - t0) * 1000),
        "start_time": _utc(t0),
        "end_time": _utc(t1),
        "provider": PROVIDER,
        "model": MODEL,
        "cost_usd": COST_USD,
        "cloud": CLOUD,

        # ── OPTIONAL ─────────────────────────────────────────────────────
        "error_code": error_code,
        "error_message": _mask(error_message) if error_message else None,
        "metadata": {
            "pc_name": os.environ.get("COMPUTERNAME") or socket.gethostname(),
            "app_version": _state["app_version"],
            "languages": languages or "",
            "output_mode": output_mode or "",      # file=실행기 / sync=생성기
        },

        # 내부 전용(전송 시 제외) — 스팬 시각 계산용
        "_start_ts": t0,
        "_end_ts": t1,
    }
    if extra:
        try:
            event["metadata"].update(extra)
        except Exception:
            pass

    q = _state["queue"]
    if q is not None:
        try:
            q.put_nowait(event)
        except queue.Full:
            pass       # 밀리면 버린다 — 로그 때문에 본체가 막히면 안 된다


# ══════════════════════════════════════════════════════════════════════════
#  5. 백그라운드 처리
# ══════════════════════════════════════════════════════════════════════════
def _worker():
    while True:
        try:
            event = _state["queue"].get()
        except Exception:
            return
        if event is None:
            _state["queue"].task_done()
            return
        try:
            _write_preview(event)
            sender = _state["sender"]
            if sender:
                try:
                    sender(event)
                except Exception:
                    pass       # 전송 실패는 조용히 넘긴다(SDK 가 재시도·버퍼링 담당)
        finally:
            # unfinished_tasks 로 '처리까지 끝났는지'를 센다 — q.empty() 는 꺼낸 순간 참이 되어
            # 마지막 1건이 파일에 쓰이기 전에 종료 대기가 풀렸다.
            _state["queue"].task_done()


def _write_preview(event):
    """무엇이 나가는지 남긴다. 접속 정보가 없을 때 이게 유일한 산출물이다."""
    path = _state["preview_path"]
    if not path:
        return
    try:
        line = json.dumps({k: v for k, v in event.items() if not k.startswith("_")},
                          ensure_ascii=False)
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except Exception:
        pass


def _drain(timeout=3.0):
    """남은 것 밀어내기 — 큐에서 꺼낸 것까지 '처리 완료'를 기다린다. 오래 잡고 있지 않는다."""
    q = _state["queue"]
    if q is None:
        return
    try:
        deadline = time.time() + timeout
        while q.unfinished_tasks and time.time() < deadline:
            time.sleep(0.05)
    except Exception:
        pass


def shutdown(timeout=3.0):
    """종료 직전 호출(멱등). 큐를 비우고 OTel 배치(기본 5초 지연)를 강제로 내보낸다.

    본체는 /api/app/shutdown 과 부모 상실 감시에서 os._exit(0) 으로 내려가므로 atexit 이 돌지 않는다
    → 본체가 이 함수를 명시적으로 부른다(log_sync.stop 과 같은 방식). 세션의 마지막 실행 1건이
    가장 잃기 쉬운 로그라서 이게 없으면 '실행 1건 = 로그 1건' 이 깨진다.
    """
    t0 = time.time()
    _drain(timeout)
    provider = _state.get("provider")
    if provider is not None:
        try:
            left_ms = int(max(0.2, timeout - (time.time() - t0)) * 1000)
            provider.force_flush(timeout_millis=left_ms)
        except Exception:
            pass
