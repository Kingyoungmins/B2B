// [제보 2026-08-31] 녹화로 만든 스킬에서 on/off 를 눌렀을 때 난 두 가지.
//
//  (3) "on/off 눌렀는데 처음부터 전체실행하더라"
//      실측 로그: client.pipeline.run.toggle_off route="reconcile_no_signature"
//      → OFF 는 '그 단계 직전으로만 되돌리는' 빠른 경로가 있는데, 쓰려면 '라이브에 무엇까지
//        들어갔나'(서명)가 필요하다. 녹화 스텝 추가의 빠른 재현 경로가 그 서명을 안 남겨
//        서명이 비었고 → 안전한 쪽(리셋 후 전체 재적용)으로 떨어졌다.
//        (폴백 전체실행 경로는 runIsolatedLivePipelineSteps 안에서 이미 남긴다 — 여기만 빠졌다)
//
//  (4) "마지막을 off 했다 다시 on 했더니 '적용됨'인데 엑셀엔 없다"
//      실측 로그: toggle_on.route activeExcelId=input_원가… / 스텝 코드는
//                Windows("output_청구서_템플릿.xlsx").Activate … "테스트"
//      → 적용은 제대로 됐고 화면이 다른 파일을 보고 있었다. 녹화 종료에는 착지를 맞추는
//        코드가 있는데(record-land) on/off 에는 없었다.
//
// 덤: toggle_off 의 sigNull 이 '판정 뒤'에 측정돼, 원인을 정반대로 읽게 만들었다.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const NL = String.fromCharCode(10);
const SRC = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 240) : "")); }
}

/* 소스에서 '단계 켜기' 성공 블록만 떼어 실제로 돌린다(문자열 매칭이 아니라 동작 확인). */
function runToggleOnTail({ stepTarget, currentFileId, headless }) {
  const seen = { view: null, shown: null, toasts: [], traces: [] };
  const i = SRC.indexOf('    _syncPipelineToggleStatus();       // 나머지 스텝 상태칩도 스위치에 맞춤');
  if (i < 0) throw new Error("켜기 성공 블록을 못 찾음");
  const j = SRC.indexOf("  } catch (err) {", i);
  const body = SRC.slice(i, j);
  const env = {
    state: { pipeline: [{ id: "rec", code: "x", enabled: true }], currentFileId },
    currentIdx: 0, stepId: "rec",
    excelMirror: { runnerHeadless: !!headless },
    inferPipelineStepTargetFileId: () => stepTarget,
    getFile: (id) => (id === stepTarget ? { name: "output_청구서_템플릿.xlsx" } : null),
    setCurrentView: (fid, o) => { seen.view = [fid, o && o.source]; },
    excelIdForPipelineFileId: async () => "ex-out",
    showOnlyExcelMirrorWindow: async (xid) => { seen.shown = xid; },
    traceClientUiEvent: (e, f) => seen.traces.push([e, f]),
    toast: (m) => seen.toasts.push(String(m)),
    _syncPipelineToggleStatus: () => {},
    refreshRunButton: () => {},
    isStepEnabled: () => true,
    console,
  };
  const names = Object.keys(env);
  const fn = new Function(...names, "return (async () => {" + NL + body + NL + "})();");
  return fn(...names.map(k => env[k])).then(() => seen);
}

(async () => {
  console.log("[4] 단계를 켜면 화면이 '그 단계가 고친 파일'로 따라간다");
  {
    const s = await runToggleOnTail({ stepTarget: "input:output_청구서_템플릿.xlsx",
                                      currentFileId: "input:input_원가_2026_4월.xlsx" });
    check("탭을 대상 파일로 옮긴다",
      !!s.view && s.view[0] === "input:output_청구서_템플릿.xlsx", s.view);
    check("옮긴 이유를 남긴다(source)", s.view && s.view[1] === "toggle-on-land", s.view);
    check("그 파일의 Excel 창을 띄운다", s.shown === "ex-out", s.shown);
    check("어느 파일이 바뀌었는지 문구로도 말한다",
      s.toasts.some(m => m.includes("output_청구서_템플릿.xlsx") && m.includes("바뀌었습니다")), s.toasts);
    const land = s.traces.find(x => x[0] === "pipeline.toggle_on.land");
    check("어디서 어디로 옮겼는지 로그에 남는다",
      !!land && land[1].movedTo === "input:output_청구서_템플릿.xlsx", land);
  }

  console.log("[4-b] 이미 그 파일을 보고 있으면 화면을 흔들지 않는다");
  {
    const s = await runToggleOnTail({ stepTarget: "input:같은파일.xlsx",
                                      currentFileId: "input:같은파일.xlsx" });
    check("탭 전환 없음", s.view === null, s.view);
    check("창 재표시 없음", s.shown === null, s.shown);
    check("문구는 종전대로", s.toasts.some(m => /적용했습니다\.$/.test(m)), s.toasts);
  }

  console.log("[4-c] 실행기 헤드리스는 건드리지 않는다(창을 일부러 숨기는 화면)");
  {
    const s = await runToggleOnTail({ stepTarget: "input:다른파일.xlsx",
                                      currentFileId: "input:현재.xlsx", headless: true });
    check("탭·창을 건드리지 않는다", s.view === null && s.shown === null, s);
    check("그래도 적용 문구는 뜬다", s.toasts.length === 1, s.toasts);
  }

  console.log("[3] 녹화 스텝 추가가 '라이브 서명'을 남긴다");
  check("빠른 재현 성공 시 서명을 기록한다",
    /_allPriorApplied && typeof noteLivePipelineApplied === "function"[\s\S]{0,80}noteLivePipelineApplied\(state\.pipeline\)/.test(SRC));
  check("기존 켜진 스텝이 전부 '적용됨'일 때만 (라이브에 없는 걸 굳히지 않게)",
    /_priorEnabled\.every\([\s\S]{0,140}status === "applied"/.test(SRC));
  check("기록 여부를 로그로 남긴다", /"record\.append_replay\.signature"/.test(SRC));
  check("폴백 경로는 종전대로(중복 기록 안 함)",
    /noteLivePipelineApplied\(sourceSteps\)/.test(SRC));

  console.log("[진단] 경로 판정 근거를 '판정 시점'에 찍는다");
  check("판정 시점 값을 따로 잡는다", /const _sigNullAtDecision = _lastLiveAppliedSignature === null;/.test(SRC));
  check("traceOff 가 그 값을 쓴다", /sigNull: _sigNullAtDecision,/.test(SRC));
  check("호출 시점에 다시 읽지 않는다",
    !/sigNull: _lastLiveAppliedSignature === null/.test(SRC));

  console.log("");
  console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " FAIL");
  process.exit(fails === 0 ? 0 : 1);
})();
