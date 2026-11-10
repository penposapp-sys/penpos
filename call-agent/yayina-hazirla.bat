@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
set "RELEASE_DIR=%SCRIPT_DIR%release"
set "TARGET_DIR=%PROJECT_ROOT%\backend\public\downloads\call-agent"
set "SOURCE_FILE="

for /f "usebackq delims=" %%F in (`powershell.exe -NoProfile -Command "Get-ChildItem -LiteralPath '%RELEASE_DIR%' -Filter '*.exe' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"`) do set "SOURCE_FILE=%%F"

if not defined SOURCE_FILE (
  echo HATA: release klasorunde kurulum EXE dosyasi bulunamadi.
  pause
  exit /b 1
)

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if errorlevel 1 (
  echo HATA: Indirme klasoru olusturulamadi: "%TARGET_DIR%"
  pause
  exit /b 1
)

copy /Y "%SOURCE_FILE%" "%TARGET_DIR%\PenPOS-Call-Agent-Setup.exe" >nul
if errorlevel 1 (
  echo HATA: Kurulum dosyasi indirme klasorune kopyalanamadi.
  pause
  exit /b 1
)

echo Tamamlandi.
echo Kaynak: "%SOURCE_FILE%"
echo Hedef:  "%TARGET_DIR%\PenPOS-Call-Agent-Setup.exe"
echo Web indirme adresi: /public/downloads/call-agent/PenPOS-Call-Agent-Setup.exe
pause
exit /b 0
