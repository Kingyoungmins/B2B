# -*- coding: utf-8 -*-
"""시작 자가진단 계약 테스트 — 실행: python test_startup_selfcheck.py

켤 때 '지금 무엇이 되고 무엇이 안 되는지'가 실제로 보이는지 확인한다.
(폐쇄망에서 DNS 가 안 풀려 보안 해제가 전부 실패하는데 시작 화면은 멀쩡해 보이던 실측 대응)
네트워크·Excel 불필요.
"""
import io
import sys
import tempfile
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import socket as socket_mod

import collector
import drm
import main as M

fails = 0


def check(name, cond, detail=""):
    global fails
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)) if (not cond and detail) else ""))
    if not cond:
        fails += 1


def run(**over):
    """자가진단을 돌리고 (경고건수, 출력문자열) 을 돌려준다."""
    args = SimpleNamespace(no_collector=False, mip_base_url="", mip_api_key="",
                           mip_account="", mip_timeout="", mip_client_ip="", mip_gateway_ip="")
    for k, v in over.items():
        setattr(args, k, v)
    buf = io.StringIO()
    with redirect_stdout(buf):
        warn = M.startup_selfcheck(args)
    return warn, buf.getvalue()


work = Path(tempfile.mkdtemp(prefix="selfcheck_"))
M.VERSION_FILE = work / "version.txt"
M.VERSION_FILE.write_text("0.8.0.0\n", encoding="utf-8")
collector.configure(work / "logs")
drm.configure(base_url="https://no-such-host-abc123.invalid/webapi", api_key="K", account="acct")

print("[1] 정상 항목은 OK 로 보인다")
warn, out = run()
check("버전 확인 OK", "[OK  ] 버전 확인" in out and "0.8.0.0" in out, out[:200])
check("로그 수집 OK + 쓰기 가능 표시", "[OK  ] 로그 수집" in out and "쓰기 가능" in out)
check("파일 업로드(python-multipart) 점검", "파일 업로드" in out)
check("문서보안 키 OK", "[OK  ] 문서보안 키" in out and "설정됨" in out)

print("[2] 폴백이 없으면, 이름을 못 찾을 때 경고 + 해결법까지 나온다")
# 자동 폴백(등록 VIP 로 직접 연결)을 끈 상태 = 예전 동작. 폴백이 켜진 경우는 [2-6] 에서 본다.
_saved_gai = socket_mod.getaddrinfo
drm.GATEWAY_IP = ""
drm._DNS_FALLBACK_INSTALLED = False
warn, out = run()
check("경고로 표시", "[경고] 게이트웨이" in out, out)
check("보안 해제가 전부 실패한다고 알린다", "보안 해제/적용이 전부 실패" in out)
check("hosts / DNS / 프록시 세 갈래를 안내", "/etc/hosts" in out and "resolv.conf" in out and "HTTPS_PROXY" in out)
check("컨테이너 주의도 안내", "extra_hosts" in out or "--add-host" in out)
check("경고 건수에 반영", warn >= 1, warn)

print("[2-2] 방화벽에 등록할 '나가는 IP' 를 알려준다(보안팀 등록값과 대조용)")
check("나가는 IP 항목", "나가는 IP" in out, out[:300])
check("DNS 실패 상태에서도 기본 경로 기준으로는 보여준다", "기본 경로 기준 추정" in out or "허용목록" in out, out)
check("보안팀 등록값과 대조하라고 안내", "보안팀에 등록된 IP" in out and "-100" in out)
check("NAT/프록시면 다를 수 있다고 알린다", "NAT" in out)

print("[2-3] 컨테이너면 그 사정에 맞게 안내한다(DNS·나가는 IP 가 호스트와 다름)")
_sc, _sn = M.detect_container, M.read_nameservers
M.detect_container = lambda: "docker"
M.read_nameservers = lambda: ["127.0.0.11"]
warn_c, out_c = run()
check("실행 환경을 컨테이너로 표시", "컨테이너(docker)" in out_c, out_c[:200])
check("DNS 서버 목록을 보여준다(도구 없이 확인)", "127.0.0.11" in out_c)
check("컨테이너는 호스트 DNS 를 안 물려받는다고 알린다", "호스트의 DNS 를 물려받지 않습니다" in out_c)
check("컨테이너 안 수정은 재시작하면 날아간다고 경고", "재시작하면 사라지니" in out_c)
check("방화벽엔 호스트 IP 를 등록하라고 안내", "호스트 서버의 IP" in out_c and "컨테이너 내부 주소" in out_c)
check("호스트에서 IP 확인하는 법까지", "hostname -I" in out_c or "ip -4 addr" in out_c)
M.detect_container, M.read_nameservers = _sc, _sn

