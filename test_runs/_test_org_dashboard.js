// [0.8.3 조직 정보 — 대시보드] 조직(팀) 열·필터가 실제로 배선됐는지.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "dashboard.html"), "utf8");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 필터 바 — 조직/팀 셀렉트");
check("f-org 셀렉트 존재", HTML.includes('id="f-org"'));
check("변경 즉시 재조회", HTML.includes('$("f-org").onchange = load'));
check("필터 칩(해제 UI)", HTML.includes('"조직: " + $("f-org").value'));

console.log("[2] 세션 표 — 조직(팀) 열");
check("머리글에 조직(팀)", /<th>사용자<\/th><th>조직\(팀\)<\/th>/.test(HTML));
check("셀에 팀 표시 + 마우스오버로 전체 경로", HTML.includes('title="${esc(s.orgPath || "")}"')
  && HTML.includes('${esc(s.team || "-")}'));
check("빈 행 colspan 11 로 갱신", HTML.includes('colspan="11"'));

console.log("[3] 데이터 배선");
check("세션 필터에 소속 적용(sessionInOrg)", HTML.includes("sessionInOrg(s, orgv)"));
check("옵션은 세션의 팀 목록으로 채움", HTML.includes("function fillOrgs")
  && HTML.includes("r.team"));
check("구버전 세션(팀 없음)도 그대로 그림('-' 표시)", HTML.includes('s.team || "-"'));

console.log("[4] 이름(마당아이디) 표기");
check("라벨 헬퍼", HTML.includes("function userLabel") && HTML.includes('o.displayName + "(" + o.madangId + ")"'));
check("세션 표 사용자 셀에 적용(원계정은 호버)",
  HTML.includes('title="${esc(s.user)}') && HTML.includes("${esc(userLabel(s.user))}</td>"));
check("사용자 표에도 적용", HTML.includes('title="${esc(r.user)}">${esc(userLabel(r.user))}'));
check("오류 표에도 적용", HTML.includes('title="${esc(e.user)}') && HTML.includes("${esc(userLabel(e.user))}</td>"));
check("사용자 랭킹 차트에도 적용", HTML.includes("C.usersHTML(stats.byUsers || [], activeUser, userLabel)"));
check("사용자 셀렉트 라벨에도 적용", HTML.includes('${esc(userLabel(r.user))}</option>'));

console.log("[5] 소속별 필터 — 전 계층");
check("orgPath 모든 단위로 옵션 구성(회사 제외)", HTML.includes('if (i === 0) return;'));
check("깊이 들여쓰기", HTML.includes('repeat(depth - 1)'));
check("어느 계층이든 매칭(sessionInOrg)", HTML.includes('split(" > ").includes(unit)'));

console.log("[6] 추가 요소");
check("팀별 사용 랭킹 차트", HTML.includes('chartBox("팀별 사용"') && HTML.includes("function teamRankHTML"));
check("팀 막대 클릭=소속 필터", HTML.includes('data-filter-org'));
check("구버전 사용 카드(허용 목록 대조)", HTML.includes("구버전 사용") && HTML.includes("function outdatedUsers"));
check("게이트 정보 없으면 카드 생략", HTML.includes("...(outdated ? ["));
check("세션 표 구버전 버전 강조", HTML.includes("허용 버전 목록에 없는 버전"));

console.log("[7] 대시보드 UI 강화");
check("고정 헤더 + 마지막 갱신", HTML.includes("position: sticky") && HTML.includes('id="last-updated"'));
check("자동 새로고침(60초)", HTML.includes('id="auto-refresh"') && HTML.includes("setInterval(load, 60000)"));
check("수동 갱신 버튼(0.8.4)", HTML.includes('id="btn-refresh"') && HTML.includes('onclick="load()"'));
check("카드 증감 배지(직전 기간 대비)", HTML.includes("function deltaBadge") && HTML.includes('title="직전 같은 기간 대비"'));
check("카드 톤(정상/주의/위험)", HTML.includes("tone-ok") && HTML.includes("tone-warn") && HTML.includes("tone-bad"));
check("신규 사용자 카드", HTML.includes("function newUsersIn") && HTML.includes("신규 사용자"));
check("오류율 카드", HTML.includes("오류율"));
check("체류 시간 분포 차트", HTML.includes("function dwellDistHTML") && HTML.includes('chartBox("체류 시간 분포"'));
check("자주 나는 오류 TOP 차트", HTML.includes("function topErrorsHTML") && HTML.includes("자주 나는 오류 TOP"));

