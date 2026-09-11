$ErrorActionPreference = 'Stop'

$targetRoot = Join-Path $env:LOCALAPPDATA 'PenPOS\Luca Veri'
$targetExtension = Join-Path $targetRoot 'chrome-extension'
$sourceExtension = Join-Path $PSScriptRoot 'chrome-extension'

New-Item -ItemType Directory -Force -Path $targetExtension | Out-Null
Copy-Item -Path (Join-Path $sourceExtension '*') -Destination $targetExtension -Recurse -Force

$uninstaller = @'
$ErrorActionPreference = 'Stop'
$targetRoot = Join-Path $env:LOCALAPPDATA 'PenPOS\Luca Veri'
if (Test-Path $targetRoot) {
  Remove-Item -Path $targetRoot -Recurse -Force
}
Write-Host 'PenPOS Luca Veri kaldırıldı.'
'@
Set-Content -Path (Join-Path $targetRoot 'Uninstall-PenPOS-Luca-Veri.ps1') -Value $uninstaller -Encoding UTF8

Write-Host ''
Write-Host 'Kurulum tamamlandı.' -ForegroundColor Green
Write-Host 'Google Chrome açık olmalıdır.'
Write-Host 'Chrome''da chrome://extensions adresini açın.'
Write-Host 'Geliştirici Modu''nu açın.'
Write-Host "Paketlenmemiş öğe yükle ile şu klasörü seçin: $targetExtension"
Write-Host ''
Read-Host 'Kapatmak için Enter''a basın'
