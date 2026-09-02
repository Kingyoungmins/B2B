/* ===================================================================
   F1 — 기능키(F키) 도움말 (개발자모드)
   ===================================================================
   [요청 2026-09-02] F키에 걸린 기능이 늘어(F2/F6/F7/F8/F9/F10/F11) 뭐가
   어디 있는지 알기 어렵다 — F1 을 누르면 매핑 표가 뜬다.
   F1 을 다시 누르거나 ESC/[확인] 으로 닫는다. 입력창에 포커스가 있어도
   F1 은 텍스트와 충돌하지 않는 기능키라 그대로 받는다.

   ※ 새 F키 기능을 추가하면 아래 FKEY_MAP 에도 한 줄 추가할 것.
   =================================================================== */

const FKEY_MAP = [
  ["F1",  "이 도움말 표시/닫기"],
  ["F2",  "업데이트 안내 창이 떠 있을 때 — 숨겨진 [무시하고 사용하기] 버튼 표시 (개발자용)"],
  ["F5",  "화면 새로고침 (작업 상태는 유지)"],
  ["F6",  "추가 메뉴(AX-Trace · E2E 작업 등록) 표시/숨김"],
  ["F7",  "스킬 엔진 전환 (Python ↔ VBA)"],
  ["F8",  "디버그 패널 표시/숨김"],
  ["F9",  "설정 창 (버전 확인 · 관리 대시보드 · 다운로드 주소 등 개발자 설정 포함)"],
  ["F10", "엑셀 작업 녹화 시작/정지"],
  ["F11", "AI 도움 열기"],
  ["F12", "웹 개발자 도구 (B2B_NATIVE_DEVTOOLS=1 로 실행했을 때만)"],
];

function toggleFkeyHelp() {
  const old = document.getElementById("fkey-help-overlay");
  if (old) { old.remove(); return; }
  const overlay = document.createElement("div");
  overlay.id = "fkey-help-overlay";
  overlay.style.cssText =
    "position:fixed; inset:0; z-index:99980; background:rgba(0,0,0,.45);" +
    "display:flex; align-items:center; justify-content:center;";
  const rows = FKEY_MAP.map(([k, desc]) =>
    '<tr><td style="padding:5px 14px 5px 0; white-space:nowrap; font-weight:800;' +
    ' font-family:Consolas,monospace">' + k + "</td>" +
    '<td style="padding:5px 0; color:#333">' + desc + "</td></tr>").join("");
  const box = document.createElement("div");
  box.style.cssText =
    "background:#fff; color:#222; border-radius:12px; padding:20px 24px 16px;" +
    "width:min(560px, calc(100vw - 48px)); max-height:calc(100vh - 80px); overflow:auto;" +
    "box-shadow:0 12px 40px rgba(0,0,0,.25); font-size:13px; line-height:1.55;";
  box.innerHTML =
    '<div style="font-weight:800; font-size:15px; margin-bottom:10px">기능키 안내</div>' +
    '<table style="border-collapse:collapse">' + rows + "</table>" +
    '<div style="display:flex; justify-content:flex-end; margin-top:14px">' +
      '<button id="fkey-help-close" style="padding:7px 16px; border:0; border-radius:8px;' +
      ' background:#111; color:#fff; font-weight:700; cursor:pointer">확인</button></div>';
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  document.getElementById("fkey-help-close").onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };  // 바깥 클릭 = 닫기
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.key === "F1") {
    e.preventDefault();                 // 브라우저 기본(도움말 페이지) 차단
    toggleFkeyHelp();
  } else if (e.key === "Escape" && document.getElementById("fkey-help-overlay")) {
    document.getElementById("fkey-help-overlay").remove();
  }
}, true);
