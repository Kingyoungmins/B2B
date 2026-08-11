@echo off
setlocal
cd /d "%~dp0"

set "APP_VERSION=0.7.3"
set "PACKAGE_DIR=dist\B2B_ver%APP_VERSION%"
set "PAYLOAD=build\b2b_ver0516_single_payload.zip"
set "OUT_EXE=dist\B2B_ver%APP_VERSION%_single.exe"
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

echo ============================================
echo  B2B ver%APP_VERSION% single EXE wrapper build
echo ============================================
echo.

if not exist "%PACKAGE_DIR%\B2B_ver%APP_VERSION%.exe" (
    echo [ERROR] Missing %PACKAGE_DIR%\B2B_ver%APP_VERSION%.exe
    echo Run build_exe.bat first.
    exit /b 1
)
if not exist "%PACKAGE_DIR%\B2B_Server.exe" (
    echo [ERROR] Missing %PACKAGE_DIR%\B2B_Server.exe
    echo Run build_exe.bat first.
    exit /b 1
)
if not exist "%CSC%" (
    echo [ERROR] C# compiler not found: %CSC%
    exit /b 1
)

if not exist "build" mkdir "build"
if exist "%PAYLOAD%" del /f /q "%PAYLOAD%"
if exist "%OUT_EXE%" del /f /q "%OUT_EXE%"

echo [INFO] Creating embedded payload...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%PACKAGE_DIR%\*' -DestinationPath '%PAYLOAD%' -Force"
if errorlevel 1 (
    echo [ERROR] Payload zip creation failed.
    exit /b 1
)

rem [version resource] generate assembly attributes (version read from launch_b2b.py only)
python "tools\gen_version_meta.py"
if errorlevel 1 (
    echo [ERROR] Version metadata generation failed.
    exit /b 1
)

rem [OriginalFilename] C# takes this field from the compiler output name. So build with a
rem fixed, version-free name and copy it to the versioned distribution name below
rem (same convention as chrome.exe / Excel.exe).
set "BUILD_EXE=dist\AX-Cell.exe"

echo [INFO] Compiling single exe...
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 ^
  /reference:System.dll ^
  /reference:System.Core.dll ^
  /reference:System.Windows.Forms.dll ^
  /reference:System.IO.Compression.dll ^
  /reference:System.IO.Compression.FileSystem.dll ^
  /resource:%PAYLOAD%,payload.zip ^
  /out:"%BUILD_EXE%" ^
  "single_exe\B2BSingleExeLauncher.cs" ^
  "build_meta\AssemblyInfo_single.cs"
if errorlevel 1 (
    echo [ERROR] Single exe compile failed.
    exit /b 1
)

rem Create the versioned distribution file. OriginalFilename stays AX-Cell.exe.
copy /y "%BUILD_EXE%" "%OUT_EXE%" >nul
if not exist "%OUT_EXE%" (
    echo [ERROR] Failed to create distribution exe.
    exit /b 1
)

del /f /q "%PAYLOAD%" >nul 2>nul

rem [self-check] The wrapper must be able to find the app entry inside its own payload.
rem A stale hardcoded name used to pass the build and fail only at first launch
rem ("Packaged app entry was not found") - verify it here instead.
echo [INFO] Verifying packaged entry...
python "tools\verify_single_exe.py" "%OUT_EXE%"
if errorlevel 1 (
    echo [ERROR] Packaged entry check failed - the built exe would not start.
    exit /b 1
)

echo.
echo ============================================
echo  Build complete: %OUT_EXE%
echo ============================================
echo.
endlocal