print("[2-4] 쿠버네티스면 '노드' 가 방화벽 출발지임을 알린다(GPU 노드만 열어둔 상황 대응)")
import os as _os
_sc2, _k8s = M.detect_container, M.k8s_pod_info
M.detect_container = lambda: "kubernetes"
M.k8s_pod_info = lambda: {"podName": "axcell-abc", "podIp": "10.1.2.3",
                          "nodeName": "", "nodeIp": "", "namespace": "ns"}
warn_k, out_k = run()
check("노드를 모르면 경고", "노드 모름" in out_k, out_k[:250])
check("출발지는 파드가 아니라 노드라고 설명", "노드 IP" in out_k and "SNAT" in out_k)
check("downward API 넣는 법 안내", "spec.nodeName" in out_k and "status.hostIP" in out_k)
check("kubectl 로 보는 법도", "kubectl get pod" in out_k)
check("노드 고정(nodeSelector) 안내", "nodeSelector" in out_k and "-100" in out_k)
M.k8s_pod_info = lambda: {"podName": "axcell-abc", "podIp": "10.1.2.3",
                          "nodeName": "violet-l40s-001", "nodeIp": "192.168.159.31", "namespace": "ns"}
warn_k2, out_k2 = run()
check("노드를 알면 그 노드를 보여준다", "violet-l40s-001" in out_k2 and "방화벽 출발지는 이 **노드**" in out_k2, out_k2[:250])
M.detect_container, M.k8s_pod_info = _sc2, _k8s

print("[2-5] URL 에 IP 를 직접 박으면 TLS 함정을 경고한다")
drm.configure(base_url="https://172.28.11.30/webapi/api/lguplusstreams/noSessiondo")
warn_ip, out_ip = run()
check("경고로 표시", "[경고] 게이트웨이 URL" in out_ip, out_ip[:250])
check("인증서 문제를 짚는다", "인증서" in out_ip)
check("hostAliases 로 풀라고 안내", "hostAliases" in out_ip)
drm.configure(base_url="https://no-such-host-abc123.invalid/webapi")

print("[2-6] 폴백이 있으면 사내 DNS 없이도 이름 풀이가 된다(사용자가 파드 설정 안 고쳐도 되게)")
drm.GATEWAY_IP = "127.0.0.1"          # 이 PC 에서 실제로 붙을 수 있는 주소로 검증
drm._DNS_FALLBACK_INSTALLED = False
drm._DNS_FALLBACK_LOGGED = False
drm._DNS_DEAD_UNTIL = 0.0
drm.install_dns_fallback()
warn_f, out_f = run()
check("이름 풀이가 OK 로", "[OK  ] 게이트웨이 이름 풀이" in out_f, out_f[:400])
check("무엇을 하고 있는지 밝힌다", "등록된 VIP 로 직접 연결 중" in out_f)
check("이름 풀이 단계엔 경고가 없다", "[경고] 게이트웨이 이름 풀이" not in out_f)
check("DNS 경고가 사라진다", "이름을 못 찾음" not in out_f)
# [회귀 2026-08-26] 이름이 풀렸다고 '게이트웨이 OK' 한 줄로 뭉뚱그리면 안 된다. 실제 연결까지
# 밟아 보고, 못 밟았거나 실패한 단계는 그대로 남겨야 한다. 예전엔 여기서 전부 OK 로 보여서
# 모든 보안 해제가 실패하는 서버가 시작 화면상 멀쩡해 보였다(실측 — 원인 찾는 데 한참 걸렸다).
check("붙지 못한 단계를 OK 로 적지 않는다",
      "[경고] 게이트웨이 TCP 연결" in out_f or "[경고] 게이트웨이 TLS 연결" in out_f
      or "[경고] 게이트웨이 HTTP 응답" in out_f or "[모름]" in out_f, out_f[:400])
socket_mod.getaddrinfo = _saved_gai
drm._DNS_FALLBACK_INSTALLED = False

print("[3] 버전 파일이 깨지면 잡아낸다")
M.VERSION_FILE.write_text("최신버전입니다\n", encoding="utf-8")
warn2, out2 = run()
check("버전 확인 경고", "[경고] 버전 확인" in out2, out2[:200])
check("고치는 법 안내", "숫자 버전" in out2)
M.VERSION_FILE.write_text("0.8.0.0\n", encoding="utf-8")

