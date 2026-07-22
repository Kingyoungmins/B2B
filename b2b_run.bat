@python -x "%~f0" %* & exit /b %errorlevel%
# -*- coding: utf-8 -*-
# ==========================================================================
#  b2b_run.bat  —  B2B 빌링 Agent 실행기를 '외부에서' 호출하는 단일 파일 도구
# ==========================================================================
#  이 파일은 Windows 배치(1행)이자 Python 스크립트(2행~)다. python -x 가 1행을
#  건너뛰고 나머지를 Python 으로 실행한다 → .bat 하나로 완결(별도 .py 불필요).
#
#  용도: 같은 PC 에서 이미 떠 있는 B2B_ver0.6.x.exe 를 API 처럼 쓴다.
#        입력 파일 + (옵션)출력 템플릿 + 스킬.zip 을 던지면, 서버가 '스킬 기본값'
#        (시트 치환 없이 스킬 그대로) 으로 전체실행하고, 완료된 파일들을 zip 으로 준다.
#        0.6.x.exe 자체는 건드리지 않는다 — 기존 HTTP API 만 순서대로 호출한다.
#
#  사용:
#    b2b_run.bat --skill 스킬.zip --input 입력.xlsx [--output 템플릿.xlsx] --out-zip 결과.zip
#    b2b_run.bat --skill s.zip --input a.xlsx b.xlsx --out-zip out.zip   (다입력: 스킬 입력 순서대로)
#    b2b_run.bat --skill s.zip --input in=a.xlsx --input "02.…=b.xlsx"    (명시 매핑: 스킬입력명=파일)
#  옵션:
#    --port N       서버 포트 직접 지정(기본: 자동 탐색)
#    --timeout S    실행 대기 초(기본 1800)
#    --keep-open    실행 후 내가 연 Excel 세션을 닫지 않음(디버그)
#    --dry-run      업로드/열기까지만 하고 실제 실행은 안 함(전송할 payload 를 출력)
#  결과: stdout 마지막 줄에 JSON 한 줄 {ok, outZip, files, port, ...}. OpenClaw 는 이걸 파싱.
#  주의: 결과 zip 에는 '전체실행으로 값이 바뀐 파일'만 담긴다(읽기만 한 입력은 원본과 동일 → 미포함).
# ==========================================================================
import sys, os, json, argparse, zipfile, io, time, re, urllib.request, urllib.error

# OpenClaw 가 stdout 의 결과 JSON(한글 파일명 포함)을 콘솔 코드페이지와 무관하게 항상 UTF-8 로
# 받도록 고정한다. 안 하면 cp949 콘솔에서 한글이 깨지거나 UnicodeEncodeError 로 죽을 수 있다.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# 서버가 뜰 수 있는 포트 후보(네이티브 셸 18120~, 단독 launcher 8090/18090~).
PORT_CANDIDATES = [18120, 18121, 18122, 18123, 18124, 18125, 18126, 18127,
                   8090, 18090, 18091, 18092, 18093, 18094, 18095]


def _log(*a):
    print("[b2b_run]", *a, file=sys.stderr, flush=True)


def _fail(msg, **extra):
    out = {"ok": False, "error": str(msg)}
    out.update(extra)
    print(json.dumps(out, ensure_ascii=False))
    sys.exit(1)


class Client:
    def __init__(self, port, timeout=1800):
        self.base = "http://127.0.0.1:%d" % port
        self.timeout = timeout

    def _req(self, path, data=None, headers=None, method=None, raw=False, timeout=None):
        url = self.base + path
        req = urllib.request.Request(url, data=data, method=method or ("POST" if data is not None else "GET"))
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=timeout or self.timeout) as resp:
            body = resp.read()
        return body if raw else json.loads(body.decode("utf-8"))

    def post_json(self, path, obj, timeout=None):
        return self._req(path, data=json.dumps(obj).encode("utf-8"),
                         headers={"content-type": "application/json"}, timeout=timeout)

    def upload(self, name, file_bytes):
        # 업로드는 raw octet-stream(멀티파트 아님). ?name= 으로 '스킬이 기대하는 이름'을 지정한다 —
        # 이러면 코드의 Workbooks("기대이름")/ctx.book("기대이름") 참조가 그대로 맞아 시트/파일 치환이 불필요.
        from urllib.parse import quote
        return self._req("/api/workbooks/upload?name=" + quote(name),
                         data=file_bytes, headers={"content-type": "application/octet-stream"})

    def get_bytes(self, path):
        return self._req(path, raw=True)


