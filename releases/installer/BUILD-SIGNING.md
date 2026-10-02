# PenPOS Luca Veri Installer Signing

The default installer build is fail-closed: it publishes an EXE only after Authenticode signing and signature verification succeed. It never creates or trusts a self-signed certificate.

## Required certificate

Obtain an organization-validated Authenticode Code Signing certificate from a publicly trusted CA for the legal entity distributing PenPOS. The certificate must include the Code Signing EKU (`1.3.6.1.5.5.7.3.3`), a usable private key, and a trusted certificate chain. OV or EV code-signing certificates are appropriate; EV is not a guarantee that SmartScreen or Smart App Control will immediately allow a new binary.

## Certificate in the Windows store

Install the CA-issued certificate and private key in `CurrentUser\My` or `LocalMachine\My`, then set its thumbprint outside the repository:

```powershell
$env:PENPOS_SIGNING_CERT_THUMBPRINT = '<certificate thumbprint>'
.\build-setup.ps1
```

## External PFX/P12

Keep the CA-issued `.pfx`/`.p12` outside the repository. Provide its path and set the password only in the current PowerShell process; do not put it in a script, command history, or repository file:

```powershell
$env:PENPOS_SIGNING_CERT_PATH = 'C:\secure\PenPOS-CodeSigning.pfx'
$securePassword = Read-Host 'PFX password' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:PENPOS_SIGNING_CERT_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
.\build-setup.ps1
Remove-Item Env:PENPOS_SIGNING_CERT_PASSWORD
Remove-Item Env:PENPOS_SIGNING_CERT_PATH
```

The build checks validity, private-key availability, Code Signing EKU, and the online certificate chain. It signs using SHA-256, applies a timestamp, verifies the Authenticode signature, and only then updates the canonical and public-download EXEs. The public copy must hash-match the signed build.

## Local unsigned test build

Unsigned output is available only by explicit opt-in and is written to `releases/installer/artifacts/PenPOS Luca Veri Setup-UNSIGNED-TEST.exe`. It does not replace the canonical EXE or update `backend/public/downloads`:

```powershell
.\build-setup.ps1 -AllowUnsignedLocalBuild
```

This test artifact is not suitable for distribution.