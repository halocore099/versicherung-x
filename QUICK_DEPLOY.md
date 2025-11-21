# Quick Deployment Checklist

## Pre-Deployment

- [ ] Upload project files to server
- [ ] Install Python 3.13+ and Node.js/Yarn
- [ ] Configure MySQL database
- [ ] Set up domain in ISPConfig

## Deployment Steps

### 1. Install Dependencies
```bash
# Backend
cd backend && uv venv && source venv/bin/activate && uv pip install -r requirements.txt

# Frontend  
cd frontend && yarn install
```

### 2. Build Frontend
```bash
cd frontend && yarn build
```

### 3. Configure Environment
```bash
# Create .env file in backend/ with your secrets
nano backend/.env
```

### 4. Create Systemd Service
```bash
sudo nano /etc/systemd/system/versicherung-x-backend.service
# Copy content from DEPLOYMENT.md
sudo systemctl enable versicherung-x-backend
sudo systemctl start versicherung-x-backend
```

### 5. Configure ISPConfig Reverse Proxy

**In ISPConfig Web Interface:**
1. Sites → Your Domain → Options
2. Apache Directives or Nginx Directives
3. Paste configuration from `ISPConfig_Reverse_Proxy_Config.txt`
4. **IMPORTANT:** Replace `/var/www/your-domain.com` with your actual path
5. Save and restart web server

### 6. Set Permissions
```bash
sudo chown -R www-data:www-data /var/www/your-domain.com/versicherung-x
sudo chmod -R 755 /var/www/your-domain.com/versicherung-x
```

## ISPConfig Configuration Summary

**What to add in ISPConfig:**

1. **Apache Directives** (if using Apache):
   - Proxy `/routes` → `http://127.0.0.1:8000/routes`
   - Serve static files from `/frontend/dist`
   - Enable React Router (SPA) support

2. **Nginx Directives** (if using Nginx):
   - Proxy `/routes` → `http://127.0.0.1:8000`
   - Serve static files from `/frontend/dist`
   - Enable React Router (SPA) support

**Key Points:**
- Backend runs on `127.0.0.1:8000` (localhost only, not public)
- Frontend static files served from `frontend/dist/`
- API requests to `/routes/*` are proxied to backend
- All other requests serve the React app (for client-side routing)

## Verify Deployment

```bash
# Check backend service
sudo systemctl status versicherung-x-backend

# Check backend logs
sudo journalctl -u versicherung-x-backend -f

# Test API endpoint
curl http://127.0.0.1:8000/routes/view_cases/cases

# Visit your domain in browser
```

## Common Issues

- **403 Forbidden**: Check file permissions (should be www-data:www-data)
- **502 Bad Gateway**: Backend not running, check systemd service
- **404 on routes**: Reverse proxy not configured correctly
- **Blank page**: Frontend not built or wrong DocumentRoot path

