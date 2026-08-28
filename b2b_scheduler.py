# -*- coding: utf-8 -*-
"""B2B 스케줄러 — 서버측 (독립 모듈)

'스케줄 등록' / '스케줄 목록' 화면이 쓰는 HTTP 엔드포인트를 전부 담는다.
본체(serve_b2b.py)와 분리해 둔 이유는, 본체가 계속 갱신되는 동안에도
이 파일만 통째로 옮기면 기능이 따라가게 하기 위해서다.

── 본체에 필요한 변경은 3곳뿐 ────────────────────────────────────────────
  1) import b2b_scheduler
  2) do_GET  안:
         _sched = b2b_scheduler.handle_get(self.path)
         if _sched is not None:
             self.send_json(_sched)
             return
  3) do_POST 안:
         if b2b_scheduler.handles_post(self.path):
             self.send_json(b2b_scheduler.handle_post(self.path, self.read_json_body() or {}))
             return

── 제공 엔드포인트 ──────────────────────────────────────────────────────
  GET  /api/whoami             로그인 계정(cmd whoami 와 같은 값)
  GET  /api/scheduler/list     등록된 스케줄 목록
  POST /api/scheduler/register 스케줄 저장(스킬 파일 포함)
  POST /api/scheduler/update   실행 주기 변경 — cron.txt 만 다시 쓴다
  POST /api/scheduler/delete   스케줄 폴더 삭제
  POST /api/scheduler/files    스킬 파일 교체/추가/삭제

── 저장 위치 ────────────────────────────────────────────────────────────
  바탕화면\\ESTB\\<OS계정>\\<스킬명>\\
      ├─ (업로드된 스킬 파일들)
      ├─ cron.txt        실행 주기(crontab 5필드) — 실행의 유일한 근거
      ├─ config.txt      사람이 읽는 요약
      └─ schedule.json   기계용 원본(수신 방법 등 cron 이 못 담는 정보)

의존성은 표준 라이브러리뿐이다.
"""
import base64
import ctypes
import datetime
import io
import json
import os
import re
import shutil
import socket
import zipfile
from pathlib import Path


def current_windows_user():
    """현재 로그인한 윈도우 계정 — cmd 의 `whoami` 와 같은 형식(도메인\\사용자, 소문자).

    스케줄 등록처럼 '이 작업의 주인이 누구인가'를 남겨야 하는 기능에서 쓴다.
    whoami.exe 를 호출하지 않고 같은 출처(로그인 세션 환경)를 직접 읽는다 — 호출마다
    프로세스를 띄우지 않으려는 것이고, 값은 동일하다.
    """
    name = os.environ.get("USERNAME") or ""
    domain = os.environ.get("USERDOMAIN") or ""
    if not name:
        try:
            import getpass
            name = getpass.getuser()
        except Exception:
            name = ""
    whoami = ("%s\\%s" % (domain, name)).lower() if domain and name else (name or "").lower()
    return {
        "ok": bool(name),
        "whoami": whoami,                                   # cloudpc\wcoh
        "user": name,                                       # wcoh
        "domain": domain,                                   # CLOUDPC
        "host": os.environ.get("COMPUTERNAME") or socket.gethostname(),
        "userProfile": os.environ.get("USERPROFILE") or "",
    }


# ── 스케줄 등록 저장 ────────────────────────────────────────────────────────
# 바탕화면\ESTB\<OS계정>\<스킬명>\ 에 스킬 파일과 cron.txt / config.txt 를 남긴다.
# 브라우저는 로컬 디스크에 못 쓰므로 이 경로 생성은 서버가 맡는다.
_BAD_NAME_CHARS = '<>:"/\\|?*'


def desktop_dir():
    """바탕화면 실제 경로. OneDrive 리디렉션이 흔해서 셸에 물어보는 쪽이 정확하다."""
    try:
        buf = ctypes.create_unicode_buffer(260)
        # SHGetFolderPathW(NULL, CSIDL_DESKTOPDIRECTORY=0x0010, NULL, SHGFP_TYPE_CURRENT=0, buf)
        if ctypes.windll.shell32.SHGetFolderPathW(None, 0x0010, None, 0, buf) == 0 and buf.value:
            return Path(buf.value)
    except Exception:
        pass
    return Path(os.environ.get("USERPROFILE") or Path.home()) / "Desktop"


