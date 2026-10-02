$ErrorActionPreference = 'Stop'

try {
  [void][System.Reflection.Assembly]::LoadWithPartialName('UIAutomationClient')
  [void][System.Reflection.Assembly]::LoadWithPartialName('UIAutomationTypes')
} catch {
  Write-Warning 'Windows UI Automation yüklenemedi; otomasyon devre dışı.'
}

function Get-UiElementByNames {
  param(
    [string[]] $Names,
    [string[]] $ControlTypes = @('Button', 'ToggleButton', 'CheckBox', 'Window', 'Edit', 'Pane')
  )

  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)

  foreach ($name in $Names) {
    foreach ($type in $ControlTypes) {
      $match = $all | Where-Object {
        try {
          $_.Current.ControlType.ProgrammaticName -eq ('ControlType.' + $type) -and (
            ($_.Current.Name -and $_.Current.Name -match [regex]::Escape($name)) -or
            ($_.Current.AutomationId -and $_.Current.AutomationId -match [regex]::Escape($name))
          )
        } catch {
          $false
        }
      } | Select-Object -First 1

      if ($match) { return $match }
    }
  }

  return $null
}

function Invoke-UiElement {
  param($Element)

  if ($null -eq $Element) { return $false }

  try {
    $invokePattern = $Element.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    if ($invokePattern) {
      $invokePattern.Invoke()
      return $true
    }
  } catch {}

  try {
    $togglePattern = $Element.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
    if ($togglePattern) {
      $togglePattern.Toggle()
      return $true
    }
  } catch {}

  try {
    $selectionPattern = $Element.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    if ($selectionPattern) {
      $selectionPattern.Select()
      return $true
    }
  } catch {}

  return $false
}

function Set-UiValue {
  param($Element, [string] $Value)

  if ($null -eq $Element) { return $false }

  try {
    $valuePattern = $Element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    if ($valuePattern) {
      $valuePattern.SetValue($Value)
      return $true
    }
  } catch {}

  try {
    [System.Windows.Forms.SendKeys]::SendWait($Value)
    return $true
  } catch {}

  return $false
}

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
  throw ('Kurulum klasörü bulunamadı: ' + $extensionRoot)
}

$manifestPath = Join-Path $extensionRoot 'manifest.json'
if (-not (Test-Path $manifestPath)) {
  throw ('Manifest bulunamadı: ' + $manifestPath)
}

$manifestText = Get-Content -Path $manifestPath -Raw
if ($manifestText -notmatch '"name"\s*:\s*"PenPOS Luca Veri"') {
  throw 'Manifest içeriği beklenenden farklı.'
}

Write-Host ('Manifest doğrulandı: ' + $manifestPath)

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
  Write-Warning 'Chrome penceresi açılmadı; otomasyon mümkün değil. Manuel olarak devam edilmelidir.'
  Write-Host '  1) chrome://extensions adresini aç'
  Write-Host '  2) Geliştirici Modu = On'
  Write-Host '  3) Paketlenmemiş öğe yükle -> seç'
  Write-Host ('  4) Klasör: ' + $extensionRoot)
  Write-Host '  5) Chrome -> Uzantılar sayfasında PenPOS Luca Veri görünmeli.'
  exit 0
}

$automationAvailable = ('System.Windows.Automation.AutomationElement' -as [type]) -ne $null

if ($automationAvailable) {
  $attemptTimeout = (Get-Date).AddSeconds(25)
  $devModeFound = $false
  while ((Get-Date) -lt $attemptTimeout) {
    $devMode = Get-UiElementByNames -Names @('Developer Mode', 'Developer mode', 'Geliştirici Modu', 'Geliştirici modu') -ControlTypes @('ToggleButton', 'CheckBox', 'Button')
    if ($devMode) {
      $devModeFound = $true
      if (Invoke-UiElement -Element $devMode) {
        Write-Host 'UI Automation: Geliştirici Modu açıldı.'
        break
      }
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $devModeFound) {
    Write-Warning 'Developer Mode kontrolü otomatik bulunamadı; manuel adım gerekli.'
  }

  $attemptTimeout = (Get-Date).AddSeconds(25)
  $loadUnpackedFound = $false
  while ((Get-Date) -lt $attemptTimeout) {
    $loadUnpacked = Get-UiElementByNames -Names @('Load unpacked', 'Load Unpacked', 'Paketlenmemiş öğe yükle', 'Paketlenmemis oge yukle') -ControlTypes @('Button')
    if ($loadUnpacked) {
      $loadUnpackedFound = $true
      if (Invoke-UiElement -Element $loadUnpacked) {
        Write-Host 'UI Automation: Paketlenmemiş öğe yükle butonuna tıklandı.'
        break
      }
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $loadUnpackedFound) {
    Write-Warning 'Paketlenmemiş öğe yükle butonu otomatik bulunamadı; manuel adım gerekli.'
  }

  $attemptTimeout = (Get-Date).AddSeconds(20)
  $folderDialogFound = $false
  while ((Get-Date) -lt $attemptTimeout) {
    $folderDialog = Get-UiElementByNames -Names @('Open Folder', 'Choose Folder', 'Select Folder', 'Klasörü Seç', 'Klasor Sec', 'Open', 'Aç', 'Seç') -ControlTypes @('Window')
    if ($folderDialog) {
      $folderDialogFound = $true
      $editField = $folderDialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) |
        Where-Object { $_.Current.ControlType.ProgrammaticName -eq 'ControlType.Edit' -or $_.Current.ControlType.ProgrammaticName -eq 'ControlType.ComboBox' } |
        Select-Object -First 1

      if ($editField) {
        [void](Set-UiValue -Element $editField -Value $extensionRoot)
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
        Write-Host ('UI Automation: Klasör yolu gönderildi -> ' + $extensionRoot)
        break
      }
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $folderDialogFound) {
    Write-Warning 'Klasör seçim penceresi otomatik bulunamadı; manuel seçim gerekli.'
  }
}

Write-Host 'Chrome eklenti sayfası açıldı. Otomasyon denendi; manuel kontrol gerekebilir.'
Write-Host '  1) Geliştirici Modu = On'
Write-Host '  2) Paketlenmemiş öğe yükle -> seç'
Write-Host ('  3) Klasör: ' + $extensionRoot)
Write-Host '  4) Açılan klasörü seç ve yüklemeyi tamamla.'
Write-Host '  5) Chrome -> Uzantılar sayfasında PenPOS Luca Veri görünmeli.'
Write-Host 'Otomasyon başarılı olamazsa, bu adımların manuel olarak yapılması gerekir.'
