[CmdletBinding()]
param(
  [string]$CertificateThumbprint = $env:PENPOS_SIGNING_CERT_THUMBPRINT,
  [string]$CertificatePath = $env:PENPOS_SIGNING_CERT_PATH,
  [string]$TimestampServer = 'http://timestamp.digicert.com',
  [switch]$AllowUnsignedLocalBuild
)

$ErrorActionPreference = 'Stop'

function Assert-CodeSigningCertificate {
  param(
    [System.Security.Cryptography.X509Certificates.X509Certificate2]$Certificate
  )

  if (-not $Certificate.HasPrivateKey) {
    throw 'The selected code-signing certificate does not have an accessible private key.'
  }
  if ($Certificate.NotBefore -gt (Get-Date) -or $Certificate.NotAfter -le (Get-Date)) {
    throw 'The selected code-signing certificate is not currently valid.'
  }

  $ekuExtension = $Certificate.Extensions |
    Where-Object { $_.Oid.Value -eq '2.5.29.37' } |
    Select-Object -First 1
  if (-not $ekuExtension) {
    throw 'The selected certificate has no Code Signing extended key usage.'
  }

  $eku = [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]$ekuExtension
  $hasCodeSigningUsage = @($eku.EnhancedKeyUsages | Where-Object { $_.Value -eq '1.3.6.1.5.5.7.3.3' }).Count -gt 0
  if (-not $hasCodeSigningUsage) {
    throw 'The selected certificate is not authorized for Code Signing.'
  }

  $chain = [System.Security.Cryptography.X509Certificates.X509Chain]::new()
  $chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::Online
  $chain.ChainPolicy.RevocationFlag = [System.Security.Cryptography.X509Certificates.X509RevocationFlag]::ExcludeRoot
  $chain.ChainPolicy.UrlRetrievalTimeout = [TimeSpan]::FromSeconds(20)
  if (-not $chain.Build($Certificate)) {
    $chainErrors = ($chain.ChainStatus | ForEach-Object { $_.StatusInformation.Trim() } | Where-Object { $_ }) -join '; '
    throw "The signing certificate chain is not trusted or could not be verified online: $chainErrors"
  }
}

$installerRoot = $PSScriptRoot
$repositoryRoot = (Resolve-Path (Join-Path $installerRoot '..\..')).Path
$extensionRoot = (Resolve-Path (Join-Path $repositoryRoot 'releases\production\PenPOS-Luca-Veri-v0.1.0\chrome-extension')).Path
$extensionFiles = @('background.js', 'content.js', 'manifest.json', 'popup.css', 'popup.html', 'popup.js')
$canonicalOutputPath = Join-Path $installerRoot 'PenPOS Luca Veri Setup.exe'
$publicDownloadPath = Join-Path $repositoryRoot 'backend\public\downloads\PenPOS Luca Veri Setup.exe'
$wrapperScript = Join-Path $installerRoot 'bundle_installer.py'
$signingCertificate = $null
$unsignedTestBuild = $false

if ($CertificateThumbprint -and $CertificatePath) {
  throw 'Set either PENPOS_SIGNING_CERT_THUMBPRINT or PENPOS_SIGNING_CERT_PATH, not both.'
}

if ($CertificatePath) {
  if (-not (Test-Path -LiteralPath $CertificatePath -PathType Leaf)) {
    throw "Signing certificate file not found: $CertificatePath"
  }
  $certificatePassword = [Environment]::GetEnvironmentVariable('PENPOS_SIGNING_CERT_PASSWORD', 'Process')
  if (-not $certificatePassword) {
    throw 'PENPOS_SIGNING_CERT_PASSWORD must be provided in the process environment for a PFX/P12 certificate.'
  }
  try {
    $signingCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
      (Resolve-Path -LiteralPath $CertificatePath).Path,
      $certificatePassword,
      [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet
    )
  } finally {
    $certificatePassword = $null
  }
} elseif ($CertificateThumbprint) {
  $normalizedThumbprint = $CertificateThumbprint -replace '\s', ''
  $signingCertificate = Get-ChildItem -Path 'Cert:\CurrentUser\My', 'Cert:\LocalMachine\My' -ErrorAction SilentlyContinue |
    Where-Object { $_.Thumbprint -eq $normalizedThumbprint } |
    Select-Object -First 1
  if (-not $signingCertificate) {
    throw "Code-signing certificate thumbprint was not found in the Windows certificate stores: $normalizedThumbprint"
  }
} elseif ($AllowUnsignedLocalBuild) {
  $unsignedTestBuild = $true
} else {
  throw 'A trusted Authenticode code-signing certificate is required. Use a CA-issued certificate from the Windows certificate store or provide PENPOS_SIGNING_CERT_PATH and PENPOS_SIGNING_CERT_PASSWORD. Use -AllowUnsignedLocalBuild only for local testing; it never publishes an EXE.'
}