def safe_component(name, fallback="unnamed"):
    """폴더/파일 이름 한 조각으로 안전하게 만든다.

    경로 구분자·상위 이동(..)·윈도우 예약문자를 걷어낸다. 사용자가 넣은 스킬명이
    그대로 경로가 되므로 여기서 막지 않으면 ESTB 밖에 쓸 수 있다.
    """
    raw = str(name or "").strip()
    cleaned = "".join("_" if (ch in _BAD_NAME_CHARS or ord(ch) < 32) else ch for ch in raw)
    # 자른 '뒤'에 다시 걷어낸다 — 120자 경계에 공백·점이 남으면 NTFS 가 mkdir 는 받아주고 이후 쓰기는 전부 거부한다.
    cleaned = cleaned.strip(" .")[:120].strip(" .")
    if cleaned in ("", ".", ".."):
        return fallback
    return cleaned


def cron_expression(sched):
    """스케줄 → crontab 5필드(분 시 일 월 요일)."""
    hour, minute = 9, 0
    tm = str(sched.get("time") or "09:00")
    if ":" in tm:
        try:
            hour, minute = int(tm.split(":")[0]), int(tm.split(":")[1])
        except ValueError:
            hour, minute = 9, 0
    cycle = sched.get("cycle")
    if cycle == "daily":
        return "%d %d * * *" % (minute, hour)
    if cycle == "weekly":
        return "%d %d * * %d" % (minute, hour, int(sched.get("weekday") or 0))
    if cycle == "monthly":
        return "%d %d %d * *" % (minute, hour, int(sched.get("day") or 1))
    # 한 번만 — crontab 에는 1회 실행이 없다. 날짜의 일·월을 박아두고 주석으로 알린다.
    date = str(sched.get("date") or "")
    parts = date.split("-")
    if len(parts) == 3:
        return "%d %d %d %d *" % (minute, hour, int(parts[2]), int(parts[1]))
    return "%d %d * * *" % (minute, hour)


def schedule_root():
    """이 계정의 스케줄 보관 폴더 — 바탕화면\\ESTB\\<OS계정>."""
    user = current_windows_user()
    return desktop_dir() / "ESTB" / safe_component(user.get("user") or "user"), user


