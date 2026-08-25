@echo off
setlocal
cd /d "%~dp0"

set "APP_VERSION=0.8.0"
set "SERVER_EXE=B2B_Server.exe"
set "PACKAGE_DIR=dist\B2B_ver%APP_VERSION%"
set "PACKAGE_ZIP=dist\B2B_ver%APP_VERSION%_portable.zip"

echo ============================================
echo  B2B ver%APP_VERSION% portable EXE build
echo ============================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is not installed on this build PC.
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed on this build PC. The packaged app needs bundled node.exe.
    exit /b 1
)

python -m pip show pyinstaller >nul 2>nul
if errorlevel 1 (
    echo [INFO] Installing PyInstaller...
    python -m pip install --upgrade pip
    python -m pip install pyinstaller
    if errorlevel 1 (
        echo [ERROR] Failed to install PyInstaller.
        exit /b 1
    )
)

echo [INFO] Building native host...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0native_host\build_native_host.ps1"
if errorlevel 1 (
    echo [ERROR] Native host build failed.
    exit /b 1
)

if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"

rem [version resource] regenerate after build/ was wiped above (idempotent)
python "tools\gen_version_meta.py"
if errorlevel 1 (
    echo [ERROR] Version metadata generation failed.
    exit /b 1
)

echo.
echo [INFO] Building Python server EXE...
python -m PyInstaller --clean launch_b2b.spec
if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    exit /b 1
)

if not exist "dist\%SERVER_EXE%" (
    echo [ERROR] Missing dist\%SERVER_EXE%.
    exit /b 1
)

echo.
echo [INFO] Creating portable package...
mkdir "%PACKAGE_DIR%"
copy /y "native_host\bin\B2B_NativeHost.exe" "%PACKAGE_DIR%\B2B_ver%APP_VERSION%.exe" >nul
copy /y "native_host\bin\Microsoft.Web.WebView2.Core.dll" "%PACKAGE_DIR%\" >nul
copy /y "native_host\bin\Microsoft.Web.WebView2.WinForms.dll" "%PACKAGE_DIR%\" >nul
copy /y "native_host\bin\WebView2Loader.dll" "%PACKAGE_DIR%\" >nul
copy /y "dist\%SERVER_EXE%" "%PACKAGE_DIR%\" >nul

if not exist "%PACKAGE_DIR%\B2B_ver%APP_VERSION%.exe" (
    echo [ERROR] Missing packaged native host.
    exit /b 1
)
if not exist "%PACKAGE_DIR%\%SERVER_EXE%" (
    echo [ERROR] Missing packaged server exe.
    exit /b 1
)
if not exist "%PACKAGE_DIR%\WebView2Loader.dll" (
    echo [ERROR] Missing WebView2Loader.dll.
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path '%PACKAGE_ZIP%') { Remove-Item -Force '%PACKAGE_ZIP%' }; Compress-Archive -Path '%PACKAGE_DIR%\*' -DestinationPath '%PACKAGE_ZIP%' -Force"
if errorlevel 1 (
    echo [ERROR] Portable zip creation failed.
    exit /b 1
)

echo.
echo ============================================
echo  Build complete
echo  EXE: %PACKAGE_DIR%\B2B_ver%APP_VERSION%.exe
echo  ZIP: %PACKAGE_ZIP%
echo ============================================
echo.
endlocal
