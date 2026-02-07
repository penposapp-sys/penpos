# ENV Kullanımı (Local vs LAN)

## Standart

- `frontend/.env` **LOCAL** içindir.
  - `VITE_API_URL=http://127.0.0.1:4000`
- `frontend/.env.lan` **LAN** içindir.
  - `VITE_API_URL=http://192.168.x.x:4000`

`frontend/.env` dosyası asla LAN IP içermemelidir.

## Komutlar

### Local geliştirme

```bash
npm -C frontend run dev
```

- Frontend `http://127.0.0.1:4000` backend’e gider.
- Backend aynı PC’de çalışmalıdır.

### LAN test (telefon/başka PC)

```bash
npm -C frontend run dev:lan
```

- Vite LAN’da yayın yapar (`--host 0.0.0.0`).
- `--mode lan` ile `frontend/.env.lan` devreye girer.

## Notlar

- `.env` değişince Vite dev server restart gerekir.
- Yanlışlıkla local ortamda `192.168.*` API URL kullanılırsa, konsola uyarı basılır.

