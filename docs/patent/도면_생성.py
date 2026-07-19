from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math


OUT = Path(__file__).resolve().parent
FONT = r"C:\Windows\Fonts\malgun.ttf"
FONT_BOLD = r"C:\Windows\Fonts\malgunbd.ttf"

INK = "#111111"
MID = "#666666"
LIGHT = "#F2F2F2"
LIGHT2 = "#FAFAFA"
WHITE = "#FFFFFF"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def canvas(width=2400, height=1500):
    im = Image.new("RGB", (width, height), WHITE)
    return im, ImageDraw.Draw(im)


def text_center(draw, xy, text, size=30, bold=False, fill=INK):
    x, y = xy
    f = font(size, bold)
    box = draw.textbbox((0, 0), text, font=f)
    draw.text((x - (box[2] - box[0]) / 2, y - (box[3] - box[1]) / 2), text, font=f, fill=fill)


def multiline_center(draw, box, lines, size=28, bold_first=False, spacing=11, fill=INK):
    x, y, w, h = box
    fonts = [font(size, bold_first and i == 0) for i in range(len(lines))]
    heights = [draw.textbbox((0, 0), line, font=f)[3] for line, f in zip(lines, fonts)]
    total = sum(heights) + spacing * max(0, len(lines) - 1)
    cy = y + (h - total) / 2
    for line, f, th in zip(lines, fonts, heights):
        tb = draw.textbbox((0, 0), line, font=f)
        draw.text((x + (w - (tb[2] - tb[0])) / 2, cy), line, font=f, fill=fill)
        cy += th + spacing


def box(draw, xywh, lines, *, fill=WHITE, width=4, radius=22, size=28, bold_first=True):
    x, y, w, h = xywh
    draw.rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=fill, outline=INK, width=width)
    multiline_center(draw, xywh, lines, size=size, bold_first=bold_first)