def discover_port(forced=None):
    ports = [forced] if forced else PORT_CANDIDATES
    for p in ports:
        try:
            c = Client(p, timeout=3)
            h = c._req("/api/backend/health", timeout=3)
            if isinstance(h, dict) and h.get("ok"):
                _log("서버 발견: port %d (build %s)" % (p, h.get("buildStamp")))
                return p
        except Exception:
            continue
    _fail("실행 중인 B2B 서버를 찾지 못했습니다. 프로그램(B2B_ver0.6.x.exe)이 켜져 있는지 확인하세요.",
          triedPorts=ports)


def read_skill(zip_path):
    """스킬 zip 에서 logic.json 을 읽어 파이프라인·기대 입력/출력 이름·핸들맵을 뽑는다."""
    if not os.path.isfile(zip_path):
        _fail("스킬 zip 을 찾을 수 없습니다: " + zip_path)
    with zipfile.ZipFile(zip_path) as z:
        ljs = [n for n in z.namelist() if n.endswith(".logic.json")]
        if not ljs:
            _fail("스킬 zip 안에 .logic.json 이 없습니다(올바른 스킬 zip 인지 확인).")
        data = json.loads(z.read(ljs[0]).decode("utf-8"))

    version = data.get("version", 1)
    # v4 핸들맵: @@FILE_n@@ → 실제(원본) 파일명
    handle_map = {}
    for rf in (data.get("requiredFiles") or []):
        if rf.get("handle") and rf.get("name"):
            handle_map[rf["handle"]] = rf["name"]

    def restore(code):
        c = str(code or "")
        for h, nm in handle_map.items():
            c = c.replace(h, nm)
        return c

    steps = []
    input_order, output_order = [], []
    seen_in, seen_out = set(), set()
    for s in (data.get("pipeline") or []):
        if s.get("enabled") is False:
            continue
        code = restore(s.get("code"))
        if not str(code).strip():
            continue
        tid = str(s.get("targetFileId") or "")
        steps.append({
            "id": s.get("id") or ("s%d" % len(steps)),
            "code": code,
            "language": s.get("language") or "python",
            "targetFileId": tid,
            "targetSheetName": s.get("targetSheetName") or s.get("targetSheet") or None,
        })
        if tid.startswith("input:"):
            nm = tid[6:]
            if nm not in seen_in:
                seen_in.add(nm); input_order.append(nm)
        elif tid.startswith("output"):
            key = tid
            if key not in seen_out:
                seen_out.add(key); output_order.append(key)

    # v4 requiredFiles 가 입력 순서의 더 정확한 근거(선언표) — 있으면 우선.
    rf_inputs = [rf["name"] for rf in (data.get("requiredFiles") or [])
                 if rf.get("role") == "input" and rf.get("name")]
    if rf_inputs:
        input_order = rf_inputs + [n for n in input_order if n not in rf_inputs]

    if not steps:
        _fail("스킬에 실행할 단계가 없습니다.")
    return {"version": version, "steps": steps,
            "inputs": input_order, "outputs": output_order,
            "name": data.get("name") or os.path.basename(zip_path)}


