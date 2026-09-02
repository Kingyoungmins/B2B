/* ===================================================================
   버전 게이트 — 시작 시 1회, 허용 버전 목록 확인 팝업
   ===================================================================
   [요청 2026-09-02] 프로그램이 처음 실행될 때 한 번, 버전 서버(보안망)의
   version.txt 에 적힌 '허용 버전 목록'과 지금 버전을 대조한다. 목록에
   없으면 팝업:
     "오래된 버전을 사용하고 있습니다. 최신 버전으로 교체 해주세요."
     [다운로드 하러가기] [무시하고 사용하기]

   설계 근거
   · 판정은 백엔드(/api/app/version/gate)가 한다 — 버전 서버 주소/키는
     백엔드(F9 설정)가 알고, '프로세스당 1회' 상태도 백엔드가 쥔다.
     그래서 새로고침(F5)이나 탭이 여럿이어도 팝업은 실행당 한 번만 뜬다.
   · 서버가 죽어 있거나 주소가 없으면 조용히 통과한다(show=false) —
     버전 확인 때문에 업무가 막히면 안 된다.
   · [다운로드 하러가기]는 백엔드가 시스템 기본 브라우저로 연다
     (네이티브 WebView 의 새 창 처리에 기대지 않는다 — 확실한 쪽).
     주소 우선순위: F9 에서 저장한 주소 > 버전 서버가 준 주소 > 기본값.
   =================================================================== */

const VERSION_GATE_DOWNLOAD_DEFAULT = "https://seulgi.lguplus.co.kr/desk/smart-billing";

function versionGateDownloadUrl(serverUrl) {
  try {
    const local = String(localStorage.getItem("b2bUpdateDownloadUrl") || "").trim();
    if (local) return local;
  } catch (_) {}
  const fromServer = String(serverUrl || "").trim();
  return fromServer || VERSION_GATE_DOWNLOAD_DEFAULT;
}

function showVersionGatePopup(info) {
  if (document.getElementById("version-gate-overlay")) return;   // 중복 방지
  const maintenance = info.kind === "maintenance";
  const overlay = document.createElement("div");
  overlay.id = "version-gate-overlay";
  overlay.style.cssText =
    "position:fixed; inset:0; z-index:99990; background:rgba(0,0,0,.45);" +
    "display:flex; align-items:center; justify-content:center;";
  const cur = String(info.current || "").replace(/\.0$/, "");
  const latest = String(info.latest || "").replace(/\.0$/, "");
  const box = document.createElement("div");
  box.style.cssText =
    "background:#fff; color:#222; border-radius:12px; padding:22px 24px 18px;" +
    "width:min(420px, calc(100vw - 48px)); box-shadow:0 12px 40px rgba(0,0,0,.25);" +
    "font-size:13.5px; line-height:1.6;";
  if (maintenance) {
    // [요청 2026-09-02] 버전 정보를 못 가져오는 경우(서버 오류 등) — 확인만 누르면 계속 사용.
    box.innerHTML =
      '<div style="font-weight:800; font-size:15px; margin-bottom:8px">안내</div>' +
      '<div>점검중입니다. 문의사항이 있으시면 팀즈로 문의 부탁드립니다</div>' +
      '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px">' +
        '<button id="version-gate-ok" style="padding:8px 14px; border:0;' +
          ' border-radius:8px; background:#111; color:#fff; font-weight:700; cursor:pointer">확인</button>' +
      "</div>";
  } else {
    // [요청 2026-09-02] "무시하고 사용하기"는 기본 숨김 — 일반 사용자는 업데이트로 유도하고,
    // 개발/운영자만 팝업이 떠 있는 동안 F2 를 누르면 버튼이 나타난다(개발자모드 관례).
    box.innerHTML =
      '<div style="font-weight:800; font-size:15px; margin-bottom:8px">업데이트 안내</div>' +
      '<div>오래된 버전을 사용하고 있습니다. 최신 버전으로 교체 해주세요.</div>' +
      '<div style="font-size:11.5px; color:#888; margin-top:6px">' +
        (cur ? "현재 버전 " + cur : "") + (latest ? " · 최신 버전 " + latest : "") + "</div>" +
      '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px">' +
        '<button id="version-gate-ignore" style="display:none; padding:8px 14px; border:1px solid #ccc;' +
          ' border-radius:8px; background:#fff; cursor:pointer">무시하고 사용하기</button>' +
        '<button id="version-gate-download" style="padding:8px 14px; border:0;' +
          ' border-radius:8px; background:#111; color:#fff; font-weight:700; cursor:pointer">' +
          "다운로드 하러가기</button>" +
      "</div>";
  }
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const okBtn = document.getElementById("version-gate-ok");
  if (okBtn) okBtn.onclick = () => overlay.remove();
  const ignoreBtn = document.getElementById("version-gate-ignore");
  if (ignoreBtn) {
    ignoreBtn.onclick = () => overlay.remove();
    // F2 = 숨겨둔 [무시하고 사용하기] 표시. 팝업이 떠 있는 동안만 듣고, 닫히면 정리한다.
    const revealKey = (e) => {
      if (e.key !== "F2") return;
      e.preventDefault();
      ignoreBtn.style.display = "";
    };
    document.addEventListener("keydown", revealKey);
    const _origRemove = overlay.remove.bind(overlay);
    overlay.remove = () => {
      document.removeEventListener("keydown", revealKey);
      _origRemove();
    };
  }
  const dlBtn = document.getElementById("version-gate-download");
  if (dlBtn) dlBtn.onclick = async () => {
    dlBtn.disabled = true;
    try {
      await fetch("/api/app/version/open-download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: versionGateDownloadUrl(info.downloadUrl) }),
      });
    } catch (_) { /* 브라우저 열기 실패해도 팝업은 유지 — 무시 버튼으로 계속 쓸 수 있다 */ }
    dlBtn.disabled = false;
  };
}

async function initVersionGate() {
  try {
    const resp = await fetch("/api/app/version/gate");
    if (!resp.ok) return;
    const data = await resp.json();
    if (data && data.show === true && (data.kind === "outdated" || data.kind === "maintenance")) {
      showVersionGatePopup(data);
    }
  } catch (_) {
    /* 게이트 확인 실패는 조용히 통과 — 시작을 막지 않는다 */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initVersionGate);
} else {
  initVersionGate();
}
