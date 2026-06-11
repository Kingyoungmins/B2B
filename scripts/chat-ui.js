/* ===================================================================
   CHAT UI
   =================================================================== */
function refreshChatState() {
  const ready = state.output !== null || state.inputs.length > 0;
  const panel = $("panel-chat");
  panel.classList.toggle("disabled", !ready);
  $("chat-send").disabled = !ready;
  if (ready && $("chat-messages").children.length === 1 &&
      $("chat-messages").children[0].classList.contains("system") &&
      !$("chat-messages").children[0].classList.contains("cleared-marker")) {
    $("chat-messages").innerHTML = "";
    const targetLabel = state.output
      ? `출력 템플릿 "${state.output.name}" 이 로드되었습니다.`
      : `입력 파일 ${state.inputs.length}개가 로드되었습니다.`;
    addMessage("system", `${targetLabel} 입력/출력 파일을 함께 수정하는 스킬을 만들어보세요.`);
  }
  renderEditingBanner();
  refreshRunButton();
}

function renderEditingBanner() {
  const inputRow = document.querySelector("#panel-chat .chat-input-row");
  if (!inputRow) return;
  let banner = document.getElementById("chat-edit-banner");
  const idx = state.editingStepId
    ? state.pipeline.findIndex(s => s.id === state.editingStepId)
    : -1;
  if (idx < 0) {
    if (banner) banner.remove();
    const ta = $("chat-text");
    if (ta) ta.classList.remove("editing");
    return;
  }
  const step = state.pipeline[idx];
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "chat-edit-banner";
    banner.className = "chat-edit-banner";
    inputRow.parentNode.insertBefore(banner, inputRow);
  }
  banner.innerHTML = `
    <span class="edit-ico">✎</span>
    <span class="edit-text"><b>Step ${idx + 1}</b> 수정 중 — ${escapeHtml(step.description)}</span>
    <button class="edit-cancel" type="button" title="수정 모드 해제">해제</button>
  `;
  banner.querySelector(".edit-cancel").onclick = () => {
    if (typeof toggleEditStep === "function") toggleEditStep(state.editingStepId);
  };
  const ta = $("chat-text");
  if (ta) ta.classList.add("editing");
}

function addMessage(role, text, opts) {
  const container = $("chat-messages");
  const div = document.createElement("div");
  div.className = "msg " + role;
  if (opts && opts.html) {
    div.innerHTML = text;
  } else {
    div.textContent = text;
  }
  container.appendChild(div);
  // 사용자가 방금 보낸 메시지는 항상 맨 아래로(자기 행동), 그 외(어시스턴트/시스템)는 stick 상태 존중.
  scrollChatToBottom({ force: role === "user" });
  return div;
}

// 사용자가 위로 스크롤해 이전 내용을 읽는 중이면 스트리밍 delta 가 화면을 끌어내리지 않도록
// "맨 아래 근처일 때만 자동 스크롤"(stick-to-bottom) 한다.
let _chatAutoStick = true;
function _isChatNearBottom(container, threshold) {
  threshold = (threshold == null) ? 80 : threshold;
  return (container.scrollHeight - container.scrollTop - container.clientHeight) <= threshold;
}
function _ensureChatScrollWatcher() {
  const container = $("chat-messages");
  if (!container || container._b2bScrollWatch) return;
  container._b2bScrollWatch = true;
  // 사용자/프로그램 스크롤 후의 위치로 stick 여부를 갱신. 맨 아래면 따라가고, 위로 올리면 멈춘다.
  container.addEventListener("scroll", () => {
    _chatAutoStick = _isChatNearBottom(container);
  }, { passive: true });
}
function scrollChatToBottom(opts) {
  const container = $("chat-messages");
  if (!container) return;
  _ensureChatScrollWatcher();
  const force = !!(opts && opts.force);
  if (!force && !_chatAutoStick) return;   // 위로 스크롤해 읽는 중이면 자동 스크롤 보류
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      _chatAutoStick = true;
    });
  });
}

// ---- 대화 기억(히스토리) 삭제 ----
// 잘못된 턴이 히스토리에 남아 다음 생성을 오염시키는 문제("기존작업 잔존")의 UI 해소책.
// llm-api 가 push 시 histId 를 붙이고, 여기서 메시지 말풍선과 연결해 × 버튼으로 제거한다.
const _boundChatHistIds = new Set();

function bindChatHistoryEntryToMessage(div, role, content) {
  try {
    if (!div || !content) return;
    const history = state.chatHistory || [];
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry && entry.role === role && entry.content === content &&
          entry.histId && !_boundChatHistIds.has(entry.histId)) {
        _boundChatHistIds.add(entry.histId);
        attachChatMessageDeleteButton(div, entry.histId);
        return;
      }
    }
  } catch (_) {}
}

