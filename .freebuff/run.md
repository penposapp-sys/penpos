# Run Doc — PenPOS Local Preview

## Reproduce uncommitted artifacts

1. Backend `.env` is already committed at `backend/.env` (contains `MONGODB_URI`).
2. Frontend `.env.development` is already committed at `frontend/.env.development` (contains `VITE_API_URL=http://localhost:4000/api`).
3. Run `npm install` in both `backend/` and `frontend/` if `node_modules/` is missing.

## Start the servers

### Backend (port 4000)
Already running on this machine (PID 9884). If not:
```
cd backend && node src/index.js
```

### Frontend (port 5173)
Already running on this machine (PID 21580). If not, from the project root:
```
cd frontend && npx vite --host 0.0.0.0
```

### Windows detached start (for Preview tab)
```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList 'node_modules\vite\bin\vite.js','--host','0.0.0.0' -WorkingDirectory '<frontend_dir>' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

## Health checks
- Backend: `curl http://localhost:4000/api/health`
- Frontend: `curl -o /dev/null -w "%{http_code}" http://localhost:5173/`
