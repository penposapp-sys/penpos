[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=Kurulum başlatılsın mı?
DisplayLicense=
FinishMessage=Kurulum tamamlandı. Chrome'da chrome://extensions adresini açıp Paketlenmemiş öğe yükle ile kurulum klasöründeki chrome-extension klasörünü seçin.
TargetName=C:\Users\faruk\OneDrive\Belgeler\PenPos System\penpos dosyalar\PenPos\releases\installer\PenPOS Luca Veri Setup.exe
FriendlyName=PenPOS Luca Veri
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1
PostInstallCmd=<None>
SourceFiles=SourceFiles

[Strings]
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1

[SourceFiles]
SourceFiles0=C:\Users\faruk\OneDrive\Belgeler\PenPos System\penpos dosyalar\PenPos\releases\PenPOS-Luca-Veri-v0.1.0
SourceFiles1=C:\Users\faruk\OneDrive\Belgeler\PenPos System\penpos dosyalar\PenPos\releases\installer

[SourceFiles0]
"chrome-extension\manifest.json"="chrome-extension\manifest.json"
"chrome-extension\background.js"="chrome-extension\background.js"
"chrome-extension\content.js"="chrome-extension\content.js"
"chrome-extension\popup.html"="chrome-extension\popup.html"
"chrome-extension\popup.js"="chrome-extension\popup.js"
"chrome-extension\popup.css"="chrome-extension\popup.css"

[SourceFiles1]
"install.ps1"="install.ps1"
