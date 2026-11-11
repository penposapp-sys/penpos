$ErrorActionPreference = 'Stop'
$infPath = Join-Path $PSScriptRoot 'silabser.inf'

if (-not (Test-Path -LiteralPath $infPath)) {
  exit 2
}

$pnputilPath = Join-Path $env:SystemRoot 'System32\pnputil.exe'
if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess) {
  $pnputilPath = Join-Path $env:SystemRoot 'Sysnative\pnputil.exe'
}

# Skip installation if the Silicon Labs package is already present in the driver store.
$existingDrivers = & $pnputilPath /enum-drivers 2>$null
if ($LASTEXITCODE -eq 0 -and ($existingDrivers -match '(?i)silabser\.inf')) {
  exit 0
}

# The NSIS installer is configured per-machine and already has administrator rights.
& $pnputilPath /add-driver $infPath /install | Out-Null
exit $LASTEXITCODE
