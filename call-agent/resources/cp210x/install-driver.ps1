$ErrorActionPreference = 'Stop'
$infPath = Join-Path $PSScriptRoot 'silabser.inf'

if (-not (Test-Path -LiteralPath $infPath)) {
  exit 2
}

$pnputilPath = Join-Path $env:SystemRoot 'System32\pnputil.exe'
if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess) {
  $pnputilPath = Join-Path $env:SystemRoot 'Sysnative\pnputil.exe'
}

# Skip elevation if the Silicon Labs package is already present in the driver store.
$existingDrivers = & $pnputilPath /enum-drivers 2>$null
if ($LASTEXITCODE -eq 0 -and ($existingDrivers -match '(?i)silabser\.inf')) {
  exit 0
}

$quotedInfPath = '"' + $infPath + '"'
$argumentLine = "/add-driver $quotedInfPath /install"
try {
  $process = Start-Process -FilePath $pnputilPath -ArgumentList $argumentLine -Verb RunAs -Wait -PassThru
  exit $process.ExitCode
} catch {
  # Includes a user declining the standard Windows administrator prompt.
  exit 1
}
