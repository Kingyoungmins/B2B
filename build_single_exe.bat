@echo off
setlocal
cd /d "%~dp0"

set "PACKAGE_DIR=dist\B2B_ver0.5.4"
set "PAYLOAD=build\b2b_ver054_single_payload.zip"
set "OUT_EXE=dist\B2B_ver0.5.4_single.exe"
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"

echo ============================================
echo  B2B ver0.5.4 single EXE wrapper build
echo ============================================
echo.

if not exist "%PACKAGE_DIR%\B2B_ver0.5.4.exe" (
    echo [ERROR] Missing %PACKAGE_DIR%\B2B_ver0.5.4.exe
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

echo [INFO] Compiling single exe...
"%CSC%" /nologo /target:winexe /platform:x64 /optimize+ /codepage:65001 ^
  /reference:System.dll ^
  /reference:System.Core.dll ^
  /reference:System.Windows.Forms.dll ^
  /reference:System.IO.Compression.dll ^
  /reference:System.IO.Compression.FileSystem.dll ^
  /resource:%PAYLOAD%,payload.zip ^
  /out:"%OUT_EXE%" ^
  "single_exe\B2BSingleExeLauncher.cs"
if errorlevel 1 (
    echo [ERROR] Single exe compile failed.
    exit /b 1
)

del /f /q "%PAYLOAD%" >nul 2>nul

echo.
echo ============================================
echo  Build complete: %OUT_EXE%
echo ============================================
echo.
endlocal
