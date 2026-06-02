@echo off
setlocal
cd /d "%~dp0"

set "HOST_EXE=%~dp0native_host\bin\B2B_NativeHost.exe"
set "HOST_SRC=%~dp0native_host\NativeHost.cs"
set "HOST_BUILD=%~dp0native_host\build_native_host.ps1"
set "NEED_BUILD=0"

if not exist "%HOST_EXE%" set "NEED_BUILD=1"
if not exist "%~dp0native_host\bin\Microsoft.Web.WebView2.Core.dll" set "NEED_BUILD=1"
if not exist "%~dp0native_host\bin\Microsoft.Web.WebView2.WinForms.dll" set "NEED_BUILD=1"
if not exist "%~dp0native_host\bin\WebView2Loader.dll" set "NEED_BUILD=1"

if "%NEED_BUILD%"=="0" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "if ((Get-Item '%HOST_SRC%').LastWriteTimeUtc -gt (Get-Item '%HOST_EXE%').LastWriteTimeUtc -or (Get-Item '%HOST_BUILD%').LastWriteTimeUtc -gt (Get-Item '%HOST_EXE%').LastWriteTimeUtc) { exit 1 } else { exit 0 }"
  if errorlevel 1 set "NEED_BUILD=1"
)

if "%NEED_BUILD%"=="1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%HOST_BUILD%"
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

start "" /D "%~dp0" "%HOST_EXE%"
