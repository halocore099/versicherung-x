# Complete Setup Guide: ISPConfig Frontend + Separate Backend VM

This guide walks you through deploying the Versicherung-X application:
1. **Backend Server (Linux VM)**: Runs the FastAPI backend in Docker with Cloudflare Tunnel
2. **Frontend (ISPConfig Server)**: Serves static frontend files via ISPConfig

---

## Prerequisites

- Linux VM for backend (Ubuntu/Debian recommended)
- ISPConfig server with access to configure sites
- SSH access to backend VM
- Docker installed on backend VM (or ability to install it)
- Cloudflare account with a domain
- MySQL database (can be on backend server or separate)

---

## Part 1: Backend Server Setup (Linux VM)

### Step 1: Connect to Backend Server

```bash
ssh user@backend-vm-ip
```

### Step 2: Install Docker (if not installed)

```bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group (to run without sudo)
sudo usermod -aG docker $USER
newgrp docker  # Or logout/login

# Verify installation
docker --version
docker compose version
```

**Note**: If you don't have sudo, ask your hosting provider to install Docker or use a Docker-enabled VPS.

### Step 3: Create Project Directory

```bash
mkdir -p ~/versicherung-x/backend
cd ~/versicherung-x/backend
```

### Step 4: Upload Backend Files

From your local machine, upload the backend files:

```bash
# From your local machine
cd /path/to/versicherung-x
scp -r backend/* user@backend-vm-ip:~/versicherung-x/backend/
```

**Required files:**
- `main.py`
- `requirements.txt`
- `routers.json`
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `.env` (with your credentials)
- `app/` directory (entire folder)
- `databutton_app/` directory (entire folder)

### Step 5: Create/Update Environment File

```bash
cd ~/versicherung-x/backend
nano .env  # Or use vi/vim
```

Fill in your values:

```env
# Database Configuration
MYSQL_HOST=your_mysql_host
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=your_database_name

# Firebase Service Account (JSON string - keep it on one line)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}

# Firebase Client Config
FIREBASE_CONFIG={"apiKey":"...","projectId":"..."}

# Repairline API Credentials
REPAIRLINE_API_USERNAME=your_repairline_username
REPAIRLINE_API_PASSWORD=your_repairline_password

# Optional
DATABUTTON_SERVICE_TYPE=production
```

Save and exit (Ctrl+X, then Y, then Enter for nano).

### Step 6: Build and Start Docker Container

```bash
cd ~/versicherung-x/backend

# Build the Docker image
docker build -t versicherung-x-backend .

# Start with docker-compose
docker compose up -d

# Or start manually
docker run -d \
  --name versicherung-x-backend \
  -p 8000:8000 \
  --env-file .env \
  --restart unless-stopped \
  versicherung-x-backend
```

### Step 7: Verify Backend is Running

```bash
# Check container status
docker ps

# Check logs
docker logs versicherung-x-backend

# Test API (should return 404 or health check response)
curl http://localhost:8000/routes/
```

### Step 8: Install Cloudflare Tunnel

```bash
# Download cloudflared
cd ~
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64

# Make executable
chmod +x cloudflared-linux-amd64

# Move to /usr/local/bin (or ~/bin if no sudo)
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
# OR if no sudo:
mkdir -p ~/bin
mv cloudflared-linux-amd64 ~/bin/cloudflared
export PATH="$HOME/bin:$PATH"

# Verify installation
cloudflared --version
```

### Step 9: Login to Cloudflare

```bash
cloudflared tunnel login
```

This will open a browser window. Select your domain and authorize the tunnel.

### Step 10: Create Cloudflare Tunnel

```bash
# Create tunnel
cloudflared tunnel create versicherung-x-backend

# List tunnels to get the ID
cloudflared tunnel list
```

