// [제보 묶음 2026-08-20] 같은 날 들어온 5+1건 제보의 수정을 한 파일로 재확인한다.
//  (1) 16단계 스킬: 생성기(라이브)에선 W열이 채워졌는데 전체실행기 결과는 W열이 빈칸(오류 없음).
//      → ① 실행기/격리 파이프라인에 스텝별 재계산이 없어(라이브 경로 19064와 비대칭) 값 읽기 스텝이
//        미계산 수식을 읽었고, ② LLM 이 '기존 값 보존'을 자기 셀 참조 수식(=IF(W3<>"",W3,…))으로
//        흉내 내 순환참조로 값이 조용히 사라졌다.
//  (2) SBAGENT-273: 마지막 스킬 적용 직후 우측 엑셀뷰가 회색으로 덮임 — 탭 전환으로도 안 돌아오고
//      단계 OFF→ON 으로만 복구. → 단일 적용 경로(prehide=hide-all)에 재표시가 없었다.
//  (3) 키보드 입력이 한 박자 늦고 마지막 글자가 좌상단 IME 조합창에 남음 — 타이핑 중 백그라운드
//      창 raise/포커스 조작이 조합을 깼다.
//  (4)(5) 스킬 삭제/토글 직후 엑셀 창이 우측 정렬을 벗어나 튀어나오고, 탭 클릭/크기 조정을 해야 복귀
//      — replace 직후 새 SDI 프레임의 hwnd 해석이 늦으면 파킹이 통째로 건너뛰어졌다.
//  (6) SBAGENT-274: '특정 값만 별도 시트로 복사'가 서식(음영 등)이 다 깨진 채 복사됨
//      — filter_to_sheet 가 값만 기록했다. 네이티브 행 복사(서식 보존)로 교체.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const py = fs.readFileSync(path.join(ROOT, "serve_b2b.py"), "utf8").replace(/^﻿/, "");
const pjs = fs.readFileSync(path.join(ROOT, "scripts", "pipeline.js"), "utf8").replace(/^﻿/, "");
const em = fs.readFileSync(path.join(ROOT, "scripts", "excel-mirror.js"), "utf8").replace(/^﻿/, "");
const fsch = fs.readFileSync(path.join(ROOT, "scripts", "file-schema.js"), "utf8").replace(/^﻿/, "");

let fails = 0;
function check(name, cond, detail) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (detail !== undefined ? "  → " + String(detail).slice(0, 200) : "")); }
}

