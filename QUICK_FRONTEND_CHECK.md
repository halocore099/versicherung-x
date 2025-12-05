# Quick Frontend Check for Customer Access Issues

## ✅ What We Know Works:
1. Backend is accessible: `https://api.navitank.org` ✅
2. CORS is configured correctly: Allows `https://versicherung.justcom.de` ✅
3. Backend responds to OPTIONS preflight requests ✅

## 🔍 What to Check Next:

### 1. Check if Frontend is Built
```bash
cd frontend
ls -la dist/
```
Should show: `index.html` and `assets/` folder

### 2. Check What API URL is in the Build
```bash
cd frontend
grep -r "api.navitank.org\|localhost:8000" dist/assets/*.js | head -3
```
Should show: `api.navitank.org` (NOT localhost:8000)

### 3. Check .env.production File
```bash
cd frontend
cat .env.production | grep VITE_API_URL
```
Should be: `VITE_API_URL=https://api.navitank.org`

### 4. Check What Customers Actually See
Ask customer to:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Share the exact error messages

Common errors:
- "Failed to fetch" → Frontend using wrong API URL
- "CORS error" → Backend CORS issue (but we verified this works)
- "404 Not Found" → Frontend not deployed or wrong path
- Blank page → Frontend files missing or routing issue

### 5. Check Frontend Deployment
On ISPConfig server, verify:
- Files are in: `/var/www/versicherung.justcom.de/versicherung-x/frontend/dist/`
- `index.html` exists
- `assets/` folder exists with JS files
- File permissions are correct (readable by web server)

### 6. Test Frontend Directly
```bash
curl -I https://versicherung.justcom.de
```
Should return: HTTP 200 OK

