!macro customInstall
  DetailPrint "PenPOS USB serial driver check..."
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\cp210x\install-driver.ps1"' $0
  IntCmp $0 0 cp210x_driver_ready
  MessageBox MB_ICONSTOP|MB_OK "CP210x USB driver installation failed (code $0). Run setup as a Windows administrator or ask your system administrator to install it."
  Abort
cp210x_driver_ready:
!macroend
