$ErrorActionPreference = 'Stop'

$targetRoot = Join-Path $env:LOCALAPPDATA 'PenPOS\Luca Veri'
$targetExtension = Join-Path $targetRoot 'chrome-extension'
$sourceExtension = Join-Path $PSScriptRoot 'chrome-extension'
$extensionFiles = @(
  'background.js',
  'content.js',
  'manifest.json',
  'popup.css',
  'popup.html',
  'popup.js'
)

try {
  if (-not (Test-Path (Join-Path $sourceExtension 'manifest.json'))) {
    $flatFilesPresent = $extensionFiles | Where-Object { Test-Path (Join-Path $PSScriptRoot $_) }
    if (-not $flatFilesPresent -or $flatFilesPresent.Count -lt 1) {
      throw 'Paketin chrome-extension klasoru ve gerekli extension dosyaları eksik.'
    }

    New-Item -ItemType Directory -Force -Path $sourceExtension | Out-Null
    foreach ($file in $extensionFiles) {
      $sourceFile = Join-Path $PSScriptRoot $file
      if (Test-Path $sourceFile) {
        Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $sourceExtension $file) -Force
      }
    }
  }

  New-Item -ItemType Directory -Force -Path $targetExtension | Out-Null

  if ((Resolve-Path $sourceExtension).Path -eq (Resolve-Path $targetExtension).Path) {
    throw 'Chrome extension kaynak ve hedef klasor ayni olamaz; gecici extraction klasoru kullanilmali.'
  }

  Copy-Item -Path (Join-Path $sourceExtension '*') -Destination $targetExtension -Recurse -Force

  $manifestPath = Join-Path $targetExtension 'manifest.json'
  if (-not (Test-Path $manifestPath)) {
    throw 'Chrome extension manifest.json bulunamadi.'
  }

  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $requiredFiles = @()

  if ($manifest.background -and $manifest.background.service_worker) {
    $requiredFiles += $manifest.background.service_worker
  }
  if ($manifest.action -and $manifest.action.default_popup) {
    $requiredFiles += $manifest.action.default_popup
  }
  foreach ($entry in @($manifest.content_scripts)) {
    foreach ($script in @($entry.js)) {
      $requiredFiles += $script
    }
  }
  if ($manifest.web_accessible_resources) {
    foreach ($resource in @($manifest.web_accessible_resources)) {
      if ($resource -is [string]) {
        $requiredFiles += $resource
      } elseif ($resource -is [System.Collections.IEnumerable]) {
        foreach ($item in $resource) {
          if ($item -is [string]) { $requiredFiles += $item }
        }
      }
    }
  }

  $requiredFiles = @($requiredFiles | Where-Object { $_ } | Select-Object -Unique)
  foreach ($relativeFile in $requiredFiles) {
    $finalPath = Join-Path $targetExtension $relativeFile
    if (-not (Test-Path $finalPath)) {
      throw "Chrome extension manifest runtime dosyasi eksik: $relativeFile"
    }
  }

  $uninstaller = @'
$ErrorActionPreference = 'Stop'
$targetRoot = Join-Path $env:LOCALAPPDATA 'PenPOS\Luca Veri'
if (Test-Path $targetRoot) {
  Remove-Item -Path $targetRoot -Recurse -Force
}
Write-Host 'PenPOS Luca Veri kaldırıldı.'
'@
  Set-Content -Path (Join-Path $targetRoot 'Uninstall-PenPOS-Luca-Veri.ps1') -Value $uninstaller -Encoding UTF8

  $chromePaths = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  )
  $chromePath = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1

  if ($chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList 'chrome://extensions/'
  }

  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Clipboard]::SetText($targetExtension)
  } catch {
  }

  $instructions = @"
Kurulum dosyalari hazirlandi ve su klasore cikarildi:
$targetExtension

$(if ($chromePath) { 'Chrome eklenti sayfasi acildi.' } else { 'Chrome bulunamadi. Chrome kurulduktan sonra chrome://extensions/ adresini acin.' })

Chrome'un zorunlu son adimi:
1. Geliştirici Modu'nu acin.
2. Paketlenmemis oge yukle'ye tiklayin.
3. Acilan klasor secicide Ctrl+V ile hazirlanan yolu yapistirip klasoru secin.

Klasor yolu panoya kopyalandi. Bu adim Chrome guvenlik siniri nedeniyle kullanici tarafindan onaylanmalidir.
"@
  [System.Windows.Forms.MessageBox]::Show(
    $instructions,
    'PenPOS Luca Veri kurulumu',
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  ) | Out-Null
} catch {
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      $_.Exception.Message,
      'PenPOS Luca Veri kurulumu basarisiz',
      [System.Windows.Forms.MessageBoxButtons]::OK,
      [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
  } catch {
    Write-Error $_
  }
  exit 1
}
