# 🚀 Deployment Instructions - Fix Customer Access Issue

## ✅ What Was Fixed:
- **Problem**: Frontend was built with `localhost:8000` instead of `api.navitank.org`
- **Solution**: Rebuilt frontend with correct API URL in `.env.production`
- **Status**: New build ready in `frontend/dist/`

## 📦 Next Steps - Deploy to ISPConfig:

### 1. Upload the New Build
Upload the contents of `frontend/dist/` to your ISPConfig server:

```bash
# From your local machine
cd frontend
scp -r dist/* user@ispconfig-server:/var/www/versicherung.justcom.de/versicherung-x/frontend/dist/
```

**OR** use ISPConfig File Manager:
1. Log into ISPConfig
2. Go to **Sites** → `versicherung.justcom.de`
3. Click **File Manager**
4. Navigate to: `versicherung-x/frontend/dist/`
5. Delete old files (or backup first)
6. Upload all files from `frontend/dist/` folder

### 2. Verify Deployment
After uploading, test:
```bash
# Test frontend loads
curl -I https://versicherung.justcom.de

# Should return: HTTP 200 OK
```

### 3. Test in Browser
1. Visit: `https://versicherung.justcom.de`
2. Open DevTools (F12) → Console
3. Check for errors
4. Verify API calls go to: `https://api.navitank.org/routes/...`

### 4. Clear Browser Cache (Important!)
Customers may need to:
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or clear browser cache
- Or use incognito/private mode

## ✅ Verification Checklist:
- [ ] Frontend files uploaded to ISPConfig
- [ ] `index.html` exists in dist folder
- [ ] `assets/` folder exists with JS files
- [ ] Frontend loads at `https://versicherung.justcom.de`
- [ ] No console errors in browser
- [ ] API calls go to `api.navitank.org` (not localhost)
- [ ] Customers can access the site

## 🔍 If Still Not Working:
1. Check browser console for specific errors
2. Verify file permissions on ISPConfig server
3. Check ISPConfig Document Root is set correctly
4. Verify Nginx/Apache configuration for SPA routing
5. Check if old cached files are being served

