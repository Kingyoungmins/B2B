"""COM 이벤트 캡처 (Docs/04, Docs/09). 실제 Excel 필요.

ActionSink 만 COM 무관(테스트 가능). AppEvents/Recorder 는 Excel 이벤트를 받는다.
"""

from .sink import ActionSink  # noqa: F401