def arrow(draw, points, *, label=None, size=24, width=5, dashed=False):
    if len(points) < 2:
        return
    if dashed:
        for a, b in zip(points, points[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            dist = max(1, math.hypot(dx, dy))
            ux, uy = dx / dist, dy / dist
            pos = 0
            while pos < dist:
                end = min(pos + 16, dist)
                draw.line((a[0] + ux * pos, a[1] + uy * pos, a[0] + ux * end, a[1] + uy * end), fill=INK, width=width)
                pos += 28
    else:
        draw.line(points, fill=INK, width=width, joint="curve")
    a, b = points[-2], points[-1]
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    ah = 22
    left = (b[0] - ah * math.cos(ang - math.pi / 6), b[1] - ah * math.sin(ang - math.pi / 6))
    right = (b[0] - ah * math.cos(ang + math.pi / 6), b[1] - ah * math.sin(ang + math.pi / 6))
    draw.polygon((b, left, right), fill=INK)
    if label:
        mx = sum(p[0] for p in points) / len(points)
        my = sum(p[1] for p in points) / len(points)
        text_center(draw, (mx, my - 22), label, size=size, bold=True)


def title(draw, width, number, name):
    text_center(draw, (width / 2, 68), f"도 {number}. {name}", size=44, bold=True)
    draw.line((100, 120, width - 100, 120), fill=INK, width=4)


def footer(draw, width):
    text_center(draw, (width / 2, 1460), "※ 괄호 안 숫자는 명세서의 구성요소 또는 단계 참조번호임", size=22, fill=MID)


def figure1():
    w, h = 2400, 1500
    im, d = canvas(w, h)
    title(d, w, 1, "스프레드시트 자동화 시스템 구성도")

    box(d, (150, 165, 2100, 250), ["(100) 네이티브 셸 (C# / WebView2)", "(110) 단일 인스턴스·생애주기 관리자   |   (120) 좌표 발행기", "(130) 포커스 보조기   |   (140) 기하학적 입력 잠금기"], fill=LIGHT, size=31)

    box(d, (150, 530, 650, 420), ["(500) 웹 UI (JavaScript)", "(510) 대화형 스킬 생성기", "(520) 파이프라인 편집기", "(530) 실행기 + 매핑 UI", "(540) 적용 게이트", "(550) 자동복구 / (560) 클릭복구"], fill=LIGHT2, size=27)
    box(d, (875, 530, 650, 420), ["(400) 재바인딩 엔진", "(410) 요구 추출기", "(420) 생성물 제외기", "(430) 5단 자동 매칭기", "(440) 실행 직전 리터럴 치환기", "저장 스킬 원본은 불변"], fill=LIGHT2, size=27)
    box(d, (1600, 530, 650, 420), ["(200) 로컬 실행 서버 (Python)", "(210) COM 세션 / 작업사본", "(220) 격리 배치 실행기", "(230) 스텝별 체크포인트", "(240) 창 합성 / (250) 행위 캡처", "(260) 스프레드시트 제약 흡수"], fill=LIGHT2, size=26)

    box(d, (150, 1090, 650, 220), ["(600) LLM API", "자연어 → Python/VBA 스킬 코드"], fill=LIGHT, size=29)
    box(d, (875, 1090, 650, 220), ["저장 스킬 저장소", "스텝 코드 + 대상 메타 + 이름"], fill=WHITE, size=29)
    box(d, (1600, 1060, 650, 280), ["(300) 라이브 Excel", "실제 EXCEL.EXE top-level 유지", "스타일 변형 + 무활성 배치", "네이티브 기능과 입력 보존"], fill=LIGHT, size=28)

    arrow(d, [(475, 415), (475, 530)], label="WebView2")
    arrow(d, [(1200, 415), (1200, 530)], label="좌표·상태")
    arrow(d, [(1925, 415), (1925, 530)], label="자식 프로세스")
    arrow(d, [(800, 720), (875, 720)], label="요구/매핑")
    arrow(d, [(1525, 720), (1600, 720)], label="HTTP")
    arrow(d, [(475, 950), (475, 1090)], label="생성/복구")
    arrow(d, [(1200, 950), (1200, 1090)], label="저장/호출")
    arrow(d, [(1925, 950), (1925, 1060)], label="COM")
    footer(d, w)
    im.save(OUT / "도1_시스템_구성도.png", dpi=(300, 300))


def figure2():
    w, h = 2200, 1500
    im, d = canvas(w, h)
    title(d, w, 2, "자연어 기반 스킬 생성·적용 흐름도")
    xs, bw, cx = 140, 900, 590
    box(d, (xs, 160, bw, 115), ["사용자 자연어 지시"], fill=LIGHT, size=33)
    box(d, (xs, 330, bw, 140), ["S201  구조 다이제스트 + LLM 호출", "헤더·표 구조 요약을 지시와 결합"], size=28)
    box(d, (xs, 525, bw, 140), ["스킬 코드 생성", "Python ctx.* 또는 VBA"], fill=LIGHT2, size=30)
    box(d, (xs, 720, bw, 155), ["S202  적용 게이트 (540)", "금지 API · 과다 읽기 · 구문 정적 검사"], size=28)
    box(d, (xs, 955, bw, 155), ["S203  라이브 작업사본에 COM 실행", "실행 직전 스냅샷 (230) 선행"], fill=LIGHT, size=28)
    box(d, (xs, 1240, bw, 135), ["S206  스킬 저장 (zip)", "스텝 코드 + 대상 메타 + 이름"], fill=LIGHT2, size=28)
    for y1, y2 in [(275, 330), (470, 525), (665, 720), (875, 955)]:
        arrow(d, [(cx, y1), (cx, y2)])

    box(d, (1300, 235, 700, 230), ["게이트 부적합", "재생성 (1회 한도) · Python → VBA 전환", "또는 사용자 승인에 따른 강제 적용"], fill=LIGHT2, size=27)
    arrow(d, [(1040, 797), (1170, 797), (1170, 350), (1300, 350)], label="검사 실패")
    arrow(d, [(1650, 465), (1650, 595), (1040, 595)], label="재시도", dashed=True)

    box(d, (1300, 760, 700, 155), ["S204  성공", "파이프라인에 스텝 축적"], fill=LIGHT, size=29)
    box(d, (1300, 1030, 700, 220), ["S205  실패 → 자동복구 (550)", "환경·캡처·기검증: 재생성 금지", "복구 가능: 체크포인트 복원 후 재생성·재적용"], fill=LIGHT2, size=26)
    arrow(d, [(1040, 1000), (1170, 1000), (1170, 837), (1300, 837)], label="성공")
    arrow(d, [(1040, 1065), (1300, 1065)], label="실패")
    arrow(d, [(1650, 915), (2070, 915), (2070, 1307), (1040, 1307)])
    arrow(d, [(1650, 1250), (1650, 1395), (1100, 1395), (1100, 1032), (1040, 1032)], dashed=True)
    text_center(d, (1240, 1375), "복원 후 재적용", size=22, bold=True)
    text_center(d, (1100, 1450), "실패 분류 게이트는 재생성으로 고칠 수 없는 오류를 복구 루프 앞에서 차단함", size=24, fill=MID)
    im.save(OUT / "도2_스킬_생성_적용_흐름도.png", dpi=(300, 300))


def vertical_flow(number, name, stages, filename, note=None):
    w, h = 2200, 1500
    im, d = canvas(w, h)
    title(d, w, number, name)
    y = 165
    heights = [int(s[2]) for s in stages]
    for i, (heading, lines, bh, shade) in enumerate(stages):
        box(d, (260, y, 1680, bh), [heading] + lines, fill=shade, size=27)
        if i < len(stages) - 1:
            arrow(d, [(1100, y + bh), (1100, y + bh + 55)])
        y += bh + 55
    if note:
        text_center(d, (w / 2, 1450), note, size=23, fill=MID)
    im.save(OUT / filename, dpi=(300, 300))


def figure3():
    stages = [
        ("S401  요구 추출 (410)", ["코드 리터럴 · 자연어 멘션 · 저장 메타 · 복붙 캡처 인자를 통합"], 180, LIGHT),
        ("S402  생성물 제외 (420)", ["추가·개명·복사 산출 시트를 요구에서 삭제", "Python 변수 대입 역추적 + VBA 대입/비교 문맥 구분"], 205, LIGHT2),
        ("S403  자동 매칭 (430)", ["정확 → 정규화 → 어간 → 상호포함 → 토큰 적중률", "각 단계에서 유일 일치일 때만 채택 (임계값 45)"], 205, LIGHT),
        ("S404  사용자 확인 UI", ["[요구 시트] ↔ [실제 시트] 페어와 3단계 상태 표시", "미해결 요구가 있으면 실행 차단"], 205, LIGHT2),
        ("S405  리터럴 치환 (440)", ["실행 직전에만 실제 파일명·시트명으로 치환한 매핑본 생성", "종료 후 제네릭 이름의 저장 스킬 원본 복원"], 205, LIGHT),
    ]
    vertical_flow(3, "저장 스킬의 이종 문서 매핑·재바인딩", stages, "도3_이종문서_재바인딩_흐름도.png", "핵심 안전핀: 입력 요구와 실행 중 생성되는 시트를 정적으로 분리함")


def figure4():
    w, h = 2200, 1500
    im, d = canvas(w, h)
    title(d, w, 4, "무손실 격리 전체실행 및 체크포인트 복구")
    box(d, (260, 160, 1680, 145), ["S301  실행 집합 계산 및 1회 요청", "같은 파일의 연속 스텝 그룹화 · 실행 대상 ∪ 교차참조 파일"], fill=LIGHT, size=27)
    box(d, (260, 370, 1680, 185), ["S302  숨김 격리 Excel 인스턴스 1개 기동", "리셋 대상: 업로드 원본의 임시 사본(pristine)", "교차참조: 라이브 현재 상태의 SaveCopyAs 동반본"], fill=LIGHT2, size=27)
    box(d, (260, 620, 1680, 180), ["S303  스텝 루프", "[직전 SaveCopyAs 스냅샷] → [Python COM 또는 VBA 실행]", "진행률은 잠금 밖 공유 상태에 기록"], fill=LIGHT, size=27)
    for y1, y2 in [(305, 370), (555, 620)]:
        arrow(d, [(1100, y1), (1100, y2)])

    box(d, (150, 930, 850, 205), ["S304  성공", "변경 파일만 결과 반영", "라이브 또는 출력 파일로 전달"], fill=LIGHT2, size=28)
    box(d, (1200, 900, 850, 265), ["S305~S306  실패 및 최소 복구", "라이브 반영 전 예외 + 스냅샷 목록 동봉", "최초 스냅샷 복원 → 실패 스텝 재생성", "→ 실패 지점부터 이어 실행"], fill=LIGHT2, size=26)
    arrow(d, [(850, 800), (850, 865), (575, 865), (575, 930)], label="성공")
    arrow(d, [(1350, 800), (1350, 860), (1625, 860), (1625, 900)], label="실패")
    arrow(d, [(1625, 1165), (1625, 1260), (1100, 1260), (1100, 800)], label="복원 후 이어 실행", dashed=True)
    text_center(d, (1100, 1365), "복구 상한: 전체 3회 · 스텝당 2회 / 스냅샷이 없으면 pristine 전체 재실행", size=24, fill=MID)
    text_center(d, (1100, 1420), "성공 전까지 라이브 세션은 변경하지 않으므로 원본과 라이브 상태를 무손실로 보존", size=25, bold=True)
    im.save(OUT / "도4_무손실_격리실행_복구_흐름도.png", dpi=(300, 300))


def figure5():
    stages = [
        ("사용자 행위", ["라이브 Excel에서 Ctrl+C(소스) → Ctrl+V(대상)"], 150, LIGHT),
        ("S501  소스 역추적", ["클립보드 Link 포맷에서 북·시트·범위 파싱", "Link 소실 시 CutCopyMode 중 저장한 최근 소스 스냅샷 사용"], 205, LIGHT2),
        ("S502  대상 판정", ["전역 Selection 대신 세션 워크북 창의 RangeSelection 우선"], 170, LIGHT),
        ("S503~S504  검증 및 결정적 스텝 생성", ["다중영역·크기·교차파일 검증", "paste_copied(src/dst book·sheet·range, values_only)"], 205, LIGHT2),
        ("S505  결정적 재생", ["소스 파일 자동 오픈 → Range.Copy 또는 값만 붙여넣기", "값·수식·서식·병합 보존 / 롤백 범위 비용 한정"], 205, LIGHT),
    ]
    vertical_flow(5, "무후킹 복사·붙여넣기 캡처와 결정적 재생", stages, "도5_복사붙여넣기_캡처_흐름도.png", "키보드 후킹이나 LLM 추측 없이 애플리케이션이 보유한 상태로 좌표를 복원함")


def figure6():
    w, h = 2400, 1100
    im, d = canvas(w, h)
    title(d, w, 6, "전체 데이터 흐름 요약")
    labels = [
        "업로드", "(210) 작업사본\n세션", "(240) 오버레이\n표시", "자연어 지시", "(600) 코드\n생성", "(540) 적용\n게이트",
        "(230) 스냅샷\n+ 라이브 적용", "스킬 저장\n(zip)", "익월 새 파일\n업로드", "(400) 요구 추출\n· 매핑", "사용자 확인", "(220) 격리 배치\n(pristine)", "결과 출력\n· 다운로드"
    ]
    coords = []
    x0, y0, bw, bh, gap = 90, 190, 320, 145, 55
    for i in range(6):
        coords.append((x0 + i * (bw + gap), y0))
    x1, y1, bw2, gap2 = 2030, 595, 280, 45
    for i in range(7):
        coords.append((x1 - i * (bw2 + gap2), y1))
    for i, (label, (x, y)) in enumerate(zip(labels, coords)):
        current_bw = bw if i < 6 else bw2
        box(d, (x, y, current_bw, bh), label.split("\n"), fill=LIGHT if i % 2 == 0 else LIGHT2, size=25)
        if i < 5:
            arrow(d, [(x + bw, y + bh / 2), (coords[i + 1][0], y + bh / 2)])
        elif i == 5:
            nx, ny = coords[i + 1]
            arrow(d, [(x + bw / 2, y + bh), (x + bw / 2, 475), (nx + bw / 2, 475), (nx + bw / 2, ny)])
        elif i < len(coords) - 1:
            nx, ny = coords[i + 1]
            arrow(d, [(x, y + bh / 2), (nx + bw2, ny + bh / 2)])
    text_center(d, (1200, 920), "원본은 열지 않음  ·  저장 스킬은 불변  ·  전체실행은 격리 인스턴스에서 수행", size=30, bold=True)
    text_center(d, (1200, 990), "실패 시 스텝 직전 체크포인트를 이용해 최소 범위만 복원하고 이어 실행", size=26)
    im.save(OUT / "도6_전체_데이터_흐름도.png", dpi=(300, 300))


if __name__ == "__main__":
    figure1()
    figure2()
    figure3()
    figure4()
    figure5()
    figure6()
    print("특허 도면 6개 생성 완료:")
    for path in sorted(OUT.glob("도[1-6]_*.png")):
        print(f"- {path.name}")
