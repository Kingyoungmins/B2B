// [대시보드 차트 2026-08-31] dashboard.html 의 집계·차트 생성 함수 검증.
//
// dashboard.html 은 <script id="dash-core">(DOM 없이 도는 순수 함수)와 boot(DOM 조작)로
// 나뉘어 있다 — 이 테스트는 core 블록을 그대로 잘라 node 로 실행한다. 브라우저 없이도
// "세션 행 → 히트맵/버전 도입률/오류 추이" 가 맞게 계산되는지 못 박는 것이 목적.
// (실측 배경: 차트 라이브러리를 CDN 으로 못 쓰는 보안망이라 전부 손으로 그린다 —
//  손으로 그린 만큼 계산이 조용히 틀어질 수 있어 계산 부분을 테스트로 잡아 둔다)
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let fails = 0;
function check(name, cond, detail) {
  console.log((cond ? "  PASS  " : "  FAIL  ") + name
    + (!cond && detail !== undefined ? "  -> " + String(JSON.stringify(detail)).slice(0, 220) : ""));
  if (!cond) fails++;
}

const html = fs.readFileSync(path.join(__dirname, "..", "dashboard.html"), "utf8");

console.log("[0] core 블록을 추출해 node 로 실행");
const m = html.match(/<script id="dash-core">([\s\S]*?)<\/script>/);
check("dash-core 블록이 있다", !!m);
const sandbox = { module: { exports: {} } };
sandbox.exports = sandbox.module.exports;
vm.createContext(sandbox);
new vm.Script(m[1]).runInContext(sandbox);   // 문법 오류면 여기서 던진다
const C = sandbox.module.exports;
check("순수 함수가 전부 내보내진다", ["heatmap", "versionByDate", "errorTrend", "sparkPath",
  "comboHTML", "usersHTML", "heatmapHTML", "versionsHTML", "errorTrendHTML",
  "langHTML", "stepIdxHTML", "durationsHTML"].every(k => typeof C[k] === "function"),
  Object.keys(C));

console.log("");
console.log("[1] 세션 행 → 히트맵 (stats 엔 없는 시간대 축을 세션의 startedAt 에서 만든다)");
// 2026-08-31 은 월요일 09시 — 요일 인덱스는 로컬 기준이라 Date 로 역산해 비교한다
const sessions = [
  { date: "2026-08-31", user: "kim", appVersion: "0.8.2.0", startedAt: "2026-08-31T09:10:00" },
  { date: "2026-08-31", user: "kim", appVersion: "0.8.2.0", startedAt: "2026-08-31T09:40:00" },
  { date: "2026-08-31", user: "lee", appVersion: "0.8.1.0", startedAt: "2026-08-31T14:00:00" },
  { date: "2026-09-01", user: "lee", appVersion: "0.8.2.0", startedAt: "2026-09-01T09:05:00" },
  { date: "2026-09-01", user: "bad", appVersion: "0.8.2.0", startedAt: "" },   // 시각 없음 — 무시돼야
];
const hm = C.heatmap(sessions);
const d0 = new Date("2026-08-31T09:10:00");
check("같은 요일·같은 시엔 2회가 쌓인다", hm.cells[d0.getDay()][9] === 2, hm.cells[d0.getDay()]);
check("최대값", hm.max === 2, hm.max);
check("시각 없는 행은 조용히 무시", hm.cells.flat().reduce((a, b) => a + b, 0) === 4);

console.log("");
console.log("[2] 세션 행 → 버전 도입률 (stats 에 버전 축이 없어 직접 만든다)");
const vd = C.versionByDate(sessions);
check("날짜 축 정렬", JSON.stringify(vd.dates) === JSON.stringify(["2026-08-31", "2026-09-01"]), vd.dates);
check("버전 축", vd.versions.includes("0.8.2.0") && vd.versions.includes("0.8.1.0"), vd.versions);
check("행렬 값", vd.matrix["0.8.2.0"][0] === 2 && vd.matrix["0.8.1.0"][0] === 1
  && vd.matrix["0.8.2.0"][1] === 2, vd.matrix);

