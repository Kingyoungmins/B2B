@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  KGM B2B ver3.5 EXE build
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not installed on this build PC.
    pause
    exit /b 1
)

python -m pip show pyinstaller >nul 2>nul
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    python -m pip install --upgrade pip
    python -m pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] Failed to install PyInstaller.
        pause
        exit /b 1
    )
)

if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"

echo.
echo [INFO] Building EXE...
python -m PyInstaller --clean launch_kgm.spec
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Build complete: dist\KGM_B2B_ver3.5.exe
echo ============================================
echo.
pause
endlocal
