# LAN Test (Telefon)

## URL’ler

- Frontend (Vite): `http://192.168.1.233:5173`
- Backend (API): `http://192.168.1.233:4000/api/health`

## Frontend API URL

- LAN için: `frontend/.env` ve `frontend/.env.lan` → `VITE_API_URL=http://192.168.1.233:4000`

## Komutlar

- Backend: `npm -C backend run dev`
- Frontend: `npm -C frontend run dev`

## Telefon Testi

- Telefon ve PC aynı Wi‑Fi’de olmalı.
- Telefonda UI: `http://192.168.1.233:5173`
- Login sonrası Network tabında isteklerin `http://192.168.1.233:4000/api/...` gittiğini doğrula.

## Windows Firewall

- Inbound TCP izin ver: `4000` ve `5173`
- Alternatif: `node.exe` için “Allow app” / inbound izin
