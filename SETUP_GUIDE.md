# Complete Setup Guide: 2-Server Deployment with Cloudflare Tunnel

This guide walks you through deploying the Versicherung-X application to two remote servers:
1. **Backend Server**: Runs the FastAPI backend in Docker with Cloudflare Tunnel
2. **Frontend Server**: Serves static frontend files

---

## Prerequisites

- Two Linux servers (Ubuntu/Debian recommended)
- SSH access to both servers
- Docker installed on backend server (or ability to install it)
- Cloudflare account with a domain
- MySQL database (can be on backend server or separate)

---

## Part 1: Backend Server Setup

### Step 1: Connect to Backend Server

```bash
ssh user@backend-server-ip
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
scp -r backend/* user@backend-server-ip:~/versicherung-x/backend/
```

**Required files:**
- `main.py`
- `requirements.txt`
- `routers.json`
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `app/` directory (entire folder)
- `databutton_app/` directory (entire folder)

### Step 5: Create Environment File

```bash
cd ~/versicherung-x/backend
cp .env.example .env
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

# Repairline API Credentials
REPAIRLINE_API_USERNAME=your_repairline_username
REPAIRLINE_API_PASSWORD=your_repairline_password

# Databutton (optional)
DATABUTTON_SERVICE_TYPE=production
```

**Important**: For `FIREBASE_SERVICE_ACCOUNT_JSON`, you need to escape the JSON properly or put it all on one line.

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

Add this configuration (replace `YOUR_TUNNEL_ID` with your actual tunnel ID):

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Backend API
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
    path: /routes/*
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
   - **Path** (if using path-based routing): `/routes/*`

### Step 13: Run Cloudflare Tunnel

**Option A: Run in foreground (for testing)**

```bash
cloudflared tunnel --config ~/.cloudflared/config.yml run versicherung-x-backend
```

**Option B: Run as systemd service (recommended)**

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

**Option C: Run with nohup (if no systemd access)**

```bash
nohup cloudflared tunnel --config ~/.cloudflared/config.yml run versicherung-x-backend > ~/cloudflared.log 2>&1 &
```

### Step 14: Verify Backend is Accessible

```bash
# Test via Cloudflare Tunnel
curl https://api.your-domain.com/routes/

# Or if using path-based routing
curl https://your-domain.com/routes/
```

---

## Part 2: Frontend Server Setup

### Step 1: Connect to Frontend Server

```bash
ssh user@frontend-server-ip
```

### Step 2: Install Web Server (Nginx or Apache)

**Option A: Nginx (Recommended)**

```bash
sudo apt-get update
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

**Option B: Apache**

```bash
sudo apt-get update
sudo apt-get install -y apache2
sudo systemctl enable apache2
sudo systemctl start apache2
```

### Step 3: Build Frontend Locally

On your **local machine**:

```bash
cd /path/to/versicherung-x/frontend

# Install dependencies
yarn install

# Build for production (with relative API paths for Cloudflare Tunnel)
VITE_API_URL="" \
VITE_API_PREFIX_PATH="/routes" \
VITE_APP_TITLE="Versicherung X" \
yarn build
```

This creates a `dist/` folder with all static files.

### Step 4: Upload Frontend Files

From your local machine:

```bash
# Create directory on server
ssh user@frontend-server-ip "mkdir -p ~/versicherung-x/frontend"

# Upload dist folder contents
cd /path/to/versicherung-x/frontend
scp -r dist/* user@frontend-server-ip:~/versicherung-x/frontend/
```

### Step 5: Configure Web Server

**For Nginx:**

```bash
sudo nano /etc/nginx/sites-available/versicherung-x
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    root /home/YOUR_USERNAME/versicherung-x/frontend;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend (via Cloudflare Tunnel)
    location /routes/ {
        proxy_pass https://api.your-domain.com;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass_header Authorization;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/versicherung-x /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

**For Apache:**

```bash
sudo nano /etc/apache2/sites-available/versicherung-x.conf
```

Add:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    
    DocumentRoot /home/YOUR_USERNAME/versicherung-x/frontend
    
    <Directory /home/YOUR_USERNAME/versicherung-x/frontend>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # Proxy API requests
    ProxyPass /routes/ https://api.your-domain.com/routes/
    ProxyPassReverse /routes/ https://api.your-domain.com/routes/
</VirtualHost>
```

Enable modules and site:

```bash
sudo a2enmod proxy proxy_http rewrite
sudo a2ensite versicherung-x
sudo systemctl reload apache2
```

### Step 6: Setup SSL (Let's Encrypt)

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx
# OR for Apache:
# sudo apt-get install -y certbot python3-certbot-apache

# Get certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
# OR for Apache:
# sudo certbot --apache -d your-domain.com -d www.your-domain.com

# Auto-renewal is set up automatically
```

### Step 7: Configure Cloudflare Tunnel for Frontend (Optional)

If you want to use Cloudflare Tunnel for the frontend too:

1. Create another tunnel on the frontend server (same steps as backend)
2. Point it to `http://localhost:80` (or 443 for HTTPS)
3. Configure DNS to point your domain to the tunnel

---

## Part 3: Final Configuration

### Update Frontend API Configuration

If you're using a subdomain for the API (`api.your-domain.com`), you may need to update the frontend build:

```bash
# Rebuild with API URL
cd /path/to/versicherung-x/frontend
VITE_API_URL="https://api.your-domain.com" \
VITE_API_PREFIX_PATH="/routes" \
yarn build

# Re-upload dist folder
scp -r dist/* user@frontend-server-ip:~/versicherung-x/frontend/
```

### Test the Application

1. Visit `https://your-domain.com` in your browser
2. Try logging in
3. Test API calls (check browser console for errors)

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
- Verify database is accessible from backend server
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

### Frontend Issues

**404 errors on routes:**
- Check Nginx/Apache configuration
- Verify `try_files` directive includes `/index.html`
- Check file permissions

**API calls failing:**
- Check browser console for CORS errors
- Verify API URL in frontend build
- Test API endpoint directly: `curl https://api.your-domain.com/routes/`

**SSL certificate issues:**
- Run `sudo certbot renew --dry-run` to test renewal
- Check certificate expiration: `sudo certbot certificates`

---

## Maintenance Commands

### Backend Server

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
```

### Frontend Server

```bash
# View Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Reload Nginx
sudo systemctl reload nginx

# Update frontend (after uploading new dist folder)
# Just upload new files, no restart needed
```

---

## Quick Reference

### Backend Server Files
- `~/versicherung-x/backend/` - Backend code
- `~/.cloudflared/config.yml` - Cloudflare Tunnel config
- `/etc/systemd/system/cloudflared-tunnel.service` - Tunnel service

### Frontend Server Files
- `~/versicherung-x/frontend/` - Static frontend files
- `/etc/nginx/sites-available/versicherung-x` - Nginx config

### Important URLs
- Backend API: `https://api.your-domain.com/routes/`
- Frontend: `https://your-domain.com`

---

## Security Notes

1. **Keep `.env` file secure** - Never commit it to git
2. **Use strong passwords** for database and API credentials
3. **Keep Docker images updated** - Regularly rebuild with latest dependencies
4. **Monitor logs** for suspicious activity
5. **Use Cloudflare's security features** - Enable WAF, DDoS protection, etc.

---

## Next Steps

- Set up automated backups for database
- Configure monitoring/alerting
- Set up CI/CD for automated deployments
- Configure log rotation
- Set up database indexes (see `backend/database_indexes.sql`)

