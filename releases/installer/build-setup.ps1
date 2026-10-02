$ErrorActionPreference = 'Stop'

$installerRoot = $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $installerRoot '..\..')).Path
$extensionRoot = (Resolve-Path (Join-Path $repositoryRoot 'releases\production\PenPOS-Luca-Veri-v0.1.0\chrome-extension')).Path
$extensionFiles = @('background.js', 'content.js', 'manifest.json', 'popup.css', 'popup.html', 'popup.js')
$outputPath = Join-Path $installerRoot 'PenPOS Luca Veri Setup.exe'
$stagingRoot = Join-Path $env:TEMP ('PenPOSLucaStage' + [guid]::NewGuid().ToString('N'))
$stagingExtension = Join-Path $stagingRoot 'chrome-extension'
$wrapperScript = Join-Path $installerRoot 'bundle_installer.py'

foreach ($file in $extensionFiles) {
  if (-not (Test-Path (Join-Path $extensionRoot $file))) {
    throw "Production extension file not found: $(Join-Path $extensionRoot $file)"
  }
}

if (-not (Test-Path $wrapperScript)) {
  throw "Bundle installer script not found: $wrapperScript"
}

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
  throw 'Python launcher (py) is required to build the EXE package.'
}

if (Test-Path $outputPath) {
  Remove-Item -LiteralPath $outputPath -Force
}

New-Item -ItemType Directory -Force -Path $stagingExtension | Out-Null
Copy-Item -Path (Join-Path $extensionRoot '*') -Destination $stagingExtension -Recurse -Force
Copy-Item -LiteralPath (Join-Path $installerRoot 'install.ps1') -Destination $stagingRoot -Force

foreach ($file in $extensionFiles) {
  $sourceFile = Join-Path $extensionRoot $file
  $stagedFile = Join-Path $stagingExtension $file
  if (-not (Test-Path $stagedFile)) {
    throw "Production extension file was not staged: $file"
  }
  if ((Get-FileHash $sourceFile -Algorithm SHA256).Hash -ne (Get-FileHash $stagedFile -Algorithm SHA256).Hash) {
    throw "Staged extension file does not match production source: $file"
  }
}

if (-not (Test-Path (Join-Path $stagingRoot 'install.ps1'))) {
  throw 'install.ps1 was not copied into the staging root.'
}

$buildDir = Join-Path $stagingRoot 'build'
$specDir = Join-Path $stagingRoot 'spec'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null
New-Item -ItemType Directory -Force -Path $specDir | Out-Null

try {
  & py -m PyInstaller --noconsole --onefile --clean --distpath $installerRoot --workpath $buildDir --specpath $specDir --name 'PenPOS Luca Veri Setup' $wrapperScript --add-data "$stagingExtension;chrome-extension" --add-data "$stagingRoot\install.ps1;."

  if (-not (Test-Path $outputPath)) {
    throw "PyInstaller did not generate the expected output file: $outputPath"
  }

  $publicDownloadPath = Join-Path $repositoryRoot 'backend\public\downloads\PenPOS Luca Veri Setup.exe'
  Copy-Item -LiteralPath $outputPath -Destination $publicDownloadPath -Force
  if ((Get-FileHash $outputPath -Algorithm SHA256).Hash -ne (Get-FileHash $publicDownloadPath -Algorithm SHA256).Hash) {
    throw 'Published installer does not match the freshly built EXE.'
  }

  Write-Host "Created: $outputPath"
  Write-Host "Published: $publicDownloadPath"
} finally {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
}