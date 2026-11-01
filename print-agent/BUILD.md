# Print Agent Exe Build

Bu klasorden portable `exe` uretilebilir.

Print Agent `0.1.9`, ESC/POS RAW yazdirma sirasinda Base64 ile tasinan ikili veriyi
dogrudan yaziciya gonderebilir. Bu, termal fislerde logo raster verisi icin kullanilir;
mevcut metin RAW yazdirma davranisi degismez.

## Gerekenler

- Node.js kurulu olmali
- `pkg` araci lazim

## Ilk kurulum

```powershell
cd print-agent
npm install --save-dev pkg
```

## Exe uretme

```powershell
cd print-agent
npm run build:exe
```

Uretilen dosya:

```text
print-agent/dist/PenPOS_PrintAgent.exe
```

## Backend icine gommeli cikti

Eger agent binary'sini backend download alanina da kopyalamak istiyorsan:

```powershell
cd print-agent
npm run build:backend
```

Bu komut su dosyayi gunceller:

```text
backend/public/downloads/print-agent/windows/PenPOS_PrintAgent.exe
```

Ek olarak `PenPOS_PrintAgent_Release.json` Agent surumunu kaydeder; backend manifesti
binary yanindaki bu metadata dosyasini kullanir.

## Canli guncelleme mantigi

Electron Setup kaynaklari `PenPos YAZICI exe` klasorundedir. Agent kaynagi olarak yalnizca
bu `print-agent` projesi kullanilir; Setup paketi canonical Agent EXE'sini WinSW ile
ProgramData'ya kurar ve servisi `--config C:\ProgramData\PenPOS\PrintAgent\config.json`
parametresiyle baslatir. Mevcut config dosyasi Setup tarafindan degistirilmez.

Iki surum bagimsizdir: Agent surumu bu projenin `package.json` dosyasindan, Setup
surumu Electron Setup projesinin `package.json` dosyasindan gelir. Tek seferlik yerel
build ve paket kontrolu icin `PenPOS-PrintAgent-Deploy.ps1 -BuildOnly`; Setup ve Agent'i
tek seferde yayinlamak icin ayni klasordeki BAT kullanilir.
