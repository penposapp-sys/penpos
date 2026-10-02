[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=0
UseLongFileName=0
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
SourceFiles=SourceFiles
Strings="Strings"
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%

[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=C:\Users\faruk\OneDrive\Belgeler\PenPos System\penpos dosyalar\PenPos\releases\installer\PenPOS Luca Veri Setup.exe
FriendlyName=PenPOS Luca Veri
AppLaunched=powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1
File0="background.js"
File1="content.js"
File2="manifest.json"
File3="popup.css"
File4="popup.html"
File5="popup.js"
File6="install.ps1"
PostInstallCmd=<None>
AdminQuietInstCmd=
UserQuietInstCmd=

[SourceFiles]
SourceFiles0=C:\Users\faruk\OneDrive\Belgeler\PenPos System\penpos dosyalar\PenPos\chrome-extension\
SourceFiles1=C:\Users\faruk\OneDrive\Belgeler\PenPos System\penpos dosyalar\PenPos\releases\installer\
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
%FILE3%=
%FILE4%=
%FILE5%=
[SourceFiles1]
%FILE6%=
