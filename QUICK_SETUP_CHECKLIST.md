# Quick Setup Checklist

## Backend Server Setup

- [ ] SSH to backend server
- [ ] Install Docker (if not installed)
- [ ] Create directory: `~/versicherung-x/backend`
- [ ] Upload backend files (main.py, requirements.txt, Dockerfile, docker-compose.yml, app/, databutton_app/)
- [ ] Create `.env` file with database, Firebase, and Repairline credentials
- [ ] Build Docker image: `docker build -t versicherung-x-backend .`
- [ ] Start container: `docker compose up -d`
- [ ] Verify backend: `curl http://localhost:8000/routes/`
- [ ] Install cloudflared: Download from GitHub releases
- [ ] Login to Cloudflare: `cloudflared tunnel login`
- [ ] Create tunnel: `cloudflared tunnel create versicherung-x-backend`
- [ ] Create config: `~/.cloudflared/config.yml`
- [ ] Configure DNS in Cloudflare Dashboard
- [ ] Start tunnel: `cloudflared tunnel run versicherung-x-backend` (or systemd service)
- [ ] Test API: `curl https://api.your-domain.com/routes/`

## Frontend Server Setup

- [ ] SSH to frontend server
- [ ] Install Nginx or Apache
- [ ] On local machine: Build frontend with `./build-production.sh` or `yarn build`
- [ ] Upload `frontend/dist/*` to `~/versicherung-x/frontend/` on server
- [ ] Configure web server (Nginx/Apache) to serve static files
- [ ] Configure proxy for `/routes/` to backend API
- [ ] Setup SSL with Let's Encrypt: `sudo certbot --nginx -d your-domain.com`
- [ ] Test frontend: Visit `https://your-domain.com`

## Files to Upload

### Backend Server
```
backend/
├── main.py
├── requirements.txt
├── routers.json
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env (create on server)
├── app/
└── databutton_app/
```

### Frontend Server
```
frontend/dist/  (contents only, not the dist folder itself)
├── index.html
├── assets/
└── ...
```

## Environment Variables

### Backend (.env)
```env
MYSQL_HOST=...
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=...
FIREBASE_SERVICE_ACCOUNT_JSON={...}
REPAIRLINE_API_USERNAME=...
REPAIRLINE_API_PASSWORD=...
```

### Frontend (build-time)
```bash
VITE_API_URL=""  # Empty for relative paths
VITE_API_PREFIX_PATH="/routes"
```

## Quick Commands

### Backend
```bash
# View logs
docker logs -f versicherung-x-backend

# Restart
docker restart versicherung-x-backend

# Update (after code changes)
cd ~/versicherung-x/backend
docker compose down
docker compose build
docker compose up -d
```

### Frontend
```bash
# Rebuild locally
cd frontend
./build-production.sh

# Upload to server
scp -r dist/* user@server:~/versicherung-x/frontend/
```

### Cloudflare Tunnel
```bash
# Check status
cloudflared tunnel info versicherung-x-backend

# View logs (systemd)
sudo journalctl -u cloudflared-tunnel -f

# Restart
sudo systemctl restart cloudflared-tunnel
```

