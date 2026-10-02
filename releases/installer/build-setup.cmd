@echo off
setlocal
rem PenPOS Luca Veri - IExpress kurulum paketi derleme.
rem Calisma dizininden bagimsiz olarak mevcut chrome-extension klasorunu paketler.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-setup.ps1"
if errorlevel 1 exit /b %errorlevel%
echo BUILD OK: "%~dp0PenPOS Luca Veri Setup.exe"
exit /b 0
