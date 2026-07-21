/* ===================================================================
   IN-VIEW SEARCH (Ctrl+F)
   ===================================================================
   현재 활성 시뮬레이터 (#excel-viewer 또는 #runner-excel-viewer) 안에서
   문자열을 찾아 일치 셀을 모두 강조하고, 다음/이전으로 스크롤 이동.
   =================================================================== */

const _searchState = {
  query: "",
  matches: [],     // [{ viewer, td }]
  cursor: -1,
  bar: null,
  visible: false,
};

function _activeViewer() {
  // 현재 활성 페이지 기준으로 viewer 결정
  const gen = document.getElementById("excel-viewer");
  const run = document.getElementById("runner-excel-viewer");
  // 둘 다 동일한 데이터를 보여주므로 보이는 쪽을 우선
  const isRunner = document.body.classList.contains("page-runner");
  return [gen, run].filter(v => v && v.offsetParent !== null);
}

function _ensureSearchBar() {
  if (_searchState.bar) return _searchState.bar;
  const bar = document.createElement("div");
  bar.className = "find-bar";
  bar.id = "find-bar";
  bar.innerHTML = `
    <input type="text" id="find-input" placeholder="현재 시트에서 찾기..." />
    <span class="find-count" id="find-count">0/0</span>
    <button class="find-btn" id="find-prev" title="이전 (Shift+Enter)">▲</button>
    <button class="find-btn" id="find-next" title="다음 (Enter)">▼</button>
    <button class="find-btn" id="find-close" title="닫기 (Esc)">✕</button>
  `;
  document.body.appendChild(bar);
  bar.querySelector("#find-input").addEventListener("input", e => runSearch(e.target.value));
  bar.querySelector("#find-input").addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) gotoMatch(-1); else gotoMatch(1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      hideFindBar();
    }
  });
  bar.querySelector("#find-prev").onclick = () => gotoMatch(-1);
  bar.querySelector("#find-next").onclick = () => gotoMatch(1);
  bar.querySelector("#find-close").onclick = () => hideFindBar();
  _searchState.bar = bar;
  return bar;
}

function showFindBar() {
  const bar = _ensureSearchBar();
  bar.classList.add("show");
  _searchState.visible = true;
  const input = document.getElementById("find-input");
  if (input) { input.focus(); input.select(); }
  if (_searchState.query) runSearch(_searchState.query);
}

function hideFindBar() {
  if (_searchState.bar) _searchState.bar.classList.remove("show");
  _searchState.visible = false;
  clearHighlights();
}

function clearHighlights() {
  document.querySelectorAll(".excel-viewer td.find-hit, .excel-viewer td.find-current").forEach(el => {
    el.classList.remove("find-hit", "find-current");
  });
  _searchState.matches = [];
  _searchState.cursor = -1;
  const cnt = document.getElementById("find-count");
  if (cnt) cnt.textContent = "0/0";
}

function runSearch(query) {
  _searchState.query = query || "";
  clearHighlights();
  if (!query) return;
  const needle = String(query).toLowerCase();
  const viewers = _activeViewer();
  const matches = [];
  viewers.forEach(viewer => {
    viewer.querySelectorAll("td[data-r]").forEach(td => {
      const text = (td.textContent || "").toLowerCase();
      if (text.indexOf(needle) >= 0) {
        td.classList.add("find-hit");
        matches.push({ viewer, td });
      }
    });
  });
  _searchState.matches = matches;
  if (matches.length > 0) {
    _searchState.cursor = 0;
    _highlightCurrent();
  } else {
    _searchState.cursor = -1;
  }
  _updateCount();
}

function gotoMatch(delta) {
  if (_searchState.matches.length === 0) return;
  const n = _searchState.matches.length;
  _searchState.cursor = ((_searchState.cursor + delta) % n + n) % n;
  _highlightCurrent();
  _updateCount();
}

function _highlightCurrent() {
  document.querySelectorAll(".excel-viewer td.find-current").forEach(el => el.classList.remove("find-current"));
  const cur = _searchState.matches[_searchState.cursor];
  if (!cur) return;
  cur.td.classList.add("find-current");
  // 가상 스크롤이라 지금 DOM에 있어야 보임. data-r/data-c로 행 인덱스를 알 수 있으면
  // 가상 스크롤러에 행 노출을 부탁한다.
  const r = parseInt(cur.td.dataset.r, 10);
  if (!isNaN(r) && typeof ensureRowVisible === "function") {
    ensureRowVisible(r);
  }
  cur.td.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
}

function _updateCount() {
  const cnt = document.getElementById("find-count");
  if (!cnt) return;
  if (_searchState.matches.length === 0) { cnt.textContent = "0/0"; return; }
  cnt.textContent = `${_searchState.cursor + 1}/${_searchState.matches.length}`;
}

// 시뮬레이터가 다시 렌더링되면 강조도 다시 적용
function reapplyFindHighlights() {
  if (_searchState.visible && _searchState.query) {
    runSearch(_searchState.query);
  }
}

// Ctrl+F 가로채기 — 시뮬레이터가 보일 때만
document.addEventListener("keydown", (e) => {
  const isFind = (e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F");
  if (!isFind) return;
  // 텍스트 입력창에 포커스 있으면 브라우저 기본 동작 양보 (단, 빈 채팅창은 가로채도 OK).
  const ae = document.activeElement;
  if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) {
    // 채팅 입력창이고 비어있으면 검색 가로챔, 아니면 양보
    if (ae.id === "chat-text" && !ae.value) {
      // 가로챔
    } else {
      return;
    }
  }
  // 시뮬레이터 보일 때만
  const viewers = _activeViewer();
  if (viewers.length === 0) return;
  e.preventDefault();
  showFindBar();
});
