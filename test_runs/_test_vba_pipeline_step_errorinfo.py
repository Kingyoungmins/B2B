import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("serve_b2b_under_test", ROOT / "serve_b2b.py")
serve_b2b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(serve_b2b)


class DummyApp:
    ScreenUpdating = True

    def __init__(self):
        self.Workbooks = []

    def Quit(self):
        pass


class DummyWorkbook:
    Name = "dummy.xlsx"
    FullName = r"C:\tmp\dummy.xlsx"


def main():
    original = {}
    names = [
        "get_excel_session",
        "session_workbook",
        "_capture_live_view_state",
        "_setup_isolated_pipeline_instance",
        "_protect_workbook_for_read_only_mirror",
        "_inject_and_run_vba",
        "_restore_app_state",
        "_restore_live_protected_view",
        "_restore_live_window",
    ]
    for name in names:
        original[name] = getattr(serve_b2b, name)

    try:
        app = DummyApp()
        wb = DummyWorkbook()
        fapp = DummyApp()
        ftarget = DummyWorkbook()

        serve_b2b.get_excel_session = lambda excel_id: {"name": "dummy.xlsx", "path": r"C:\tmp\dummy.xlsx"}
        serve_b2b.session_workbook = lambda session: (app, wb)
        serve_b2b._capture_live_view_state = lambda app, wb, session: None
        serve_b2b._setup_isolated_pipeline_instance = lambda session, excel_id, reset, work: (fapp, ftarget, 0)
        serve_b2b._protect_workbook_for_read_only_mirror = lambda *args, **kwargs: None
        serve_b2b._restore_app_state = lambda *args, **kwargs: None
        serve_b2b._restore_live_protected_view = lambda *args, **kwargs: None
        serve_b2b._restore_live_window = lambda *args, **kwargs: None

        def fail_vba(*args, **kwargs):
            raise RuntimeError("VBA 실행 실패: 아래 첨자 사용이 잘못되었습니다.")

        serve_b2b._inject_and_run_vba = fail_vba

        step = {
            "stepIdx": 2,
            "stepId": "missing-pivot",
            "description": "총합계 작성",
            "language": "vba",
            "code": 'Sub B2BSkill()\nSet ws = ActiveWorkbook.Worksheets("피벗_결과")\nEnd Sub',
        }

        try:
            serve_b2b._run_vba_pipeline_on_session_impl("dummy", [step], reset=True)
        except serve_b2b.PipelineExecutionError as err:
            info = err.info
            assert info["stepIdx"] == 2, info
            assert info["stepId"] == "missing-pivot", info
            assert info["language"] == "vba", info
            assert "피벗_결과" in info["code"], info
            assert "아래 첨자" in info["rawError"], info
            print("vba pipeline step errorInfo OK")
            return
        raise AssertionError("PipelineExecutionError was not raised")
    finally:
        for name, value in original.items():
            setattr(serve_b2b, name, value)


if __name__ == "__main__":
    main()