function attachChatMessageDeleteButton(div, histId) {
  if (!div || !histId || div.querySelector(".msg-del")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "msg-del";
  btn.title = "이 메시지를 대화 기억에서 삭제 (이후 생성에 반영되지 않음. 적용된 스킬은 유지)";
  btn.textContent = "×";
  btn.onclick = (e) => {
    e.stopPropagation();
    const idx = (state.chatHistory || []).findIndex(en => en && en.histId === histId);
    if (idx >= 0) state.chatHistory.splice(idx, 1);
    div.remove();
    if (typeof toast === "function") toast("대화 기억에서 삭제했습니다. 이후 요청에 반영되지 않습니다.", "success");
  };
  div.appendChild(btn);
}

function scrollReasoningToBottom(el) {
  if (!el) return;
  requestAnimationFrame(() => {
    el.scrollTop = el.scrollHeight;
  });
}

function clearViewerDragSelection() {
  state.selectedCell = null;
  state.selectedRange = null;
  state.selectedRanges = [];
  state.selectionAnchor = null;
  document.querySelectorAll(".selected-cell,.selected-range").forEach(el => {
    el.classList.remove("selected-cell", "selected-range");
  });
}

function setActionButtonPending(button, pendingText) {
  if (!button) return;
  button.textContent = pendingText || "\uC791\uC5C5 \uC911...";
  button.classList.add("pending");
}

function finalizeActionButtonFromResult(button, result, doneText, onFailure, options = {}) {
  if (!button) return;
  if (result && result.pending && result.promise) {
    setActionButtonPending(button);
    let cancelBtn = null;
    const actions = options.actions || button.parentElement;
    if (typeof result.cancel === "function" && actions) {
      cancelBtn = document.createElement("button");
      cancelBtn.className = "action-btn danger apply-cancel";
      cancelBtn.type = "button";
      cancelBtn.textContent = "■ 작업 중단";
      cancelBtn.onclick = () => {
        cancelBtn.disabled = true;
        cancelBtn.textContent = "중단 중...";
        Promise.resolve(result.cancel()).catch(() => {});
      };
      actions.appendChild(cancelBtn);
    }
    const cleanupCancelButton = () => {
      if (cancelBtn && cancelBtn.parentElement) cancelBtn.remove();
    };
    result.promise
      .then((value) => {
        cleanupCancelButton();
        if (value && value.cancelled) {
          button.textContent = "\uC911\uB2E8\uB428";
          button.classList.remove("pending");
          button.classList.add("error");
          return;
        }
        button.textContent = doneText || "\u2713 \uC801\uC6A9\uB428";
        button.classList.remove("pending");
      })
      .catch(() => {
        cleanupCancelButton();
        button.textContent = "\uC801\uC6A9 \uC2E4\uD328";
        button.classList.remove("pending");
        button.classList.add("error");
        if (typeof onFailure === "function") onFailure();
      });
    return;
  }
  if (result && result.error) {
    button.textContent = "\uC801\uC6A9 \uC2E4\uD328";
    button.classList.add("error");
    if (typeof onFailure === "function") onFailure();
    return;
  }
  button.textContent = doneText || "\u2713 \uC801\uC6A9\uB428";
}

function restoreActionButtonsAfterFailure(buttons, primaryButton, retryText) {
  (buttons || []).forEach(btn => {
    if (!btn) return;
    btn.disabled = false;
    btn.classList.remove("pending", "error");
  });
  if (primaryButton) primaryButton.textContent = retryText || "\uC7AC\uC2DC\uB3C4";
}

function userExplicitlyRequestsFormulaOverwrite(text) {
  return /수식\s*(제거|삭제|지워|없애|값으로|대체|덮어)|기존\s*수식.*(제거|삭제|지워|없애|값)|formula\s*(remove|delete|overwrite|replace)|값으로\s*(덮어|대체|바꿔)/i.test(String(text || ""));
}

function codeMentionsFormulaOverwrite(code) {
  return /수식\s*(제거|삭제|지워|없애)|수식을?\s*값으로|값으로\s*덮어쓰기|formula\s*(remove|delete|overwrite|replace)/i.test(String(code || ""));
}

function userRequestsCopyPaste(text) {
  return /(복사|붙여\s*넣|붙여넣|복붙|copy|paste)/i.test(String(text || ""));
}

function userRequestsValuesOnly(text) {
  return /(값만|값\s*복사|값\s*붙여|수식\s*(빼고|제외|없이)|values?\s*only|paste\s*values?)/i.test(String(text || ""));
}

function userRequestsNumericOnly(text) {
  return /(숫자만|숫자\s*값만|수치만|금액만|number(?:s)?\s*only|numeric\s*only)/i.test(String(text || ""));
}

function codeCopiesValuesOnly(code) {
  const text = String(code || "");
  // python(openpyxl) 두 줄 분리 패턴까지 잡는다: val = ws.cell(...).value → ws.cell(...).value = val
  // openpyxl 의 .value 대입은 서식을 전혀 옮기지 못하므로, COM 폴백 마커 없이 복붙을
  // .value 루프로 처리하는 코드는 '값만 복사'로 판정한다(복붙 요청일 때만 가드가 발동).
  const isPythonSkill = /def\s+transform\s*\(\s*ctx\s*\)/.test(text);
  const hasComFallback = /B2B_ENGINE_FALLBACK\s*:\s*excel-com/i.test(text);
  const pythonValueCopyLoop = isPythonSkill && !hasComFallback &&
    /\.cell\s*\([^)]*\)\s*\.value\s*=/.test(text) &&
    /=\s*[\w.]*\.cell\s*\([^)]*\)\s*\.value\b/.test(text);
  return pythonValueCopyLoop
    || /\.Value\s*=\s*[^#\n\r;]+\.Value\b/i.test(text)
    || /PasteSpecial\s+[^'\n\r]*(xlPasteValues|-4163|Paste\s*:=\s*xlPasteValues|Paste\s*:=\s*-4163)/i.test(text)
    || /PasteSpecial\s*\([^)]*(xlPasteValues|-4163|Paste\s*=\s*-4163)/i.test(text)
    || /ctx\.(write_grid|set_range)\s*\([^)]*ctx\.rows\s*\(/i.test(text);
}

function codeFiltersNumericOnlyForCopy(code) {
  const text = String(code || "");
  const numericTest = /(IsNumeric\s*\(|WorksheetFunction\.IsNumber\s*\(|Application\.IsNumber\s*\(|\bisinstance\s*\([^)]*,\s*\(?\s*(?:int|float|Decimal)|\btype\s*\([^)]*\)\s*(?:is|==)\s*(?:int|float)|Number\.isFinite\s*\(|Number\.isInteger\s*\(|typeof\s+[^=\n\r]+\s*===\s*["']number["'])/i;
  const copyWrite = /(복사|붙여|copy|paste|ctx\.(?:write_grid|set_range)\s*\(|\.Value\s*=|append\s*\(|dest|target)/i;
  const skipNonNumeric = /(continue|pass|skip|else\s*:|if\s+not\s+.*(?:IsNumeric|isinstance|Number\.|typeof)|filter\s*\()/i;
  return numericTest.test(text) && copyWrite.test(text) && skipNonNumeric.test(text);
}

// [0.5.2 이식·하이브리드] degenerate 출력 감지 — 준-greedy 디코딩의 Qwen 이 같은 줄을 끝없이
// 반복하는 경우(모든 python 코드 공통). 적용 전에 걸러 간결 재생성을 유도한다.
function pythonDegenerateOutputFailure(code) {
  const lines = String(code || "").split("\n");
  const counts = {};
  let maxRepeat = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length < 6) continue; // 빈 줄·괄호 등 자연스러운 반복은 허용
    const n = (counts[line] || 0) + 1;
    counts[line] = n;
    if (n > maxRepeat) maxRepeat = n;
  }
  if (maxRepeat >= 8) {
    return "같은 코드 줄이 비정상적으로 여러 번 반복되었습니다. 반복 없이, 필요한 로직만 간결하게 다시 생성해 주세요(비슷한 처리는 for 루프로 묶기).";
  }
  return null;
}

// [0.5.2 이식·하이브리드] COM 폴백(# B2B_ENGINE_FALLBACK: excel-com) 코드 한정 bulk 위반 검사.
// openpyxl(인프로세스) 코드는 셀 루프가 빨라 대상이 아니고, COM 은 셀 단위 호출이 왕복당 느려
// 루프 내 COM 쓰기/전체 열 연산/Select·Activate 를 차단한다.

function codeHasBroadValueRewrite(code) {
  const text = String(code || "");
  if (/\bUsedRange\s*\.Value\s*=/.test(text)) return true;
  if (/\bRange\s*\([^'\n\r]*(lastCol|xlToLeft|Columns\.Count)[^'\n\r]*\)\s*\.Value\s*=/i.test(text)) return true;
  if (/\bRange\s*\(\s*"[$]?[A-Z]+:[$]?[A-Z]+"\s*\)\s*\.Value\s*=/i.test(text)) return true;
  if (/\bColumns\s*\([^)]*\)\s*\.Value\s*=/i.test(text)) return true;

  const broadRangeVars = new Set();
  const setRe = /\bSet\s+([A-Za-z_]\w*)\s*=\s*([^\n\r']+)/gi;
  let match;
  while ((match = setRe.exec(text)) !== null) {
    const varName = match[1];
    const expr = match[2] || "";
    const isBroadRange = /\bUsedRange\b/i.test(expr)
      || (/\bRange\s*\(/i.test(expr) && /\b(lastCol|xlToLeft|Columns\.Count)\b/i.test(expr))
      || /\bRange\s*\(\s*"[$]?[A-Z]+:[$]?[A-Z]+"/i.test(expr)
      || /\bColumns\s*\(/i.test(expr);
    if (isBroadRange) {
      broadRangeVars.add(varName.toLowerCase());
    }
  }

  for (const varName of broadRangeVars) {
    const writeRe = new RegExp("\\b" + varName + "\\s*\\.\\s*Value\\s*=", "i");
    if (writeRe.test(text)) return true;
  }

  const roundTripRe = /\b([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*\.Value\b[\s\S]{0,4000}\b\2\s*\.Value\s*=\s*\1\b/i;
  const roundTrip = roundTripRe.exec(text);
  if (roundTrip) {
    const rangeVar = (roundTrip[2] || "").toLowerCase();
    return broadRangeVars.has(rangeVar);
  }
  return false;
}

// VBA 적용 직전 정적 안전 필터(런타임에 주입되기 전 차단). 평가 하니스
// (tests/vba_regression/vba_static_checks.py)의 hard-block 패턴을 exe 로 포팅한 것.
// 위반 시 자동으로 Qwen 재생성 → 재검사(최대 VBA_STATIC_MAX_REGEN 회) 후에도 실패하면
// 사용자에게 차단 안내한다. (정적 FAIL 실패는 '정상 응답이지만 위험'이라 재생성 대상.)
const VBA_STATIC_MAX_REGEN = 2;
// Python 정적 게이트는 2회 실패(최초 1회 + 재생성 1회)면 더 끌지 않고 바로 VBA 전환한다.
// (Python COM 기반 제약일 가능성이 높은데 같은 제약으로 3번째 재생성을 돌리는 것은 낭비.)
const PYTHON_STATIC_MAX_REGEN = 1;

function vbaStaticSafetyFailures(code, sourceUserMessage) {
  // 주석 제거 후 검사 — "' Workbooks.Open 금지" 같은 규칙 메아리 주석이 오탐되지 않게.
  const text = _stripVbaCommentsForGate(code);
  const failures = [];
  const blocked = [
    [/\bOn\s+Error\s+Resume\s+Next\b/i, "On Error Resume Next 로 오류를 삼키면 안 됩니다(실패가 '적용됨'으로 오보). 실패는 Err.Raise 로 전파하거나 On Error GoTo Cleanup 으로 상태 원복 후 재전파하세요."],
    [/\bMsgBox\s*(?:\(|\s)/i, "MsgBox 는 자동 실행을 멈춥니다. 제거하고 실패는 Err.Raise 로 알리세요."],
    [/\bInputBox\s*(?:\(|\s)/i, "InputBox 는 자동 실행을 멈춥니다. 제거하세요."],
    [/\bShell\s*(?:\(|\s)/i, "Shell 실행은 금지입니다."],
    [/\bWorkbooks\s*\.\s*Open\b/i, "Workbooks.Open 금지(다른 파일을 열지 마세요). 이미 열린 워크북만 다루세요."],
    [/\bApplication\s*\.\s*Quit\b/i, "Application.Quit 금지."],
    [/\.(?:Save|SaveAs|SaveCopyAs|Close)\b/i, "Save/SaveAs/Close 금지(파일 저장·닫기를 코드에서 하지 마세요)."],
  ];
  for (const [re, msg] of blocked) {
    if (re.test(text)) failures.push(msg);
  }
  // 파일/네트워크용 CreateObject 금지(Scripting.Dictionary 는 허용).
  const coRe = /\bCreateObject\s*\(\s*["']([^"']+)["']\s*\)/gi;
  let m;
  while ((m = coRe.exec(text)) !== null) {
    if (String(m[1]).toLowerCase() !== "scripting.dictionary") {
      failures.push(`CreateObject("${m[1]}") 금지(Scripting.Dictionary 외 파일/네트워크 객체 생성 불가).`);
    }
  }
  // 전체 시트 순회는 사용자가 "전체/모든 시트"를 명시했을 때만 허용.
  const allSheetIntent = /(\b(all|every)\s+sheets?\b|전체\s*시트|모든\s*시트|전\s*시트|시트\s*전체)/i.test(String(sourceUserMessage || ""));
  if (!allSheetIntent && /\bFor\s+Each\s+\w+\s+In\s+(?:ActiveWorkbook\s*\.\s*)?Worksheets\b/i.test(text)) {
    failures.push("'전체 시트' 요청이 아닌데 For Each ... In Worksheets 로 모든 시트를 순회합니다. 요청한 특정 시트만 대상으로 하세요.");
  }
  return failures;
}

// 게이트 검사용 주석 제거 — 모델이 프롬프트의 금지 규칙을 주석으로 메아리치는 일이 흔한데
// ("# openpyxl 이 아니라 ctx 사용", "' Workbooks.Open 금지") 주석까지 검사하면 전부 오탐이 된다.
// 문자열 리터럴은 보존한다(CreateObject("...") 등 문자열 내용을 보는 검사가 있음).
function _stripPythonCommentsForGate(code) {
  return String(code || "").split("\n").map(line => {
    let inStr = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inStr) {
        if (ch === "\\") { i++; continue; }
        if (ch === inStr) inStr = null;
      } else if (ch === '"' || ch === "'") {
        inStr = ch;
      } else if (ch === "#") {
        return line.slice(0, i);
      }
    }
    return line;
  }).join("\n");
}

function _stripVbaCommentsForGate(code) {
  return String(code || "").split("\n").map(line => {
    if (/^\s*Rem\b/i.test(line)) return "";
    let inStr = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inStr = !inStr;
      else if (ch === "'" && !inStr) return line.slice(0, i);
    }
    return line;
  }).join("\n");
}

// ver0.5.2 4단계: Python COM 스킬용 클라이언트 정적 안전 검사(적용 직전 1차 게이트).
// 서버의 AST 게이트가 최종 권위이고, 여기서는 빠른 차단 + 자동 재생성을 위해 같은 규칙을
// 정규식 휴리스틱으로 검사한다.
function pythonComStaticSafetyFailures(code, sourceUserMessage) {
  const text = String(code || "");
  // 주석을 제거한 본문으로 금지 패턴을 검사한다(주석 속 키워드 오탐 방지).
  const scanText = _stripPythonCommentsForGate(text);
  const failures = [];
  if (!/def\s+transform\s*\(\s*ctx\s*\)\s*:/.test(text)) {
    failures.push("def transform(ctx): 진입 함수가 필요합니다.");
  }
  const blocked = [
    [/^\s*(?:import|from)\s+\w+/m, "import 는 사용할 수 없습니다(re/datetime/math 는 이미 주어져 있음)."],
    // (?<![\w.]) — re.compile()/ctx.input() 같은 '제공 모듈/ctx 의 메서드 호출'은 빌트인이 아니다.
    // 서버 AST 게이트도 bare 이름 호출만 차단한다(속성 호출은 허용).
    [/(?<![\w.])(?:open|eval|exec|__import__|input|compile)\s*\(/, "open/eval/exec/__import__ 등 빌트인은 사용할 수 없습니다."],
    [/\b(?:win32com|openpyxl|subprocess|os\.|sys\.)/, "win32com/openpyxl/os/sys 모듈은 사용할 수 없습니다(ctx API 만 사용)."],
    [/\bload_workbook\s*\(|\bws\s*\[\s*["']/, 'openpyxl 관용구(ws["A1"], load_workbook)는 지원되지 않습니다. ctx.read()/ctx.write() 를 사용하세요.'],
    [/\.(?:Select|Activate)\s*\(/, ".Select/.Activate 는 사용할 수 없습니다."],
    [/\bActiveWorkbook\b|\bActiveSheet\b/, "ActiveWorkbook/ActiveSheet 에 의존하지 마세요(ctx 가 대상 파일에 고정되어 있음)."],
    [/while\s+(?:True|1)\s*:/, "while True 무한 루프는 금지입니다."],
    [/\.(?:Save|SaveAs|SaveCopyAs|Close|Quit)\s*\(/, "저장/닫기/종료 호출은 금지입니다."],
  ];
  for (const [re, msg] of blocked) {
    if (re.test(scanText)) failures.push(msg);
  }
  // 루프 내부의 ctx 쓰기 반복(셀 단위 COM 폭주) 휴리스틱 — 서버 AST 게이트와 동일 규칙.
  // 수신자는 ctx 와 ctx.book(...) 별칭만 본다 — (?:\w+)\. 로 아무 변수나 매칭하면
  // 루프 안의 일반 리스트 .copy()/.sort()/.clear() 까지 오탐으로 차단된다.
  {
    const ctxAliases = new Set(["ctx"]);
    const aliasRe = /(\w+)\s*=\s*(\w+)\s*\.\s*book\s*\(/g;
    let grew = true;
    while (grew) { // book = ctx.book(...), other = book.book(...) 같은 연쇄 별칭까지 수렴
      grew = false;
      let am;
      aliasRe.lastIndex = 0;
      while ((am = aliasRe.exec(scanText)) !== null) {
        if (ctxAliases.has(am[2]) && !ctxAliases.has(am[1])) { ctxAliases.add(am[1]); grew = true; }
      }
    }
    const recv = Array.from(ctxAliases).join("|");
    // 들여쓰기 인식: '루프 헤더보다 깊게 들여쓴 줄'만 루프 본문으로 본다.
    // (이전 정규식은 들여쓰기를 안 봐서, 루프 "다음에" 오는 ctx.write() — 권장 패턴 —
    //  까지 루프 안으로 오인해 for 루프가 있으면 사실상 무조건 차단됐다.)
    const loopWriteRe = new RegExp(
      "^([ \\t]*)(?:for|while)\\s[^\\n]*:[ \\t]*\\n" +   // 루프 헤더(들여쓰기 캡처)
      "(?:(?:\\1[ \\t]+[^\\n]*)?\\n)*?" +                 // 본문: 더 깊은 들여쓰기 줄/빈 줄만 통과
      "\\1[ \\t]+[^\\n]*\\b(?:" + recv + ")" +
      "(?:\\s*\\.\\s*book\\s*\\([^\\n]*?\\))?" +          // ctx.book("...").write(...) 체이닝 포함
      "\\s*\\.\\s*(?:write|write_cell|write_formulas|copy|clear|insert_rows|insert_cols|delete_rows|delete_cols|merge|unmerge|sort)\\s*\\(",
      "m"
    );
    if (loopWriteRe.test(scanText)) { // 루프 본문의 주석("# ctx.write 는 밖에서") 오탐 방지
      failures.push("루프 안에서 ctx 쓰기 함수를 반복 호출하면 안 됩니다. 값을 2차원 리스트로 모은 뒤 ctx.write() 한 번으로 쓰세요.");
    }
  }
  if (/overwrite_formulas\s*=\s*True/.test(scanText) && !userExplicitlyRequestsFormulaOverwrite(sourceUserMessage)) {
    failures.push("사용자가 수식 제거를 명시하지 않았는데 overwrite_formulas=True 를 사용했습니다. 수식 셀은 건너뛰도록 다시 작성하세요.");
  }
  // degenerate 출력 감지: 준-greedy 디코딩의 Qwen 이 같은 줄을 끝없이 반복하거나
  // 단순 작업에 수백 줄을 토해내는 경우 — 적용 전에 걸러 간결 재생성을 유도한다.
  const lines = text.split("\n");
  const lineCounts = {};
  let maxRepeat = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 6) continue; // 빈 줄·괄호 등 자연스러운 반복은 허용
    const n = (lineCounts[line] || 0) + 1;
    lineCounts[line] = n;
    if (n > maxRepeat) maxRepeat = n;
  }
  if (maxRepeat >= 8) {
    failures.push("같은 코드 줄이 비정상적으로 여러 번 반복되었습니다. 반복 없이, 필요한 로직만 간결하게 다시 작성하세요(비슷한 처리는 for 루프로 묶기).");
  }
  if (lines.length > 150) {
    failures.push("코드가 비정상적으로 깁니다. 요청을 만족하는 최소한의 코드(보통 40줄 이내)로 다시 작성하세요.");
  }
  // [검증패치#4] 복사/붙여넣기 요청인데 ctx.copy 없이 read→write 재구성 — 헤더/빈칸 누락·서식/수식 소실의 원인.
  if (typeof userRequestsCopyPaste === "function" && userRequestsCopyPaste(sourceUserMessage) &&
      (typeof userRequestsValuesOnly !== "function" || !userRequestsValuesOnly(sourceUserMessage)) &&
      !/ctx\.copy\s*\(/.test(scanText) && /ctx\.read\s*\(/.test(scanText) && /ctx\.(write|write_cell|write_formulas)\s*\(/.test(scanText)) {
    failures.push("복사/붙여넣기 요청은 ctx.copy(원본시트, 범위, 대상시트, 시작셀) 로 범위 전체(헤더·빈칸 포함)를 그대로 옮겨야 합니다 — read→write 값 재구성은 서식·수식·빈칸이 사라집니다.");
  }
  return failures;
}

function buildPythonStaticSafetyRegenPrompt(code, failures, sourceUserMessage) {
  const fixList = failures.map(f => `- ${f}`).join("\n");
  return [
    "방금 생성한 Python 스킬이 적용 직전 정적 안전 검사에서 막혔습니다.",
    "원래 사용자 요청을 그대로 만족하되, 아래 위반을 모두 제거해 다시 작성하세요.",
    "",
    "## 원래 사용자 요청",
    String(sourceUserMessage || "(직전 요청 참조)"),
    "",
    "## 막힌 이유(모두 고칠 것)",
    fixList,
    "",
    "## 막힌 코드",
    "```python",
    String(code || ""),
    "```",
    "",
    "반드시 하나의 ```python 코드 블록으로 def transform(ctx): 를 출력하세요.",
    "규칙: import 금지(re/datetime/math 는 제공됨) · ctx API 만 사용 · 읽기는 ctx.read() 한 번,",
    "계산은 메모리에서, 쓰기는 ctx.write() 한 번 · 루프 안 ctx 쓰기 금지 · 실패는 raise ValueError.",
    "/no_think",
  ].join("\n");
}

function buildStaticSafetyRegenPrompt(code, failures, sourceUserMessage) {
  const fixList = failures.map(f => `- ${f}`).join("\n");
  return [
    "방금 생성한 VBA 가 적용 직전 정적 안전 검사에서 막혔습니다.",
    "원래 사용자 요청을 그대로 만족하되, 아래 위반을 모두 제거해 VBA 를 다시 작성하세요.",
    "",
    "## 원래 사용자 요청",
    String(sourceUserMessage || "(직전 요청 참조)"),
    "",
    "## 막힌 이유(모두 고칠 것)",
    fixList,
    "",
    "## 막힌 코드",
    "```vba",
    String(code || ""),
    "```",
    "",
    "반드시 하나의 ```vba 코드 블록만 출력하세요. On Error Resume Next / MsgBox / InputBox / Shell /",
    "Workbooks.Open / Save·Close / Application.Quit / 무관한 전체 시트 순회를 쓰지 마세요.",
    "대상을 못 찾으면 Err.Raise vbObjectError + 513, \"B2BSkill\", \"사유\" 로 실패를 알리세요.",
    "/no_think",
  ].join("\n");
}

function showCodeGuardBlock(message, context) {
  context = context || {};
  // [B2B#18 진단] '적용 버튼이 안 눌린다'의 상당수는 가드가 조용히 막은 경우다. 로그로 구분.
  console.warn(`[B2B#18] 적용 가드 차단: ${message}`);
  toast(message, "error");
  const div = addMessage("system", "", {});
  div.innerHTML = `
    <div>${escapeHtml(message)}</div>
    ${context.onForceApply ? `
      <div class="action-btns" style="margin-top:8px">
        <button class="action-btn danger" type="button">${escapeHtml(context.forceLabel || "강제로 적용")}</button>
      </div>
    ` : ""}
  `;
  const forceBtn = div.querySelector("button");
  if (forceBtn && context.onForceApply) {
    forceBtn.onclick = () => {
      if (forceBtn.disabled) return;
      forceBtn.disabled = true;
      forceBtn.textContent = "강제 적용 중...";
      try {
        context.onForceApply();
      } catch (err) {
        forceBtn.disabled = false;
        forceBtn.textContent = context.forceLabel || "강제로 적용";
        throw err;
      }
    };
  }
  scrollChatToBottom({ force: true });   // 가드 안내/강제적용 버튼은 항상 보이도록(#18)
}

// 정적 안전 위반 시 Qwen 을 자동 재호출해 고친 코드를 받아 다시 검사 흐름에 태운다.
// addAssistantReply 가 새 코드에 대해 validateAssistantCodeBeforeApply 를 다시 호출하므로
// staticRegenAttempt 카운터로 무한 재생성을 막는다(VBA_STATIC_MAX_REGEN 회까지).
async function autoRegenerateForStaticSafety(code, failures, context) {
  const sourceUserMessage = (context && context.sourceUserMessage) || latestUserRequestForSafety();
  const attempt = Number((context && context.staticRegenAttempt) || 0) + 1;
  const isPythonRegen = !!(context && context.skillLanguage === "python");
  const maxRegen = isPythonRegen ? PYTHON_STATIC_MAX_REGEN : VBA_STATIC_MAX_REGEN;
  const prompt = isPythonRegen
    ? buildPythonStaticSafetyRegenPrompt(code, failures, sourceUserMessage)
    : buildStaticSafetyRegenPrompt(code, failures, sourceUserMessage);
  toast(`안전하지 않은 패턴이 감지되어 코드를 자동으로 다시 생성합니다. (${attempt}/${maxRegen})`, "success");
  const loading = addMessage("assistant", "", {});
  const aiName = (typeof getAiDisplayName === "function" ? getAiDisplayName() : "AI");
  const streamView = setupStreamingAssistantMessage(loading, `(안전 재생성 ${attempt}/${maxRegen}) `, aiName, null);
  // degenerate(줄 반복/비정상 길이) 위반이 포함된 재생성에서만 강한 반복 억제를 건다.
  // (일반 요청에 1.5 를 상시 적용하면 코드 토큰 재사용까지 벌점을 줘 출력이 망가진다.)
  const hasDegenerateFailure = (failures || []).some(f => /반복|비정상적으로\s*깁니다/.test(String(f)));
  try {
    $("chat-send").disabled = true;
    const reply = await callLLM(prompt, {
      presencePenalty: hasDegenerateFailure ? 1.5 : undefined,
      onDelta: (_d, full) => { streamView.setAnswer(full); scrollChatToBottom(); },
      onReconnect: (a, max) => { streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${a}/${max})`); },
    });
    streamView.flush();
    loading.remove();
    // 새 응답을 일반 흐름으로 렌더 → 새 코드가 자동으로 다시 정적검사된다(카운터/폴백 표식 전파).
    addAssistantReply(reply, {
      sourceUserMessage,
      staticRegenAttempt: attempt,
      vbaFallbackTried: !!(context && context.vbaFallbackTried),
    });
    scrollChatToBottom();
  } catch (err) {
    loading.innerHTML = "안전 재생성 실패: " + escapeHtml(err && err.message ? err.message : String(err));
    loading.classList.remove("assistant");
    loading.classList.add("system", "error");
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
  }
}

// Python COM 정적 게이트를 (최초 생성 + 자동 재생성 VBA_STATIC_MAX_REGEN 회) 연속으로 통과하지
// 못하면 같은 요청을 VBA 매크로로 전환해 한 번 더 생성한다. 이 호출 1회만 VBA 시스템 프롬프트를
// 쓰고(forceEngine), 전역 엔진 설정은 바꾸지 않는다. 생성된 VBA 는 일반 흐름(addAssistantReply)을
// 타므로 VBA 정적 게이트가 다시 검사하고, 적용 시 language="vba" 라우팅으로 run-vba 에 실행된다.
async function autoRegenerateAsVbaFallback(code, failures, context) {
  const sourceUserMessage = (context && context.sourceUserMessage) || latestUserRequestForSafety();
  const fixList = (failures || []).map(f => `- ${f}`).join("\n");
  const prompt = [
    "Python 스킬이 정적 안전 검사를 여러 번 통과하지 못했습니다. 같은 요청을 VBA 매크로로 전환해 다시 작성하세요.",
    "",
    "## 원래 사용자 요청",
    String(sourceUserMessage || "(직전 요청 참조)"),
    "",
    "## Python 에서 막혔던 이유(같은 실수를 VBA 에서 반복하지 말 것)",
    fixList,
    "",
    "반드시 하나의 ```vba 코드 블록만 출력하세요. On Error Resume Next / MsgBox / InputBox / Shell /",
    "Workbooks.Open / Save·Close / Application.Quit / 무관한 전체 시트 순회를 쓰지 마세요.",
    "대상을 못 찾으면 Err.Raise vbObjectError + 513, \"B2BSkill\", \"사유\" 로 실패를 알리세요.",
    "/no_think",
  ].join("\n");
  toast("Python 안전 검사를 계속 통과하지 못해 VBA 로 전환해 다시 생성합니다.", "success");
  const loading = addMessage("assistant", "", {});
  const aiName = (typeof getAiDisplayName === "function" ? getAiDisplayName() : "AI");
  const streamView = setupStreamingAssistantMessage(loading, "(VBA 전환 재생성) ", aiName, null);
  try {
    $("chat-send").disabled = true;
    const reply = await callLLM(prompt, {
      forceEngine: "vba",
      onDelta: (_d, full) => { streamView.setAnswer(full); scrollChatToBottom(); },
      onReconnect: (a, max) => { streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${a}/${max})`); },
    });
    streamView.flush();
    loading.remove();
    // vbaFallbackTried: VBA 쪽 게이트도 끝내 막히면 다시 python 으로 돌아오지 않고 최종 차단.
    addAssistantReply(reply, { sourceUserMessage, staticRegenAttempt: 0, vbaFallbackTried: true });
    scrollChatToBottom();
  } catch (err) {
    loading.innerHTML = "VBA 전환 재생성 실패: " + escapeHtml(err && err.message ? err.message : String(err));
    loading.classList.remove("assistant");
    loading.classList.add("system", "error");
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
  }
}

function validateAssistantCodeBeforeApply(code, context) {
  context = context || {};
  const sourceUserMessage = context.sourceUserMessage || "";
  // ver0.5.2 4단계: Python COM 스킬은 전용 게이트로(서버 AST 게이트의 1차 방어선).
  const codeText = String(code || "");
  const isPythonSkill = /def\s+transform\s*\(\s*ctx\s*\)\s*:/.test(codeText) ||
    (/\bctx\.\w+\s*\(/.test(codeText) && !/\bSub\s+\w+\s*\(/i.test(codeText));
  if (isPythonSkill) {
    const pyFailures = pythonComStaticSafetyFailures(code, sourceUserMessage);
    if (pyFailures.length) {
      const attemptsSoFar = Number(context.staticRegenAttempt || 0);
      if (attemptsSoFar < PYTHON_STATIC_MAX_REGEN) {
        autoRegenerateForStaticSafety(code, pyFailures, { ...context, skillLanguage: "python" });
      } else if (!context.vbaFallbackTried) {
        // Python 정적 제약을 2회(최초+재생성 1회) 통과하지 못함 → 같은 요청을
        // VBA 로 전환해 다시 시도한다(전역 엔진 설정은 그대로).
        autoRegenerateAsVbaFallback(code, pyFailures, context);
      } else {
        showCodeGuardBlock(
          "여러 번 다시 생성했지만 안전하지 않은 패턴이 남아 적용을 막았습니다:\n- " +
            pyFailures.join("\n- "),
          context,
        );
      }
      return false;
    }
    return true; // 아래 VBA 전용 휴리스틱은 건너뜀
  }
  // 0) VBA 런타임 안전 하드블록(On Error Resume Next, MsgBox, Workbooks.Open/.Save/.Close,
  //    Application.Quit, Shell, 무관 전체시트순회, 파일 CreateObject). 위반 시 자동 재생성.
  const safetyFailures = vbaStaticSafetyFailures(code, sourceUserMessage);
  if (safetyFailures.length) {
    const attemptsSoFar = Number(context.staticRegenAttempt || 0);
    if (attemptsSoFar < VBA_STATIC_MAX_REGEN) {
      autoRegenerateForStaticSafety(code, safetyFailures, context);
    } else {
      showCodeGuardBlock(
        "여러 번 다시 생성했지만 안전하지 않은 패턴이 남아 적용을 막았습니다:\n- " +
          safetyFailures.join("\n- "),
        context,
      );
    }
    return false;
  }
  if (codeMentionsFormulaOverwrite(code) && !userExplicitlyRequestsFormulaOverwrite(sourceUserMessage)) {
    const message = "사용자가 수식 제거를 명시하지 않았는데 생성 코드에 수식 제거/값 덮어쓰기 의도가 포함되어 적용을 막았습니다. 수식을 보존하는 코드로 다시 생성해 주세요.";
    showCodeGuardBlock(message, context);
    return false;
  }
  if (codeHasBroadValueRewrite(code) && !userExplicitlyRequestsFormulaOverwrite(sourceUserMessage)) {
    const message = "표 전체/UsedRange를 Value 배열로 다시 쓰는 VBA가 감지되어 적용을 막았습니다. 이 방식은 기존 수식을 값으로 바꿀 수 있으니 대상 열/셀만 쓰는 코드로 다시 생성해 주세요.";
    showCodeGuardBlock(message, context);
    return false;
  }
  if (userRequestsCopyPaste(sourceUserMessage) && !userRequestsValuesOnly(sourceUserMessage) && codeCopiesValuesOnly(code)) {
    const message = "복사/붙여넣기 요청에서 값만 복사하는 코드가 감지되어 적용을 막았습니다. 수식과 서식이 유지되도록 Range.Copy 또는 PasteSpecial xlPasteAll 방식으로 다시 생성해 주세요.";
    showCodeGuardBlock(message, context);
    return false;
  }
  if (userRequestsCopyPaste(sourceUserMessage) && !userRequestsNumericOnly(sourceUserMessage) && codeFiltersNumericOnlyForCopy(code)) {
    const message = "복사/붙여넣기 요청에서 숫자 셀만 골라 복사하는 코드가 감지되어 적용을 막았습니다. 선택 범위의 텍스트, 숫자, 수식, 빈칸을 행/열 위치 그대로 모두 복사하는 코드로 다시 생성해 주세요.";
    showCodeGuardBlock(message, context);
    return false;
  }
  // VBA 응답에도 같은 줄 도배(degenerate) 가드를 적용한다(Python 쪽은 COM 게이트가 담당).
  const degen = pythonDegenerateOutputFailure(code);
  if (degen) {
    showCodeGuardBlock(degen, context);
    return false;
  }
  return true;
}

function latestUserRequestForSafety() {
  const history = state.chatHistory || [];
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i] || {};
    if (item.role !== "user") continue;
    const content = String(item.content || item.text || item.message || "");
    if (!content) continue;
    if (content.includes("## 실패한 코드") || content.includes("## 상세 오류")) continue;
    return content;
  }
  return "";
}

// ---- 코드 미생성/주석-only 출력 감지 (Qwen 이 설명만 하거나 # 주석만 잔뜩 다는 문제) ----
const NO_CODE_MAX_REGEN = 2;

// 사용자에게 되묻는 정상적인 명확화 질문이면 재생성하지 않는다.
function _looksLikeClarifyingQuestion(text) {
  const t = String(text || "");
  if (!/\?|까요|입니까|인가요/.test(t)) return false;
  return /(어떤|어느|무엇|어디|몇|중에|선택|알려\s*주|확인해\s*주|말씀해\s*주)/.test(t);
}

// 실행 가능한 문장이 없는 주석-only 코드인지 검사(파이썬 # / VBA '·Rem).
function _isCommentOnlyCode(code, language) {
  const lines = String(code || "").split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return true;
  const isComment = (l) => language === "vba"
    ? (l.startsWith("'") || /^rem\b/i.test(l))
    : l.startsWith("#");
  // 시그니처/끝맺음/pass/docstring 만 있고 나머지가 전부 주석이면 본문이 없는 것.
  const scaffold = /^(def\s+transform|sub\s+b2bskill|end\s+sub|pass$|return(\s+none)?$|"""|''')/i;
  return lines.every(l => isComment(l) || scaffold.test(l));
}

// 코드를 만들어야 하는 응답인데 코드가 없거나 비어 있으면 문제 목록을 돌려준다.
function assistantReplyCodeProblems(fullText, code) {
  const text = String(fullText || "");
  const stripped = text.replace(/```[\s\S]*?```/g, "").trim();
  if (!code) {
    if (_looksLikeClarifyingQuestion(stripped)) return []; // 정당한 되물음은 통과
    return ["코드 블록 없이 설명만 출력했습니다."];
  }
  const language = typeof inferCodeLanguage === "function" ? inferCodeLanguage(code, text) : "";
  if (_isCommentOnlyCode(code, language)) {
    return ["코드 블록이 주석/뼈대뿐이고 실제 실행 문장이 없습니다."];
  }
  const hasEntry = language === "vba"
    ? /\bSub\s+B2BSkill\s*\(/i.test(code)
    : (language === "python" ? /def\s+transform\s*\(\s*ctx\s*\)\s*:/.test(code) : true);
  if (!hasEntry) {
    return [language === "vba"
      ? "진입점 Sub B2BSkill() 이 없습니다."
      : "진입 함수 def transform(ctx): 가 없습니다."];
  }
  return [];
}

// 설명만/주석만 응답을 받았을 때 교정 지시와 함께 자동 재생성한다(최대 NO_CODE_MAX_REGEN 회).
async function autoRegenerateForMissingCode(fullText, problems, context) {
  const sourceUserMessage = (context && context.sourceUserMessage) || latestUserRequestForSafety();
  const attempt = Number((context && context.noCodeRegenAttempt) || 0) + 1;
  const engine = typeof getSkillEngine === "function" ? getSkillEngine() : "python";
  const isVba = engine === "vba";
  const prompt = [
    "방금 응답에는 실행할 코드가 없었습니다:",
    ...problems.map(p => `- ${p}`),
    "",
    "## 원래 사용자 요청",
    String(sourceUserMessage || "(직전 요청 참조)"),
    "",
    "설명·계획·주석만 쓰지 말고, 위 요청을 실제로 수행하는 코드를 지금 바로 작성하세요.",
    isVba
      ? "반드시 하나의 ```vba 코드 블록으로 Sub B2BSkill() 전체 구현을 출력하세요."
      : "반드시 하나의 ```python 코드 블록으로 def transform(ctx): 전체 구현을 출력하세요.",
    "코드 밖 설명은 1~2문장만. 주석은 꼭 필요한 곳에만 짧게.",
    "/no_think",
  ].join("\n");
  toast(`응답에 코드가 없어 자동으로 다시 생성합니다. (${attempt}/${NO_CODE_MAX_REGEN})`, "success");
  const loading = addMessage("assistant", "", {});
  const aiName = (typeof getAiDisplayName === "function" ? getAiDisplayName() : "AI");
  const streamView = setupStreamingAssistantMessage(loading, `(코드 재생성 ${attempt}/${NO_CODE_MAX_REGEN}) `, aiName, null);
  try {
    $("chat-send").disabled = true;
    const reply = await callLLM(prompt, {
      onDelta: (_d, full) => { streamView.setAnswer(full); scrollChatToBottom(); },
      onReconnect: (a, max) => { streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${a}/${max})`); },
    });
    streamView.flush();
    loading.remove();
    addAssistantReply(reply, {
      ...(context || {}),
      sourceUserMessage,
      noCodeRegenAttempt: attempt,
    });
    scrollChatToBottom();
  } catch (err) {
    loading.innerHTML = "코드 재생성 실패: " + escapeHtml(err && err.message ? err.message : String(err));
    loading.classList.remove("assistant");
    loading.classList.add("system", "error");
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
  }
}

function addAssistantReply(fullText, replyContext) {
  const code = extractCode(fullText);
  const language = typeof inferCodeLanguage === "function" ? inferCodeLanguage(code, fullText) : "javascript";
  const desc = extractDescription(fullText);
  const stripped = fullText.replace(/```[\s\S]*?```/g, "").trim();
  const editTargetId = replyContext && replyContext.editTargetId;
  const reasoning = replyContext && replyContext.reasoning;

  const div = document.createElement("div");
  div.className = "msg assistant";
  div.innerHTML = `<div>${escapeHtml(stripped)}</div>`;
  if (reasoning) div.insertBefore(createReasoningBox(reasoning), div.firstChild);
  bindChatHistoryEntryToMessage(div, "assistant", fullText);
  if (code) {
    const codeBlk = document.createElement("pre");
    codeBlk.className = "code-block";
    codeBlk.textContent = code;
    div.appendChild(codeBlk);

    const actions = document.createElement("div");
    actions.className = "action-btns";

    if (editTargetId) {
      const editApplyBtn = document.createElement("button");
      editApplyBtn.className = "action-btn";
      editApplyBtn.textContent = "\u2713 \uC218\uC815 \uC801\uC6A9";
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "action-btn reject";
      rejectBtn.textContent = "\u2715 \uAC70\uC808";
      actions.appendChild(editApplyBtn);
      actions.appendChild(rejectBtn);
      div.appendChild(actions);

      const runEditApply = () => {
        const result = replaceLogicAt(editTargetId, code, desc, language);
        if (result && !result.error) {
          editApplyBtn.disabled = true;
          rejectBtn.disabled = true;
          finalizeActionButtonFromResult(
            editApplyBtn,
            result,
            "\u2713 \uC218\uC815 \uC801\uC6A9\uB428",
            () => restoreActionButtonsAfterFailure([editApplyBtn, rejectBtn], editApplyBtn, "\u2713 \uB2E4\uC2DC \uC218\uC815 \uC801\uC6A9"),
            { actions }
          );
        }
      };
      editApplyBtn.onclick = () => {
        const validationContext = {
          ...(replyContext || {}),
          forceLabel: "\uAC15\uC81C\uB85C \uC218\uC815 \uC801\uC6A9",
          onForceApply: runEditApply,
        };
        if (!validateAssistantCodeBeforeApply(code, validationContext)) return;
        runEditApply();
      };
      rejectBtn.onclick = () => {
        editApplyBtn.disabled = true;
        rejectBtn.disabled = true;
        rejectBtn.textContent = "\uAC70\uC808\uB428";
      };
    } else {
      const applyBtn = document.createElement("button");
      applyBtn.className = "action-btn";
      applyBtn.textContent = "\u2713 \uC801\uC6A9";
      const insertBtn = document.createElement("button");
      insertBtn.className = "action-btn insert";
      insertBtn.textContent = "\u21B3 \uC0BD\uC785";
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "action-btn reject";
      rejectBtn.textContent = "\u2715 \uAC70\uC808";
      actions.appendChild(applyBtn);
      actions.appendChild(insertBtn);
      actions.appendChild(rejectBtn);
      div.appendChild(actions);

      const runApply = () => {
        const result = applyLogic({ id: uid(), prompt: latestUserRequestForSafety(), code, description: desc, language });
        applyBtn.disabled = true;
        insertBtn.disabled = true;
        rejectBtn.disabled = true;
        finalizeActionButtonFromResult(
          applyBtn,
          result,
          "\u2713 \uC801\uC6A9\uB428",
          () => restoreActionButtonsAfterFailure([applyBtn, insertBtn, rejectBtn], applyBtn, "\u2713 \uB2E4\uC2DC \uC801\uC6A9"),
          { actions }
        );
      };
      const runInsert = () => {
        openInsertPositionDialog(state.pipeline.length, (position) => {
          const result = insertLogic({ id: uid(), prompt: latestUserRequestForSafety(), code, description: desc, language }, position);
          applyBtn.disabled = true;
          insertBtn.disabled = true;
          rejectBtn.disabled = true;
          finalizeActionButtonFromResult(
            insertBtn,
            result,
            `${position}\uBC88\uC5D0 \uC0BD\uC785\uB428`,
            () => restoreActionButtonsAfterFailure([applyBtn, insertBtn, rejectBtn], insertBtn, "\u21B3 \uB2E4\uC2DC \uC0BD\uC785"),
            { actions }
          );
        });
      };
      applyBtn.onclick = () => {
        const validationContext = {
          ...(replyContext || {}),
          forceLabel: "\uAC15\uC81C\uB85C \uC801\uC6A9",
          onForceApply: runApply,
        };
        if (!validateAssistantCodeBeforeApply(code, validationContext)) return;
        runApply();
      };
      insertBtn.onclick = () => {
        const validationContext = {
          ...(replyContext || {}),
          forceLabel: "\uAC15\uC81C\uB85C \uC0BD\uC785",
          onForceApply: runInsert,
        };
        if (!validateAssistantCodeBeforeApply(code, validationContext)) return;
        runInsert();
      };
      rejectBtn.onclick = () => {
        applyBtn.disabled = true;
        insertBtn.disabled = true;
        rejectBtn.disabled = true;
        rejectBtn.textContent = "\uAC70\uC808\uB428";
      };
    }
  }
  $("chat-messages").appendChild(div);
  scrollChatToBottom();

  // 코드가 필요했는데 설명만/주석만 온 경우 자동 재생성(원본 응답은 위에 그대로 남긴다).
  if (replyContext && replyContext.sourceUserMessage) {
    const problems = assistantReplyCodeProblems(fullText, code);
    if (problems.length) {
      const attemptsSoFar = Number(replyContext.noCodeRegenAttempt || 0);
      if (attemptsSoFar < NO_CODE_MAX_REGEN) {
        autoRegenerateForMissingCode(fullText, problems, replyContext);
      } else {
        showCodeGuardBlock(
          "여러 번 다시 생성했지만 실행 가능한 코드를 받지 못했습니다:\n- " + problems.join("\n- ") +
            "\n요청을 더 구체적으로(대상 시트/열/값) 다시 보내 주세요.",
          {},
        );
      }
    }
  }
}

function createReasoningBox(text) {
  const box = document.createElement("div");
  box.className = "reasoning-box";
  const toggle = document.createElement("button");
  toggle.className = "reasoning-toggle";
  toggle.type = "button";
  toggle.textContent = "생각 펼치기";
  const content = document.createElement("div");
  content.className = "reasoning-content";
  content.textContent = text;
  toggle.onclick = () => {
    const open = box.classList.toggle("open");
    toggle.textContent = open ? "생각 접기" : "생각 펼치기";
    if (open) {
      scrollReasoningToBottom(content);
      scrollChatToBottom();
    }
  };
  box.appendChild(toggle);
  box.appendChild(content);
  return box;
}

function openInsertPositionDialog(currentCount, onConfirm) {
  const modal = $("modal");
  const maxPos = currentCount + 1;
  const defaultPos = Math.max(1, currentCount); // 보통 마지막 단계 직전이 가장 자주 쓰임
  modal.innerHTML = `
    <h3>몇 번째 단계에 삽입할까요?</h3>
    <p style="font-size:12px; color:#666; margin-bottom:10px">
      현재 파이프라인은 <b>${currentCount}</b> 단계입니다.<br>
      <b>1</b> ~ <b>${maxPos}</b> 사이의 숫자를 입력하세요. (1: 맨 앞, ${maxPos}: 맨 뒤)
    </p>
    <input type="number" id="insert-pos" min="1" max="${maxPos}" value="${defaultPos}" />
    <div class="row">
      <button class="btn-secondary" id="modal-cancel">취소</button>
      <button class="btn-primary" id="modal-confirm">삽입</button>
    </div>
  `;
  $("modal-bg").classList.add("show");
  setTimeout(() => { const el = $("insert-pos"); if (el) el.select(); }, 50);
  const close = () => $("modal-bg").classList.remove("show");
  $("modal-cancel").onclick = close;
  const confirm = () => {
    const v = parseInt($("insert-pos").value, 10);
    if (isNaN(v) || v < 1 || v > maxPos) {
      toast(`1 ~ ${maxPos} 사이의 숫자를 입력하세요`, "error");
      return;
    }
    close();
    onConfirm(v);
  };
  $("modal-confirm").onclick = confirm;
  $("insert-pos").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); confirm(); }
  });
}

function setupStreamingAssistantMessage(container, modeLabel, aiName, onStop, onStopThinking) {
  let initialized = false;
  let reasoningBox;
  let reasoningToggle;
  let reasoningContent;
  let stopBtn;
  let stopThinkBtn;
  let answerText;
  let codeBlock;
  let statusText;
  let answerRenderer;
  let reasoningRenderer;

  // #10: think 모드면 '생각 중단'(thinking 만 끊고 답변 받기) + '요청 중단'(전체 종료) 두 버튼,
  // 아니면 기존처럼 단일 '중단'.
  const stopButtonsHtml = () => {
    if (!onStop) return "";
    if (onStopThinking) {
      return '<span class="stream-stop-group">'
        + '<button class="stream-stop-think-btn" type="button">생각 중단</button>'
        + '<button class="stream-stop-btn" type="button">요청 중단</button></span>';
    }
    return '<button class="stream-stop-btn" type="button">중단</button>';
  };
  const wireStopButtons = () => {
    stopBtn = container.querySelector(".stream-stop-btn");
    stopThinkBtn = container.querySelector(".stream-stop-think-btn");
    if (stopBtn && onStop) {
      stopBtn.onclick = () => {
        stopBtn.disabled = true;
        stopBtn.textContent = "중단 중...";
        if (stopThinkBtn) stopThinkBtn.disabled = true;
        onStop();
      };
    }
    if (stopThinkBtn && onStopThinking) {
      stopThinkBtn.onclick = () => {
        stopThinkBtn.disabled = true;
        stopThinkBtn.textContent = "생각 중단 중...";
        onStopThinking();
      };
    }
  };

  container.classList.add("loading");
  container.innerHTML = `
    <div class="streaming-topbar">
      <span><span class="loader"></span> ${escapeHtml(modeLabel)}${escapeHtml(aiName)}에게 전송 중...</span>
      ${stopButtonsHtml()}
    </div>
  `;
  wireStopButtons();
  scrollChatToBottom();

  function initialize() {
    if (initialized) return;
    initialized = true;
    container.classList.remove("loading");
    container.innerHTML = `
      ${onStop ? '<div class="streaming-topbar"><span class="stream-status"></span>' + stopButtonsHtml() + '</div>' : ""}
      <div class="reasoning-box" hidden>
        <button class="reasoning-toggle" type="button">생각 펼치기</button>
        <div class="reasoning-content"></div>
      </div>
      <div class="assistant-stream">
        <div class="assistant-stream-text"></div>
        <pre class="code-block assistant-stream-code" hidden></pre>
      </div>
    `;
    reasoningBox = container.querySelector(".reasoning-box");
    reasoningToggle = container.querySelector(".reasoning-toggle");
    reasoningContent = container.querySelector(".reasoning-content");
    answerText = container.querySelector(".assistant-stream-text");
    codeBlock = container.querySelector(".assistant-stream-code");
    statusText = container.querySelector(".stream-status");
    if (statusText) statusText.textContent = `${modeLabel}${aiName} 응답 수신 중...`;
    wireStopButtons();
    answerRenderer = createSmoothStructuredRenderer(
      answerText,
      codeBlock,
      `${modeLabel}${aiName} 응답 수신 중...`,
    );
    reasoningRenderer = createSmoothTextRenderer(reasoningContent, "", () => {
      if (reasoningBox && reasoningBox.classList.contains("open")) {
        scrollReasoningToBottom(reasoningContent);
      }
      scrollChatToBottom();
    });

    reasoningToggle.onclick = () => {
      const open = reasoningBox.classList.toggle("open");
      reasoningToggle.textContent = open ? "생각 접기" : "생각 펼치기";
      if (open) {
        scrollReasoningToBottom(reasoningContent);
        scrollChatToBottom();
      }
    };
  }

  return {
    setAnswer(text) {
      initialize();
      answerRenderer.setTarget(text);
      scrollChatToBottom();
    },
    setReasoning(text) {
      if (!text) return;
      initialize();
      reasoningBox.hidden = false;
      reasoningRenderer.setTarget(text);
      if (!reasoningBox.classList.contains("open")) reasoningToggle.textContent = "생각 펼치기";
      if (reasoningBox.classList.contains("open")) scrollReasoningToBottom(reasoningContent);
      scrollChatToBottom();
    },
    setStatus(text) {
      initialize();
      if (statusText) statusText.textContent = text || "";
      scrollChatToBottom();
    },
    flush() {
      if (!initialized) initialize();
      answerRenderer.flush();
      reasoningRenderer.flush();
      if (reasoningBox && reasoningBox.classList.contains("open")) scrollReasoningToBottom(reasoningContent);
      if (stopBtn) stopBtn.remove();
      if (stopThinkBtn) stopThinkBtn.remove();
    },
    stopped() {
      if (stopBtn) {
        stopBtn.disabled = true;
        stopBtn.textContent = "중단됨";
      }
      if (stopThinkBtn) stopThinkBtn.remove();
    },
  };
}

function showThinkRetryPrompt(container, context) {
  context = context || {};
  const prompt = context.prompt || "";
  const editTargetId = context.editTargetId || null;
  const sourceUserMessage = context.sourceUserMessage || latestUserRequestForSafety();
  const modeLabel = context.modeLabel || "";
  const aiName = context.aiName || "LLM";
  const message = context.message || "Think 요청이 중단되었습니다.";
  const detail = context.detail || "Think 없이 다시 요청할 수 있습니다.";
  container.classList.remove("streaming", "loading");
  container.classList.add("think-retry");
  container.innerHTML = `
    <div>${escapeHtml(message)}</div>
    <div style="font-size:12px; color:#666; margin-top:4px">${escapeHtml(detail)}</div>
    <div class="action-btns" style="margin-top:8px">
      <button class="action-btn" type="button">Think 없이 재요청</button>
    </div>
  `;
  const retryBtn = container.querySelector("button");
  retryBtn.onclick = async () => {
    const abortController = new AbortController();
    const streamView = setupStreamingAssistantMessage(container, modeLabel, aiName, () => abortController.abort());
    container.classList.add("streaming");
    $("chat-send").disabled = true;
    try {
      const reply = await callLLM(prompt, {
        editTargetId,
        thinkMode: false,
        skipHistoryPush: true,
        signal: abortController.signal,
        onDelta: (delta, full) => {
          streamView.setAnswer(full);
          scrollChatToBottom();
        },
      });
      streamView.flush();
      container.remove();
      addAssistantReply(reply, { editTargetId, sourceUserMessage, reasoning: "" });
      scrollChatToBottom();
    } catch (err) {
      container.classList.remove("streaming", "loading");
      if (err && err.name === "AbortError") {
        streamView.stopped();
        container.textContent = "재요청을 중단했습니다.";
      } else {
        container.innerHTML = "재요청 실패: " + escapeHtml(err.message);
        container.classList.remove("assistant");
        container.classList.add("system", "error");
      }
      scrollChatToBottom();
    } finally {
      $("chat-send").disabled = false;
    }
  };
  // #10 '생각 중단': 버튼 클릭을 기다리지 않고 Think 없이 즉시 재요청.
  if (context.autoStart) retryBtn.click();
}

function createSmoothStructuredRenderer(textEl, codeEl, emptyText) {
  const textRenderer = createSmoothTextRenderer(textEl, emptyText, scrollChatToBottom);
  const codeRenderer = createSmoothTextRenderer(codeEl, "", () => {
    codeEl.scrollTop = codeEl.scrollHeight;
    scrollChatToBottom();
  });

  return {
    setTarget(text) {
      const parsed = splitStreamingReply(text);
      textRenderer.setTarget(parsed.text);
      codeEl.hidden = !parsed.hasCode;
      codeRenderer.setTarget(parsed.code);
    },
    flush() {
      textRenderer.flush();
      codeRenderer.flush();
    },
  };
}


// 키는 step id(없으면 코드 본문) — 복구 요청 횟수를 step 단위로 센다.
const PYTHON_RUNTIME_FAIL_VBA_THRESHOLD = 2;
const _pythonRuntimeFailCounts = new Map();

function _pythonRuntimeFailKey(step) {
  if (!step) return "";
  return String(step.id || "") || ("code:" + String(step.code || "").slice(0, 400));
}

function notePythonRuntimeFailure(step) {
  const key = _pythonRuntimeFailKey(step);
  if (!key) return 1;
  const next = (_pythonRuntimeFailCounts.get(key) || 0) + 1;
  _pythonRuntimeFailCounts.set(key, next);
  return next;
}

function clearPythonRuntimeFailures() {
  _pythonRuntimeFailCounts.clear();
}

function resolveErrorRecoveryStepIndex(stepIdx, errorInfo) {
  const hasIdentity = !!(errorInfo && (errorInfo.stepId || errorInfo.code));
  if (errorInfo && errorInfo.stepId) {
    const byId = state.pipeline.findIndex(step => step && step.id === errorInfo.stepId);
    if (byId >= 0) return byId;
  }
  if (errorInfo && errorInfo.code) {
    const byCode = state.pipeline.findIndex(step => step && step.code === errorInfo.code);
    if (byCode >= 0) return byCode;
  }
  if (hasIdentity) return -1;
  if (errorInfo && errorInfo.description) {
    const byDesc = state.pipeline.findIndex(step => step && step.description === errorInfo.description);
    if (byDesc >= 0) return byDesc;
  }
  const numeric = Number(stepIdx);
  if (Number.isInteger(numeric) && numeric >= 0 && state.pipeline[numeric]) return numeric;
  return -1;
}

async function requestErrorRecovery(stepIdx, errorInfo, userNote) {
  const recoveryNoteText = String(userNote || "").trim();
  const reportedStepIdx = Number((errorInfo && errorInfo.stepIdx) ?? stepIdx);
  stepIdx = resolveErrorRecoveryStepIndex(stepIdx, errorInfo);
  const displayStepNumber = Number.isInteger(reportedStepIdx) && reportedStepIdx >= 0
    ? reportedStepIdx + 1
    : (stepIdx >= 0 ? stepIdx + 1 : (state.pipeline || []).length + 1);
  let failedStep = stepIdx >= 0 ? (state.pipeline[stepIdx] || null) : null;
  if (!failedStep || !failedStep.code) {
    failedStep = failedStep || {
      id: errorInfo && errorInfo.stepId,
      description: errorInfo && errorInfo.description,
      code: errorInfo && errorInfo.code,
      language: errorInfo && errorInfo.language,
    };
  }
  const hasExplicitFailedTarget = !!(errorInfo && (
    Number(errorInfo.stepIdx) >= 0 ||
    errorInfo.stepId ||
    errorInfo.code ||
    errorInfo.description
  ));
  if (!failedStep || !failedStep.code) {
    // 특정 step을 못 짚었으면 적용 가능한 마지막 단계를 복구 대상으로 추정한다.
    if (!hasExplicitFailedTarget) {
      const enabledSteps = (state.pipeline || []).filter(s => s && s.enabled !== false && s.code);
      const guess = enabledSteps[enabledSteps.length - 1];
      if (guess) {
        failedStep = guess;
        stepIdx = state.pipeline.indexOf(guess);
      }
    }
  }
  if (!failedStep || !failedStep.code) {
    toast("복구에 사용할 스킬 코드를 찾지 못했습니다.", "error");
    return;
  }
  const isExistingStep = stepIdx >= 0 && state.pipeline[stepIdx] === failedStep;
  const recoveryLanguage = failedStep.language ||
    (typeof inferPipelineStepLanguage === "function" ? inferPipelineStepLanguage(failedStep) : "python");
  let isVbaRecovery = recoveryLanguage === "vba" || (typeof getSkillEngine === "function" && getSkillEngine() === "vba");
  let isPythonRecovery = !isVbaRecovery && recoveryLanguage === "python";
  // [0.5.2.2 §4.2] Python COM 런타임 실패가 같은 step 에서 누적되면(기본 2회) Python COM 기반
  // 자체의 제약으로 판단하고 이번 복구부터 VBA 전환 생성을 시도한다(전역 엔진 설정은 불변).
  let vbaRuntimeSwitch = false;
  if (isPythonRecovery) {
    const pythonFailCount = notePythonRuntimeFailure(failedStep);
    if (pythonFailCount >= PYTHON_RUNTIME_FAIL_VBA_THRESHOLD) {
      vbaRuntimeSwitch = true;
      isVbaRecovery = true;
      isPythonRecovery = false;
      toast(`Python 실행이 ${pythonFailCount}회 실패해 VBA 매크로로 전환해 복구를 시도합니다.`, "success");
    }
  }
  const recoveryCodeRule = isVbaRecovery
    ? "Return exactly one VBA code block that defines Sub B2BSkill(). Do not return JavaScript or Python."
    : (isPythonRecovery
      ? "Return exactly one Python code block that defines def transform(ctx):. Do not return JavaScript."
      : "Return exactly one JavaScript code block that defines function transform(inputs, output).");
  const useCompatibilityCheck = !!(errorInfo && errorInfo.compatibilityCheck);
  const sourceUserMessage = latestUserRequestForSafety();
  const schemaSummary = useCompatibilityCheck && typeof buildSchemaSummary === "function" ? buildSchemaSummary() : "";
  const recentHistory = useCompatibilityCheck ? (state.chatHistory || [])
    .slice(-8)
    .map(msg => {
      const role = msg && msg.role ? msg.role : "unknown";
      const content = msg && (msg.content || msg.text || msg.message) ? (msg.content || msg.text || msg.message) : "";
      return `${role}: ${String(content).slice(0, 1200)}`;
    })
    .filter(Boolean)
    .join("\n") : "";
  const compatibilityPrompt = useCompatibilityCheck && !isVbaRecovery ? [
    "",
    "## 복구 방식",
    "- 코드는 자동 교체하지 않습니다. 사용자가 '수정 적용' 버튼을 눌러 적용할 수 있도록 수정 후보만 제안하세요.",
    "- 실패한 Step 하나만 고치세요. 이전/다음 Step의 작업을 반복하거나 새 기능을 추가하지 마세요.",
    "- 먼저 호환성 검사를 수행한 뒤, 그 결과를 반영한 코드블록 하나를 작성하세요.",
    "",
    "## 실행기 호환성 검사 순서",
    "1. inputs[\"정확한_파일명.xlsx\"]처럼 파일명을 하드코딩해서 새 실행 파일명과 맞지 않는지 확인하세요.",
    "2. 날짜/월/버전/배치번호만 다른 파일이면 전체 파일명을 고정하지 말고 시트명/컬럼명 기준으로 찾으세요.",
    "3. 시트명이 기준이면 findInputBySheet(inputs, \"시트명\")을 사용하세요. 반환값은 {fileName, file, sheetName, sheet} 입니다.",
    "4. 컬럼은 고정 인덱스보다 col(sheet, \"컬럼명\")으로 다시 찾으세요.",
    "5. 회사명/월/날짜처럼 공백 차이가 날 수 있는 값은 equalsNormalizedText/includesNormalizedText/replaceNormalizedText를 사용하세요.",
    "6. 시트명이 여러 파일에 있을 수 있으면 사용자 의도와 현재 스키마를 기준으로 가장 맞는 파일을 선택하세요.",
    "",
    "## findInputBySheet 사용 예시",
    "```javascript",
    "const found = findInputBySheet(inputs, \"빈시트\");",
    "if (!found) return { inputs, output };",
    "const file = found.file;",
    "const sheet = found.sheet;",
    "```",
  ] : useCompatibilityCheck ? [
    "",
    "## 복구 방식",
    "- 코드는 자동 교체하지 않습니다. 사용자가 '수정 적용' 버튼을 눌러 적용할 수 있도록 수정 후보만 제안하세요.",
    "- 실패한 Step 하나만 고치세요. 이전/다음 Step의 작업을 반복하거나 새 기능을 추가하지 마세요.",
    "- 실패한 Step은 VBA입니다. 반드시 ActiveWorkbook/Workbooks(...).Worksheets(...) 기준의 VBA 코드로 복구하세요.",
  ] : [];

  const userNoteBlock = recoveryNoteText ? [
    "## ★ 사용자 추가 설명 — 최우선 반영",
    "아래는 사용자가 직접 적은 '하려던 작업 / 실제로 나온 결과 / 기대하는 결과'입니다. 다른 어떤 추론보다 이 설명을 가장 우선해서, 대화 히스토리·실패 코드·오류와 함께 반영해 코드를 고치세요.",
    recoveryNoteText,
    "",
  ] : [];

  const prompt = [
    ...(vbaRuntimeSwitch ? [
      "",
      "## Python → VBA 전환 (중요)",
      "아래 Python 스킬은 같은 작업에서 런타임 오류로 여러 번 실패했습니다. Python COM(ctx) 기반의 제약일 수 있으니, 이번에는 같은 작업을 수행하는 VBA 매크로(Sub B2BSkill())로 전환해 작성하세요.",
      "실패한 Python 코드를 그대로 번역하지 말고, 오류 원인을 피해 VBA 의 방식(헤더 이름으로 열 찾기, 실제 범위 한정, 벌크 배열 입출력)으로 다시 설계하세요.",
    ] : []),
    ...userNoteBlock,
    `Step ${displayStepNumber} 실행 중 오류가 발생했습니다.`,
    isExistingStep
      ? "대화 히스토리의 사용자 의도, 현재 파일 스키마, 수정 대상 코드, 아래 오류를 함께 분석해서 이 Step을 교체할 수정 코드를 다시 작성하세요."
      : "이 Step은 아직 파이프라인에 적용되지 못했습니다. 대화 히스토리의 사용자 의도, 현재 파일 스키마, 실패한 코드, 아래 오류를 함께 분석해서 적용 가능한 새 스킬 코드를 다시 작성하세요.",
    recoveryCodeRule,
    "오류 복구는 실패 원인만 고치는 작업입니다. 사용자의 최신 요청에 없는 수식 제거, 값 덮어쓰기, 대상 파일/시트 변경을 새로 추가하지 마세요.",
    "\"채워\", \"입력\", \"업데이트\", \"반영\"은 수식 제거 지시가 아닙니다. 수식 셀을 값으로 바꾸는 코드는 사용자가 명시적으로 수식 제거/값 대체를 요청했을 때만 작성하세요.",
    ...compatibilityPrompt,
    recoveryCodeRule,
    "",
    "## 실패한 Step",
    `설명: ${failedStep.description || ""}`,
    "",
    "## 실패한 코드",
    "```" + (vbaRuntimeSwitch ? "python" : (isVbaRecovery ? "vba" : (isPythonRecovery ? "python" : "javascript"))),
    failedStep.code || "",
    "```",
    "",
    "## 상세 오류",
    `메시지: ${(errorInfo && errorInfo.message) || ""}`,
    errorInfo && errorInfo.stack ? `\n스택:\n${errorInfo.stack}` : "",
    recentHistory ? "\n## 최근 대화/사용자 의도\n" + recentHistory : "",
    schemaSummary ? "\n## 현재 업로드 파일/시트/컬럼 스키마\n" + schemaSummary : "",
  ].filter(Boolean).join("\n");

  addMessage("system", `Step ${displayStepNumber} 에러 복구를 요청합니다.${recoveryNoteText ? "\n📝 추가 설명: " + recoveryNoteText : ""}`);
  const loading = addMessage("assistant", "", {});
  loading.classList.add("streaming");

  const aiName = settings.provider === "openai-compat" ? "ixi 모델" : "LLM";
  const thinkMode = typeof isThinkModeEnabled === "function" && isThinkModeEnabled();
  const abortController = new AbortController();
  const streamView = setupStreamingAssistantMessage(loading, "(에러 복구) ", aiName, () => abortController.abort());
  $("chat-send").disabled = true;
  let reasoningText = "";

  try {
    const requestOptions = {
      // [0.5.2.2] VBA 전환 복구는 이 호출 1회만 VBA 시스템 프롬프트를 쓴다(전역 엔진 설정 불변).
      forceEngine: vbaRuntimeSwitch ? "vba" : undefined,
      editTargetId: isExistingStep ? failedStep.id : null,
      thinkMode,
      signal: abortController.signal,
      onDelta: (delta, full) => {
        streamView.setAnswer(full);
        scrollChatToBottom();
      },
      onReconnect: (attempt, maxAttempts) => {
        streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${attempt}/${maxAttempts})`);
        scrollChatToBottom();
      },
    };
    if (thinkMode) {
      requestOptions.onReasoningDelta = (delta, full) => {
        reasoningText = full;
        streamView.setReasoning(full);
        scrollChatToBottom();
      };
      requestOptions.onReasoningWarning = () => {
        const warning = "정확한 동작을 위해 생각이 길어지고 있습니다. 다만, 같은 말을 여러 번 반복할 경우 중단해주세요.";
        streamView.setStatus(warning);
        toast(warning, "success");
      };
    }
    const reply = await callLLM(prompt, requestOptions);
    streamView.flush();
    loading.remove();
    addAssistantReply(reply, {
      editTargetId: isExistingStep ? failedStep.id : null,
      sourceUserMessage,
      reasoning: reasoningText,
    });
    scrollChatToBottom();
  } catch (err) {
    loading.classList.remove("streaming");
    loading.classList.remove("loading");
    if (err && err.name === "AbortError" && thinkMode) {
      showThinkRetryPrompt(loading, {
        prompt,
        editTargetId: isExistingStep ? failedStep.id : null,
        sourceUserMessage,
        modeLabel: "(에러 복구) ",
        aiName,
        message: "Think 요청을 중단했습니다.",
        detail: "필요하면 Think 없이 같은 복구 요청을 다시 보낼 수 있습니다.",
      });
      scrollChatToBottom();
      return;
    }
    if (err && err.name === "AbortError") {
      streamView.stopped();
      loading.textContent = "에러 복구 요청이 중단되었습니다.";
    } else {
      loading.innerHTML = "복구 요청 실패: " + escapeHtml(err.message);
      loading.classList.remove("assistant");
      loading.classList.add("system", "error");
    }
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
  }
}

function splitStreamingReply(text) {
  const value = String(text || "");
  const fenceStart = value.indexOf("```");
  if (fenceStart < 0) {
    return { text: value, code: "", hasCode: false };
  }

  const before = value.slice(0, fenceStart).trim();
  let rest = value.slice(fenceStart + 3);
  rest = rest.replace(/^(javascript|js)\s*\n/i, "");
  const fenceEnd = rest.indexOf("```");
  const code = fenceEnd >= 0 ? rest.slice(0, fenceEnd).trimEnd() : rest;
  const after = fenceEnd >= 0 ? rest.slice(fenceEnd + 3).trim() : "";
  return {
    text: [before, after].filter(Boolean).join("\n\n") || "코드 작성 중...",
    code,
    hasCode: true,
  };
}

function createSmoothTextRenderer(el, emptyText, onRender) {
  let target = "";
  let shown = "";
  let rafId = null;
  let lastTs = performance.now();

  function render(ts) {
    rafId = null;
    if (!target) {
      shown = "";
      el.textContent = emptyText || "";
      if (onRender) onRender();
      return;
    }
    const elapsed = lastTs ? Math.max(0, ts - lastTs) : 16;
    lastTs = ts;
    const remaining = target.length - shown.length;
    if (remaining <= 0) {
      schedule();
      return;
    }
    const charsPerFrame = getSmoothCharsPerFrame(remaining, elapsed);
    shown = target.slice(0, shown.length + Math.min(remaining, charsPerFrame));
    el.textContent = shown;
    if (onRender) onRender();
    schedule();
  }

  function schedule() {
    if (rafId === null) rafId = requestAnimationFrame(render);
  }

  return {
    setTarget(text) {
      target = String(text || "");
      if (!target) {
        shown = "";
        el.textContent = emptyText || "";
        if (onRender) onRender();
        return;
      }
      if (!target.startsWith(shown)) shown = "";
      schedule();
    },
    flush() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      shown = target;
      el.textContent = target || emptyText || "";
      if (onRender) onRender();
    },
  };
}

function getSmoothCharsPerFrame(remaining, elapsed) {
  if (remaining > 240) return Math.max(3, Math.min(12, Math.ceil(elapsed / 8)));
  if (remaining > 80) return Math.max(2, Math.min(6, Math.ceil(elapsed / 12)));
  return 1;
}

async function sendChat() {
  const input = $("chat-text");
  const msg = input.value.trim();
  if (!msg) return;
  if (!state.output && state.inputs.length === 0) { toast("입력 또는 출력 파일을 먼저 업로드하세요", "error"); return; }
  // [#5] 인플라이트 락: 처리 중에는 버튼 클릭/Enter 재입력을 막아 같은 요청 중복 전송을 방지.
  // (top 체크 ~ 첫 await 사이는 모두 동기 코드라 재진입이 끼어들 수 없음. 해제는 finally 단일 지점.)
  if (window.__b2bChatInFlight) { toast("이전 요청을 처리 중입니다. 잠시 후 다시 시도하세요.", "error"); return; }
  window.__b2bChatInFlight = true;
  // 전송 시점의 수정 대상 step을 캡처해두면, 이후 사용자가 수정 모드를 토글해도 응답 버튼은 올바른 step을 가리킨다.
  const editTargetId = state.editingStepId || null;
  // [B2B#5 진단] 한 번의 전송에 고유 id 부여. 같은 id 로 응답이 2번 렌더되면 표시측 중복,
  // 서로 다른 id 가 한 사용자 동작에서 2개 나오면 전송측 중복. llm-api 의 재전송 로그와 대조.
  const reqId = (window.__b2bChatReqSeq = (window.__b2bChatReqSeq || 0) + 1);
  console.debug(`[B2B#5] req#${reqId} sendChat 시작 (editTarget=${editTargetId || "none"})`);
  input.value = "";
  const userMsgDiv = addMessage("user", msg);
  scrollChatToBottom(true); // 전송 직후에는 위로 스크롤돼 있었어도 바닥으로
  clearViewerDragSelection();
  const loading = addMessage("assistant", "", {});
  loading.classList.add("streaming");
  // 외부 노출 시엔 내부 모델명을 표시하지 않고 LLM 으로 통일
  const aiName = settings.provider === "openai-compat" ? "ixi 모델" : "LLM";
  const modeLabel = editTargetId ? "(수정 모드) " : "";
  const thinkMode = typeof isThinkModeEnabled === "function" && isThinkModeEnabled();
  const abortController = new AbortController();
  let stopThinkingRequested = false;
  const streamView = setupStreamingAssistantMessage(
    loading, modeLabel, aiName,
    () => abortController.abort(),                                   // 요청 중단: 전체 종료
    thinkMode ? () => { stopThinkingRequested = true; abortController.abort(); } : null  // 생각 중단: think만 끊고 답변
  );
  $("chat-send").disabled = true;
  let reasoningText = "";
  let prompt = "";
  try {
    prompt = typeof augmentUserPromptWithMentions === "function"
      ? augmentUserPromptWithMentions(msg)
      : msg;
    const requestOptions = {
      editTargetId,
      reqId,
      thinkMode,
      signal: abortController.signal,
      onDelta: (delta, full) => {
        streamView.setAnswer(full);
        scrollChatToBottom();
      },
      onReconnect: (attempt, maxAttempts) => {
        streamView.setAnswer(`ixi 연결이 끊겨 재연결 중입니다. (${attempt}/${maxAttempts})`);
        scrollChatToBottom();
      },
    };
    if (thinkMode) {
      requestOptions.onReasoningDelta = (delta, full) => {
        reasoningText = full;
        streamView.setReasoning(full);
        scrollChatToBottom();
      };
      requestOptions.onReasoningWarning = () => {
        const warning = "정확한 동작을 위해 생각이 길어지고 있습니다. 다만, 같은 말을 여러 번 반복할 경우 중단해주세요.";
        streamView.setStatus(warning);
        toast(warning, "success");
      };
    }
    const reply = await callLLM(prompt, requestOptions);
    streamView.flush();
    loading.remove();
    addAssistantReply(reply, { editTargetId, sourceUserMessage: msg, reasoning: reasoningText });
    bindChatHistoryEntryToMessage(userMsgDiv, "user", msg);
    console.debug(`[B2B#5] req#${reqId} addAssistantReply 렌더 (reply length=${reply ? reply.length : 0})`);
    scrollChatToBottom();
  } catch (err) {
    loading.classList.remove("streaming");
    loading.classList.remove("loading");
    if (err && err.name === "AbortError" && thinkMode && stopThinkingRequested) {
      // '생각 중단': thinking 을 끊고 Think 없이 같은 요청으로 답변을 자동 재요청.
      showThinkRetryPrompt(loading, {
        prompt,
        editTargetId,
        sourceUserMessage: msg,
        modeLabel,
        aiName,
        autoStart: true,
        message: "생각을 중단하고 답변을 생성합니다…",
        detail: "Think 없이 같은 요청으로 다시 보냅니다.",
      });
      scrollChatToBottom();
      return;
    }
    if (err && err.name === "AbortError") {
      // '요청 중단'(또는 think 아님): 전체 종료.
      streamView.stopped();
      loading.textContent = "요청이 중단되었습니다.";
    } else {
      loading.innerHTML = "❌ " + escapeHtml(err.message);
      loading.classList.remove("assistant");
      loading.classList.add("system");
    }
    scrollChatToBottom();
  } finally {
    $("chat-send").disabled = false;
    window.__b2bChatInFlight = false;   // [#5] 락 해제는 항상 여기서(완료/오류/중단 공통)
  }
}

$("chat-send").onclick = sendChat;
$("chat-text").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    if (typeof isMentionMenuOpen === "function" && isMentionMenuOpen()) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    sendChat();
  }
});

// ---- 스킬 설계창 도구: 대화 영역 확대/축소 + 대화 기억 비우기 ----
(function setupChatPanelTools() {
  const expandBtn = $("chat-expand-toggle");
  if (expandBtn) {
    expandBtn.onclick = (e) => {
      e.stopPropagation(); // panel-head 의 접기/펼치기 토글로 번지지 않게
      const section = document.getElementById("panel-chat-section");
      if (!section) return;
      const expanded = section.classList.toggle("chat-expanded");
      const messages = $("chat-messages");
      if (messages) messages.style.height = ""; // 수동 리사이즈(inline 높이) 초기화 → 클래스 높이 적용
      expandBtn.textContent = expanded ? "⤡ 축소" : "⤢ 확대";
      scrollChatToBottom(true);
    };
  }
  const clearBtn = $("chat-clear-history");
  if (clearBtn) {
    clearBtn.onclick = async (e) => {
      e.stopPropagation();
      // 미러(항상-위 네이티브 Excel 창)가 모달을 덮거나 클릭을 가로채지 않게 먼저 숨긴다.
      try { if (typeof hideAllExcelMirrorWindows === "function") await hideAllExcelMirrorWindows(); } catch (_) {}
      const confirmed = typeof openB2bConfirmModal === "function"
        ? await openB2bConfirmModal("대화 기억을 모두 비울까요?" + String.fromCharCode(10) + "(적용된 스킬 파이프라인과 파일은 그대로 유지됩니다)", { okLabel: "비우기" })
        : confirm("대화 기억을 모두 비울까요?");
      if (!confirmed) {
        try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(0); } catch (_) {}
        return;
      }
      state.chatHistory = [];
      _boundChatHistIds.clear();
      // 새 세션처럼: 런타임 실패 카운터도 함께 리셋(이전 작업의 VBA 전환 누적이 새 대화에 안 넘어가게).
      if (typeof clearPythonRuntimeFailures === "function") clearPythonRuntimeFailures();
      const container = $("chat-messages");
      if (container) {
        // cleared-marker: refreshChatState 의 '단일 system 메시지' 재초기화 조건과 구분(덮어쓰기 방지).
        container.innerHTML = `<div class="msg system cleared-marker">대화 기억을 비웠습니다. 새 요청은 이전 대화의 영향을 받지 않습니다.</div>`;
      }
      if (typeof toast === "function") toast("대화 기억을 비웠습니다.", "success");
      try { if (typeof scheduleRestoreActiveExcelMirror === "function") scheduleRestoreActiveExcelMirror(120); } catch (_) {}
    };
  }
})();
