@echo off
setlocal
cd /d "%~dp0"

if exist "%~dp0\python\python.exe" (
  set "PYTHON_EXE=%~dp0\python\python.exe"
) else (
  set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" "%~dp0launch_b2b.py"
endlocal
