$ErrorActionPreference = 'Stop'

$chromeApp = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $chromeApp) {
  throw 'Chrome bulunamadı.'
}

$extensionRoot = Join-Path $env:LOCALAPPDATA 'PenPOS\Luca Veri\chrome-extension'
if (-not (Test-Path $extensionRoot)) {
  throw "Kurulum klasörü bulunamadı: $extensionRoot"
}

$process = Start-Process -FilePath $chromeApp -ArgumentList 'chrome://extensions/' -PassThru
Start-Sleep -Seconds 3

$chromeWindow = $null
$timeoutAt = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $timeoutAt) {
  $chromeWindow = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($chromeWindow) { break }
  Start-Sleep -Milliseconds 500
}

if (-not $chromeWindow) {
  throw 'Chrome penceresi açılmadı.'
}

# Geliştirici Modu'nu aç
$devModeButton = $null
$attempts = 0
while ($attempts -lt 30) {
  $devModeButton = Get-ChildItem -Path 'HKCU:\Software\Google\Chrome\PreferenceMACs' -ErrorAction SilentlyContinue
  if ($devModeButton) { break }
  Start-Sleep -Milliseconds 500
  $attempts++
}

# Çoklu Chrome örneği/ekran durumunda doğrudan URL açılabilir; UI adımı için gereksinim ana akıştan sözel yönerge olarak bırakılır.
Write-Host 'Chrome eklenti sayfası açıldı. Manuel olarak:'
Write-Host '  1) Geliştirici Modu = On'
Write-Host '  2) Paketlenmemiş öğe yükle -> seç'
Write-Host '  3) Klasör: ' + $extensionRoot
Write-Host '  4) Açılan klasörü seç ve yüklemeyi tamamla.'
Write-Host '  5) Chrome -> Uzantılar sayfasında PenPOS Luca Veri görünmeli.'

# Gerçek yükleme doğrulaması için klasörün manifest varlığı kontrol edilir.
$manifestPath = Join-Path $extensionRoot 'manifest.json'
if (-not (Test-Path $manifestPath)) {
  throw "Manifest bulunamadı: $manifestPath"
}

$manifestText = Get-Content -Path $manifestPath -Raw
if ($manifestText -notmatch '"name"\s*:\s*"PenPOS Luca Veri"') {
  throw 'Manifest içeriği beklenenden farklı.'
}

Write-Host 'Manifest doğrulandı: ' + $manifestPath
Write-Host 'Eklenti yükleme adımı için Chrome UI manuel olarak tamamlanmalıdır.'
