@echo off
setlocal
cd /d "%~dp0"

set "APP_VERSION=0.5.19"
set "SERVER_EXE=B2B_Server.exe"
set "PACKAGE_DIR=dist\B2B_ver%APP_VERSION%"
set "PACKAGE_ZIP=dist\B2B_ver%APP_VERSION%_portable.zip"
set "OFFLINE_DIR=%~dp0tools\offline"
set "WHEELHOUSE=%OFFLINE_DIR%\wheels"
set "OFFLINE_NODE=%OFFLINE_DIR%\node\node.exe"
set "WEBVIEW2_NUPKG=%OFFLINE_DIR%\nuget\Microsoft.Web.WebView2.1.0.2903.40.nupkg"

echo ============================================
echo  B2B ver%APP_VERSION% offline portable build
echo ============================================
echo.

set "USING_EMBEDDED_PYTHON=0"
if exist "%~dp0tools\offline\python\python.exe" (
    set "PYTHON_EXE=%~dp0tools\offline\python\python.exe"
    set "USING_EMBEDDED_PYTHON=1"
) else (
    set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" --version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python was not found.
    echo         Put portable Python at tools\offline\python\python.exe or install Python on this build PC.
    exit /b 1
)

if "%USING_EMBEDDED_PYTHON%"=="1" (
    for %%P in ("%~dp0tools\offline\python\python*._pth") do (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content '%%~fP') -replace '^#import site$', 'import site' | Set-Content '%%~fP' -Encoding ASCII"
    )
)

if not exist "%OFFLINE_NODE%" (
    echo [ERROR] Missing offline Node.js runtime:
    echo         %OFFLINE_NODE%
    echo         Copy node.exe from the Windows x64 Node distribution into tools\offline\node\.
    exit /b 1
)
set "PATH=%OFFLINE_DIR%\node;%PATH%"

if not exist "%WEBVIEW2_NUPKG%" (
    echo [ERROR] Missing offline WebView2 NuGet package:
    echo         %WEBVIEW2_NUPKG%
    echo         Download Microsoft.Web.WebView2.1.0.2903.40.nupkg on an internet PC and copy it here.
    exit /b 1
)

if exist "%WHEELHOUSE%" (
    "%PYTHON_EXE%" -m pip --version >nul 2>nul
    if errorlevel 1 (
        if not exist "%~dp0tools\offline\python\get-pip.py" (
            echo [ERROR] pip is not available and get-pip.py is missing:
            echo         %~dp0tools\offline\python\get-pip.py
            exit /b 1
        )
        echo [INFO] Bootstrapping pip from offline wheelhouse...
        "%PYTHON_EXE%" "%~dp0tools\offline\python\get-pip.py" --no-index --find-links "%WHEELHOUSE%" pip setuptools wheel
        if errorlevel 1 (
            echo [ERROR] Offline pip bootstrap failed.
            exit /b 1
        )
    )
    echo [INFO] Installing Python build dependencies from offline wheelhouse...
    "%PYTHON_EXE%" -m pip install --no-index --find-links "%WHEELHOUSE%" pyinstaller pyinstaller-hooks-contrib pefile pywin32-ctypes pywin32 openpyxl
    if errorlevel 1 (
        echo [ERROR] Offline dependency install failed.
        exit /b 1
    )
)

"%PYTHON_EXE%" -m PyInstaller --version >nul 2>nul
if errorlevel 1 (
    echo [ERROR] PyInstaller is not installed and wheelhouse is missing or incomplete:
    echo         %WHEELHOUSE%
    exit /b 1
)

"%PYTHON_EXE%" -c "import importlib.util, sys; missing=[m for m in ('win32com','pythoncom','openpyxl') if importlib.util.find_spec(m) is None]; print('[ERROR] Missing Python modules: ' + ', '.join(missing)) if missing else None; sys.exit(1 if missing else 0)"
if errorlevel 1 exit /b 1

echo [INFO] Building native host using offline WebView2 package...
set "B2B_OFFLINE_BUILD=1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0native_host\build_native_host.ps1"
if errorlevel 1 (
    echo [ERROR] Native host build failed.
    exit /b 1
)

if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"

echo.
echo [INFO] Building Python server EXE...
"%PYTHON_EXE%" -m PyInstaller --clean launch_b2b.spec
if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    exit /b 1
)

if not exist "dist\%SERVER_EXE%" (
    echo [ERROR] Missing dist\%SERVER_EXE%.
    exit /b 1
)

echo.
echo [INFO] Creating offline portable package...
mkdir "%PACKAGE_DIR%"
copy /y "native_host\bin\B2B_NativeHost.exe" "%PACKAGE_DIR%\B2B_ver%APP_VERSION%.exe" >nul
copy /y "native_host\bin\Microsoft.Web.WebView2.Core.dll" "%PACKAGE_DIR%\" >nul
copy /y "native_host\bin\Microsoft.Web.WebView2.WinForms.dll" "%PACKAGE_DIR%\" >nul
copy /y "native_host\bin\WebView2Loader.dll" "%PACKAGE_DIR%\" >nul
copy /y "dist\%SERVER_EXE%" "%PACKAGE_DIR%\" >nul
copy /y "%OFFLINE_NODE%" "%PACKAGE_DIR%\node.exe" >nul

if not exist "%PACKAGE_DIR%\B2B_ver%APP_VERSION%.exe" (
    echo [ERROR] Missing packaged native host.
    exit /b 1
)
if not exist "%PACKAGE_DIR%\%SERVER_EXE%" (
    echo [ERROR] Missing packaged server exe.
    exit /b 1
)
if not exist "%PACKAGE_DIR%\node.exe" (
    echo [ERROR] Missing packaged node.exe.
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path '%PACKAGE_ZIP%') { Remove-Item -Force '%PACKAGE_ZIP%' }; Compress-Archive -Path '%PACKAGE_DIR%\*' -DestinationPath '%PACKAGE_ZIP%' -Force"
if errorlevel 1 (
    echo [ERROR] Portable zip creation failed.
    exit /b 1
)

echo.
echo ============================================
echo  Offline build complete
echo  EXE: %PACKAGE_DIR%\B2B_ver%APP_VERSION%.exe
echo  ZIP: %PACKAGE_ZIP%
echo ============================================
echo.
endlocal