def _write_schedule_files(root, ctx, saved):
    """cron.txt / config.txt / schedule.json 을 한 번에 쓴다.

    등록과 수정이 반드시 같은 내용을 만들도록 한 곳에 모았다.
    """
    sched = ctx.get("schedule") or {}
    expr = cron_expression(sched)
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    skill_name = ctx.get("skillName") or ""
    owner = ctx.get("owner") or ""

    cron_lines = [
        "# B2B 스케줄 - %s" % skill_name,
        "# %s" % (ctx.get("summaryWhen") or ""),
        "# 생성 %s / 등록자 %s" % (ctx.get("createdAt") or stamp, owner),
    ]
    if sched.get("cycle") == "once":
        cron_lines.append("# 주의: 1회 실행입니다. crontab 에는 1회가 없어 해당 일·월로 고정했습니다.")
    cron_lines += ["", expr, ""]
    (root / "cron.txt").write_text("\n".join(cron_lines), encoding="utf-8")

    cfg = [
        "[스케줄]",
        "%s → %s" % (ctx.get("summaryWhen") or "", ctx.get("summaryHow") or ""),
        "",
        "[기본]",
        "스킬 명   : %s" % skill_name,
        "등록자    : %s" % owner,
        "등록 시각 : %s" % (ctx.get("createdAt") or stamp),
        "수정 시각 : %s" % stamp,
        "cron      : %s" % expr,
        "",
        "[AX-Cell 스킬]",
        "%s" % (ctx.get("cellSkillName") or "-"),
        "",
        "[필요 문서와 AX-Trace]",
    ]
    for doc in (ctx.get("docs") or []):
        cfg.append("- %s" % doc.get("doc"))
        cfg.append("    AX-Trace: %s" % (doc.get("trace") or "(미연결)"))
    cfg += ["", "[저장된 파일]"]
    cfg += ["- %s (%s bytes)" % (f["name"], f["bytes"]) for f in saved] or ["- 없음"]
    cfg.append("")
    (root / "config.txt").write_text("\n".join(cfg), encoding="utf-8")

    # 사람이 읽는 config.txt 를 되파싱하는 건 깨지기 쉽다 → 기계용 원본을 따로 남긴다.
    manifest = {
        "version": 1,
        "skillName": skill_name,
        "owner": owner,
        "createdAt": ctx.get("createdAt") or stamp,
        "updatedAt": stamp,
        "cron": expr,
        "schedule": sched,
        "summaryWhen": ctx.get("summaryWhen") or "",
        "summaryHow": ctx.get("summaryHow") or "",
        "cellSkillName": ctx.get("cellSkillName") or "",
        "docs": ctx.get("docs") or [],
        # 어느 파일이 AX-Cell 인지 남긴다. 스킬 교체 때 '이 파일이 바뀌면
        # 필요 문서가 달라질 수 있다' 를 판단하는 근거가 된다.
        "cellFile": next((f["name"] for f in saved
                          if str(f.get("role") or "") == "ax-cell"), ""),
        "files": saved,
    }
    (root / "schedule.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return expr, manifest


def register_schedule(payload):
    """스케줄 한 건을 바탕화면 ESTB 아래에 저장한다."""
    base, user = schedule_root()
    skill_name = safe_component(payload.get("skillName"), "")
    if not skill_name:
        return {"ok": False, "error": "스킬 명을 입력해 주세요."}

    # [완결성 검사] 문서 하나라도 가져올 방법(AX-Trace)이 없으면 등록하지 않는다.
    # 무인 실행이 목적이라, 빠진 채로 등록하면 그날 새벽에 조용히 실패한다.
    # 화면도 막고 있지만 여기서 한 번 더 본다 — 화면을 우회한 호출이 있을 수 있다.
    unlinked = [str(d.get("doc") or "?") for d in (payload.get("docs") or [])
                if not str(d.get("trace") or "").strip()]
    if unlinked:
        return {"ok": False,
                "error": "AX-Trace 스킬이 연결되지 않은 문서가 %d개 있습니다: %s"
                         % (len(unlinked), ", ".join(unlinked)),
                "unlinked": unlinked}

    root = base / skill_name
    try:
        root.mkdir(parents=True, exist_ok=True)
    except OSError as err:
        return {"ok": False, "error": "폴더를 만들지 못했습니다: %s" % err}

    saved = []
    for item in (payload.get("files") or []):
        fname = safe_component(item.get("name"), "")
        if not fname:
            continue
        if _is_protected(fname):
            return {"ok": False, "error": "이 이름은 사용할 수 없습니다: %s" % fname}
        try:
            blob = base64.b64decode(item.get("data") or "")
        except Exception:
            return {"ok": False, "error": "파일 데이터를 해석하지 못했습니다: %s" % fname}
        try:
            (root / fname).write_bytes(blob)
        except OSError as err:
            return {"ok": False, "error": "파일을 저장하지 못했습니다: %s (%s)" % (fname, err)}
        saved.append({"name": fname, "role": item.get("role") or "", "bytes": len(blob)})

    ctx = dict(payload)
    ctx["skillName"] = skill_name
    ctx["owner"] = user.get("whoami") or ""
    expr, manifest = _write_schedule_files(root, ctx, saved)
    return {"ok": True, "dir": str(root), "account": safe_component(user.get("user") or "user"),
            "skillName": skill_name, "cron": expr, "files": saved}


_WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"]


def describe_cron(sched):
    """파싱된 주기 → '매달 25일 09:30' 같은 문장. 화면 표기와 같은 규칙."""
    tm = sched.get("time") or "00:00"
    cycle = sched.get("cycle")
    if cycle == "daily":
        return "매일 %s" % tm
    if cycle == "weekly":
        return "매주 %s요일 %s" % (_WEEKDAY_KO[int(sched.get("weekday") or 0) % 7], tm)
    if cycle == "monthly":
        return "매달 %d일 %s" % (int(sched.get("day") or 1), tm)
    if cycle == "once" and sched.get("month"):
        return "%d월 %d일 %s (1회)" % (int(sched["month"]), int(sched.get("day") or 1), tm)
    return tm


def _read_schedule(folder):
    """폴더 하나를 스케줄 한 건으로 읽는다. schedule.json 이 없으면 있는 만큼만 채운다."""
    item = {
        "skillName": folder.name, "dir": str(folder), "cron": "",
        "summaryWhen": "", "summaryHow": "", "owner": "", "createdAt": "", "updatedAt": "",
        "schedule": None, "cellSkillName": "", "cellFile": "", "docs": [], "files": [], "legacy": False,
    }
    manifest = folder / "schedule.json"
    if manifest.is_file():
        try:
            loaded = json.loads(manifest.read_text(encoding="utf-8"))
            if not isinstance(loaded, dict):
                raise ValueError("schedule.json 최상위가 객체가 아님")
            item.update(loaded)
            item["dir"] = str(folder)
            item["skillName"] = folder.name
        except (OSError, ValueError, TypeError):
            item["legacy"] = True
    else:
        # schedule.json 이 생기기 전에 등록된 폴더. 수신 방법 같은 부가정보는 없지만
        # cron.txt 만 있으면 주기는 읽어낼 수 있으므로 수정은 가능하다.
        item["legacy"] = True

    # cron.txt 가 실행 주기의 유일한 근거다. schedule.json 보다 우선해서 반영한다.
    expr, comments = read_cron_file(folder)
    if expr:
        item["cron"] = expr
        parsed = parse_cron_expr(expr)
        if parsed:
            item["cronSchedule"] = parsed
            if not item.get("summaryWhen"):
                item["summaryWhen"] = describe_cron(parsed)
    for c in comments:
        if c.startswith("# 수정 "):
            item["cronUpdatedAt"] = c[len("# 수정 "):].split(" / ")[0].strip()
    try:
        item["files"] = [{"name": p.name, "bytes": p.stat().st_size}
                         for p in sorted(folder.iterdir())
                         if p.is_file() and not _is_protected(p.name)]
    except OSError:
        pass
    return item


def list_schedules():
    base, user = schedule_root()
    if not base.is_dir():
        return {"ok": True, "root": str(base), "owner": user.get("whoami") or "", "items": []}
    items = []
    try:
        for child in sorted(base.iterdir(), key=lambda p: p.name.lower()):
            if child.is_dir():
                items.append(_read_schedule(child))
    except OSError as err:
        return {"ok": False, "error": "목록을 읽지 못했습니다: %s" % err}
    return {"ok": True, "root": str(base), "owner": user.get("whoami") or "", "items": items}


def parse_cron_expr(expr):
    """crontab 5필드 → 화면이 쓰는 스케줄 dict. 못 읽으면 None.

    cron.txt 가 '무엇이 언제 도는지'의 유일한 근거다. schedule.json 이 없는
    옛 폴더도 이걸로 읽어야 수정 화면을 채울 수 있다.
    """
    parts = str(expr or "").split()
    if len(parts) != 5:
        return None
    minute, hour, dom, mon, dow = parts
    try:
        tm = "%02d:%02d" % (int(hour), int(minute))
    except ValueError:
        return None

    out = {"time": tm, "day": 1, "weekday": 1, "date": ""}
    if dom != "*" and mon != "*":
        out["cycle"] = "once"
        try:
            out["day"] = int(dom)
            out["month"] = int(mon)
        except ValueError:
            return None
    elif dom != "*":
        out["cycle"] = "monthly"
        try:
            out["day"] = int(dom)
        except ValueError:
            return None
    elif dow != "*":
        out["cycle"] = "weekly"
        try:
            out["weekday"] = int(dow) % 7
        except ValueError:
            return None
    else:
        out["cycle"] = "daily"
    return out


def read_cron_file(folder):
    """cron.txt 에서 (식, 주석줄들) 을 뽑는다."""
    path = folder / "cron.txt"
    if not path.is_file():
        return "", []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, ValueError):   # 메모장 ANSI 저장 등 디코딩 실패도 '없는 것'으로
        return "", []
    expr, comments = "", []
    for line in lines:
        t = line.strip()
        if t.startswith("#"):
            comments.append(t)
        elif t and not expr:
            expr = t
    return expr, comments


