[Version]
Class=IEXPRESS
SEDVersion=3

[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=1
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
PostInstallCmd=<None>
SourceFiles="SourceFiles"
Strings="Strings"
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%

[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName="__TARGET_NAME__"
FriendlyName="PenPOS Luca Veri"
AppLaunched="powershell.exe -NoProfile -ExecutionPolicy Bypass -File install.ps1"
File0="chrome-extension\background.js"
File1="chrome-extension\content.js"
File2="chrome-extension\manifest.json"
File3="chrome-extension\popup.html"
File4="chrome-extension\popup.js"
File5="chrome-extension\popup.css"
File6="install.ps1"
AdminQuietInstCmd=
UserQuietInstCmd=

[SourceFiles]
SourceFiles0=__STAGED_ROOT__
[SourceFiles0]
%File0%
%File1%
%File2%
%File3%
%File4%
%File5%
%File6%
