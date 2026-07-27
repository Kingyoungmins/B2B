"""ixi-Cell-R CLI 진입점.

  info   <skill.icr>                     스킬 요약 (COM 불필요)
  record [files...] --out s.icr          엑셀 행동 녹화 → 정제 → 저장 (Excel 필요)
  replay <skill.icr> [--delta N]         스킬 재현 (Excel 필요)

폐쇄망/저사양: COM 의존 명령은 win32com 을 지연 import 한다.
"""
from __future__ import annotations

import argparse
import sys

from .distiller import distill
from .model.skill import Skill
from .skillstore import load, save


def _cmd_info(args) -> int:
    skill, raw = load(args.path)
    print(f"스킬: {skill.name}  (schema={skill.schema}, version={skill.version}, engine={skill.engine})")
    print(f"anchor_period: {skill.anchor_period}   params: {[p.name for p in skill.params]}")
    print(f"스텝 {len(skill.steps)}개 (활성 {len(skill.enabled_steps())}), 원시 액션 {len(raw)}개")
    for s in skill.steps:
        flag = " " if s.enabled else "x"
        print(f"  [{flag}] {s.id} {s.kind:12s} {s.description}")
    return 0


def _cmd_export_eval_eca(args) -> int:
    from .skillstore.eval_eca_export import export
    skill, _ = load(args.path)
    out = export(skill, args.out, name=args.name)
    print(f"📤 eval_eca 형식으로 내보냄: {out}  (eval_eca 의 '스킬 불러오기'로 로드)")
    print("   주의: 채우기/글꼴/테두리 등 일부 서식은 eval_eca ctx 로 옮길 수 없습니다.")
    return 0


def _open_excel():
    import win32com.client  # 지연 import (폐쇄망 빌드에서 선택)
    app = win32com.client.Dispatch("Excel.Application")
    app.Visible = True
    return app


def _cmd_record(args) -> int:
    import pythoncom
    import win32com.client

    from .recorder.com_events import AppEvents, pump_until_closed
    from .recorder.sink import ActionSink
    from .workbooks.registry import WorkbookRegistry

    pythoncom.CoInitialize()
    app = _open_excel()
    registry = WorkbookRegistry()
    sink = ActionSink()

    for f in args.files:
        try:
            registry.register(app.Workbooks.Open(f))
        except Exception as e:
            print(f"[열기 실패] {f}: {e}")
    for wb in app.Workbooks:
        registry.register(wb)

    handler = win32com.client.WithEvents(app, AppEvents)
    handler.sink = sink
    handler.registry = registry
    handler.begin(app)

    print("🤖 녹화 중 — 엑셀에서 작업하세요. 엑셀 종료 또는 Ctrl+C 로 정지.")
    pump_until_closed(app)

    handler.flush_dirty_formats(app)  # 남은 증분 서식 마지막 1회
    handler.resolve_deferred(app)  # 큰 붙여넣기 deferred 값 채우기
    handler.capture_sort_diffs(app)  # 재정렬 자동 캡처(버튼 없이)
    handler.capture_filter_diffs(app)  # 자동필터 자동 캡처(버튼 없이)
    handler.capture_dimension_diffs(app)  # 열너비/행높이 자동 캡처
    handler.capture_format_diffs(app)  # 서식 시작/정지 diff 자동 반영
    # 객체/속성은 서식 뒤에 — 피벗 출력 셀/서식 정리가 그 뒤라야 동작
    handler.capture_object_diffs(app)  # 이름·메모·표·틀고정·그룹·유효성·조건부서식·차트·피벗·시트복사
    handler.reconcile()  # 시트 최종 이름 보정
    steps = distill(sink.actions)
    skill = Skill(name=args.name, steps=steps, anchor_period=args.anchor)
    save(skill, args.out, raw_actions=sink.actions)
    print(f"\n💾 저장: {args.out}  (스텝 {len(steps)}개 / 원시 {len(sink.actions)}개)")
    pythoncom.CoUninitialize()
    return 0


def _cmd_replay(args) -> int:
    import pythoncom

    from .parametrize.apply import apply_delta, resolve_skill
    from .replay.engine import replay
    from .workbooks.registry import WorkbookRegistry

    skill, _ = load(args.path)
    if args.delta is not None:
        from .parametrize.month_shift import parse_period
        year = parse_period(skill.anchor_period)[0] if skill.anchor_period else 2000
        steps = apply_delta(skill.steps, args.delta, year)
    else:
        steps = resolve_skill(skill, run_index=args.run_index, current_period=args.current)

    pythoncom.CoInitialize()
    app = _open_excel()
    registry = WorkbookRegistry()
    for f in args.files:
        registry.register(app.Workbooks.Open(f))
    for wb in app.Workbooks:
        registry.register(wb)

    # 세션이 교차파일·읽기전용 소스 오픈을 처리(Docs/07)
    n = replay(app, steps, registry=registry)
    print(f"▶ 재현 완료: {n} 스텝 적용")
    pythoncom.CoUninitialize()
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ixicellr", description="Excel Action Record & Replay")
    sub = p.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("info", help="스킬 요약")
    pi.add_argument("path")
    pi.set_defaults(func=_cmd_info)

    pr = sub.add_parser("record", help="엑셀 행동 녹화")
    pr.add_argument("files", nargs="*", help="미리 열 워크북 경로")
    pr.add_argument("--out", default="skill.icr")
    pr.add_argument("--name", default="녹화_스킬")
    pr.add_argument("--anchor", default=None, help="기준 기간 YYYY-MM")
    pr.set_defaults(func=_cmd_record)

    pp = sub.add_parser("replay", help="스킬 재현")
    pp.add_argument("path")
    pp.add_argument("files", nargs="*", help="대상 워크북 경로")
    pp.add_argument("--delta", type=int, default=None, help="월 시프트(직접 지정)")
    pp.add_argument("--run-index", type=int, default=0)
    pp.add_argument("--current", default=None, help="현재 기간 YYYY-MM")
    pp.set_defaults(func=_cmd_replay)

    pe = sub.add_parser("export-eval-eca", help="스킬을 eval_eca(logic.json) 형식으로 내보내기")
    pe.add_argument("path", help="입력 .icr")
    pe.add_argument("--out", default="skill_eval_eca.zip", help="출력 .zip")
    pe.add_argument("--name", default=None, help="스킬 이름(미지정 시 .icr 의 이름)")
    pe.set_defaults(func=_cmd_export_eval_eca)
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