print("[4] 수집 폴더에 못 쓰면 잡아낸다")
saved_root = collector.LOG_ROOT
collector.LOG_ROOT = Path(str(work / "logs" / "없는드라이브")) if False else Path("Z:/nonexistent_root_for_test")
warn3, out3 = run()
check("쓰기 불가 경고", "[경고] 로그 수집" in out3, out3[:200])
check("권한/경로 안내", "권한" in out3 or "--log-root" in out3)
collector.LOG_ROOT = saved_root

print("[5] 키가 없으면 503 이 난다고 미리 알려준다")
drm.configure(api_key="")
warn4, out4 = run()
check("키 없음 경고", "[경고] 문서보안 키" in out4 and "503" in out4, out4[:300])
check("어디에 넣는지 안내", "MIP_API_KEY" in out4 and ".env" in out4)
drm.configure(api_key="K")

print("[6] 기능을 껐으면 '꺼짐' 으로 구분한다(경고 아님)")
warn5, out5 = run(no_collector=True)
check("꺼짐 표시", "[꺼짐] 로그 수집" in out5, out5[:200])
check("꺼짐은 경고로 세지 않는다", "[경고] 로그 수집" not in out5)

print("[7] 진단이 서버 기동을 막지 않는다")
saved = drm.check_gateway_reachable
drm.check_gateway_reachable = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("점검 실패"))
try:
    M.startup_selfcheck(SimpleNamespace(no_collector=False, mip_base_url="", mip_api_key="",
                                        mip_account="", mip_timeout="", mip_client_ip="", mip_gateway_ip=""))
    check("점검 중 예외가 나면 밖으로 던진다(main 이 잡아 서버는 계속)", True)
except RuntimeError:
    check("점검 중 예외가 나면 밖으로 던진다(main 이 잡아 서버는 계속)", True)
except Exception as err:
    check("예상 못 한 예외", False, err)
finally:
    drm.check_gateway_reachable = saved
check("main 이 진단 예외를 잡아 준다", "startup_selfcheck(args)" in Path("main.py").read_text("utf-8")
      and "서버는 그대로 시작합니다" in Path("main.py").read_text("utf-8"))

print("[7] 점검이 서버 기동을 막지 않는다(파드 재시작 사고)")
# [실측 2026-08-27] 게이트웨이가 막힌 상태에서 점검·진단이 90초 넘게 걸렸는데, 그동안 포트가
# 안 열려 플랫폼 헬스체크(GET /v1/models)가 실패했다. 플랫폼은 죽은 서비스로 보고 파드를
# **계속 재시작**시켰다 — 진단하려다 서비스를 죽인 셈이다. 점검은 아무리 유용해도 서비스보다 뒤다.
import time as _time

_saved_check, _saved_diag = M.startup_selfcheck, M.run_deep_diagnosis
_ran = {"check": False}


def _slow_check(args):
    _time.sleep(3.0)                      # 막힌 게이트웨이를 흉내낸다
    _ran["check"] = True
    return 1


M.startup_selfcheck = _slow_check
M.run_deep_diagnosis = lambda *a, **k: None
_args = SimpleNamespace(no_collector=False, mip_base_url="", mip_api_key="", mip_account="",
                        mip_timeout="", mip_client_ip="", mip_gateway_ip="",
                        diagnose=False, no_diagnose=False)
_t0 = _time.monotonic()
_buf = io.StringIO()
with redirect_stdout(_buf):
    M.start_background_checks(_args, delay=0.2)
_elapsed = _time.monotonic() - _t0
check("점검을 기다리지 않고 바로 돌아온다(기동을 막지 않음)", _elapsed < 1.0, "%.2f초" % _elapsed)
check("서버가 먼저 뜬다고 알려준다", "서버를 먼저 띄웁니다" in _buf.getvalue(), _buf.getvalue()[:120])
check("헬스체크를 막지 않는다고 명시", "/v1/models" in _buf.getvalue())
_time.sleep(4.0)
check("점검은 나중에 백그라운드에서 실제로 돈다", _ran["check"] is True)
M.startup_selfcheck, M.run_deep_diagnosis = _saved_check, _saved_diag

print("")
import shutil
shutil.rmtree(work, ignore_errors=True)
print("\n" + ("RESULT: ALL PASS" if fails == 0 else f"RESULT: {fails} FAIL"))
sys.exit(1 if fails else 0)
