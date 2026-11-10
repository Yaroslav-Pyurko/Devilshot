@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %*
if errorlevel 1 (
  echo.
  echo Server stopped with an error. See the message above.
  pause
)
