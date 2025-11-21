# Files to Upload to Server

## Complete File List

Upload the entire project structure, but here's what's essential:

### Backend Files (Required)
```
backend/
├── main.py                          # FastAPI application entry point
├── requirements.txt                 # Python dependencies
├── pyproject.toml                   # Python project config
├── routers.json                     # Router configuration
├── start-backend.sh                 # Start script (NEW)
├── stop-backend.sh                  # Stop script (NEW)
├── restart-backend.sh               # Restart script (NEW)
├── run.sh                           # Development run script
├── run-production.sh               # Production run script
├── install.sh                       # Installation script
├── app/                             # Application code
│   ├── apis/
│   │   ├── simple_sync/
│   │   │   └── __init__.py          # Sync logic
│   │   ├── view_cases/
│   │   │   └── __init__.py          # View cases API
│   │   ├── admin_users/
│   │   │   └── __init__.py
│   │   ├── repair_case_exports/
│   │   │   └── __init__.py
│   │   └── minimal_auth_test/
│   │       └── __init__.py
│   ├── libs/
│   │   └── database_management.py   # Database connection
│   ├── env.py
│   └── auth/
│       └── user.py
├── databutton_app/
│   └── mw/
│       └── auth_mw.py               # Auth middleware
└── database_indexes.sql             # Optional: DB indexes
```

### Frontend Files (Required)
```
frontend/
├── package.json                     # Node dependencies
├── yarn.lock                        # Lock file
├── vite.config.ts                   # Vite configuration
├── tsconfig.json                     # TypeScript config
├── tailwind.config.js               # Tailwind config
├── index.html                        # HTML entry point
├── install.sh                       # Installation script
├── run.sh                            # Development run script
├── src/                              # Source code
│   ├── main.tsx
│   ├── AppWrapper.tsx
│   ├── router.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── App.tsx
│   │   └── ...
│   ├── components/
│   ├── brain/                        # API client
│   └── ...
└── public/                           # Static assets
```

### Configuration Files
```
├── .env                             # Environment variables (CREATE ON SERVER)
├── .gitignore
├── Makefile
├── README.md
├── DEPLOYMENT.md                     # Deployment guide
├── QUICK_DEPLOY.md                   # Quick checklist
├── ISPConfig_Reverse_Proxy_Config.txt # Reverse proxy config
└── UPLOAD_CHECKLIST.md               # This file
```

## What NOT to Upload

Don't upload these (they'll be generated on the server):
```
- node_modules/                       # Install with yarn install
- frontend/dist/                      # Build with yarn build
- backend/venv/                      # Create with uv venv
- backend/.venv/                     # Virtual environment
- backend/backend.pid                # Created when running
- backend/logs/                      # Created when running
- .git/                              # Git repository
- *.pyc, __pycache__/                # Python cache
- .DS_Store                          # macOS files
```

## Quick Upload Command

From your local machine, create a tarball excluding unnecessary files:

```bash
# From project root
tar --exclude='node_modules' \
    --exclude='frontend/dist' \
    --exclude='backend/venv' \
    --exclude='backend/.venv' \
    --exclude='.git' \
    --exclude='backend/logs' \
    --exclude='backend/backend.pid' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.DS_Store' \
    -czf versicherung-x-deploy.tar.gz .

# Upload to server
scp versicherung-x-deploy.tar.gz user@your-server.com:/path/to/upload/

# On server, extract
cd /path/to/upload/
tar -xzf versicherung-x-deploy.tar.gz -C /var/www/your-domain.com/versicherung-x/
```

## Minimum Essential Files (if space is limited)

If you need to upload only essentials:

**Backend:**
- All `.py` files
- `requirements.txt`
- `pyproject.toml`
- `routers.json`
- `start-backend.sh`, `stop-backend.sh`, `restart-backend.sh`

**Frontend:**
- All `.ts`, `.tsx`, `.js`, `.jsx` files
- `package.json`, `yarn.lock`
- `vite.config.ts`
- `tsconfig.json`
- `tailwind.config.js`
- `index.html`
- All files in `src/` and `public/`

## After Upload - First Time Setup

1. **Install backend dependencies:**
   ```bash
   cd backend
   uv venv
   source venv/bin/activate
   uv pip install -r requirements.txt
   ```

2. **Install frontend dependencies:**
   ```bash
   cd frontend
   yarn install
   ```

3. **Build frontend:**
   ```bash
   cd frontend
   yarn build
   ```

4. **Create .env file:**
   ```bash
   cd backend
   nano .env
   # Add your environment variables
   ```

5. **Start backend:**
   ```bash
   cd backend
   ./start-backend.sh
   ```

6. **Configure ISPConfig reverse proxy** (see ISPConfig_Reverse_Proxy_Config.txt)

## Verify Upload

After uploading, verify these files exist:
```bash
# Backend
ls -la backend/start-backend.sh
ls -la backend/app/apis/simple_sync/__init__.py
ls -la backend/main.py

# Frontend
ls -la frontend/package.json
ls -la frontend/src/main.tsx
```