def update_schedule(payload):
    """등록된 스케줄의 실행 주기를 바꾼다 — cron.txt 만 다시 쓴다.

    [의도적으로 좁게] 폴더 이름·수신 방법·스킬 파일은 건드리지 않는다. cron.txt 가
    담을 수 있는 건 '언제 도는가' 뿐이고, 실행을 가르는 것도 그 한 줄이기 때문이다.
    """
    base, user = schedule_root()
    name = safe_component(payload.get("skillName"), "")
    if not name:
        return {"ok": False, "error": "대상 스케줄을 지정해 주세요."}
    root = base / name
    if not root.is_dir():
        return {"ok": False, "error": "스케줄을 찾지 못했습니다: %s" % name}

    sched = payload.get("schedule") or {}
    expr = cron_expression(sched)
    stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 원래 있던 '생성 …' 주석은 살려둔다 — 언제 처음 등록했는지가 사라지면 안 된다.
    _old_expr, old_comments = read_cron_file(root)
    created_line = next((c for c in old_comments if c.startswith("# 생성 ")), "")

    lines = ["# B2B 스케줄 - %s" % name, "# %s" % (payload.get("summaryWhen") or "")]
    if created_line:
        lines.append(created_line)
    lines.append("# 수정 %s / %s" % (stamp, user.get("whoami") or ""))
    if sched.get("cycle") == "once":
        lines.append("# 주의: 1회 실행입니다. crontab 에는 1회가 없어 해당 일·월로 고정했습니다.")
    lines += ["", expr, ""]
    try:
        (root / "cron.txt").write_text("\n".join(lines), encoding="utf-8")
    except OSError as err:
        return {"ok": False, "error": "cron.txt 를 쓰지 못했습니다: %s" % err}

    return {"ok": True, "dir": str(root), "skillName": name, "cron": expr}


