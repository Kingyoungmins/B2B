/* ===================================================================
   문서보안(AIP/DRM) 안내 + 다운로드 경유 암호화  (0.7.5)

   백엔드(secure_doc.py)가 실제 해제/적용을 한다. 이 파일은
     · 업로드 전 "보안문서 같다" 를 8바이트로 어림잡아 안내 배너를 띄우고
     · 다운로드가 보안 재적용을 거치도록 fetch 경로로 바꿔 주고
     · 브라우저에서 조립한 blob 을 저장 직전 백엔드에 들러 암호화한다.
   배너는 excel-mirror 의 잠금(beginUiBusy)과 일부러 독립이다 — 그쪽
   상태기계(깊이 카운트)에 얹으면 서로의 해제 타이밍이 얽힌다.
   =================================================================== */

const secureDocState = { cache: null, at: 0 };

async function secureDocStatus(force) {
  const now = Date.now();
  if (!force && secureDocState.cache && now - secureDocState.at < 15000) return secureDocState.cache;
  try {
    const resp = await fetch("/api/secure-doc/status");
    secureDocState.cache = await resp.json();
  } catch (_) {
    secureDocState.cache = { ok: false, enabled: false, active: false, anySecured: false };
  }
  secureDocState.at = now;
  return secureDocState.cache;
}

/* 고정 배너 — "문서를 보안해제 중입니다" / "문서를 보안적용 중입니다"
   업로드 중 다운로드같이 겹쳐도 먼저 끝난 쪽이 배너를 꺼버리지 않게 카운터로 센다. */
function secureDocNotice(msg) {
  secureDocState.noticeCount = (secureDocState.noticeCount || 0) + 1;
  if (secureDocState.noticeCount > 1) msg = msg + " (" + secureDocState.noticeCount + "건 진행 중)";
  _secureDocBannerShow(msg);
}

function _secureDocBannerShow(msg) {
  let el = document.getElementById("secure-doc-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "secure-doc-banner";
    el.style.cssText =
      "position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99999;" +
      "background:#0f0a1e;color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;" +
      "box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px;" +
      "max-width:80vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
    const spin = document.createElement("span");
    spin.style.cssText =
      "width:14px;height:14px;border:2px solid #fff;border-top-color:transparent;" +
      "border-radius:50%;display:inline-block;flex:0 0 auto;animation:securedocspin 1s linear infinite";
    const text = document.createElement("span");
    text.id = "secure-doc-banner-text";
    const style = document.createElement("style");
    style.textContent = "@keyframes securedocspin{to{transform:rotate(360deg)}}";
    el.appendChild(spin);
    el.appendChild(text);
    el.appendChild(style);
    document.body.appendChild(el);
  }
  const textEl = el.querySelector("#secure-doc-banner-text");
  if (textEl) textEl.textContent = msg;
  el.style.display = "flex";
}

function secureDocNoticeHide() {
  secureDocState.noticeCount = Math.max(0, (secureDocState.noticeCount || 0) - 1);
  if (secureDocState.noticeCount > 0) return;   // 아직 진행 중인 건이 있다
  const el = document.getElementById("secure-doc-banner");
  if (el) el.style.display = "none";
}

/* 업로드 전 어림 판정(안내용) — 진짜 판정은 백엔드/Gateway 가 한다.
   PK(zip)=평문 xlsx, OLE 복합문서=보안 가능성, 그 외 이진(0x00 포함)=보안 가능성. */
async function secureDocSniff(file) {
  try {
    const st = await secureDocStatus();
    if (!st || !st.enabled) return false;
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (head.length < 4) return false;
    if (head[0] === 0x50 && head[1] === 0x4b) return false;                    // "PK"
    if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return true; // OLE
    for (let i = 0; i < head.length; i++) if (head[i] < 9) return true;        // 제어문자=바이너리
    return false;
  } catch (_) {
    return false;
  }
}

function secureDocSaveBlobPlain(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* blob 을 저장하기 직전 — 보안문서가 열려 있으면 백엔드 경유로 암호화해서 돌려받는다.
   실패하면 예외 — 평문을 그대로 저장하지 않기 위해서다(부르는 쪽이 중단 처리). */
async function secureDocMaybeEncryptBlob(blob, filename) {
  const st = await secureDocStatus();
  if (!st || !st.active || !st.anySecured) return blob;
  secureDocNotice("문서를 보안적용 중입니다…");
  try {
    const resp = await fetch("/api/secure-doc/encrypt?name=" + encodeURIComponent(filename), {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: blob,
    });
    if (!resp.ok) {
      let msg = "HTTP " + resp.status;
      try { msg = (await resp.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    return await resp.blob();
  } finally {
    secureDocNoticeHide();
  }
}

/* 저장 직전 훅 — 실패 시 평문 저장은 하지 않는다(토스트로 알리고 중단). */
function secureDocSaveBlob(blob, filename) {
  secureDocMaybeEncryptBlob(blob, filename)
    .then(out => secureDocSaveBlobPlain(out, filename))
    .catch(err => {
      const msg = (err && err.message) ? err.message : String(err);
      if (typeof toast === "function") toast("문서 보안적용에 실패해 다운로드를 중단했습니다: " + msg, "error");
      else alert("문서 보안적용에 실패해 다운로드를 중단했습니다: " + msg);
    });
}

/* 백엔드 파일 다운로드 공용 경로 — 보안이 켜져 있으면 fetch 로 받아(서버가 그 안에서 암호화)
   안내와 실패 처리를 하고, 평소엔 기존처럼 a.href 로 바로 받는다. */
async function secureDownloadUrl(url, filename) {
  let st = null;
  try { st = await secureDocStatus(); } catch (_) {}
  const active = st && st.active && st.anySecured;
  if (!active) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  secureDocNotice("문서를 보안적용 중입니다…");
  try {
    const resp = await fetch(url);              // 서버가 내보내기 직전에 암호화해 준다
    if (!resp.ok) {
      let msg = "HTTP " + resp.status;
      try { msg = (await resp.json()).error || msg; } catch (_) {}
      throw new Error(msg);
    }
    const blob = await resp.blob();
    secureDocSaveBlobPlain(blob, filename || "download.xlsx");
  } catch (err) {
    const msg = (err && err.message) ? err.message : String(err);
    if (typeof toast === "function") toast("다운로드 중단(보안적용 실패): " + msg, "error");
  } finally {
    secureDocNoticeHide();
  }
}
