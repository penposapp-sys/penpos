# Print Agent Exe Build

Bu klasorden portable `exe` uretilebilir.

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

## Canli guncelleme mantigi

Bu exe olustuktan sonra iki yol var:

1. Kurulu agent klasorundeki eski exe bununla degistirilir ve servis yeniden baslatilir.
2. Elinizde ayri bir setup projesi varsa, setup icine bu yeni exe konur ve installer yeniden alinır.

## Onemli not

Bu repo icinde installer (`Setup.exe`) projesi gorunmuyor. Buradan su anda portable agent exe uretiyoruz.