console.log("[8] AI에게 묻기");
check("질문 입력/버튼", HTML.includes('id="ask-input"') && HTML.includes("askDashboard()"));
check("프리셋 질문 칩", (HTML.match(/class="ask-chip"/g) || []).length >= 3);
check("요약본 생성기(buildDashDigest)", HTML.includes("function buildDashDigest"));
check("요약본 크기 상한", HTML.includes("text.length > 9000"));
check("앱과 같은 AI 설정 재사용", HTML.includes('localStorage.getItem("mvno_llm_settings_v4")'));
check("데이터만 근거로 답하라는 계약", HTML.includes("데이터에 없는 것은 추측하지 말고"));
check("스냅샷 없으면 조회 먼저 안내", HTML.includes("먼저 [조회] 로 데이터를 불러와 주세요"));
check("think 태그 제거(원문 노출 방지)", HTML.includes("<think>[\s\S]*?<\/think>") || /replace\(\/<think>/.test(HTML));

console.log("[10] 토큰 사용량");
check("토큰 카드", HTML.includes("토큰 사용") && HTML.includes("function fmtTok"));
check("사용자별 토큰 차트", HTML.includes("function tokenUsersHTML") && HTML.includes('chartBox("사용자별 토큰"'));
check("팀별 토큰 차트(조직 맵 결합)", HTML.includes("function tokenTeamsHTML") && HTML.includes('chartBox("팀별 토큰"'));
check("모델별 토큰 차트", HTML.includes("function tokenModelsHTML") && HTML.includes('chartBox("모델별 토큰"'));
check("입력/출력 분리 표기", HTML.includes("입 ") && HTML.includes("/출 "));
check("구서버(토큰 없음)면 안내 문구", (HTML.match(/0\.8\.3\+ 앱부터 수집/g) || []).length >= 3);
check("AI 질문 요약본에 토큰 포함", HTML.includes("토큰사용:"));
check("전체실행 카드(0.8.4)", HTML.includes("전체실행") && HTML.includes("ex.fullRuns"));
check("AI 질문 요약본에 전체실행 포함", HTML.includes("전체실행: d.fullRuns"));
{
  const i = HTML.indexOf("function fmtTok");
  const j = HTML.indexOf("/* 사용자별 토큰 TOP", i);
  const fmtTok = new Function(HTML.slice(i, j) + "\nreturn fmtTok;")();
  check("표기 — 1.2M/340k/950", fmtTok(1234567) === "1.2M" && fmtTok(340000) === "340k"
    && fmtTok(950) === "950" && fmtTok(0) === "0", [fmtTok(1234567), fmtTok(340000)].join(","));
}

console.log("[9] 요약본 내용(기능 실행)");
{
  // buildDashDigest 를 실제로 돌려 요약 구조를 확인 — DOM 없이 도는 순수 함수다
  const i = HTML.indexOf("function buildDashDigest");
  const j = HTML.indexOf("/* 앱 채팅과 같은 AI 설정", i);
  const fn = new Function("userLabel", "userOrgMap",
    HTML.slice(i, j) + "\nreturn buildDashDigest;")(u => u, {});
  const digest = JSON.parse(fn({
    from: "2026-09-01", to: "2026-09-02", user: "", org: "",
    total: { sessions: 5, userCount: 2, dwellMinutes: 100, skills: 3 }, errCount: 1,
    prevTotal: { sessions: 2, userCount: 1, dwellMinutes: 40, errCount: 0 },
    byDate: [{ date: "2026-09-02", sessions: 5, dwellMinutes: 100 }],
    byUsers: [{ user: "u1", sessions: 5, dwellMinutes: 100 }],
    sessions: [{ user: "u1", team: "A팀", appVersion: "0.8.3.0" }],
    errors: [{ event: "step.fail", summary: "요약", ts: "t", user: "u1" }],
    outdated: { count: 0, names: [] }, newUsers: { count: 1, names: ["u1"] },
  }));
  check("기간·요약·팀별·오류종류·직전기간이 담긴다",
    digest["조회기간"] && digest["요약"]["총실행"] === 5
    && digest["팀별"][0]["팀"] === "A팀" && digest["오류종류"][0]["이벤트"] === "step.fail"
    && digest["직전기간"]["총실행"] === 2, JSON.stringify(digest).slice(0, 150));
}

console.log("");
console.log("[11] 세션 상세 펼침(로그 파일·스킬 단계) — 0.8.4");
check("로그/스킬 셀이 펼침 토글(sess-expand + 좌표 데이터)",
  HTML.includes('class="num sess-expand"') && HTML.includes('data-session="${esc(s.sessionId)}"'));
check("클릭 위임 → toggleSessionDetail",
  HTML.includes('closest("td.sess-expand")') && HTML.includes("toggleSessionDetail(td)"));
check("상세 API 호출 + 세션별 캐시",
  HTML.includes('api("session/detail?date="') && HTML.includes("sessDetailCache[key]"));
check("개별 파일 다운로드 링크(kind=logs/skills)",
  HTML.includes("/api/logdash/session/file?date=") && HTML.includes('fileUrl("logs", f.name)')
  && HTML.includes('fileUrl("skills", sk.name)'));
check("스킬 단계 수·켜짐 수·단계 목록 렌더",
  HTML.includes('"단계, 켜짐 "') && HTML.includes("sk.stepTitles.map"));
check("구버전 수집 서버 안내(하위 호환 실패 메시지)", HTML.includes("collector.py 갱신 필요"));
check("프록시 허용 경로에 session/detail·session/file 포함",
  (() => { const ld = fs.readFileSync(path.join(ROOT, "log_dash.py"), "utf8");
           return ld.includes('"session/detail"') && ld.includes('"session/file"'); })());

console.log("[12] 페이지 나눔(10줄) + 행 클릭 필터 매핑 — 0.8.4");
check("쪽 크기 10", HTML.includes("const PAGE_SIZE = 10;"));
check("네 표 모두 렌더 후 페이지 적용",
  HTML.includes('["tbl-users", "tbl-dates", "tbl-sessions", "tbl-errors"].forEach(paginate);'));
check("보던 쪽 유지 + 줄이 줄면 마지막 쪽으로 당김(클램프)",
  HTML.includes("if (st.page >= pages) st.page = pages - 1;"));
check("상세 행은 부모 행 표시를 따라간다",
  HTML.includes('dr.style.display = (parent && parent.style.display !== "none") ? "" : "none";'));
check("정렬 시 고아 상세 행 정리 + 현재 쪽 재적용",
  HTML.includes("정렬로 부모와 떨어지는 상세 행 정리") && HTML.includes("if (pagers[tbl.id]) paginate(tbl.id);"));
check("페이저 정보(건수·쪽)", HTML.includes('"건 · " + (st.page + 1) + "/" + pages + "쪽</span>"'));
check("사용자별 행 클릭=그 사용자 필터(data-filter-user, 활성 행 표시)",
  HTML.includes('class="row-click${r.user === activeUser ? " row-active" : ""}" data-filter-user="${esc(r.user)}"'));
check("일별 행 클릭=시작·종료일을 그 날로(data-filter-date)",
  HTML.includes('class="row-click${r.date === activeDate ? " row-active" : ""}" data-filter-date="${esc(r.date)}"'));
check("실행 목록 날짜·사용자 셀 역방향 매핑",
  HTML.includes('class="cell-link" data-filter-date="${esc(s.date)}"')
  && HTML.includes('class="cell-link" data-filter-user="${esc(s.user)}"'));
check("오류 목록 사용자 셀도 매핑", HTML.includes('class="cell-link" data-filter-user="${esc(e.user)}"'));
check("행 클릭이 기존 교차 필터 핸들러로 흐른다(같은 토글 규칙)",
  HTML.includes('ev.target.closest("[data-filter-user]")') && HTML.includes('ev.target.closest("[data-filter-date]")'));

console.log("[13] 토큰 추이 + 필터 중 사용자 셀렉트 유지 — 0.8.4");
check("토큰 추이 차트(일별, 입력/출력 쌓은 막대)",
  HTML.includes("function tokenTrendHTML(byDate)") && HTML.includes('chartBox("토큰 추이"')
  && HTML.includes("events.tokens && events.tokens.byDate"));
check("막대 클릭=그 날로 필터(data-filter-date)",
  /tokenTrendHTML[\s\S]{0,500}data-filter-date/.test(HTML));
check("입력·출력 색 구분 + 범례",
  HTML.includes(".bar.tok-in") && HTML.includes(".bar.tok-out") && /tok-out[\s\S]{0,900}범례|<i style="background:#f0a34d"><\/i>출력/.test(HTML));
check("사용자 필터 중엔 셀렉트 전체 목록 유지",
  HTML.includes('if (!$("f-user").value) fillUsers(stats.byUsers || [], true);'));

console.log("[14] 스킬 TOP·CSV·필터 URL·요약 복사 — 0.8.4");
check("스킬 TOP 차트(skillFiles 이름 집계, 저장 횟수·사람 수)",
  HTML.includes("function skillTopHTML(sessions)") && HTML.includes('chartBox("스킬 TOP"'));
check("CSV 내보내기 — 4개 표 버튼 + BOM(한글 엑셀) + 상세·빈 행 제외",
  (HTML.match(/exportCSV\('tbl-/g) || []).length === 4
  && HTML.includes('"\\uFEFF"') && /exportCSV[\s\S]{0,600}sess-detail/.test(HTML));
check("필터 URL 저장(해시) — 갱신 시 기록 + 시작 시 복원",
  HTML.includes("history.replaceState") && HTML.includes("initFromHash")
  && HTML.includes('hp.get("from")'));
check("복원 시 임시 옵션 생성(옵션 목록이 아직 빈 셀렉트)",
  HTML.includes("sel.add(new Option(v, v))"));
check("보고용 요약 복사 버튼 + 클립보드 폴백",
  HTML.includes('id="btn-report"') && HTML.includes("function copyReport(btn)")
  && HTML.includes("function fallbackCopy(text, done)"));
check("요약이 직전 기간 증감까지 사람 말로",
  HTML.includes('" → 증가"') && HTML.includes('"[AX-Cell 사용 현황] "'));

console.log("[15] 요약 복사 — 실제 실행(문자열 스냅샷 버그 회귀)");
(async () => {
check("digest 원본 객체 보관(__dashDigest) — 반환은 AI용 문자열이라 별도 보관 필수",
  HTML.includes("window.__dashDigest = digest;"));
check("copyReport 는 객체(__dashDigest)를 읽는다", HTML.includes("const d = window.__dashDigest;"));
{
  const i0 = HTML.indexOf("function copyReport(btn)");
  const i1 = HTML.indexOf("/* [토큰 추이 2026-09-03]");
  const SRC = HTML.slice(i0, i1);
  let copied = null; const toasts = [];
  const env = {
    window: { __dashDigest: {
      조회기간: "2026-08-27 ~ 2026-09-02",
      필터: { 사용자: "전체", 소속: "전체" },
      요약: { 총실행: 42, 사용자수: 8, 총체류분: 310, 스킬저장: 12, 오류건수: 3 },
      직전기간: { 총실행: 30, 사용자수: 7, 총체류분: 200, 오류건수: 7 },
      토큰사용: { 총: 1200000, 입력: 980000, 출력: 220000, 호출: 154 },
      전체실행: { 횟수: 4, 성공: 3, 실패: 1 },
      사용자TOP: [{ 사용자: "서영민(s0min)", 실행: 15 }],
      오류종류: [{ 이벤트: "step.fail", 건수: 2 }],
      신규사용자: ["김신규(knew1)"], 구버전사용: [],
    } },
    navigator: { clipboard: { writeText: t => { copied = t; return Promise.resolve(); } } },
    fmtTok: n => String(n), toast: (m) => toasts.push(m),
    setTimeout: () => 0, document: { createElement: () => ({ style: {} }) },
  };
  const run = new Function(...Object.keys(env), SRC + "\nreturn copyReport;")(...Object.values(env));
  run({ textContent: "복사" });
  await Promise.resolve();
  check("복사 텍스트에 기간이 들어간다(undefined 아님)",
    copied && copied.includes("[AX-Cell 사용 현황] 2026-08-27 ~ 2026-09-02") && !copied.includes("undefined"), copied);
  check("실행·직전 기간 증감이 사람 말로",
    copied && copied.includes("실행 42회 (직전 기간 30 → 증가)"), copied);
  check("토큰·전체실행·TOP·잦은 오류 포함",
    copied && copied.includes("토큰 1200000") && copied.includes("전체실행 4회")
    && copied.includes("서영민(s0min)(15회)") && copied.includes("step.fail 2건"), copied);
  copied = null;
  env.window.__dashDigest = null;
  const run2 = new Function(...Object.keys(env), SRC + "\nreturn copyReport;")(...Object.values(env));
  run2({ textContent: "복사" });
  check("조회 전엔 안내 토스트(무반응 금지)", toasts.some(m => String(m).includes("먼저 [조회]")), toasts);
}
console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
})();

