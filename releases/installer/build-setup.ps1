$ErrorActionPreference = 'Stop'

$installerRoot = $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $installerRoot '..\..')).Path
$extensionRoot = (Resolve-Path (Join-Path $repositoryRoot 'chrome-extension')).Path
$outputPath = Join-Path $installerRoot 'PenPOS Luca Veri Setup.exe'
$temporaryOutput = Join-Path $env:TEMP ('PenPOSLuca-' + [guid]::NewGuid().ToString('N') + '.exe')
$stagingRoot = Join-Path $env:TEMP ('PenPOSLucaStage' + [guid]::NewGuid().ToString('N'))
$stagingExtension = Join-Path $stagingRoot 'chrome-extension'
$temporarySed = Join-Path $env:TEMP ('PenPOSLuca-' + [guid]::NewGuid().ToString('N') + '.sed')
$templatePath = Join-Path $installerRoot 'PenPOS-Luca-Veri.sed'
$iexpressPath = Join-Path $env:WINDIR 'System32\iexpress.exe'

if (-not (Test-Path (Join-Path $extensionRoot 'manifest.json'))) {
  throw "Extension manifest not found: $extensionRoot"
}
if (-not (Test-Path $iexpressPath)) {
  throw "IExpress not found: $iexpressPath"
}

$sed = [System.IO.File]::ReadAllText($templatePath)
$sed = $sed.Replace('__TARGET_NAME__', $temporaryOutput)
$sed = $sed.Replace('__STAGED_ROOT__', $stagingRoot)

if ($sed.Contains('__TARGET_NAME__') -or $sed.Contains('__STAGED_ROOT__')) {
  throw 'IExpress SED path substitution failed.'
}

[System.IO.File]::WriteAllText($temporarySed, $sed, [System.Text.Encoding]::Default)
$buildSucceeded = $false
try {
  New-Item -ItemType Directory -Force -Path $stagingExtension | Out-Null
  Copy-Item -Path (Join-Path $extensionRoot '*') -Destination $stagingExtension -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $installerRoot 'install.ps1') -Destination $stagingRoot -Force

  if (-not (Test-Path (Join-Path $stagingExtension 'manifest.json'))) {
    throw 'Current extension sources were not copied into the IExpress staging folder.'
  }
  if (-not (Test-Path (Join-Path $stagingRoot 'install.ps1'))) {
    throw 'install.ps1 was not copied into the extraction root.'
  }

  if (Test-Path $temporaryOutput) {
    Remove-Item -LiteralPath $temporaryOutput -Force
  }

  Push-Location $installerRoot
  try {
    & $iexpressPath /N $temporarySed
  } finally {
    Pop-Location
  }
  if (-not (Test-Path $temporaryOutput)) {
    throw "IExpress did not create the expected package. Diagnostic SED retained at: $temporarySed"
  }

  Copy-Item -LiteralPath $temporaryOutput -Destination $outputPath -Force
  if (-not (Test-Path $outputPath)) {
    throw "The package was created but could not be copied to: $outputPath"
  }

  $buildSucceeded = $true
  Write-Host "Created: $outputPath"
} finally {
  Remove-Item -LiteralPath $temporaryOutput -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
  if ($buildSucceeded) {
    Remove-Item -LiteralPath $temporarySed -Force -ErrorAction SilentlyContinue
  } else {
    Write-Warning "Diagnostic SED retained at: $temporarySed"
  }
}