console.log("[1] 실행기 = 라이브 패리티 — 스텝별 재계산");
check("전체실행 루프가 스텝마다 재계산한다(fullrun.step.ok 직전)",
  /_safe_excel_calculate\(fapp\)\s*\n\s*_vba_trace\("fullrun\.step\.ok"/.test(py));
check("격리 파이프라인 루프도 스텝마다 재계산한다(pipeline.step.ok 직전)",
  /_safe_excel_calculate\(fapp\)\s*\n\s*_vba_trace\(\s*\n\s*"pipeline\.step\.ok"/.test(py));
check("라이브 워커 경로의 기존 재계산은 그대로", /_safe_excel_calculate\(app\)/.test(py));

console.log("[2] 자기 셀 참조(순환) 수식 가드 — write_formulas 가 쓰기 전에 거부");
check("검사 함수가 있다", /def _self_referencing_formula_cells\(data, row0, col0\):/.test(py));
check("write_formulas 가 쓰기 전에 검사한다",
  /_bad = _self_referencing_formula_cells\(data, int\(anchor\.Row\), int\(anchor\.Column\)\)/.test(py));
check("거부 메시지가 원인과 대안(read_formulas 로 읽어 되돌려 쓰기)을 말한다",
  /자기 자신을 참조하는 수식을 쓰려고 했습니다/.test(py) && /ctx\.read_formulas 로 현재 상태/.test(py));
// [2026-08-24 속도 수정] 리터럴 제거는 그대로지만 미리 컴파일해 재사용한다(셀마다 재컴파일 제거).
check("문자열 리터럴 속 우연한 주소는 제거 후 검사",
  /_lit = re\.compile\(r'"\[\^"\]\*"'\)/.test(py) && /_lit\.sub\('""', body\)/.test(py));
check("정규식을 열마다 한 번만 컴파일한다(3만 셀 재컴파일 → 1573ms 로 느려지던 회귀 방지)",
  /_pat_cache/.test(py) && /_pat_cache\[col_txt\] = rx/.test(py));

// [행동 검증] 소스에 배포된 '바로 그 패턴 템플릿'을 꺼내 JS 정규식으로 같은 케이스를 돌린다
// (파이썬 lookbehind/lookahead 문법이 JS 와 동일해 1:1 로 검증 가능).
{
  // 열마다 한 번 컴파일하고 '참조된 행 번호'를 캡처해 비교하는 형태(2026-08-24 속도 수정 후).
  const m = py.match(/re\.compile\(r"(\(\?<!\[[^"]+?)" \+ re\.escape\(col_txt\) \+ r"(\\\$\?)\(\\d\+\)(\(\?!\[[^"]+?\))"\)/);
  check("패턴 템플릿을 소스에서 추출했다", !!m, "re.compile(r\"...\") 형태를 찾지 못함");
  if (m) {
    const mk = (col) => new RegExp(m[1] + col.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + m[2] + "(\\d+)" + m[3], "g");
    const strip = s => s.replace(/"[^"]*"/g, '""');
    // 소스와 같은 판정 — 캡처한 행 번호가 '이 셀의 행'과 같을 때만 자기참조.
    const hit = (formula, col, row) => {
      const rx = mk(col); const scan = strip(formula);
      let mm; while ((mm = rx.exec(scan))) { if (mm[1] === String(row)) return true; }
      return false;
    };
    check("자기 셀 참조를 잡는다: W3 에 =IF(W3<>\"\",W3,…)", hit('=IF(W3<>"", W3, IF(H3="국제", V3*1.0, ""))', "W", "3"));
    check("절대참조 자기 셀도 잡는다: W3 에 =$W$3+1", hit('=$W$3+1', "W", "3"));
    check("다른 열 참조는 통과: W3 에 =IF(OR(...K3...),V3*1.2,\"\")", !hit('=IF(OR(ISNUMBER(SEARCH("1대역", K3))), V3*1.2, "")', "W", "3"));
    check("같은 열 다른 행(누계)은 통과: W3 에 =W2+V3", !hit('=W2+V3', "W", "3"));
    check("시트 한정 참조는 통과: W3 에 =Sheet2!W3", !hit('=Sheet2!W3', "W", "3"));
    check("이웃 열 오인 없음: W3 에 =AW3", !hit('=AW3', "W", "3"));
    check("행 번호 접두 오인 없음: W3 에 =W31", !hit('=W31', "W", "3"));
    check("범위 참조는 보수적으로 통과: W3 에 =SUM(W3:W10)", !hit('=SUM(W3:W10)', "W", "3"));
    check("문자열 리터럴 속 주소는 통과: W3 에 =\"주의 W3 셀\"", !hit('="주의 W3 셀"', "W", "3"));
  }
  // 가능하면 실제 파이썬 함수도 실행해 본다(파이썬이 없으면 조용히 건너뜀 — 위 JS 검증이 본검사).
  try {
    const script = [
      "import re, io, sys",
      "src = io.open(r'" + path.join(ROOT, "serve_b2b.py").replace(/\\/g, "\\\\") + "', encoding='utf-8').read()",
      "def grab(name):",
      "    i = src.index('def ' + name + '(')",
      "    j = src.index('\\ndef ', i + 1)",
      "    return src[i:j]",
      "ns = {'re': re}",
      "exec(grab('_col_letter'), ns)",
      "exec(grab('_self_referencing_formula_cells'), ns)",
      "f = ns['_self_referencing_formula_cells']",
      "bad = f([['=IF(W3<>\"\", W3, \"\")'], ['=IF(H4=\"a\", S4, \"\")']], 3, 23)",
      "ok = f([['=K3*1.2'], ['=W3+1']], 3, 23)",   // 두 번째는 W4 에 들어가는 W3 참조 → 다른 행이라 통과
      "print('HIT' if bad == ['W3'] and ok == [] else 'MISS', bad, ok)",
    ].join("\n");
    const candidates = [process.env.B2B_TEST_PYTHON, "python", "python3"].filter(Boolean);
    let ran = false;
    for (const exe of candidates) {
      const r = spawnSync(exe, ["-c", script], { encoding: "utf8", timeout: 30000 });
      if (r.status === 0 && /HIT|MISS/.test(String(r.stdout))) {
        check("실제 파이썬 함수 행동 검증(자기셀만 잡고 나머지 통과)", /^HIT/.test(String(r.stdout).trim()), r.stdout);
        ran = true;
        break;
      }
    }
    if (!ran) console.log("  SKIP  실제 파이썬 실행(파이썬 없음/스텁) — 패턴 템플릿 JS 검증으로 대체됨");
  } catch (_) {
    console.log("  SKIP  실제 파이썬 실행 불가 — 패턴 템플릿 JS 검증으로 대체됨");
  }
}

console.log("[3] SBAGENT-273 — 단일 적용(수정/켜기/삽입) 후 회색 엑셀뷰");
check("단일 적용 성공 후 미러를 강제 재표시하고 탭도 착지시킨다(비격리)",
  /await showOnlyExcelMirrorWindow\(excelId, \{ force: true \}\);[\s\S]{0,300}?landAppTabOnExcelSession\(excelId\);[\s\S]{0,200}?\} else if \(typeof scheduleRestoreActiveExcelMirror/.test(pjs.replace(/\r/g, "")));
check("격리(VBA/교차파일) 단일 적용은 예약 복원으로 되살린다",
  /scheduleRestoreActiveExcelMirror\(180, \{ restoreExcelId: excelId \}\)/.test(pjs));
check("적용 실패 시에도 예약 복원을 건다(오류 화면 뒤 회색 방지)",
  /scheduleRestoreActiveExcelMirror\(300, \{ restoreExcelId: excelId \}\)/.test(pjs));
check("표시 경로: 숨김(SW_HIDE) 프레임도 전체 배치로 복구",
  /not win32gui\.IsWindowVisible\(target_hwnd\):[\s\S]{0,400}?do_position = True/.test(py));
check("표시 경로: 배치 후 z-순서 raise(파킹이 HWND_BOTTOM 으로 내려놓은 것 복구)",
  /viewport_width=viewport_width, viewport_height=viewport_height,\s*show=True,\s*\)[\s\S]{0,400}?_raise_excel_hwnd\(target_hwnd\)[\s\S]{0,80}?else:/.test(py.replace(/\r/g, "")));

console.log("[4] 정렬 이탈 — replace 직후 새 프레임 파킹 보장");
check("프레임 hwnd 해석을 짧게 재시도한다(저사양 SDI 생성 지연)",
  /\[정렬 이탈 2026-08-20\][\s\S]{0,700}time\.sleep\(0\.2\)\s*\n\s*_new_frame_hwnd = _workbook_window_hwnd\(new_wb\)/.test(py));

console.log("[5] 입력 지연/IME — 타이핑 중 창 조작 억제");
check("타이핑/조합 이벤트로 가드 시각을 갱신한다",
  /excelMirror\.typingGuardUntil = Date\.now\(\) \+ 1000/.test(em)
  && /compositionstart/.test(em) && /compositionupdate/.test(em));
check("raise 가 타이핑 가드 중엔 건너뛴다",
  /if \(!options\.force && Date\.now\(\) < \(excelMirror\.typingGuardUntil \|\| 0\)\) return false;/.test(em));
check("텍스트 입력 focusin 은 오버레이 복원을 발동하지 않는다",
  /event\.type === "focusin" && isTextEditableEventTarget\(target\)\) return;/.test(em));
check("서버 raise/position 이 최소화 복원 시 활성화를 동반하지 않는다(SW_RESTORE 호출 제거)",
  /def _raise_excel_hwnd/.test(py)
  && /SW_SHOWNOACTIVATE", 4\)\)/.test(py)
  && !/ShowWindow\(hwnd, getattr\(win32con, "SW_RESTORE"/.test(py));

console.log("[6] SBAGENT-274 — filter_to_sheet 서식 보존 복사");
check("매칭 행을 연속 구간으로 압축한다", /def _row_runs\(nums\):/.test(py));
check("네이티브 행 복사로 옮긴다(값+서식 보존)", /rng\.Copy\(dest_ws\.Cells\(int\(out_row\), 1\)\)/.test(py));
check("열 너비도 보존한다(xlPasteColumnWidths)", /dest_ws\.Range\("A1"\)\.PasteSpecial\(8\)/.test(py));
check("상대참조 수식 왜곡은 읽어 둔 값으로 덮어 정합", /읽어 둔 계산 값으로 내용만 한 번 덮어써/.test(py));
check("복사 실패/과분산 매칭은 예전 값-기록 폴백(결과 보장)",
  /copied_native = False\s+# 복사 실패\(보호\/병합 등\)/.test(py) && /len\(all_runs\) <= 1500/.test(py));
check("코드젠 가이드가 '서식 보존됨'을 알려 VBA 우회를 막는다",
  /원본 행을 네이티브 복사로 옮겨 서식\(음영·테두리·표시형식·열너비\)이 그대로 보존됩니다/.test(fsch));
check("확정 실패한 VBA 스텝은 적용 직전 사본으로 라이브를 되돌린다(잔류물이 나중에 증발하는 착시 방지)",
  /!mayHaveApplied && liveLang !== "python" && _preSnap && _preSnap\.resultId/.test(pjs)
  && /실패한 단계의 변경을 되돌리는 중\.\.\./.test(pjs));
check("타임아웃(성공 가능) 스텝은 되돌리지 않는 기존 보존 규칙 유지",
  /mayHaveApplied && appendToPipeline/.test(pjs) && /step-timeout-preserved/.test(pjs));
check("'확인 필요'(review+켜짐) 스텝의 X 삭제도 라이브를 직전 사본으로 되돌린다(시트 잔류 방지)",
  /_removedStatus === "applied"\s*\n\s*\|\| \(_removedStatus === "review" && isStepEnabled\(removedStep\)\)/.test(pjs.replace(/\r/g, "")));

console.log("[8] SBAGENT-275 — 저장 대화상자 투명+전면 프리즈(응답 없는 창에 AttachThreadInput)");
{
  const nh = fs.readFileSync(path.join(ROOT, "native_host", "NativeHost.cs"), "utf8");
  check("IsHungAppWindow P/Invoke 가 선언돼 있다", /IsHungAppWindow\(IntPtr hWnd\)/.test(nh));
  check("ForceHostForeground 가 멈춘 창에는 붙지 않는다",
    /fgThread != 0 && fgThread != thisThread && !IsHungAppWindow\(fg\)/.test(nh));
  check("FocusWindow 도 멈춘 창에는 붙지 않는다",
    /targetThread != 0 && targetThread != currentThread && !IsHungAppWindow\(hwnd\)/.test(nh));
  check("서버 _focus_excel_grid_child 도 멈춘 창에는 붙지 않는다",
    /if user32\.IsHungAppWindow\(int\(best\)\):\s*\n\s*target_thread = 0/.test(py.replace(/\r/g, "")));
  check("서버 _handoff_foreground_to_host(hide-all 경유)도 멈춘 창에는 붙지 않는다",
    /if user32\.IsHungAppWindow\(fg\):\s*\n\s*fg_thread = 0/.test(py.replace(/\r/g, "")));
  check("동기 SendMessage/SwitchToThisWindow 등 행 유발 API 미사용(호스트·서버)",
    !/SwitchToThisWindow/.test(nh) && !/\bSendMessage\(/.test(nh)
    && !/win32gui\.SendMessage\(/.test(py));
}

console.log("[9] '특정 값만 남기고 삭제' — 제자리 삭제 헬퍼(임시시트 재구성으로 서식 깨지는 우회 차단)");
check("ctx.delete_rows_where 가 있다(조건 행 제자리 삭제)", /def delete_rows_where\(self, sheet, predicate, header_rows=1\):/.test(py));
check("아래→위 + 다중영역 일괄 삭제(행번호 밀림·COM 왕복 폭주 방지)",
  /runs\.reverse\(\)[\s\S]{0,600}?rng\.Delete\(\)/.test(py.replace(/\r/g, "")));
check("구조 변경 마커를 남긴다", /delete_rows_where:\{sheet\}\(-\{len\(doomed\)\}\)/.test(py));
// [2026-08-25] '조건 행 삭제' 문구가 규칙에 합류하며 문장이 확장됨("…지워줘"뿐 아니라 …도) —
// 잠그려는 계약(둘 다 delete_rows_where + 재구성 금지)은 그대로, 고정 문구만 새 문장에 맞춘다.
check("코드젠 가이드: 특정 값만 남기기는 delete_rows_where, 임시시트 재구성 금지",
  /특정 값인 행만 남기고 나머지 삭제해줘 \/ X 아닌 행은 지워줘"[\s\S]{0,120}반드시 이걸 쓰세요/.test(fsch)
  && /임시 시트에 복사했다가 다시 붙이는 재구성은 음영·표시형식\(선행 0 포함\)이 통째로 깨집니다/.test(fsch));
check("도구 선택표에도 매핑이 있다", /특정 값 행만 남기고 나머지 삭제\(제자리, 서식 보존\) \| ctx\.delete_rows_where/.test(fsch));

console.log("[7] 부분 갱신 보존 가이드 정합(16단계 사고 재발 방지)");
check("보존 예시가 read_formulas(수식 포함 읽기)를 쓴다",
  /cur = ctx\.read_formulas\(sheet, f"W3:W\{last\}"\)/.test(fsch));
check("자기 셀 참조로 보존을 흉내 내지 말라고 명시(실행기가 거부함을 안내)",
  /자기 셀을 참조하는 수식으로 보존을 흉내 내지 마세요/.test(fsch) && /실행기가 쓰기 자체를 거부합니다/.test(fsch));

console.log("");
console.log(fails === 0 ? "RESULT: ALL PASS" : `RESULT: ${fails} FAIL`);
process.exit(fails === 0 ? 0 : 1);