def parse_input_args(input_args, skill_inputs):
    """--input 값을 (기대이름 → 실제파일경로) 로 해석.
       'name=path' 명시 매핑이 있으면 그대로. 아니면 주어진 순서를 스킬 입력 순서에 1:1 대응."""
    explicit, positional = {}, []
    for a in input_args:
        if "=" in a and not os.path.exists(a):
            k, v = a.split("=", 1)
            explicit[k.strip()] = v.strip()
        else:
            positional.append(a)
    mapping = {}
    # 명시 매핑 먼저
    for k, v in explicit.items():
        # 스킬 기대이름과 정확 일치 우선, 없으면 그 이름 그대로 사용(스킬이 그 이름을 쓸 수도)
        mapping[k] = v
    # 위치 매핑: 남은 스킬 입력 슬롯에 순서대로
    remaining_slots = [n for n in skill_inputs if n not in mapping]
    if positional:
        if not remaining_slots:
            # 스킬이 input:… 을 안 남긴 경우(파일명 리터럴만): 파일명 그대로 기대이름으로 씀
            for v in positional:
                mapping[os.path.basename(v)] = v
        else:
            if len(positional) > len(remaining_slots):
                _fail("입력 파일이 스킬이 요구하는 개수(%d)보다 많습니다. name=파일 형식으로 매핑하세요."
                      % len(remaining_slots), skillInputs=skill_inputs)
            for slot, v in zip(remaining_slots, positional):
                mapping[slot] = v
    if not mapping:
        _fail("입력 파일이 없습니다(--input).")
    for k, v in mapping.items():
        if not os.path.isfile(v):
            _fail("입력 파일을 찾을 수 없습니다: %s (기대이름 %s)" % (v, k))
    return mapping


