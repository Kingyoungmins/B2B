/* ===================================================================
   기능키(F키) 접근 권한 가드 (0.8.4)
   ===================================================================
   [요청 2026-09-03]
   · 개발/관리성 F키(F2·F6·F7·F8·F9)는 접근 권한이 있어야 동작한다.
   · 기본 권한: 소속 팀이 "Foundation리서치팀" 인 사용자(whoami /fqdn 조직 정보).
   · 비권한자도 F1 을 6번 연속으로 누르면 권한 획득 —
     "서영민님으로부터 버프 획득." 알림 팝업. (이 PC 에 유지)

   설계 근거
   · 이 파일은 index.html 에서 '가장 먼저' 로드된다 — capture 단계 리스너는
     등록 순서대로 돌므로, 먼저 등록해야 stopImmediatePropagation 으로
     뒤의 F7(config.js)·F8(debug-panel) 등 다른 핸들러를 막을 수 있다.
   · F1(도움말)·F10(녹화)·F11(AI 도움)은 일반 사용 기능이라 막지 않는다.
     F5(새로고침)도 그대로.
   · 개발망(비도메인 — 조직 정보 없음)은 판별 근거가 없으므로 허용한다.
     막으면 개발이 통째로 멈춘다(조직 정보는 VM 에만 있다).
   · 권한 판정 전(whoami 응답 전 수백 ms)은 차단하지 않는다 — 시작 직후
     정상 사용자의 키가 막히는 쪽이 더 나쁜 실패다.
   =================================================================== */

const FKEY_GUARDED = ["F2", "F6", "F7", "F8", "F9"];
const FKEY_BUFF_KEY = "b2bFkeyBuff";
const fkeyGuard = { known: false, team: "", allowed: true };

function fkeyHasBuff() {
  try { return localStorage.getItem(FKEY_BUFF_KEY) === "1"; } catch (_) { return false; }
}

function fkeyComputeAllowed(team) {
  // 팀 정보 없음(개발망) → 허용 / Foundation리서치팀 → 허용 / 그 외 → 버프 보유 시만
  if (!team) return true;
  if (team === "Foundation리서치팀") return true;
  return fkeyHasBuff();
}

async function fkeyGuardInit() {
  try {
    const res = await fetch("/api/whoami", { cache: "no-store" });
    const info = await res.json();
    fkeyGuard.team = (info && info.team) || "";
  } catch (_) {
    fkeyGuard.team = "";
  }
  fkeyGuard.allowed = fkeyComputeAllowed(fkeyGuard.team);
  fkeyGuard.known = true;
}

function fkeyShowBuffPopup() {
  if (document.getElementById("fkey-buff-popup")) return;
  const el = document.createElement("div");
  el.id = "fkey-buff-popup";
  el.style.cssText =
    "position:fixed; top:24px; left:50%; transform:translateX(-50%); z-index:99995;" +
    "background:#111; color:#fff; border-radius:12px; padding:14px 22px;" +
    "box-shadow:0 10px 30px rgba(0,0,0,.35); font-size:14px; font-weight:800;" +
    "display:flex; align-items:center; gap:10px; animation:fkeybuff .25s ease-out;";
  el.innerHTML =
    '<span style="font-size:20px">🎁</span>' +
    '<span>서영민님으로부터 버프 획득.' +
    '<div style="font-size:11.5px; font-weight:600; color:#bbb; margin-top:2px">기능키 사용 권한이 활성화되었습니다</div></span>';
  const style = document.createElement("style");
  style.textContent = "@keyframes fkeybuff { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%); } }";
  document.head.appendChild(style);
  document.body.appendChild(el);
  setTimeout(() => { try { el.remove(); } catch (_) {} }, 3200);
}

/* F1 6연타 감지 — 1.5초 안에 이어서 눌러야 하고, 다른 키가 끼면 처음부터 */
const fkeyTap = { count: 0, last: 0 };

function fkeyOnKeydown(e) {
  const now = Date.now();
  if (e.key === "F1" && !e.repeat) {
    fkeyTap.count = (now - fkeyTap.last <= 1500) ? fkeyTap.count + 1 : 1;
    fkeyTap.last = now;
    if (fkeyTap.count >= 6) {
      fkeyTap.count = 0;
      if (!fkeyGuard.allowed) {
        try { localStorage.setItem(FKEY_BUFF_KEY, "1"); } catch (_) {}
        fkeyGuard.allowed = true;
        fkeyShowBuffPopup();
      }
    }
    return;                                   // F1 자체(도움말)는 항상 통과
  }
  if (!e.repeat) fkeyTap.count = 0;           // 다른 키가 끼면 연타 리셋
  if (!FKEY_GUARDED.includes(e.key)) return;
  if (!fkeyGuard.known || fkeyGuard.allowed) return;
  // 비권한자 — 조용히 무시(권한의 존재 자체를 광고하지 않는다)
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
}

document.addEventListener("keydown", fkeyOnKeydown, true);   // capture + 최초 등록 = 최우선
fkeyGuardInit();
