# Print Agent Exe Build

Bu klasorden portable `exe` uretilebilir.

Print Agent, ESC/POS RAW yazdirma sirasinda Base64 ile tasinan ikili veriyi
dogrudan yaziciya gonderebilir. Tasarimli masa fislerinde Base64 encoding bilgisi
zorunludur; eksik veya hatali aktarim artik metin olarak yazdirilmaz. Diger metin RAW
yazdirma davranisi degismez.

Release surumunun tek kaynagi `print-agent/package.json` dosyasidir. `npm run build:exe`
bu surumu Agent runtime koduna ve Electron Setup `package.json`/lock dosyalarina otomatik
esitler. Print Agent deploy BAT'i ayni PS1 akisini kullandigi icin Agent, Setup ve Release
JSON surumleri tek bir surum degisikligiyle birlikte uretilir.

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

Agent ve Setup surumleri ayni tutulur ve tek surum kaynagi bu projenin `package.json`
dosyasidir. Tek seferlik yerel build ve paket kontrolu icin
`PenPOS-PrintAgent-Deploy.ps1 -BuildOnly`; Setup ve Agent'i tek seferde yayinlamak icin
ayni klasordeki BAT kullanilir.
