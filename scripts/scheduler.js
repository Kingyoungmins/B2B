/* ===================================================================
   스케줄 등록 — AX-Cell 스킬을 올려 '필요한 문서'가 무엇인지 목록만 보여준다.

   [독립성이 이 파일의 제1 요구사항]
   AX-Cell 본체는 계속 갱신된다. 이 화면을 나중에 최신 코드에 그대로 옮겨붙일 수 있어야
   하므로, 여기서는 본체의 어떤 것도 쓰지 않는다.
     · 앱 전역($ / state / pipeline / save-load / excelMirror …) 참조 없음
     · 외부 라이브러리 없음 — zip 해제는 브라우저 내장 DecompressionStream 으로 직접
     · 모든 DOM id 는 sched- 접두사로 격리, 전역은 window.AXCellScheduler 하나만
   본체에서 건드리는 곳은 메뉴 버튼 · 컨테이너 div · script 태그 세 군데뿐이다.
   옮길 때는 이 파일과 styles/scheduler.css, 그리고 그 세 군데만 이식하면 된다.

   [실행기와 다른 점] 실행기는 문서를 실제로 올려 실행까지 가지만, 스케줄 등록은
   "이 스킬이 무엇을 필요로 하는가"만 확정한다. 실제 문서는 실행 시점에 작업 폴더에서
   찾게 되므로 지금 올릴 이유가 없다.
   =================================================================== */