if ($signingCertificate) {
  Assert-CodeSigningCertificate -Certificate $signingCertificate
  if (-not (Get-Command Set-AuthenticodeSignature -ErrorAction SilentlyContinue)) {
    throw 'Set-AuthenticodeSignature is unavailable; use Windows PowerShell on Windows.'
  }
}

$outputPath = $canonicalOutputPath
if ($unsignedTestBuild) {
  $unsignedOutputRoot = Join-Path $installerRoot 'artifacts'
  New-Item -ItemType Directory -Force -Path $unsignedOutputRoot | Out-Null
  $outputPath = Join-Path $unsignedOutputRoot 'PenPOS Luca Veri Setup-UNSIGNED-TEST.exe'
}

$stagingRoot = Join-Path $env:TEMP ('PenPOSLucaStage' + [guid]::NewGuid().ToString('N'))
$stagingExtension = Join-Path $stagingRoot 'chrome-extension'
$stagingInstallScript = Join-Path $stagingRoot 'install.ps1'
$buildDir = Join-Path $stagingRoot 'build'
$specDir = Join-Path $stagingRoot 'spec'
$distDir = Join-Path $stagingRoot 'dist'
$stagedOutputPath = Join-Path $distDir 'PenPOS Luca Veri Setup.exe'

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

New-Item -ItemType Directory -Force -Path $stagingExtension, $buildDir, $specDir, $distDir | Out-Null
Copy-Item -Path (Join-Path $extensionRoot '*') -Destination $stagingExtension -Recurse -Force
Copy-Item -LiteralPath (Join-Path $installerRoot 'install.ps1') -Destination $stagingInstallScript -Force

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

try {
  & py -m PyInstaller --noconsole --onefile --clean --distpath $distDir --workpath $buildDir --specpath $specDir --name 'PenPOS Luca Veri Setup' $wrapperScript --add-data "$stagingExtension;chrome-extension" --add-data "$stagingInstallScript;."
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed with exit code $LASTEXITCODE."
  }
  if (-not (Test-Path $stagedOutputPath)) {
    throw "PyInstaller did not generate the expected output file: $stagedOutputPath"
  }

  if ($signingCertificate) {
    $signature = Set-AuthenticodeSignature -FilePath $stagedOutputPath -Certificate $signingCertificate -HashAlgorithm SHA256 -TimestampServer $TimestampServer
    if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
      throw "Authenticode signing failed: $($signature.StatusMessage)"
    }
    $verifiedSignature = Get-AuthenticodeSignature -FilePath $stagedOutputPath
    if ($verifiedSignature.Status -ne [System.Management.Automation.SignatureStatus]::Valid -or $verifiedSignature.SignerCertificate.Thumbprint -ne $signingCertificate.Thumbprint) {
      throw "Signed EXE verification failed: $($verifiedSignature.Status)"
    }

    New-Item -ItemType Directory -Force -Path (Split-Path $publicDownloadPath -Parent) | Out-Null
    Copy-Item -LiteralPath $stagedOutputPath -Destination $canonicalOutputPath -Force
    Copy-Item -LiteralPath $stagedOutputPath -Destination $publicDownloadPath -Force
    $builtHash = (Get-FileHash $canonicalOutputPath -Algorithm SHA256).Hash
    $publicHash = (Get-FileHash $publicDownloadPath -Algorithm SHA256).Hash
    if ($builtHash -ne $publicHash) {
      throw 'Signed installer and public download EXE SHA-256 hashes do not match.'
    }

    Write-Host "SIGNED DISTRIBUTION READY: $canonicalOutputPath"
    Write-Host "Published: $publicDownloadPath"
    Write-Host "SHA256: $builtHash"
    Write-Host "Signer: $($verifiedSignature.SignerCertificate.Subject)"
  } else {
    $unsignedSignature = Get-AuthenticodeSignature -FilePath $stagedOutputPath
    if ($unsignedSignature.Status -ne [System.Management.Automation.SignatureStatus]::NotSigned) {
      throw "Unsigned test build has an unexpected signature state: $($unsignedSignature.Status)"
    }
    Copy-Item -LiteralPath $stagedOutputPath -Destination $outputPath -Force
    Write-Host "UNSIGNED LOCAL TEST ONLY: $outputPath"
    Write-Host 'Not copied to the canonical installer or public download path.'
    Write-Host "SHA256: $((Get-FileHash $outputPath -Algorithm SHA256).Hash)"
  }
} finally {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
}