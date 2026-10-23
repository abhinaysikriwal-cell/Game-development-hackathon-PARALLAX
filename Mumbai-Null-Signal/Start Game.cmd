@echo off
setlocal
cd /d "%~dp0"
set "PORT=8766"
set "PYTHON_EXE="

if defined USERPROFILE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" set "PYTHON_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not defined PYTHON_EXE for /f "delims=" %%P in ('where python 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
if not defined PYTHON_EXE for /f "delims=" %%P in ('where py 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%P"

if not defined PYTHON_EXE (
  echo Python was not found. Install Python, or publish this folder with GitHub Pages.
  pause
  exit /b 1
)

start "Mumbai Null Signal server 8766" /min "%PYTHON_EXE%" -m http.server %PORT% --bind 127.0.0.1 --directory "%~dp0."
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/"
echo Mumbai Null Signal is running. Keep the server window open while you play.
echo Close the minimized server window when you are finished.
pause