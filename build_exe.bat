@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  KGM 업무망 EXE 빌드
echo ============================================
echo.

REM Python 확인
where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python이 설치되어 있지 않습니다.
    echo Python을 설치한 뒤 다시 실행해주세요.
    pause
    exit /b 1
)

REM PyInstaller 설치 확인 및 자동 설치
python -m pip show pyinstaller >nul 2>nul
if errorlevel 1 (
    echo [INFO] PyInstaller가 없어 자동 설치합니다...
    python -m pip install --upgrade pip
    python -m pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] PyInstaller 설치 실패.
        pause
        exit /b 1
    )
)

REM 이전 빌드 산출물 정리
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"

REM EXE 빌드
echo.
echo [INFO] EXE 빌드 시작...
python -m PyInstaller --clean launch_kgm.spec
if errorlevel 1 (
    echo.
    echo [ERROR] 빌드 실패.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  빌드 완료: dist\KGM_업무망.exe
echo ============================================
echo.
pause
endlocal
