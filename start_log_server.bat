@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem ============================================================
rem  AX-Cell 로그 수집 - 개발 PC 테스트 서버 (한 번에 준비)
rem
rem  이 파일을 두 번 클릭하면
rem    1) 필요한 것 설치 확인
rem    2) 로그를 쌓을 폴더 준비 (이 폴더의 logs)
rem    3) AX-Cell 이 '내 PC 서버'로 로그를 보내도록 설정
rem    4) 수집 서버 실행 + 관리자 화면 열기
rem  까지 됩니다. 그 다음 AX-Cell 을 평소처럼 켜면 됩니다.
rem
rem  원래대로(사내 서버로) 돌리려면 :  start_log_server.bat off
rem ============================================================

set "PORT=8100"
set "URL=http://127.0.0.1:%PORT%"
set "LOGROOT=%~dp0logs"

if /i "%~1"=="off" goto :revert
if /i "%~1"=="stop" goto :revert

echo ============================================================
echo    AX-Cell 로그 수집 - 개발 PC 테스트 서버
echo ------------------------------------------------------------
echo    쌓이는 곳   : %LOGROOT%
echo    관리자 화면 : %URL%/admin
echo ============================================================
echo.

rem ── 1. 파이썬 확인 ──────────────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
  echo [오류] python 을 찾지 못했습니다. 파이썬을 설치하거나 PATH 에 넣어 주세요.
  echo.
  pause
  exit /b 1
)

rem ── 2. 필요한 것 설치 (처음 한 번만) ────────────────────────
python -c "import fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
  echo [준비] 처음 실행이라 필요한 것을 설치합니다. 1~2분 걸릴 수 있습니다...
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo.
    echo [오류] 설치에 실패했습니다. 사내망이면 pip 저장소 설정이 필요할 수 있습니다.
    echo        python -m pip install -r requirements.txt --index-url http://사내저장소/simple --trusted-host 사내저장소
    echo.
    pause
    exit /b 1
  )
  echo.
)

rem ── 3. AX-Cell 이 이 서버로 보내도록 설정 ───────────────────
rem  setx 는 '지금 이후에 새로 켜는 프로그램'부터 적용됩니다.
rem  그래서 이 창을 띄운 뒤에 AX-Cell 을 켜야 로그가 이리로 옵니다.
setx B2B_LOG_SYNC_URL "%URL%" >nul
setx B2B_LOG_SYNC_INTERVAL "10" >nul
echo [설정] 이제 AX-Cell 을 켜면 로그가 이 서버로 옵니다 (10초마다 전송).
echo        * 이 창을 띄운 '다음에' 켜는 AX-Cell 부터 적용됩니다.
echo        * 원래대로 돌리려면 이 파일을 off 로 한 번 실행 :  start_log_server.bat off
echo.

rem ── 4. 이미 떠 있으면 그걸 그대로 씁니다 ────────────────────
python -c "import urllib.request; urllib.request.urlopen('%URL%/v1/logs/health', timeout=2)" >nul 2>&1
if not errorlevel 1 (
  echo [알림] 수집 서버가 이미 떠 있습니다. 관리자 화면만 엽니다.
  start "" "%URL%/admin"
  echo.
  pause
  exit /b 0
)

rem ── 5. 서버가 뜨는 대로 관리자 화면 열기 ────────────────────
start "" /b powershell -NoProfile -Command "for($i=0;$i -lt 40;$i++){try{Invoke-WebRequest -UseBasicParsing '%URL%/v1/logs/health' -TimeoutSec 2 ^| Out-Null; Start-Process '%URL%/admin'; break}catch{Start-Sleep -Milliseconds 700}}"

rem ── 6. 서버 실행 (이 창을 닫으면 서버도 꺼집니다) ───────────
echo [실행] 수집 서버를 켭니다.  끄려면 이 창을 닫거나 Ctrl+C.
echo.
python main.py --version-file version.txt --log-root "%LOGROOT%" --host 127.0.0.1 --port %PORT%

echo.
echo [종료] 수집 서버가 꺼졌습니다. 쌓인 자료는 그대로 남아 있습니다:
echo        %LOGROOT%
echo.
echo        AX-Cell 을 원래 서버로 돌리려면 :  start_log_server.bat off
echo.
pause
exit /b 0

rem ── 되돌리기 ────────────────────────────────────────────────
:revert
echo [되돌리기] AX-Cell 이 다시 사내 서버로 보내도록 설정을 지웁니다...
setx B2B_LOG_SYNC_URL "" >nul
setx B2B_LOG_SYNC_INTERVAL "" >nul
reg delete "HKCU\Environment" /F /V B2B_LOG_SYNC_URL >nul 2>&1
reg delete "HKCU\Environment" /F /V B2B_LOG_SYNC_INTERVAL >nul 2>&1
echo            완료. 지금 이후에 켜는 AX-Cell 부터 원래대로 돌아갑니다.
echo            (이 폴더의 logs 안에 쌓인 자료는 지우지 않았습니다)
echo.
pause
exit /b 0
