@echo off
setlocal
cd /d "%~dp0"

rem =====================================================
rem  한 방 싱글 빌드: build_exe.bat -> build_single_exe.bat
rem  (build_single_exe.bat 은 패키지를 감싸기만 하므로 반드시
rem   build_exe.bat 이 먼저다. 신선도 가드는 뒤 단계에 내장.)
rem =====================================================

echo [1/2] build_exe.bat
call "%~dp0build_exe.bat"
if errorlevel 1 (
    echo [ERROR] build_exe.bat failed - stop.
    exit /b 1
)

echo.
echo [2/2] build_single_exe.bat
call "%~dp0build_single_exe.bat"
if errorlevel 1 (
    echo [ERROR] build_single_exe.bat failed.
    exit /b 1
)

echo.
echo [OK] single build complete.
