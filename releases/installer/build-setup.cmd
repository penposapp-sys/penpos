@echo off
setlocal
rem Signed distribution builds require a trusted Authenticode certificate.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-setup.ps1" %*
if errorlevel 1 exit /b %errorlevel%
exit /b 0