def build_groups(steps, name_to_excel, output_excel):
    """스텝을 연속 같은-세션 묶음(group)으로. targetFileId → excelId 해석."""
    def excel_for(tid):
        if tid.startswith("input:"):
            return name_to_excel.get(tid[6:])
        if tid.startswith("output"):
            return output_excel
        return None
    groups, cur = [], None
    for i, s in enumerate(steps):
        eid = excel_for(s["targetFileId"])
        if eid is None:
            # 대상 미해결: 유일 입력이면 거기로, 아니면 실패
            if len(name_to_excel) == 1:
                eid = next(iter(name_to_excel.values()))
            else:
                _fail("단계 %d 의 대상 파일(%s)을 열린 세션과 연결하지 못했습니다."
                      % (i + 1, s["targetFileId"]))
        step_payload = {"code": s["code"], "language": s["language"],
                        "targetSheetName": s["targetSheetName"], "stepIdx": i, "stepId": s["id"]}
        if cur and cur["excelId"] == eid:
            cur["steps"].append(step_payload)
        else:
            cur = {"excelId": eid, "steps": [step_payload]}
            groups.append(cur)
    return groups


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--skill", required=True)
    ap.add_argument("--input", nargs="+", required=True)
    ap.add_argument("--output", default=None, help="출력 템플릿(옵션)")
    ap.add_argument("--out-zip", dest="out_zip", required=True)
    ap.add_argument("--port", type=int, default=None)
    ap.add_argument("--timeout", type=int, default=1800)
    ap.add_argument("--keep-open", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    port = discover_port(args.port)
    c = Client(port, timeout=args.timeout)

    skill = read_skill(args.skill)
    _log("스킬:", skill["name"], "| 단계", len(skill["steps"]), "| 기대 입력", skill["inputs"])

    in_map = parse_input_args(args.input, skill["inputs"])
    _log("입력 매핑:", {k: os.path.basename(v) for k, v in in_map.items()})

    opened = []          # 내가 연 excelId (끝에 닫기)
    name_to_excel = {}   # 기대이름 → excelId
    try:
        # 1) 입력 업로드(기대이름으로) + 세션 열기
        for expected, path in in_map.items():
            with open(path, "rb") as f:
                up = c.upload(expected, f.read())
            if not up.get("ok"):
                _fail("업로드 실패: %s (%s)" % (expected, up.get("error")))
            op = c.post_json("/api/excel/open",
                             {"workbookId": up["workbookId"], "liveEditable": True, "deferVisible": True})
            if not op.get("ok") or not op.get("excelId"):
                _fail("세션 열기 실패: %s (%s)" % (expected, op.get("error")))
            name_to_excel[expected] = op["excelId"]
            opened.append(op["excelId"])
            _log("열림:", expected, "→", op["excelId"])

        # 2) 출력 템플릿(옵션)
        output_excel = None
        if args.output:
            out_name = os.path.basename(args.output)
            with open(args.output, "rb") as f:
                up = c.upload(out_name, f.read())
            if not up.get("ok"):
                _fail("출력 템플릿 업로드 실패: " + str(up.get("error")))
            op = c.post_json("/api/excel/open",
                             {"workbookId": up["workbookId"], "liveEditable": True, "deferVisible": True})
            if op.get("ok") and op.get("excelId"):
                output_excel = op["excelId"]
                opened.append(op["excelId"])
                _log("출력 열림:", out_name, "→", output_excel)

        # 내가 연 세션이 화면에 뜨는 걸 억제(사용자가 프로그램을 쓰는 중일 수 있어 전역 hide 는 피함).
        # deferVisible 로 이미 숨김. 필요시 개별 hide.
        for eid in opened:
            try:
                c.post_json("/api/excel/hide", {"excelId": eid, "light": True})
            except Exception:
                pass

        # 3) 실행 payload 구성('스킬 기본값' = 시트 치환 없음, 파일명은 업로드 이름으로 이미 일치)
        groups = build_groups(skill["steps"], name_to_excel, output_excel)
        reset_ids = []
        for g in groups:
            if g["excelId"] not in reset_ids:
                reset_ids.append(g["excelId"])

        if args.dry_run:
            print(json.dumps({"ok": True, "dryRun": True, "port": port,
                              "groups": groups, "resetExcelIds": reset_ids},
                             ensure_ascii=False))
            return

        # 4) 전체실행(파일 출력 모드) — 라이브 미반영, 결과 파일만 생성
        _log("전체실행 중... (단계 %d)" % len(skill["steps"]))
        res = c.post_json("/api/excel/run-full-pipeline",
                          {"groups": groups, "resetExcelIds": reset_ids,
                           "viewSheet": None, "outputMode": "file"},
                          timeout=args.timeout)
        if not res.get("ok"):
            _fail("전체실행 실패: " + str(res.get("error")), errorInfo=res.get("errorInfo"))

        out_files = res.get("outputFiles") or []
        if not out_files:
            _fail("전체실행은 됐지만 결과 파일이 없습니다(스킬이 파일을 바꾸지 않았을 수 있음).",
                  applied=res.get("applied"))

        # 5) 결과 파일 내려받아 zip 으로 묶기
        os.makedirs(os.path.dirname(os.path.abspath(args.out_zip)) or ".", exist_ok=True)
        packed = []
        with zipfile.ZipFile(args.out_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            for of in out_files:
                dl = of.get("downloadUrl") or ("/api/workbooks/download/%s" % of.get("downloadId"))
                blob = c.get_bytes(dl)
                arc = of.get("name") or ("결과_%d.xlsx" % len(packed))
                zf.writestr(arc, blob)
                packed.append(arc)
        _log("결과 zip:", args.out_zip, "| 파일", packed)

        print(json.dumps({"ok": True, "port": port, "outZip": os.path.abspath(args.out_zip),
                          "files": packed, "applied": res.get("applied"),
                          "skill": skill["name"]}, ensure_ascii=False))
    finally:
        if not args.keep_open:
            for eid in opened:
                try:
                    c.post_json("/api/excel/close", {"excelId": eid})
                except Exception:
                    pass


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        _fail("서버 통신 오류: " + str(e))
    except SystemExit:
        raise
    except Exception as e:
        _fail("예기치 못한 오류: " + repr(e))