# ── AX-Cell 스킬 해석 ───────────────────────────────────────────────────────
# scripts/scheduler.js 및 tools/auto_runner/skill.py 와 같은 규칙이다.
# 세 곳이 같은 답을 내야 "화면에서 본 문서 목록"과 "서버가 검사하는 목록"과
# "실제 실행 때 찾는 파일"이 어긋나지 않는다.
_BOOK_RE = re.compile(r"\.book\(\s*[\"']([^\"']+)[\"']")
_WORKBOOKS_RE = re.compile(r"Workbooks\(\s*\"([^\"]+)\"")


def _basename(name):
    return str(name or "").replace("\\", "/").split("/")[-1].strip()


def _zip_entry_names(zf):
    """앱이 만든 zip 은 UTF-8 플래그가 없어도 바이트는 UTF-8 이다."""
    out = {}
    for info in zf.infolist():
        name = info.filename
        if not (info.flag_bits & 0x800):
            try:
                name = name.encode("cp437").decode("utf-8")
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
        out[name] = info.filename
    return out


def skill_docs_from_zip(blob):
    """스킬 zip 바이트 → 필요한 문서 이름 목록(정렬). 스킬이 아니면 None."""
    try:
        zf = zipfile.ZipFile(io.BytesIO(blob))
    except Exception:
        return None
    try:
        with zf:
            names = _zip_entry_names(zf)
            logic = [n for n in names if n.lower().endswith(".logic.json")]
            if not logic:
                return None
            data = json.loads(zf.read(names[logic[0]]).decode("utf-8-sig"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None

    required = data.get("requiredFiles") or []
    handles = {rf["handle"]: rf["name"] for rf in required
               if isinstance(rf, dict) and rf.get("handle") and rf.get("name")}

    steps = []
    for idx, st in enumerate(data.get("pipeline") or []):
        if not isinstance(st, dict) or st.get("enabled") is False:
            continue
        code = str(st.get("code") or "")
        for handle, real in handles.items():
            code = code.replace(handle, real)
        if not code.strip():
            continue
        steps.append({"code": code,
                      "language": str(st.get("language") or "python"),
                      "targetFileId": str(st.get("targetFileId") or "")})
    if not steps:
        return None

    literals = set()
    for st in steps:
        for m in _BOOK_RE.finditer(st["code"]):
            literals.add(_basename(m.group(1)))
        if st["language"].lower() == "vba":
            for m in _WORKBOOKS_RE.finditer(st["code"]):
                literals.add(_basename(m.group(1)))

    # 유령 입력 — 요구로 잡혔지만 실제로는 안 쓰이는 파일
    sheets_by = {}
    for rf in required:
        if isinstance(rf, dict) and rf.get("name"):
            sheets_by[_basename(rf["name"])] = rf.get("requiredSheets") or []
    targeted = {st["targetFileId"][len("input:"):] for st in steps
                if st["targetFileId"].startswith("input:")}
    phantoms = set()
    for raw in (data.get("unresolvedRefs") or []):
        nm = _basename(raw)
        if nm and nm in targeted and not sheets_by.get(nm) and nm not in literals:
            phantoms.add(nm)

    docs = []

    def add(raw):
        nm = _basename(raw)
        if nm and nm not in phantoms and nm not in docs:
            docs.append(nm)

    for rf in required:
        if isinstance(rf, dict) and rf.get("role") == "input" and rf.get("name"):
            add(rf["name"])
    for st in steps:
        if st["targetFileId"].startswith("input:"):
            add(st["targetFileId"][len("input:"):])
    for st in steps:
        for m in _BOOK_RE.finditer(st["code"]):
            add(m.group(1))
        if st["language"].lower() == "vba":
            for m in _WORKBOOKS_RE.finditer(st["code"]):
                add(m.group(1))
    return sorted(docs)


# cron.txt / config.txt / schedule.json 은 스케줄의 메타데이터다.
# 스킬 파일 편집으로 이들을 지우거나 덮어쓰면 스케줄 자체가 깨지므로 손대지 못하게 한다.
_PROTECTED_FILES = {"cron.txt", "config.txt", "schedule.json"}


def _is_protected(name):
    """NTFS 는 대소문자를 구분하지 않으므로 'Cron.txt' 도 cron.txt 다 — 비교도 그렇게 한다."""
    return str(name or "").lower() in _PROTECTED_FILES


def _folder_files(root):
    out = []
    try:
        for f in sorted(root.iterdir()):
            if f.is_file() and not _is_protected(f.name):
                out.append({"name": f.name, "bytes": f.stat().st_size})
    except OSError:
        pass
    return out


def update_files(payload):
    """등록된 스케줄의 스킬 파일을 교체/추가/삭제한다.

    [순서가 중요하다] 검사 → 삭제 → 쓰기 순으로 한다.
    삭제를 먼저 하면, 뒤에서 거부해도 파일은 이미 사라진 뒤라
    '거부했는데 AX-Cell 이 없어진' 상태가 된다(실제로 그 버그가 있었다).
    """
    base, user = schedule_root()
    name = safe_component(payload.get("skillName"), "")
    if not name:
        return {"ok": False, "error": "대상 스케줄을 지정해 주세요."}
    root = base / name
    if not root.is_dir():
        return {"ok": False, "error": "스케줄을 찾지 못했습니다: %s" % name}

    # 기존에 기록해 둔 '필요 문서'와 AX-Cell 파일명
    prev_docs, cell_file = [], ""
    manifest_path = root / "schedule.json"
    if manifest_path.is_file():
        try:
            _m = json.loads(manifest_path.read_text(encoding="utf-8"))
            prev_docs = sorted(_basename(d.get("doc")) for d in (_m.get("docs") or [])
                               if isinstance(d, dict) and d.get("doc"))
            cell_file = str(_m.get("cellFile") or "")
        except Exception:   # 깨진 schedule.json(비객체 → TypeError/AttributeError 포함)은 '없는 것'으로
            pass

    # ── 1단계: 검사만 한다. 디스크는 아직 건드리지 않는다 ──────────────────
    removals = str(payload.get("remove") or "")
    remove_list = [safe_component(r, "") for r in (payload.get("remove") or [])]
    remove_list = [r for r in remove_list if r and not _is_protected(r)]

    pending = []
    for item in (payload.get("add") or []):
        fname = safe_component(item.get("name"), "")
        if not fname:
            continue
        if _is_protected(fname):
            return {"ok": False, "error": "이 이름은 사용할 수 없습니다: %s" % fname}
        try:
            blob = base64.b64decode(item.get("data") or "")
        except Exception:
            return {"ok": False, "error": "파일 데이터를 해석하지 못했습니다: %s" % fname}

        # [AX-Cell 교체 검사] 올린 것이 스킬이고 그게 이 스케줄의 AX-Cell 자리라면,
        # 필요 문서가 그대로인지 본다. 하나라도 다르면 다른 잡이므로 거부한다 —
        # 기존 AX-Trace 연결을 물려받을 수 없기 때문이다.
        role = str(item.get("role") or "")
        replacing_cell = (role == "ax-cell") or (cell_file and cell_file in remove_list)
        if prev_docs and role != "ax-trace" and replacing_cell:
            new_docs = skill_docs_from_zip(blob)
            if new_docs is not None and new_docs != prev_docs:
                return {
                    "ok": False,
                    "docsChanged": True,
                    "error": "이 스킬은 필요한 문서가 이전과 다릅니다. "
                             "기존 AX-Trace 연결을 그대로 쓸 수 없어 다시 등록해야 합니다.",
                    "prevDocs": prev_docs,
                    "newDocs": new_docs,
                }
        pending.append((fname, blob, role))

    # ── 2단계: 여기서부터 실제로 바꾼다 ────────────────────────────────────
    removed, added = [], []
    for fname in remove_list:
        target = root / fname
        if target.is_file():
            try:
                target.unlink()
                removed.append(fname)
            except OSError as err:
                return {"ok": False, "error": "삭제하지 못했습니다: %s (%s)" % (fname, err)}

    for fname, blob, role in pending:
        try:
            (root / fname).write_bytes(blob)
        except OSError as err:
            return {"ok": False, "error": "저장하지 못했습니다: %s (%s)" % (fname, err)}
        added.append({"name": fname, "role": role, "bytes": len(blob)})

    files = _folder_files(root)

    # schedule.json 의 파일 목록·AX-Cell 위치를 실제 폴더와 맞춘다(있을 때만).
    if manifest_path.is_file():
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            data["files"] = files
            # 문서↔AX-Trace 짝이 함께 오면 갱신한다. 화면이 이 값을 읽어
            # '문서별 수정' 줄을 그리므로 실제 파일과 어긋나면 안 된다.
            incoming_docs = payload.get("docs")
            if isinstance(incoming_docs, list) and incoming_docs:
                data["docs"] = [{"doc": str(x.get("doc") or ""),
                                 "trace": str(x.get("trace") or "")}
                                for x in incoming_docs if isinstance(x, dict) and x.get("doc")]
            new_cell = next((a["name"] for a in added if a["role"] == "ax-cell"), "")
            if new_cell:
                data["cellFile"] = new_cell
            elif data.get("cellFile") in removed:
                data["cellFile"] = ""
            data["updatedAt"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            manifest_path.write_text(json.dumps(data, ensure_ascii=False, indent=2),
                                     encoding="utf-8")
        except Exception:   # 깨진 schedule.json(비객체 → TypeError/AttributeError 포함)은 '없는 것'으로
            pass

    return {"ok": True, "dir": str(root), "skillName": name,
            "added": added, "removed": removed, "files": files}


def delete_schedule(payload):
    base, _user = schedule_root()
    name = safe_component(payload.get("skillName"), "")
    if not name:
        return {"ok": False, "error": "대상 스케줄을 지정해 주세요."}
    root = base / name
    # 사용자가 준 이름이 정말 ESTB 안을 가리키는지 실제 경로로 다시 확인한다.
    try:
        if base.resolve() not in root.resolve().parents:
            return {"ok": False, "error": "삭제할 수 없는 경로입니다."}
    except OSError:
        return {"ok": False, "error": "경로를 확인하지 못했습니다."}
    if not root.is_dir():
        return {"ok": False, "error": "스케줄을 찾지 못했습니다: %s" % name}
    try:
        shutil.rmtree(root)
    except OSError as err:
        return {"ok": False, "error": "삭제하지 못했습니다: %s" % err}
    return {"ok": True, "skillName": name}


# ── HTTP 디스패치 ──────────────────────────────────────────────────────────
_GET_ROUTES = {
    "/api/whoami": lambda: current_windows_user(),
    "/api/scheduler/list": lambda: list_schedules(),
}

_POST_ROUTES = {
    "/api/scheduler/register": register_schedule,
    "/api/scheduler/update": update_schedule,
    "/api/scheduler/delete": delete_schedule,
    "/api/scheduler/files": update_files,
}


def handles_get(path):
    """본체가 Origin 가드 등을 먼저 걸 수 있게 '내 GET 인지'만 판단한다(handles_post 와 대칭)."""
    return str(path).split("?")[0] in _GET_ROUTES


def handle_get(path):
    """이 모듈이 맡는 GET 이면 응답 dict 를, 아니면 None 을 돌려준다."""
    fn = _GET_ROUTES.get(str(path).split("?")[0])
    return fn() if fn else None


def handles_post(path):
    """본체가 본문을 읽기 전에 '내 것인지'만 먼저 판단할 수 있게 한다."""
    return str(path).split("?")[0] in _POST_ROUTES


def handle_post(path, payload):
    fn = _POST_ROUTES.get(str(path).split("?")[0])
    return fn(payload or {}) if fn else None
