# Deployment Guide

This guide covers deploying the versicherung-x application to a production server with ISPConfig.

## Prerequisites

- Server with ISPConfig installed
- Python 3.13+ installed
- Node.js and Yarn installed
- MySQL database configured
- Domain/subdomain configured in ISPConfig

## Step 1: Upload Files to Server

Upload the entire project to your server. Recommended location: `/var/www/your-domain.com/versicherung-x`

```bash
# On your local machine, create a deployment package (excluding node_modules, .venv, etc.)
tar --exclude='node_modules' --exclude='.venv' --exclude='frontend/dist' \
    --exclude='.git' -czf versicherung-x.tar.gz .

# Upload to server
scp versicherung-x.tar.gz user@your-server.com:/var/www/your-domain.com/

# On server, extract
cd /var/www/your-domain.com/
tar -xzf versicherung-x.tar.gz -C versicherung-x/
```

## Step 2: Install Dependencies

### Backend Dependencies

```bash
cd /var/www/your-domain.com/versicherung-x/backend
uv venv
source venv/bin/activate
uv pip install -r requirements.txt
```

### Frontend Dependencies

```bash
cd /var/www/your-domain.com/versicherung-x/frontend
yarn install
```

## Step 3: Build Frontend for Production

```bash
cd /var/www/your-domain.com/versicherung-x/frontend
yarn build
```

This creates a `dist/` folder with static files.

## Step 4: Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
cd /var/www/your-domain.com/versicherung-x/backend
nano .env
```

Add your environment variables (database credentials, API keys, etc.):

```env
DATABUTTON_EXTENSIONS='[{"name":"firebase-auth","config":{"firebaseConfig":{...}}}]'
# Add other environment variables as needed
```

## Step 5: Set Up Production Backend Service

Create a systemd service file for the backend:

```bash
sudo nano /etc/systemd/system/versicherung-x-backend.service
```

Add the following content:

```ini
[Unit]
Description=Versicherung-X FastAPI Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/your-domain.com/versicherung-x/backend
Environment="PATH=/var/www/your-domain.com/versicherung-x/backend/venv/bin"
ExecStart=/var/www/your-domain.com/versicherung-x/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable versicherung-x-backend
sudo systemctl start versicherung-x-backend
sudo systemctl status versicherung-x-backend
```

## Step 6: Configure ISPConfig Reverse Proxy

### Option A: Using ISPConfig Web Interface (Recommended)

1. Log into ISPConfig
2. Go to **Sites** → Select your domain
3. Go to **Options** tab
4. Enable **Apache Directives** or **Nginx Directives** (depending on your setup)
5. Add the configuration from `ISPConfig_Reverse_Proxy_Config.txt` (see below)

### Option B: Manual Configuration

If you need to manually configure, see the configuration files below.

## Step 7: Set Permissions

```bash
sudo chown -R www-data:www-data /var/www/your-domain.com/versicherung-x
sudo chmod -R 755 /var/www/your-domain.com/versicherung-x
sudo chmod -R 775 /var/www/your-domain.com/versicherung-x/backend/venv
```

## Step 8: Test the Deployment

1. Check backend is running: `curl http://127.0.0.1:8000/routes/view_cases/cases`
2. Visit your domain in a browser
3. Check logs if issues: `sudo journalctl -u versicherung-x-backend -f`

## Troubleshooting

- **Backend not starting**: Check logs with `sudo journalctl -u versicherung-x-backend -n 50`
- **Permission errors**: Ensure www-data owns the files
- **Database connection**: Verify database credentials in `.env`
- **Port conflicts**: Ensure port 8000 is not in use: `sudo netstat -tulpn | grep 8000`