**Note the Tunnel ID** (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Step 11: Configure Cloudflare Tunnel

```bash
# Create config directory
mkdir -p ~/.cloudflared

# Create config file
nano ~/.cloudflared/config.yml
```

Add this configuration (replace `YOUR_TUNNEL_ID` and `YOUR_USERNAME` with your actual values):

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Backend API - use subdomain (recommended)
  - hostname: api.your-domain.com
    service: http://localhost:8000
  
  # Catch-all rule (must be last)
  - service: http_status:404
```

**Alternative**: If you want to use a path instead of subdomain:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Backend API with path
  - hostname: your-domain.com
    path: /api/*
    service: http://localhost:8000
  
  # Catch-all
  - service: http_status:404
```

Save and exit.

### Step 12: Configure DNS in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Go to **Zero Trust** → **Networks** → **Tunnels**
4. Click on your tunnel (`versicherung-x-backend`)
5. Click **Configure** → **Public Hostname**
6. Add a new hostname:
   - **Subdomain**: `api` (or leave blank for root domain)
   - **Domain**: `your-domain.com`
   - **Service**: `http://localhost:8000`
   - **Path** (if using path-based routing): `/api/*`

### Step 13: Run Cloudflare Tunnel

**Option A: Run as systemd service (recommended)**

Create service file:

```bash
sudo nano /etc/systemd/system/cloudflared-tunnel.service
```

Add this (replace `YOUR_USERNAME`):

```ini
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/YOUR_USERNAME/.cloudflared/config.yml run versicherung-x-backend
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel
sudo systemctl start cloudflared-tunnel
sudo systemctl status cloudflared-tunnel
```

**Option B: Run with nohup (if no systemd access)**

```bash
nohup cloudflared tunnel --config ~/.cloudflared/config.yml run versicherung-x-backend > ~/cloudflared.log 2>&1 &
```

### Step 14: Verify Backend is Accessible

```bash
# Test via Cloudflare Tunnel (using subdomain)
curl https://api.your-domain.com/routes/

# Or if using path-based routing
curl https://your-domain.com/api/routes/
```

**Note the Cloudflare Tunnel URL** - you'll need this for the frontend configuration:
- Subdomain: `https://api.your-domain.com`
- Path-based: `https://your-domain.com/api`

---

## Part 2: Frontend Setup (ISPConfig Server)

### Step 1: Build Frontend Locally

On your **local machine**:

```bash
cd /path/to/versicherung-x/frontend

# Install dependencies
yarn install

# Build for production
# IMPORTANT: Use your Cloudflare Tunnel URL for the API
# Replace api.your-domain.com with your actual backend URL
VITE_API_URL="https://api.your-domain.com" \
VITE_API_PREFIX_PATH="/routes" \
VITE_APP_TITLE="Versicherung X" \
yarn build
```

**Important**: 
- If using subdomain: `VITE_API_URL="https://api.your-domain.com"`
- If using path-based: `VITE_API_URL="https://your-domain.com/api"`

This creates a `dist/` folder with all static files.

### Step 2: Upload Frontend Files to ISPConfig

From your local machine, upload the built frontend files:

```bash
# Upload dist folder contents to ISPConfig server
# Replace with your actual ISPConfig path
cd /path/to/versicherung-x/frontend
scp -r dist/* user@ispconfig-server:/var/www/your-domain.com/versicherung-x/frontend/dist/
```

**Or use ISPConfig File Manager:**
1. Log into ISPConfig
2. Go to **Sites** → Your domain
3. Click **File Manager**
4. Navigate to your site's directory
5. Create folder: `versicherung-x/frontend/dist/`
6. Upload all files from `frontend/dist/` folder

### Step 3: Configure ISPConfig Site

1. **Log into ISPConfig Web Interface**
2. Go to **Sites** → Select your domain
3. Click on **Options** tab
4. Scroll to **Document Root** and set it to:
   ```
   /var/www/your-domain.com/versicherung-x/frontend/dist
   ```
   (Adjust path based on your ISPConfig setup)

### Step 4: Configure Reverse Proxy in ISPConfig

**For Nginx (Recommended):**

1. In ISPConfig, go to **Sites** → Your domain → **Options**
2. Scroll to **Nginx Directives**
3. Paste this configuration:

```nginx
# Proxy API requests to backend via Cloudflare Tunnel
location /routes/ {
    proxy_pass https://api.your-domain.com;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass_header Authorization;
    client_max_body_size 0;
    client_body_buffer_size 1m;
    proxy_intercept_errors on;
    proxy_buffering on;
    proxy_buffer_size 128k;
    proxy_buffers 256 16k;
    proxy_busy_buffers_size 256k;
    proxy_temp_file_write_size 256k;
    proxy_max_temp_file_size 0;
    proxy_read_timeout 600;
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
}

# Handle React Router (SPA) - serve index.html for non-API routes
location / {
    try_files $uri $uri/ /index.html;
}
```

**For Apache:**

1. In ISPConfig, go to **Sites** → Your domain → **Options**
2. Scroll to **Apache Directives**
3. Paste this configuration:

```apache
# Proxy API requests to backend via Cloudflare Tunnel
ProxyPreserveHost On
ProxyPass /routes/ https://api.your-domain.com/routes/
ProxyPassReverse /routes/ https://api.your-domain.com/routes/

# Don't proxy static assets
ProxyPass /assets/ !
ProxyPass /favicon.ico !

# Handle React Router (SPA routing)
<Directory /var/www/your-domain.com/versicherung-x/frontend/dist>
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
    
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</Directory>
```

**Important**: 
- Replace `https://api.your-domain.com` with your actual Cloudflare Tunnel URL
- If using path-based routing, adjust the `ProxyPass` directives accordingly

4. Click **Save**
5. ISPConfig will regenerate the configuration files automatically

### Step 5: Enable Required Modules (Apache only)

If using Apache, ensure these modules are enabled in ISPConfig:
- `mod_proxy`
- `mod_proxy_http`
- `mod_rewrite`

(ISPConfig usually has these enabled by default)

### Step 6: Test the Configuration

1. Visit `https://your-domain.com` in your browser
2. Open browser developer tools (F12) → Console tab
3. Try logging in
4. Check for any API errors in the console
5. Verify API calls are going to `https://api.your-domain.com/routes/...`

---

## Part 3: Final Configuration

### Architecture Overview

```
Internet
   ↓
ISPConfig Server (Frontend)
   ├── Serves static files from /frontend/dist/
   └── Proxies /routes/* → https://api.your-domain.com (Cloudflare Tunnel)
         ↓
   Cloudflare Tunnel
         ↓
   Backend Linux VM (Docker)
   └── FastAPI on localhost:8000
```

### Update Frontend Build (if needed)

If you need to change the API URL, rebuild the frontend:

```bash
# On local machine
cd /path/to/versicherung-x/frontend

# Rebuild with new API URL
VITE_API_URL="https://api.your-domain.com" \
VITE_API_PREFIX_PATH="/routes" \
yarn build

# Re-upload to ISPConfig
scp -r dist/* user@ispconfig-server:/var/www/your-domain.com/versicherung-x/frontend/dist/
```

---

## Troubleshooting

### Backend Issues

**Container won't start:**
```bash
docker logs versicherung-x-backend
docker ps -a
```

**Database connection errors:**
- Check `.env` file has correct database credentials
- Verify database is accessible from backend VM
- Check firewall rules

**Cloudflare Tunnel not connecting:**
```bash
# Check tunnel status
cloudflared tunnel info versicherung-x-backend

# Check logs
sudo journalctl -u cloudflared-tunnel -f
# OR if using nohup:
tail -f ~/cloudflared.log
```

### Frontend Issues (ISPConfig)

**404 errors on routes:**
- Check ISPConfig Document Root is set correctly
- Verify `try_files` directive in Nginx (or RewriteRule in Apache)
- Check file permissions in ISPConfig File Manager

**API calls failing:**
- Check browser console for CORS errors
- Verify API URL in frontend build matches Cloudflare Tunnel URL
- Test API endpoint directly: `curl https://api.your-domain.com/routes/`
- Check ISPConfig reverse proxy configuration
- Verify Cloudflare Tunnel is running and accessible

**Proxy errors:**
- Check ISPConfig error logs
- Verify the Cloudflare Tunnel URL is correct in proxy configuration
- Ensure SSL certificate is valid for the API subdomain

---

## Maintenance Commands

### Backend Server (Linux VM)

```bash
# View backend logs
docker logs -f versicherung-x-backend

# Restart backend
docker restart versicherung-x-backend

# Update backend (after uploading new code)
cd ~/versicherung-x/backend
docker compose down
docker compose build
docker compose up -d

# Check Cloudflare Tunnel status
sudo systemctl status cloudflared-tunnel
# OR if using nohup:
ps aux | grep cloudflared
```

### Frontend (ISPConfig)

```bash
# View logs via ISPConfig
# ISPConfig → Sites → Your domain → Logs

# Update frontend (after rebuilding)
# Just upload new files via ISPConfig File Manager or SCP
# No restart needed - ISPConfig serves files directly
```

---

## Quick Reference

### Backend Server (Linux VM) Files
- `~/versicherung-x/backend/` - Backend code
- `~/.cloudflared/config.yml` - Cloudflare Tunnel config
- `/etc/systemd/system/cloudflared-tunnel.service` - Tunnel service

### Frontend (ISPConfig) Files
- `/var/www/your-domain.com/versicherung-x/frontend/dist/` - Static frontend files
- ISPConfig manages Nginx/Apache configuration

### Important URLs
- Backend API (via Cloudflare Tunnel): `https://api.your-domain.com/routes/`
- Frontend: `https://your-domain.com`

---

## Security Notes

1. **Keep `.env` file secure** - Never commit it to git
2. **Use strong passwords** for database and API credentials
3. **Keep Docker images updated** - Regularly rebuild with latest dependencies
4. **Monitor logs** for suspicious activity
5. **Use Cloudflare's security features** - Enable WAF, DDoS protection, etc.
6. **Backend VM is not directly exposed** - Only accessible via Cloudflare Tunnel
7. **ISPConfig handles SSL** - No need to configure SSL separately for frontend

---

## Next Steps

- Set up automated backups for database
- Configure monitoring/alerting
- Set up CI/CD for automated deployments
- Configure log rotation
- Set up database indexes (see `backend/database_indexes.sql`)