console.log("");
console.log("[3] 오류 추이 — 전량 집계(events)가 있으면 그걸, 없으면 목록에서 근사");
const fromEvents = C.errorTrend([{ date: "2026-08-31", count: 5 }], [{ date: "2026-08-30" }]);
check("events 우선", fromEvents.length === 1 && fromEvents[0].count === 5, fromEvents);
const fromList = C.errorTrend(null, [{ date: "2026-08-30" }, { date: "2026-08-30" }, { ts: "2026-08-31T01:00:00" }]);
check("목록 근사(날짜 그룹)", JSON.stringify(fromList)
  === JSON.stringify([{ date: "2026-08-30", count: 2 }, { date: "2026-08-31", count: 1 }]), fromList);

console.log("");
console.log("[4] 선 그래프 path — 값이 좌표로 바뀌는지");
const p = C.sparkPath([0, 50, 100], 100, 50, 0);
check("M 로 시작해 점 수만큼 L", /^M0\.0,50\.0 L50\.0,25\.0 L100\.0,0\.0$/.test(p), p);
check("빈 값이면 빈 문자열", C.sparkPath([], 100, 50) === "");
check("한 점이어도 안 죽는다", C.sparkPath([3], 100, 50).startsWith("M"));

console.log("");
console.log("[5] 차트 HTML — 클릭 필터 속성과 위험 문자 이스케이프");
const combo = C.comboHTML([{ date: "2026-08-31", sessions: 3, dwellMinutes: 10 }], "");
check("날짜 막대에 필터 속성", combo.includes('data-filter-date="2026-08-31"'), combo.slice(0, 200));
const users = C.usersHTML([{ user: '<img src=x onerror=alert(1)>', sessions: 2, dwellMinutes: 5 }], "");
check("사용자 막대에 필터 속성", users.includes("data-filter-user="));
check("사용자명이 이스케이프된다(XSS)", !users.includes("<img") && users.includes("&lt;img"), users.slice(0, 240));
check("선택된 사용자는 active 표시",
  C.usersHTML([{ user: "kim", sessions: 1, dwellMinutes: 0 }], "kim").includes("active"));
const vh = C.versionsHTML(vd);
check("버전 누적 막대 + 범례", vh.includes("stackrow") && vh.includes("0.8.1.0"));
const et = C.errorTrendHTML([{ date: "2026-08-31", count: 2 }], false);
check("구버전 서버면 과소집계 경고를 단다", et.includes("과소집계"), et.slice(-160));
check("전량 스캔이면 경고 없음", !C.errorTrendHTML([{ date: "2026-08-31", count: 2 }], true).includes("과소집계"));

console.log("");
console.log("[6] 분석 구역(events API) 렌더러");
const lang = C.langHTML([{ language: "vba", runs: 4, ok: 3, error: 1, avgMs: 120 },
                         { language: "python", runs: 2, ok: 2, error: 0, avgMs: 350 }]);
check("언어별 성공률이 계산된다", lang.includes("성공 75.0%") && lang.includes("성공 100.0%"), lang.slice(0, 260));
const idx = C.stepIdxHTML([{ stepIdx: 0, runs: 10, error: 1 }, { stepIdx: 1, runs: 10, error: 4 }]);
check("stepIdx 는 사람 눈높이(1단계부터)", idx.includes("1단계") && idx.includes("2단계"));
check("실패율 20%↑ 는 빨간 막대", idx.includes('fil err'));
const dur = C.durationsHTML([{ event: "excel.save.snapshot", count: 5, avgMs: 90000, totalMs: 450000 }]);
check("소요시간을 사람 단위로(1.5분)", dur.includes("1.5분"), dur);
check("빈 데이터는 빈 안내", C.langHTML([]).includes("empty"));

console.log("");
console.log("[7] 배선 — 프록시 화이트리스트와 boot 코드");
const proxy = fs.readFileSync(path.join(__dirname, "..", "log_dash.py"), "utf8");
check("log_dash 가 events 를 허용", /ALLOWED_PATHS = \([^)]*"events"/.test(proxy));
check("boot 가 events 실패를 접는다(구버전 서버에서도 화면 유지)",
  html.includes('catch (_e) { events = null; }') && html.includes("collector.py 를 2026-08-31"));
check("표 정렬이 붙는다", html.includes("makeSortable"));
check("교차 필터 위임 리스너", html.includes('closest("[data-filter-user]")')
  && html.includes('closest("[data-filter-date]")'));
check("세션을 2000행까지 받는다(클라 집계 상한)", html.includes("sessions?limit=2000"));
check("오류 목록도 1000건까지", html.includes("limit=1000"));

console.log("");
console.log(fails ? "RESULT: " + fails + " FAIL" : "RESULT: ALL PASS");
process.exit(fails ? 1 : 0);
