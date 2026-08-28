/* ===================================================================
   로그인 사용자 식별 — 좌상단에 cmd `whoami` 와 같은 값을 띄운다.

   스케줄 등록은 "이 작업의 주인이 누구인가"가 먼저다. 등록·실행 이력이 계정에
   묶여야 나중에 여러 사람이 쓰거나 에이전트가 대신 돌릴 때 누구 것인지 가려진다.
   값은 서버(/api/whoami)가 준다 — 브라우저는 OS 계정을 알 수 없다.
   =================================================================== */
const userIdentity = { loaded: false, whoami: "", user: "", domain: "", host: "" };

async function loadUserIdentity() {
  const box = document.getElementById("user-identity");
  const text = document.getElementById("user-identity-text");
  if (!box || !text) return;

  try {
    const res = await fetch("/api/whoami", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const info = await res.json();
    if (!info || !info.ok || !info.whoami) throw new Error("계정 정보 없음");

    Object.assign(userIdentity, {
      loaded: true,
      whoami: info.whoami,
      user: info.user || "",
      domain: info.domain || "",
      host: info.host || "",
    });

    text.textContent = info.whoami;
    box.classList.add("ok");
    box.title = [
      "로그인 계정: " + info.whoami,
      info.host ? "PC: " + info.host : "",
      info.userProfile ? "프로필: " + info.userProfile : "",
    ].filter(Boolean).join("\n");
  } catch (err) {
    // 식별 실패를 조용히 넘기지 않는다 — 주인을 모르는 채로 스케줄을 걸면 안 된다.
    text.textContent = "사용자 확인 실패";
    box.classList.add("fail");
    box.title = "로그인 계정을 확인하지 못했습니다: " + (err && err.message ? err.message : err);
  }
}

loadUserIdentity();
