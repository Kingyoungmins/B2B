/* ===================================================================
   프로그램 버전 표기 (상단 제목 옆)
   ===================================================================
   [사용자 요청 2026-08-06] 상단 'AX-Cell' 옆에 작은 초록 글씨로 버전을 띄운다.
   보여줄 값 = **실행 파일 속성의 '파일 버전'**(속성 → 자세히 → 파일 버전. 예 0.7.2.0).
   손으로 적은 문자열이 아니라 실제 exe 에서 읽으므로, 배포본과 화면 표기가 어긋날 수 없다.
     · 배포(exe 실행): AX-Cell.exe 의 버전 리소스
     · 개발(소스 실행): exe 가 없으니 launch_b2b.py 의 CURRENT_VERSION (백엔드가 알아서 폴백)

   서버가 못 읽으면 아무것도 표시하지 않는다(:empty 로 숨김) — 잘못된 버전을 보여주느니
   안 보여주는 게 낫다. 버전은 실행 중에 바뀌지 않으므로 한 번만 조회한다.
   =================================================================== */

async function initAppVersionLabel() {
  const el = document.getElementById("app-version");
  if (!el) return;
  try {
    const resp = await fetch("/api/app/version");
    if (!resp.ok) return;
    const data = await resp.json();
    // normalized = 항상 4자리(0.7.2 → 0.7.2.0). 파일 속성에 보이는 형식과 같게 맞춘다.
    const ver = String((data && (data.normalized || data.version)) || "").trim();
    if (!data || data.ok === false || !ver) return;
    el.textContent = `ver ${ver}`;
    // 개발 중(소스 실행)이면 exe 버전이 아니라는 걸 마우스 올렸을 때 알 수 있게 한다.
    const src = String((data && data.source) || "");
    el.title = src.startsWith("exe:")
      ? `프로그램 파일 버전 (${src.slice(4)})`
      : "프로그램 버전 (소스 실행 중 — 빌드된 파일 버전이 아닙니다)";
  } catch (_) {
    /* 못 읽으면 조용히 비워 둔다 */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppVersionLabel);
} else {
  initAppVersionLabel();
}
