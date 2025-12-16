# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Versicherung-X is an insurance repair case management system exported from Databutton. It consists of a Python FastAPI backend and a React TypeScript frontend that displays and syncs repair cases from the Repairline API.

## Commands

### Install dependencies
```bash
make                    # Install both backend and frontend
make install-backend    # Backend only (uses uv)
make install-frontend   # Frontend only (uses yarn)
```

### Run development servers
```bash
make run-backend        # Starts FastAPI on port 8000
make run-frontend       # Starts Vite dev server on port 5173
```

### Frontend commands (from frontend directory)
```bash
yarn dev      # Development server
yarn build    # Production build
yarn lint     # ESLint
yarn preview  # Preview production build
```

### Backend
```bash
cd backend && ./run.sh  # Runs uvicorn with the FastAPI app factory
```

## Architecture

### Backend (Python FastAPI)

- **Entry point**: `backend/main.py` - Creates FastAPI app with CORS middleware and Firebase auth
- **API routers**: `backend/app/apis/*/` - Each subdirectory is an API module with `__init__.py` containing a `router`
- **Router config**: `backend/routers.json` - Controls auth requirements per router (`disableAuth: true/false`)
- **Auth middleware**: `backend/databutton_app/mw/auth_mw.py` - Firebase JWT validation using PyJWKClient
- **Database**: MySQL via `backend/app/libs/database_management.py` - credentials from env vars

Key API modules:
- `view_cases` - CRUD operations for repair cases, CSV/Excel exports
- `simple_sync` - Background sync from Repairline API with parallel processing
- `admin_users` - User management

### Frontend (React + TypeScript + Vite)

- **Entry**: `frontend/src/main.tsx` -> `router.tsx` -> `user-routes.tsx`
- **API client**: `frontend/src/brain/` - Auto-generated HTTP client with auth headers
  - `Brain.ts` / `BrainRoute.ts` - API endpoint methods
  - `http-client.ts` - Base HTTP client with 401 redirect handling
  - `index.ts` - Constructs client with Firebase auth token injection
- **Auth**: `frontend/src/app/auth/` - Firebase auth with `UserGuard` for protected routes
- **Pages**: `frontend/src/pages/` - Route components (Dashboard is main UI at 55KB)
- **Build config**: `frontend/vite.config.ts` - Defines `__API_URL__`, `__FIREBASE_CONFIG__` etc. from env vars

### Authentication Flow

1. Frontend uses Firebase Auth, gets ID token
2. Token sent in `Authorization: Bearer <token>` header via `brain/index.ts` securityWorker
3. Backend validates against Firebase JWKS endpoint
4. Routes without `disableAuth: true` in routers.json require valid token

### Environment Variables

Backend (`backend/.env`):
- `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
- `FIREBASE_CONFIG` (JSON)
- `REPAIRLINE_API_USERNAME`, `REPAIRLINE_API_PASSWORD`
- `CORS_ALLOWED_ORIGINS`

Frontend (`frontend/.env`, `.env.development`, `.env.production`):
- `VITE_API_URL` - Backend API base URL
- `VITE_FIREBASE_CONFIG` (JSON)
- `VITE_DEV_PROXY_TARGET` - Dev server proxy target (default: http://127.0.0.1:8000)

### API Path Convention

- Backend routes are prefixed with `/routes` (see `main.py` import_api_routers)
- Vite dev server proxies `/routes` to backend
- Production uses `VITE_API_URL` + `/routes`