(function () {
  "use strict";

  // ── ZIP 읽기 (라이브러리 없이) ──────────────────────────────────────────
  // 스킬 zip 은 앱이 만든 것이라 구조가 단순하다(압축 없음 또는 deflate).
  // 중앙 디렉터리만 훑어 원하는 항목 하나를 꺼낸다.
  const SIG_EOCD = 0x06054b50;
  const SIG_CEN = 0x02014b50;

  function findEocd(view, len) {
    const min = Math.max(0, len - 22 - 65535);
    for (let i = len - 22; i >= min; i--) {
      if (view.getUint32(i, true) === SIG_EOCD) return i;
    }
    return -1;
  }

  function listEntries(buf) {
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    const eocd = findEocd(view, bytes.length);
    if (eocd < 0) throw new Error("zip 형식이 아닙니다(EOCD 없음).");

    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const entries = [];
    const utf8 = new TextDecoder("utf-8");

    for (let i = 0; i < count; i++) {
      if (view.getUint32(p, true) !== SIG_CEN) break;
      const flags = view.getUint16(p + 8, true);
      const method = view.getUint16(p + 10, true);
      const compSize = view.getUint32(p + 20, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const cmtLen = view.getUint16(p + 32, true);
      const localOff = view.getUint32(p + 42, true);
      // [한글 엔트리명] 앱이 만든 zip 은 UTF-8 플래그(0x800)를 안 세우지만 바이트 자체는
      // UTF-8 이다. 그래서 플래그와 무관하게 UTF-8 로 읽으면 그대로 맞는다.
      // (파이썬 zipfile 은 플래그가 없으면 cp437 로 읽어 깨지므로 되돌리는 코드가 필요했다.)
      const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      entries.push({ name, method, compSize, localOff, flags });
      p += 46 + nameLen + extraLen + cmtLen;
    }
    return entries;
  }

  async function readEntry(buf, entry) {
    const view = new DataView(buf);
    const bytes = new Uint8Array(buf);
    const nameLen = view.getUint16(entry.localOff + 26, true);
    const extraLen = view.getUint16(entry.localOff + 28, true);
    const start = entry.localOff + 30 + nameLen + extraLen;
    const raw = bytes.subarray(start, start + entry.compSize);

    if (entry.method === 0) return new TextDecoder("utf-8").decode(raw);
    if (entry.method !== 8) throw new Error("지원하지 않는 압축 방식입니다(method " + entry.method + ").");
    if (typeof DecompressionStream !== "function") {
      throw new Error("이 브라우저는 zip 해제를 지원하지 않습니다(DecompressionStream 없음).");
    }
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  }

  // ── 스킬 해석 — 필요한 문서 뽑기 ────────────────────────────────────────
  // 파이썬 러너(tools/auto_runner/skill.py)와 같은 규칙이다. 두 곳이 같은 답을 내야
  // "스케줄에서 본 목록"과 "실제 실행 때 찾는 파일"이 어긋나지 않는다.
  const BOOK_RE = /\.book\(\s*["']([^"']+)["']/g;
  const WORKBOOKS_RE = /Workbooks\(\s*"([^"]+)"/g;
  const BOOK_VAR_RE = /(\w+)\s*=\s*ctx\.book\(\s*["']([^"']+)["']\s*\)/g;

  const base = (s) => String(s || "").split(/[\\/]/).pop().trim();

  function matchAll(re, text, group) {
    const out = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) out.push(m[group]);
    return out;
  }

  function codeLiterals(steps) {
    const set = new Set();
    steps.forEach((s) => {
      matchAll(BOOK_RE, s.code, 1).forEach((n) => set.add(base(n)));
      if (String(s.language).toLowerCase() === "vba") {
        matchAll(WORKBOOKS_RE, s.code, 1).forEach((n) => set.add(base(n)));
      }
    });
    return set;
  }

  /* 요구로 잡혔지만 실제로는 안 쓰이는 입력(=유령)을 걸러낸다.
     현업이 여러 파일을 띄워놓고 스킬을 만들면 앱이 '활성 탭'을 targetFileId 로 적는다.
     코드는 ctx.book() 으로 다른 파일을 열었으므로 만들 때는 정상 동작했고 아무도 모른다.
     세 조건이 모두 맞을 때만 유령으로 본다(하나라도 어긋나면 진짜 요구):
       ① 앱이 unresolvedRefs 에 '못 풀었다'고 스스로 적어뒀다
       ② requiredSheets 가 비어 있다 — 내용에 대한 요구가 없다
       ③ 어느 코드도 그 이름으로 책을 열지 않는다
     ②③ 덕분에 '이름만 잘못 적힌 참조'(예: 확장자 중복)는 유령으로 오해되지 않는다. */
  function findPhantoms(data, required, steps) {
    const unresolved = new Set((data.unresolvedRefs || []).map(base).filter(Boolean));
    if (!unresolved.size) return new Set();
    const sheetsBy = new Map();
    required.forEach((rf) => { if (rf.name) sheetsBy.set(base(rf.name), rf.requiredSheets || []); });
    const literals = codeLiterals(steps);
    const targeted = new Set(steps
      .filter((s) => s.targetFileId.startsWith("input:"))
      .map((s) => s.targetFileId.slice(6)));

    const out = new Set();
    unresolved.forEach((name) => {
      const sheets = sheetsBy.get(name) || [];
      if (targeted.has(name) && !sheets.length && !literals.has(name)) out.add(name);
    });
    return out;
  }

  function outputName(required, steps) {
    for (const rf of required) {
      if (rf.role === "output" && rf.name) return base(rf.name);
    }
    // v3 에는 role 이 없다 → output: 대상 스텝에서 '쓰기를 당하는 책'이 출력이다.
    for (const s of steps) {
      if (!s.targetFileId.startsWith("output")) continue;
      BOOK_VAR_RE.lastIndex = 0;
      let m;
      while ((m = BOOK_VAR_RE.exec(s.code)) !== null) {
        const writer = new RegExp("\\b" + m[1] + "\\s*\\.\\s*(?:write|write_cell|add_sheet|delete_sheet|copy|sort)\\s*\\(");
        if (writer.test(s.code)) return base(m[2]);
      }
    }
    return null;
  }

  function analyze(data) {
    const required = data.requiredFiles || [];
    const handles = {};
    required.forEach((rf) => { if (rf.handle && rf.name) handles[rf.handle] = rf.name; });

    const steps = [];
    (data.pipeline || []).forEach((st, idx) => {
      if (st.enabled === false) return;
      let code = String(st.code || "");
      Object.keys(handles).forEach((h) => { code = code.split(h).join(handles[h]); });
      if (!code.trim()) return;
      steps.push({
        id: String(st.id || "s" + idx),
        code,
        language: String(st.language || "python"),
        targetFileId: String(st.targetFileId || ""),
      });
    });
    if (!steps.length) throw new Error("실행할 단계가 없는 스킬입니다.");

    const phantoms = findPhantoms(data, required, steps);
    const outName = outputName(required, steps);

    // 문서 목록 — 나온 곳(sources)을 남겨 왜 필요한지 설명할 수 있게 한다.
    const docs = new Map();
    const add = (rawName, source, sheets) => {
      const name = base(rawName);
      if (!name || phantoms.has(name)) return;
      if (!docs.has(name)) docs.set(name, { name, sheets: [], sources: [], role: "input" });
      const rec = docs.get(name);
      if (!rec.sources.includes(source)) rec.sources.push(source);
      (sheets || []).forEach((sh) => { if (sh && !rec.sheets.includes(sh)) rec.sheets.push(sh); });
    };

    required.forEach((rf) => {
      if (rf.role === "input" && rf.name) add(rf.name, "선언", rf.requiredSheets);
    });
    steps.forEach((s) => {
      if (s.targetFileId.startsWith("input:")) add(s.targetFileId.slice(6), "대상");
    });
    steps.forEach((s) => {
      matchAll(BOOK_RE, s.code, 1).forEach((n) => add(n, "코드"));
      if (s.language.toLowerCase() === "vba") {
        matchAll(WORKBOOKS_RE, s.code, 1).forEach((n) => add(n, "코드"));
      }
    });

    const list = Array.from(docs.values());
    if (outName && docs.has(outName)) docs.get(outName).role = "output";

    const langs = Array.from(new Set(steps.map((s) => s.language.toLowerCase()))).sort();
    return {
      name: String(data.name || ""),
      version: Number(data.version || 0),
      createdAt: String(data.createdAt || ""),
      stepCount: steps.length,
      languages: langs,
      docs: list,
      phantoms: Array.from(phantoms),
      outputName: outName,
    };
  }

  // ── 상태 ────────────────────────────────────────────────────────────────
  // 문서 이름 → 그 문서를 가져오는 AX-Trace 스킬. 청구서(AX-Cell)는 문서를 '쓰고',
  // 수집(AX-Trace)은 문서를 '만들어 온다' — 이 화면은 그 둘을 문서 단위로 잇는 곳이다.
  const state = {
    skill: null,
    traces: new Map(),
    error: "",
    pending: null,
    // 스케줄 등록 폼. 기본값은 월마감이 가장 흔해서 '매달 1일 09:00'.
    schedule: {
      name: "", cycle: "monthly", day: 1, weekday: 1, date: "", time: "09:00",
      delivery: "both", email: "", folder: "",
    },
    skillFile: null,       // AX-Cell 원본 — 등록할 때 그대로 저장해야 한다
    registered: null,
    saving: false,
  };

  // 등록자 표시용 계정. 스케줄은 주인이 누구인지가 남아야 해서 함께 보여준다.
  // [독립성] whoami.js 에 기대지 않고 직접 읽는다 — 이 파일만 옮겨도 동작해야 한다.
  // 못 읽어도 화면은 그대로 돌아간다(등록자 줄만 빠진다).
  let owner = "";
  (async () => {
    try {
      const res = await fetch("/api/whoami", { cache: "no-store" });
      const info = await res.json();
      if (info && info.ok && info.whoami) { owner = info.whoami; render(); }
    } catch (_) { /* 계정을 못 읽어도 스케줄 등록 자체는 막지 않는다 */ }
  })();

  const $$ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // ── 화면 ────────────────────────────────────────────────────────────────
  // 큰 단계는 둘이다.
  //   1. 스킬 업로드 — ① AX-Cell, ② 문서별 AX-Trace
  //   2. 스케줄 등록 — 1 이 끝나야 열린다
  // 무인 실행이 목적이라 문서 하나라도 가져올 방법이 없으면 2 를 열지 않는다.
  // 대신 무엇이 남았는지는 잠긴 상태에서도 계속 보여준다.

  const CYCLES = [
    { k: "daily", label: "매일" },
    { k: "weekly", label: "매주" },
    { k: "monthly", label: "매달" },
    { k: "once", label: "한 번만" },
  ];
  const DELIVERY = [
    { k: "mail", icon: "✉", label: "메일로 받기" },
    { k: "folder", icon: "📁", label: "공유 폴더로 받기" },
    { k: "both", icon: "✦", label: "둘 다" },
  ];
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  function readiness() {
    const sk = state.skill;
    if (!sk) return { ready: false, total: 0, done: 0, left: 0 };
    const total = sk.docs.length;
    const done = sk.docs.filter((d) => state.traces.has(d.name)).length;
    return { ready: total > 0 && done === total, total, done, left: total - done };
  }

  // 단계 표식은 동그라미 숫자 하나로 끝낸다. 번호 글자와 이모지를 나란히 두면
  // 시선이 두 번 걸리고 크기도 서로 안 맞아 지저분해진다.
  function stepRow(cls, badge, title, sub, tail) {
    return '<section class="sx-step ' + cls + '">' +
        badge +
        '<span class="sx-step-body">' +
          '<span class="sx-step-title">' + title + "</span>" +
          '<span class="sx-step-sub">' + sub + "</span>" +
        "</span>" + (tail || "") +
      "</section>";
  }

  const numBadge = (n) => '<span class="sx-step-badge">' + n + "</span>";
  const iconBadge = (ch) => '<span class="sx-step-badge icon">' + ch + "</span>";

  function groupHead(no, title, sub, mood) {
    return '<div class="sx-group ' + mood + '">' +
        '<span class="sx-group-no">' + no + "</span>" +
        '<span class="sx-group-text">' +
          '<span class="sx-group-title">' + title + "</span>" +
          '<span class="sx-group-sub">' + sub + "</span>" +
        "</span>" +
      "</div>";
  }

  // ── 1. 스킬 업로드 ──────────────────────────────────────────────────────
  function viewStep1() {
    const sk = state.skill;
    if (!sk) {
      // 목록에서 '스킬 수정' 으로 들어온 경우 — 어떤 스케줄을 고치는 중인지 알린다.
      const editing = state.schedule.name
        ? '<div class="sx-notice">「' + esc(state.schedule.name) + '」 의 스킬을 다시 올리는 중입니다. ' +
          "같은 이름으로 등록하면 그 폴더에 덮어써집니다.</div>"
        : "";
      return editing + stepRow("live", numBadge(1),
        "AX-Cell 스킬을 올려주세요",
        "스킬을 읽어 필요한 문서를 찾아냅니다 · .zip 을 끌어다 놓아도 됩니다",
        '<button class="sx-btn primary" type="button" data-act="pick-skill">파일 선택</button>');
    }
    const bits = ["v" + sk.version, sk.stepCount + "단계", sk.languages.join("/")];
    if (sk.createdAt) bits.push(sk.createdAt.slice(0, 10));
    return stepRow("done", numBadge(1), esc(sk.name), bits.map(esc).join(" · "),
      '<button class="sx-btn ghost" type="button" data-act="pick-skill">교체</button>') +
      (sk.phantoms.length
        ? '<div class="sx-notice">스킬에 적혀 있지만 <b>실제로는 쓰이지 않는 참조</b> ' +
          sk.phantoms.length + "개를 목록에서 제외했습니다 — " + esc(sk.phantoms.join(", ")) + "</div>"
        : "");
  }

  function viewStep2() {
    const sk = state.skill;
    if (!sk) {
      return stepRow("muted", numBadge(2), "AX-Trace 스킬 연결",
        "1 번을 올리면 문서마다 가져올 수집 스킬을 연결할 수 있습니다",
        '<span class="sx-lock">대기 중</span>');
    }
    const r = readiness();
    const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
    const progress =
      '<span class="sx-progress">' +
        '<span class="sx-progress-num"><b>' + r.done + "</b> / " + r.total + "</span>" +
        '<span class="sx-progress-track"><i style="width:' + pct + '%"></i></span>' +
      "</span>";
    return stepRow(r.ready ? "done" : "live", numBadge(2), "AX-Trace 스킬 연결",
      "문서마다 그걸 가져올 수집 스킬을 연결하세요", progress) +
      '<div class="sx-docs">' + sk.docs.map(viewDoc).join("") + "</div>";
  }

  function viewDoc(doc, idx) {
    const trace = state.traces.get(doc.name);
    const chips = [];
    if (doc.role === "output") chips.push('<span class="sx-chip out">출력</span>');
    doc.sheets.forEach((s) => chips.push('<span class="sx-chip sheet">' + esc(s) + "</span>"));
    chips.push('<span class="sx-chip src">' + esc(doc.sources.join(" · ")) + "</span>");

    const slot = trace
      ? '<div class="sx-trace linked">' +
          '<span class="sx-trace-mark">🛰</span>' +
          '<span class="sx-trace-body">' +
            '<span class="sx-trace-name">' + esc(trace.file) + "</span>" +
            '<span class="sx-trace-meta">' + esc(humanSize(trace.size) || "연결됨") + "</span>" +
          "</span>" +
          '<button class="sx-btn tiny" type="button" data-act="drop-trace" data-doc="' +
            esc(doc.name) + '">해제</button>' +
        "</div>"
      : '<button class="sx-trace empty" type="button" data-act="pick-trace" data-doc="' +
          esc(doc.name) + '">' +
          '<span class="sx-trace-plus">+</span>' +
          '<span class="sx-trace-cta">AX-Trace 스킬 연결' +
            '<span class="sx-trace-note">이 문서를 가져올 수집 스킬</span>' +
          "</span>" +
        "</button>";

    return '<article class="sx-doc' + (trace ? " linked" : "") + '" data-doc="' + esc(doc.name) + '">' +
        '<div class="sx-doc-rail"></div>' +
        '<div class="sx-doc-main">' +
          '<div class="sx-doc-idx">' + String(idx + 1).padStart(2, "0") + "</div>" +
          '<div class="sx-doc-info">' +
            '<div class="sx-doc-name" title="' + esc(doc.name) + '">' + esc(doc.name) + "</div>" +
            '<div class="sx-doc-chips">' + chips.join("") + "</div>" +
          "</div>" +
        "</div>" +
        '<div class="sx-doc-slot">' + slot + "</div>" +
      "</article>";
  }

  // ── 2. 스케줄 등록 ──────────────────────────────────────────────────────
  function cycleText() {
    const s = state.schedule;
    if (s.cycle === "daily") return "매일 " + s.time;
    if (s.cycle === "weekly") return "매주 " + WEEKDAYS[s.weekday] + "요일 " + s.time;
    if (s.cycle === "monthly") return "매달 " + s.day + "일 " + s.time;
    return (s.date || "날짜 미지정") + " " + s.time + " 한 번";
  }

  function deliveryText() {
    const s = state.schedule;
    const mail = s.email ? "메일(" + s.email + ")" : "메일";
    const folder = s.folder ? "공유 폴더(" + s.folder + ")" : "공유 폴더";
    if (s.delivery === "mail") return mail + "로 받기";
    if (s.delivery === "folder") return folder + "로 받기";
    return mail + " · " + folder + " 둘 다";
  }

  // 등록을 막을 이유들. 비어 있으면 등록 가능하다.
  function scheduleProblems() {
    const s = state.schedule;
    const out = [];
    if (!s.name.trim()) out.push("스킬 명을 입력하세요.");
    if (s.cycle === "monthly" && !(s.day >= 1 && s.day <= 31)) out.push("일자를 1~31 사이로 지정하세요.");
    if (s.cycle === "once" && !s.date) out.push("실행할 날짜를 지정하세요.");
    if (!s.time) out.push("실행 시각을 지정하세요.");
    if (s.delivery !== "folder" && !s.email.trim()) out.push("결과를 받을 메일 주소를 입력하세요.");
    if (s.delivery !== "mail" && !s.folder.trim()) out.push("결과를 저장할 공유 폴더 경로를 입력하세요.");
    return out;
  }

  function segs(name, items, current) {
    return '<div class="sx-seg">' + items.map((it) =>
      '<button type="button" class="sx-seg-btn' + (it.k === current ? " on" : "") + '"' +
        ' data-act="set-' + name + '" data-val="' + it.k + '">' +
        (it.icon ? '<span class="sx-seg-ico">' + it.icon + "</span>" : "") +
        esc(it.label) + "</button>").join("") + "</div>";
  }

  // 스킬 명은 저장 폴더 이름이 된다 — 바탕화면\\ESTB\\<계정>\\<스킬명>\\
  function viewName() {
    return '<div class="sx-card">' +
        '<div class="sx-card-title">이 스케줄의 이름</div>' +
        '<div class="sx-field"><label for="sx-name">스킬 명</label>' +
          '<input id="sx-name" type="text" placeholder="예: 한전 인천지부 월마감" value="' +
          esc(state.schedule.name) + '" data-field="name"></div>' +
        '<p class="sx-hint2">바탕화면 <b>ESTB</b> 폴더 아래 이 이름으로 저장됩니다</p>' +
      "</div>";
  }

  function viewWhen() {
    const s = state.schedule;
    let detail = "";
    if (s.cycle === "weekly") {
      detail = '<div class="sx-field"><label>요일</label>' +
        '<div class="sx-seg tight">' + WEEKDAYS.map((w, i) =>
          '<button type="button" class="sx-seg-btn' + (i === s.weekday ? " on" : "") + '"' +
          ' data-act="set-weekday" data-val="' + i + '">' + w + "</button>").join("") + "</div></div>";
    } else if (s.cycle === "monthly") {
      detail = '<div class="sx-field"><label for="sx-day">일자</label>' +
        '<input id="sx-day" type="number" min="1" max="31" value="' + s.day +
        '" data-field="day"><span class="sx-suffix">일</span></div>' +
        '<p class="sx-hint">29~31 일은 그 달에 없으면 말일에 실행합니다</p>';
    } else if (s.cycle === "once") {
      detail = '<div class="sx-field"><label for="sx-date">날짜</label>' +
        '<input id="sx-date" type="date" value="' + esc(s.date) + '" data-field="date"></div>';
    }
    return '<div class="sx-card">' +
        '<div class="sx-card-title">언제 실행할까요</div>' +
        segs("cycle", CYCLES, s.cycle) + detail +
        '<div class="sx-field"><label for="sx-time">시각</label>' +
          '<input id="sx-time" type="time" value="' + esc(s.time) + '" data-field="time"></div>' +
      "</div>";
  }

  function viewDelivery() {
    const s = state.schedule;
    let fields = "";
    if (s.delivery !== "folder") {
      fields += '<div class="sx-field"><label for="sx-email">메일 주소</label>' +
        '<input id="sx-email" type="email" placeholder="name@company.com" value="' +
        esc(s.email) + '" data-field="email"></div>';
    }
    if (s.delivery !== "mail") {
      fields += '<div class="sx-field"><label for="sx-folder">공유 폴더</label>' +
        '<input id="sx-folder" type="text" placeholder="' + esc("\\\\서버\\공유\\청구서") +
        '" value="' + esc(s.folder) + '" data-field="folder"></div>';
    }
    return '<div class="sx-card">' +
        '<div class="sx-card-title">결과물을 어떻게 받을까요</div>' +
        segs("delivery", DELIVERY, s.delivery) + fields +
      "</div>";
  }

  function viewSummary() {
    const problems = scheduleProblems();
    const ok = problems.length === 0;
    return '<div class="sx-summary">' +
        '<div class="sx-summary-line">' +
          '<span class="sx-summary-when">' + esc(cycleText()) + "</span>" +
          '<span class="sx-summary-arrow">→</span>' +
          '<span class="sx-summary-how">' + esc(deliveryText()) + "</span>" +
        "</div>" +
        (owner ? '<div class="sx-summary-owner">등록자 ' + esc(owner) + "</div>" : "") +
        (ok ? "" : '<ul class="sx-todo">' + problems.map((p) =>
          "<li>" + esc(p) + "</li>").join("") + "</ul>") +
      "</div>" +
      '<div class="sx-actions">' +
        '<button class="sx-btn primary wide" type="button" data-act="register"' +
          (ok && !state.saving ? "" : " disabled") + ">" +
          (state.saving ? "저장 중…" : "스케줄 등록") + "</button>" +
      "</div>";
  }

  function viewRegistered() {
    // 저장 결과가 일부 비어 있어도 화면이 죽지 않게 한다 — 등록은 이미 끝난 상태라
    // 여기서 예외가 나면 사용자는 성공했는지조차 알 수 없게 된다.
    const r = state.registered || {};
    const savedNames = (r.saved || []).map((f) => f.name).filter(Boolean);
    return '<div class="sx-done">' +
        '<div class="sx-done-mark">✓</div>' +
        '<div class="sx-done-body">' +
          '<div class="sx-done-title">스케줄이 등록되었습니다</div>' +
          '<div class="sx-done-when">' + esc(r.when) + " → " + esc(r.how) + "</div>" +
          '<div class="sx-done-meta">' + esc(r.skill) + " · 문서 " + r.docCount + "개" +
            (r.owner ? " · " + esc(r.owner) : "") + "</div>" +
        "</div>" +
        '<button class="sx-btn ghost" type="button" data-act="edit-schedule">수정</button>' +
      "</div>" +
      '<div class="sx-saved">' +
        '<div class="sx-saved-row"><span>저장 위치</span><code>' + esc(r.dir || "-") + "</code></div>" +
        '<div class="sx-saved-row"><span>cron</span><code>' + esc(r.cron || "-") + "</code></div>" +
        '<div class="sx-saved-row"><span>파일</span><code>' +
          esc(savedNames.concat(["cron.txt", "config.txt"]).join("  ·  ")) +
        "</code></div>" +
      "</div>" +
      '<div class="sx-notice">폴더와 파일은 저장됐지만 <b>정해진 시각에 실제로 돌리는 ' +
        "부분은 아직 없습니다</b> — cron.txt 는 등록용 기록입니다.</div>";
  }

  function viewGroup2() {
    const r = readiness();
    if (!r.ready) {
      const missing = state.skill
        ? state.skill.docs.filter((d) => !state.traces.has(d.name)).map((d) => d.name)
        : [];
      const why = !state.skill
        ? "1 번에서 AX-Cell 스킬을 먼저 올려주세요"
        : "문서 " + r.left + "개에 AX-Trace 스킬이 아직 연결되지 않았습니다";
      // 몇 개인지만 알려주면 어느 것인지 다시 찾아야 한다 — 이름을 그대로 적는다.
      const listing = missing.length
        ? '<ul class="sx-missing">' + missing.map((n) =>
            "<li>" + esc(n) + "</li>").join("") + "</ul>"
        : "";
      return groupHead("2", "스케줄 등록", "언제 돌릴지와 결과를 받을 방법을 정합니다", "muted") +
        stepRow("muted", iconBadge("🔒"), "아직 열 수 없습니다", esc(why),
          '<span class="sx-lock">잠김</span>') + listing;
    }
    const head = groupHead("2", "스케줄 등록", "언제 돌릴지와 결과를 받을 방법을 정합니다", "live");
    if (state.registered) return head + viewRegistered();
    return head + viewName() +
      '<div class="sx-grid">' + viewWhen() + viewDelivery() + "</div>" + viewSummary();
  }

  // 입력 중에는 이 두 곳만 바꾼다(전체 재렌더 없이).
  function refreshSummary() {
    const wrap = $$("sched-stage");
    if (!wrap) return;
    const when = wrap.querySelector(".sx-summary-when");
    const how = wrap.querySelector(".sx-summary-how");
    const btn = wrap.querySelector('[data-act="register"]');
    const todo = wrap.querySelector(".sx-todo");
    if (when) when.textContent = cycleText();
    if (how) how.textContent = deliveryText();
    const problems = scheduleProblems();
    if (btn) btn.disabled = problems.length > 0;
    if (todo) {
      todo.innerHTML = problems.map((p) => "<li>" + esc(p) + "</li>").join("");
      todo.hidden = problems.length === 0;
    } else if (problems.length) {
      render();   // 없던 목록이 필요해지면 그때만 다시 그린다
    }
  }

  function render() {
    const stage = $$("sched-stage");
    if (!stage) return;
    const err = state.error ? '<div class="sx-error">' + esc(state.error) + "</div>" : "";
    const r = readiness();
    stage.innerHTML = '<div class="sx-wrap">' +
      groupHead("1", "스킬 업로드", "청구서를 만드는 스킬과, 문서를 가져올 수집 스킬",
        r.ready ? "done" : "live") +
      viewStep1() + err + viewStep2() +
      viewGroup2() +
    "</div>";
  }

  // ── zip → 스킬 정보 ─────────────────────────────────────────────────────
  async function parseSkillZip(file) {
    if (!/\.zip$/i.test(file.name)) throw new Error("스킬 .zip 파일을 선택해 주세요.");
    const buf = await file.arrayBuffer();
    const logic = listEntries(buf).find((e) => /\.logic\.json$/i.test(e.name));
    if (!logic) throw new Error("zip 안에 .logic.json 이 없습니다(올바른 스킬 zip 인지 확인).");
    return analyze(JSON.parse(await readEntry(buf, logic)));
  }

  async function loadSkill(file) {
    state.error = "";
    try {
      state.skill = await parseSkillZip(file);
      state.skillFile = file;
      state.traces.clear();      // 스킬이 바뀌면 문서가 달라진다 — 이전 연결은 무효
    } catch (err) {
      state.error = "AX-Cell 스킬을 읽지 못했습니다: " + (err && err.message ? err.message : err);
    }
    render();
  }

  /* AX-Trace 는 AX-Cell 과 형식이 다르다 — logic.json 이 없을 수도 있고 아직 규격이
     정해지지 않았다. 그래서 여기서는 아무 검사도 하지 않고 들어온 파일을 그대로 받는다.
     규격이 정해지면 이 함수 안에서만 해석을 붙이면 된다(화면·상태는 그대로). */
  function loadTrace(docName, file) {
    if (!file) return;
    state.error = "";
    state.traces.set(docName, { file: file.name, size: Number(file.size) || 0, blob: file });
    render();
  }

  // 파일 → base64. 서버가 바탕화면에 그대로 써야 하므로 원본 바이트를 보낸다.
  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const s = String(fr.result || "");
        resolve(s.slice(s.indexOf(",") + 1));      // "data:...;base64," 앞부분 제거
      };
      fr.onerror = () => reject(fr.error || new Error("파일을 읽지 못했습니다."));
      fr.readAsDataURL(file);
    });
  }

  async function saveSchedule() {
    if (state.saving || scheduleProblems().length) return;
    state.saving = true;
    state.error = "";
    render();
    try {
      const files = [];
      if (state.skillFile) {
        files.push({ name: state.skillFile.name, role: "ax-cell",
                     data: await toBase64(state.skillFile) });
      }
      for (const [, t] of state.traces) {
        if (t.blob) files.push({ name: t.file, role: "ax-trace", data: await toBase64(t.blob) });
      }
      const res = await fetch("/api/scheduler/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skillName: state.schedule.name,
          schedule: state.schedule,
          summaryWhen: cycleText(),
          summaryHow: deliveryText(),
          cellSkillName: state.skill ? state.skill.name : "",
          docs: state.skill.docs.map((d) => ({
            doc: d.name,
            trace: (state.traces.get(d.name) || {}).file || "",
          })),
          files,
        }),
      });
      const out = await res.json();
      if (!out || !out.ok) throw new Error((out && out.error) || "HTTP " + res.status);
      state.registered = {
        when: cycleText(), how: deliveryText(), owner,
        skill: state.skill.name, docCount: state.skill.docs.length,
        dir: out.dir, cron: out.cron, saved: out.files || [],
      };
    } catch (err) {
      state.error = "스케줄을 저장하지 못했습니다: " + (err && err.message ? err.message : err);
    }
    state.saving = false;
    render();
  }

  function humanSize(n) {
    if (!n) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  // ── 입력 배선 ───────────────────────────────────────────────────────────
  function bind() {
    const root = $$("sched-root");
    const fileSkill = $$("sched-file");
    const fileTrace = $$("sched-trace-file");
    if (!root || !fileSkill || !fileTrace) return;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "pick-skill") {
        state.pending = null;
        fileSkill.click();
      } else if (act === "pick-trace") {
        // 형식을 모르므로 확장자 필터를 걸지 않는다.
        state.pending = btn.dataset.doc;
        fileTrace.click();
      } else if (act === "drop-trace") {
        state.traces.delete(btn.dataset.doc);
        render();
      } else if (act === "set-cycle") {
        state.schedule.cycle = btn.dataset.val;
        render();
      } else if (act === "set-weekday") {
        state.schedule.weekday = Number(btn.dataset.val);
        render();
      } else if (act === "set-delivery") {
        state.schedule.delivery = btn.dataset.val;
        render();
      } else if (act === "register") {
        saveSchedule();
      } else if (act === "edit-schedule") {
        state.registered = null;
        render();
      }
    });

    // 텍스트/숫자 입력은 다시 그리지 않는다 — 매 글자마다 render 하면 포커스가 날아간다.
    // 값만 상태에 반영하고, 요약과 등록 버튼만 그 자리에서 갱신한다.
    root.addEventListener("input", (e) => {
      const el = e.target.closest("[data-field]");
      if (!el) return;
      const f = el.dataset.field;
      state.schedule[f] = (f === "day") ? Number(el.value || 0) : el.value;
      refreshSummary();
    });

    fileSkill.addEventListener("change", () => {
      if (fileSkill.files && fileSkill.files[0]) loadSkill(fileSkill.files[0]);
      fileSkill.value = "";
    });
    fileTrace.addEventListener("change", () => {
      const doc = state.pending;
      if (doc && fileTrace.files && fileTrace.files[0]) loadTrace(doc, fileTrace.files[0]);
      fileTrace.value = "";
      state.pending = null;
    });

    // 드래그 — 놓는 위치가 대상을 정한다.
    //   문서 카드 위  → 그 문서의 AX-Trace
    //   ① 단계 행 위  → AX-Cell (교체 포함)
    //   그 밖         → 아직 ① 이 없을 때만 AX-Cell 로 받는다
    const overClass = "sx-dragover";
    const zoneOf = (e) => e.target.closest(".sx-doc, .sx-step.live");

    root.addEventListener("dragover", (e) => {
      e.preventDefault();
      root.querySelectorAll("." + overClass).forEach((n) => n.classList.remove(overClass));
      const zone = zoneOf(e);
      // ② 는 문서 카드에만 놓을 수 있다 — 단계 행 자체는 받는 곳이 아니다.
      if (zone && !(state.skill && zone.classList.contains("sx-step"))) {
        zone.classList.add(overClass);
      }
    });
    root.addEventListener("dragleave", (e) => {
      const zone = zoneOf(e);
      if (zone) zone.classList.remove(overClass);
    });
    root.addEventListener("drop", (e) => {
      e.preventDefault();
      root.querySelectorAll("." + overClass).forEach((n) => n.classList.remove(overClass));
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      const card = e.target.closest(".sx-doc");
      if (card && state.skill) { loadTrace(card.dataset.doc, file); return; }
      // ① 단계 행(항상 첫 .sx-step)만 AX-Cell 교체를 받는다. ② 행·🔒 행에 살짝 빗나가게 놓은 AX-Trace 가
      // 스킬을 갈아치우고 연결을 전부 지우던 것을 막는다(dragover 의 '② 행은 받는 곳이 아니다' 와 같은 기준).
      const step = e.target.closest(".sx-step");
      if (!state.skill || (step && step === root.querySelector(".sx-step"))) loadSkill(file);
    });

    render();
    bindList();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  스케줄 목록 — 등록된 것 보기 / 수정 / 삭제
  //  같은 모듈 안에 둔다. 주기·수신 선택 UI(CYCLES/DELIVERY/segs)와 요약 문장
  //  생성기를 등록 화면과 공유해야 두 화면의 표기가 어긋나지 않는다.
  // ═══════════════════════════════════════════════════════════════════════
  const list = { loading: false, error: "", root: "", items: [], editing: null, draft: null,
                 skillEditing: null, skillDraft: null, pendingPick: null, busy: "" };

  function draftText(fn) {
    // cycleText/deliveryText 는 state.schedule 을 본다. 편집 중에는 draft 를 잠시 끼워 쓴다.
    const keep = state.schedule;
    state.schedule = list.draft;
    try { return fn(); } finally { state.schedule = keep; }
  }

  async function loadList() {
    list.loading = true; list.error = "";
    renderList();
    try {
      const res = await fetch("/api/scheduler/list", { cache: "no-store" });
      const out = await res.json();
      if (!out || !out.ok) throw new Error((out && out.error) || "HTTP " + res.status);
      list.items = out.items || [];
      list.root = out.root || "";
    } catch (err) {
      list.error = "목록을 읽지 못했습니다: " + (err && err.message ? err.message : err);
    }
    list.loading = false;
    renderList();
  }

  // 주기만 검사한다 — 이 화면이 바꾸는 건 cron.txt 한 줄뿐이고,
  // 메일/폴더 같은 수신 정보는 cron 이 담지 못해 여기서 손대지 않는다.
  function draftProblems() {
    const d = list.draft || {};
    const out = [];
    if (d.cycle === "monthly" && !(d.day >= 1 && d.day <= 31)) out.push("일자를 1~31 사이로 지정하세요.");
    if (d.cycle === "once" && !d.date) out.push("실행할 날짜를 지정하세요.");
    if (!d.time) out.push("실행 시각을 지정하세요.");
    return out;
  }

  async function saveEdit() {
    if (!list.editing || list.busy) return;
    const problems = draftProblems();
    if (problems.length) { list.error = problems[0]; renderList(); return; }
    list.busy = list.editing; list.error = "";
    renderList();
    try {
      const res = await fetch("/api/scheduler/update", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          skillName: list.editing,
          schedule: list.draft,
          summaryWhen: draftText(cycleText),
        }),
      });
      const out = await res.json();
      if (!out || !out.ok) throw new Error((out && out.error) || "HTTP " + res.status);
      list.editing = null; list.draft = null;
    } catch (err) {
      list.error = "수정하지 못했습니다: " + (err && err.message ? err.message : err);
    }
    list.busy = "";
    await loadList();
  }

  async function removeItem(name) {
    if (list.busy) return;
    list.busy = name; list.error = "";
    renderList();
    try {
      const res = await fetch("/api/scheduler/delete", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillName: name }),
      });
      const out = await res.json();
      if (!out || !out.ok) throw new Error((out && out.error) || "HTTP " + res.status);
    } catch (err) {
      list.error = "삭제하지 못했습니다: " + (err && err.message ? err.message : err);
    }
    list.busy = "";
    await loadList();
  }

  async function saveSkillFiles() {
    const d = list.skillDraft;
    if (!list.skillEditing || !d || list.busy) return;

    // '수정'으로 바꾼 줄만 교체한다. 새 줄이 생기지 않고 원래 줄이 바뀐다.
    const add = [], remove = [];
    if (d.cellNew) {
      if (d.cellFile) remove.push(d.cellFile);
      add.push({ name: d.cellNew.name, role: "ax-cell", blob: d.cellNew.blob });
    }
    d.rows.forEach((r) => {
      if (r.mode !== "edit" || !r.next) return;
      if (r.trace) remove.push(r.trace);
      add.push({ name: r.next.name, role: "ax-trace", blob: r.next.blob, doc: r.doc });
    });
    if (!add.length) return;

    list.busy = list.skillEditing; list.error = "";
    renderList();
    try {
      const payloadAdd = [];
      for (const a of add) {
        payloadAdd.push({ name: a.name, role: a.role, data: await toBase64(a.blob) });
      }
      // 문서↔AX-Trace 짝도 함께 보낸다 — 서버가 schedule.json 의 docs 를 갱신한다.
      const docs = d.rows.map((r) => ({
        doc: r.doc,
        trace: (r.mode === "edit" && r.next) ? r.next.name : r.trace,
      }));
      const res = await fetch("/api/scheduler/files", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ skillName: list.skillEditing, add: payloadAdd, remove, docs }),
      });
      const out = await res.json();
      if (!out || !out.ok) throw new Error((out && out.error) || "HTTP " + res.status);
      list.skillEditing = null; list.skillDraft = null;
    } catch (err) {
      list.error = "스킬을 저장하지 못했습니다: " + (err && err.message ? err.message : err);
    }
    list.busy = "";
    await loadList();
  }

  // ── 스케줄 수정 — cron 규칙만 다룬다 ──────────────────────────────────
  // 스킬 파일은 여기서 손대지 않는다. 그건 '스킬 수정' 의 몫이고,
  // 이 화면이 쓰는 cron.txt 한 줄에는 담을 수도 없다.
  function draftCron() {
    const d = list.draft || {};
    const tm = String(d.time || "00:00").split(":");
    const h = Number(tm[0] || 0), m = Number(tm[1] || 0);
    if (d.cycle === "daily") return m + " " + h + " * * *";
    if (d.cycle === "weekly") return m + " " + h + " * * " + (d.weekday || 0);
    if (d.cycle === "monthly") return m + " " + h + " " + (d.day || 1) + " * *";
    const parts = String(d.date || "").split("-");
    if (parts.length === 3) return m + " " + h + " " + Number(parts[2]) + " " + Number(parts[1]) + " *";
    return m + " " + h + " * * *";
  }

  function viewEditor(item) {
    const d = list.draft;
    let detail = "";
    if (d.cycle === "weekly") {
      detail = '<div class="sx-field"><label>요일</label><div class="sx-seg tight">' +
        WEEKDAYS.map((w, i) => '<button type="button" class="sx-seg-btn' +
          (i === d.weekday ? " on" : "") + '" data-lact="e-weekday" data-val="' + i + '">' +
          w + "</button>").join("") + "</div></div>";
    } else if (d.cycle === "monthly") {
      detail = '<div class="sx-field"><label>일자</label>' +
        '<input type="number" min="1" max="31" value="' + d.day + '" data-efield="day">' +
        '<span class="sx-suffix">일</span></div>' +
        '<p class="sx-hint2">29~31 일은 그 달에 없으면 말일에 실행합니다</p>';
    } else if (d.cycle === "once") {
      detail = '<div class="sx-field"><label>날짜</label>' +
        '<input type="date" value="' + esc(d.date) + '" data-efield="date"></div>';
    }
    const seg = '<div class="sx-seg">' + CYCLES.map((it) =>
      '<button type="button" class="sx-seg-btn' + (it.k === d.cycle ? " on" : "") +
      '" data-lact="e-cycle" data-val="' + it.k + '">' + esc(it.label) + "</button>").join("") + "</div>";

    const problems = draftProblems();
    return '<div class="sl-editor">' +
        '<div class="sl-editor-head">실행 주기 수정' +
          '<span>이 항목의 <code>cron.txt</code> 만 바뀝니다 · 스킬 파일은 그대로</span></div>' +
        seg + detail +
        '<div class="sx-field"><label>시각</label><input type="time" value="' +
          esc(d.time) + '" data-efield="time"></div>' +
        '<div class="sl-editor-foot">' +
          '<span class="sl-preview">' + esc(draftText(cycleText)) +
            '<code>' + esc(draftCron()) + "</code></span>" +
          '<span class="sl-editor-btns">' +
            '<button class="sx-btn ghost" type="button" data-lact="cancel">취소</button>' +
            '<button class="sx-btn primary" type="button" data-lact="save"' +
              (problems.length || list.busy ? " disabled" : "") + ">" +
              (list.busy === item.skillName ? "저장 중…" : "저장") + "</button>" +
          "</span>" +
        "</div>" +
        (problems.length ? '<ul class="sx-todo">' + problems.map((x) =>
          "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") +
      "</div>";
  }

  function viewSkillEditor(item) {
    const d = list.skillDraft;

    // 다른 잡으로 판정된 경우 — 이 안내만 보여준다.
    if (d.conflict) {
      const c = d.conflict;
      const gone = c.prev.filter((x) => !c.next.includes(x));
      const fresh = c.next.filter((x) => !c.prev.includes(x));
      const li = (arr, cls, mark) => arr.map((x) =>
        '<li class="' + cls + '"><b>' + mark + "</b> " + esc(x) + "</li>").join("");
      return '<div class="sl-editor">' +
          '<div class="sl-conflict">' +
            '<div class="sl-conflict-head">이 스킬은 필요한 문서가 다릅니다</div>' +
            '<p class="sl-conflict-sub">「' + esc(c.file) + '」 은(는) 지금 등록된 것과 ' +
              "요구 문서가 달라 <b>다른 작업</b>으로 봅니다. 기존 AX-Trace 연결을 " +
              "그대로 쓸 수 없어 처음부터 다시 등록해야 합니다.</p>" +
            '<ul class="sl-diff">' + li(gone, "out", "−") + li(fresh, "in", "+") + "</ul>" +
          "</div>" +
          '<div class="sl-editor-foot">' +
            '<span class="sl-preview">교체하지 않았습니다</span>' +
            '<span class="sl-editor-btns">' +
              '<button class="sx-btn ghost" type="button" data-lact="skill-cancel">취소</button>' +
              '<button class="sx-btn primary" type="button" data-lact="reregister" data-name="' +
                esc(item.skillName) + '">처음부터 다시 등록하기</button>' +
            "</span>" +
          "</div>" +
        "</div>";
    }

    // 유지/수정 토글 한 쌍
    const toggle = (act, idx, mode) =>
      '<span class="sl-toggle">' +
        '<button type="button" class="sl-tg' + (mode === "keep" ? " on keep" : "") +
          '" data-lact="' + act + '-keep"' + (idx === null ? "" : ' data-idx="' + idx + '"') +
          ">그대로 유지</button>" +
        '<button type="button" class="sl-tg' + (mode === "edit" ? " on edit" : "") +
          '" data-lact="' + act + '-edit"' + (idx === null ? "" : ' data-idx="' + idx + '"') +
          ">수정</button>" +
      "</span>";

    // AX-Cell 줄
    const cellMode = d.cellNew ? "edit" : "keep";
    const cellRow =
      '<div class="sl-row cell' + (d.cellNew ? " changed" : "") + '">' +
        '<span class="sl-row-kind">AX-Cell</span>' +
        '<span class="sl-row-main">' +
          '<span class="sl-row-file">' +
            esc(d.cellNew ? d.cellNew.name : (d.cellFile || "(기록 없음)")) + "</span>" +
          '<span class="sl-row-sub">' +
            (d.cellNew
              ? "새 파일 · " + esc(humanSize(d.cellNew.size))
              : (d.cellFile ? esc(humanSize(d.cellBytes)) : "이 스케줄의 AX-Cell 파일을 알 수 없습니다")) +
          "</span>" +
        "</span>" +
        toggle("cell", null, cellMode) +
      "</div>";

    // 문서별 AX-Trace 줄
    const docRows = d.rows.map((r, i) => {
      const changed = r.mode === "edit" && r.next;
      return '<div class="sl-row' + (changed ? " changed" : "") + '">' +
          '<span class="sl-row-kind doc">문서 ' + String(i + 1).padStart(2, "0") + "</span>" +
          '<span class="sl-row-main">' +
            '<span class="sl-row-doc" title="' + esc(r.doc) + '">' + esc(r.doc) + "</span>" +
            '<span class="sl-row-file">' +
              '<span class="sl-row-arrow">↳ AX-Trace</span> ' +
              esc(changed ? r.next.name : (r.trace || "(연결 없음)")) +
              (changed ? ' <span class="sl-file-tag add">교체됨</span>' : "") +
            "</span>" +
            (changed
              ? '<span class="sl-row-sub">이전: ' + esc(r.trace || "-") + "</span>"
              : "") +
          "</span>" +
          toggle("trace", i, r.mode) +
        "</div>";
    }).join("");

    const changes = [];
    if (d.cellNew) changes.push("AX-Cell 1");
    const traceChanged = d.rows.filter((r) => r.mode === "edit" && r.next).length;
    if (traceChanged) changes.push("AX-Trace " + traceChanged);
    const pendingPick = d.rows.some((r) => r.mode === "edit" && !r.next);
    const dirty = changes.length > 0;

    return '<div class="sl-editor">' +
        '<div class="sl-editor-head">스킬 수정' +
          '<span>바꿀 항목만 <b>수정</b>으로 돌리세요 · 나머지는 그대로 둡니다</span></div>' +
        '<div class="sl-rows">' + cellRow + docRows + "</div>" +
        (pendingPick
          ? '<p class="sx-hint2">수정으로 바꾼 항목 중 아직 파일을 안 고른 것이 있습니다.</p>'
          : "") +
        '<div class="sl-editor-foot">' +
          '<span class="sl-preview">' +
            (dirty ? "변경: " + esc(changes.join(" · ")) : "변경 없음") + "</span>" +
          '<span class="sl-editor-btns">' +
            '<button class="sx-btn ghost" type="button" data-lact="skill-cancel">취소</button>' +
            '<button class="sx-btn primary" type="button" data-lact="skill-save"' +
              (dirty && !list.busy ? "" : " disabled") + ">" +
              (list.busy === item.skillName ? "저장 중…" : "저장") + "</button>" +
          "</span>" +
        "</div>" +
      "</div>";
  }

  function viewItem(item) {
    const editing = list.editing === item.skillName;
    const skillEditing = list.skillEditing === item.skillName;
    const when = item.summaryWhen || "(주기 정보 없음)";
    const how = item.summaryHow || "";
    const fileCount = (item.files || []).length;
    const meta = [];
    if (item.owner) meta.push(esc(item.owner));
    if (item.createdAt) meta.push("등록 " + esc(item.createdAt.slice(0, 16)));
    if (item.cronUpdatedAt) meta.push("주기 수정 " + esc(item.cronUpdatedAt.slice(0, 16)));
    meta.push("파일 " + fileCount + "개");

    return '<article class="sl-item' + (editing || skillEditing ? " open" : "") + '">' +
        '<div class="sl-rail"></div>' +
        '<div class="sl-body">' +
          '<div class="sl-head">' +
            '<div class="sl-title-wrap">' +
              '<div class="sl-title">' + esc(item.skillName) + "</div>" +
              '<div class="sl-when">' + esc(when) + (how ? " → " + esc(how) : "") + "</div>" +
            "</div>" +
            '<div class="sl-actions">' +
              '<button class="sx-btn ghost" type="button" data-lact="edit-skill" data-name="' +
                esc(item.skillName) + '">스킬 수정</button>' +
              '<button class="sx-btn ghost" type="button" data-lact="edit" data-name="' +
                esc(item.skillName) + '">스케줄 수정</button>' +
              '<button class="sx-btn tiny" type="button" data-lact="ask-del" data-name="' +
                esc(item.skillName) + '">삭제</button>' +
            "</div>" +
          "</div>" +
          '<div class="sl-meta">' + (item.cron ? '<code>' + esc(item.cron) + "</code>" : "") +
            meta.join(" · ") + "</div>" +
          '<div class="sl-path">' + esc(item.dir) + "</div>" +
          (editing ? viewEditor(item)
                   : (skillEditing ? viewSkillEditor(item) : "")) +
        "</div>" +
      "</article>";
  }

  function renderList() {
    const stage = $$("schedlist-stage");
    if (!stage) return;
    const err = list.error ? '<div class="sx-error">' + esc(list.error) + "</div>" : "";

    if (list.loading && !list.items.length) {
      stage.innerHTML = '<div class="sx-wrap">' + err +
        '<div class="sl-empty">불러오는 중…</div></div>';
      return;
    }
    const head =
      '<div class="sl-top">' +
        '<div>' +
          '<h2 class="sx-group-title">등록된 스케줄</h2>' +
          '<div class="sx-group-sub">' +
            (list.root ? esc(list.root) : "바탕화면 ESTB 폴더") + "</div>" +
        "</div>" +
        '<button class="sx-btn ghost" type="button" data-lact="reload">새로고침</button>' +
      "</div>";

    if (!list.items.length) {
      stage.innerHTML = '<div class="sx-wrap">' + head + err +
        '<div class="sl-empty">아직 등록된 스케줄이 없습니다.<br>' +
        '<span>메뉴의 <b>스케줄 등록</b>에서 만들 수 있습니다.</span></div></div>';
      return;
    }
    stage.innerHTML = '<div class="sx-wrap">' + head + err +
      '<div class="sl-items">' + list.items.map(viewItem).join("") + "</div></div>";
  }

  function bindList() {
    const root = $$("schedlist-root");
    if (!root) return;

    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lact]");
      if (!btn) return;
      const act = btn.dataset.lact;
      const name = btn.dataset.name;
      if (act === "reload") { loadList(); return; }
      if (act === "edit") {
        const item = list.items.find((i) => i.skillName === name);
        if (!item) return;
        // cron.txt 가 실제로 도는 주기다. schedule.json 보다 이걸 우선한다
        // (수정은 cron.txt 만 바꾸므로 둘이 다르면 cron.txt 가 맞다).
        const base = item.cronSchedule || item.schedule || {};
        // 두 편집 패널은 배타적이다 — 스킬 편집이 열려 있으면 닫는다.
        list.skillEditing = null; list.skillDraft = null;
        list.editing = name;
        list.draft = {
          name: item.skillName,
          // weekday 는 일요일이 0 이라 `|| 1` 로 채우면 일요일 스케줄이 월요일로 보이고 저장까지 그렇게 됐다.
          cycle: base.cycle || "monthly", day: base.day || 1,
          weekday: (base.weekday === undefined || base.weekday === null) ? 1 : base.weekday,
          date: base.date || "", time: base.time || "09:00",
          // cycleText 가 참조하므로 형태만 맞춰 둔다(이 화면에서 바꾸지는 않는다)
          delivery: "both", email: "", folder: "",
        };
        list.error = "";
        renderList();
        return;
      }
      if (act === "edit-skill") {
        // 화면을 옮기지 않는다. 이 카드 안에서 폴더의 파일만 고친다.
        const item = list.items.find((i) => i.skillName === name);
        if (!item) return;
        list.editing = null; list.draft = null;
        list.skillEditing = name;
        // 파일 나열이 아니라 '문서 ↔ AX-Trace' 짝으로 보여준다.
        // 등록 화면과 같은 단위라 사용자가 무엇을 바꾸는지 바로 안다.
        const byName = {};
        (item.files || []).forEach((f) => { byName[f.name] = f.bytes; });
        const cellName = item.cellFile || "";
        list.skillDraft = {
          cellFile: cellName,
          cellBytes: byName[cellName] || 0,
          cellNew: null,                 // {name, size, blob} — 교체할 AX-Cell
          prevDocs: (item.docs || []).map((d) => d.doc || d),
          // 문서 한 줄 = {doc, trace(기존 파일명), mode: keep|edit, next}
          rows: (item.docs || []).map((d) => ({
            doc: d.doc || String(d),
            trace: d.trace || "",
            bytes: byName[d.trace] || 0,
            mode: "keep",
            next: null,                  // {name, size, blob}
          })),
          conflict: null,
        };
        list.error = "";
        renderList();
        return;
      }
      if (act === "reregister") {
        // 등록 화면으로 보내되 이름·주기·수신 방법은 채워둔다.
        // 같은 이름으로 등록하면 그 폴더에 덮어써진다.
        const item = list.items.find((i) => i.skillName === name);
        state.skill = null; state.skillFile = null; state.traces.clear();
        state.registered = null; state.error = "";
        state.schedule.name = name;
        const b = (item && (item.cronSchedule || item.schedule)) || {};
        Object.assign(state.schedule, {
          cycle: b.cycle || state.schedule.cycle,
          day: b.day || state.schedule.day,
          weekday: (b.weekday === undefined ? state.schedule.weekday : b.weekday),
          date: b.date || "",
          time: b.time || state.schedule.time,
        });
        if (item && item.schedule) {
          state.schedule.delivery = item.schedule.delivery || state.schedule.delivery;
          state.schedule.email = item.schedule.email || "";
          state.schedule.folder = item.schedule.folder || "";
        }
        list.skillEditing = null; list.skillDraft = null;
        render(); renderList();
        if (typeof setPage === "function") setPage("scheduler");
        return;
      }
      if (act === "skill-cancel") {
        list.skillEditing = null; list.skillDraft = null; list.error = "";
        renderList();
        return;
      }
      if (act === "cell-keep") {
        list.skillDraft.cellNew = null;
        renderList();
        return;
      }
      if (act === "cell-edit") {
        // 토글을 누르면 곧바로 파일 탐색기를 연다 — 한 번 더 누르게 하지 않는다.
        list.pendingPick = { kind: "cell" };
        $$("schedlist-file").click();
        return;
      }
      if (act === "trace-keep") {
        const r = list.skillDraft.rows[Number(btn.dataset.idx)];
        r.mode = "keep"; r.next = null;
        renderList();
        return;
      }
      if (act === "trace-edit") {
        list.pendingPick = { kind: "trace", idx: Number(btn.dataset.idx) };
        $$("schedlist-file").click();
        return;
      }
      if (act === "skill-save") { saveSkillFiles(); return; }
      if (act === "cancel") { list.editing = null; list.draft = null; list.error = ""; renderList(); return; }
      if (act === "save") { saveEdit(); return; }
      if (act === "ask-del") {
        // 폴더와 스킬 파일이 통째로 사라진다 — 되돌릴 수 없으니 한 번 묻는다.
        if (window.confirm('"' + name + '" 스케줄을 삭제할까요?\n폴더와 그 안의 스킬 파일이 모두 지워집니다.')) {
          removeItem(name);
        }
        return;
      }
      if (act === "e-cycle") { list.draft.cycle = btn.dataset.val; renderList(); return; }
      if (act === "e-weekday") { list.draft.weekday = Number(btn.dataset.val); renderList(); return; }
      if (act === "e-delivery") { list.draft.delivery = btn.dataset.val; renderList(); return; }
    });

    const filePick = $$("schedlist-file");
    if (filePick) {
      filePick.addEventListener("change", async () => {
        const f = filePick.files && filePick.files[0];
        filePick.value = "";
        const pick = list.pendingPick;
        list.pendingPick = null;
        if (!f || !pick || !list.skillDraft) return;
        const d = list.skillDraft;

        if (pick.kind === "cell") {
          // [AX-Cell 교체 검사] 요구 문서가 그대로인지 본다. 하나라도 다르면
          // 다른 잡이므로 여기서 멈추고 재등록으로 안내한다.
          let docs = null;
          try {
            docs = (await parseSkillZip(f)).docs.map((x) => x.name).sort();
          } catch (_) {
            docs = null;   // 스킬로 못 읽으면 판단하지 않는다(서버가 한 번 더 본다)
          }
          if (docs) {
            const prev = (d.prevDocs || []).slice().sort();
            const same = prev.length === docs.length && prev.every((x, i) => x === docs[i]);
            if (!same) {
              d.conflict = { file: f.name, prev, next: docs };
              renderList();
              return;
            }
          }
          d.cellNew = { name: f.name, size: Number(f.size) || 0, blob: f };
          renderList();
          return;
        }

        const row = d.rows[pick.idx];
        if (!row) return;
        row.mode = "edit";
        row.next = { name: f.name, size: Number(f.size) || 0, blob: f };
        renderList();
      });
    }

    // 편집 중 입력은 다시 그리지 않는다(포커스 유지). 미리보기 문장만 갱신.
    root.addEventListener("input", (e) => {
      const el = e.target.closest("[data-efield]");
      if (!el || !list.draft) return;
      const f = el.dataset.efield;
      list.draft[f] = (f === "day") ? Number(el.value || 0) : el.value;
      const pv = root.querySelector(".sl-preview");
      if (pv) pv.innerHTML = esc(draftText(cycleText)) + "<code>" + esc(draftCron()) + "</code>";
      const save = root.querySelector('[data-lact="save"]');
      if (save) save.disabled = draftProblems().length > 0;
    });

    loadList();
  }

  window.AXCellScheduler = {
    state, analyze, listEntries, readEntry, loadSkill, loadTrace, render,
    list, loadList, renderList,
    get skill() { return state.skill; },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
