# Step-by-Step Debugging: Why Customers Can't Access the Website

## Architecture Overview
- **Frontend**: `https://versicherung.justcom.de` (ISPConfig server)
- **Backend**: `https://api.navitank.org` (Cloudflare Tunnel → Backend VM)
- **CORS**: Must allow `https://versicherung.justcom.de`

---

## Step 1: Check Frontend Accessibility

### 1.1 Can customers reach the frontend domain?
```bash
# Test from your machine
curl -I https://versicherung.justcom.de

# Expected: HTTP 200 OK
# If fails: DNS/SSL/ISPConfig issue
```

**Common Issues:**
- DNS not pointing to ISPConfig server
- SSL certificate expired or invalid
- ISPConfig site not enabled/configured
- Firewall blocking port 443

**Fix:**
- Check DNS records in your domain registrar
- Verify SSL certificate in ISPConfig
- Check ISPConfig site status

---

## Step 2: Check Backend Accessibility

### 2.1 Can the backend API be reached?
```bash
# Test backend directly
curl -I https://api.navitank.org/routes/

# Expected: HTTP 200 or 401 (401 means backend is up, just needs auth)
# If fails: Cloudflare Tunnel or backend issue
```

**Common Issues:**
- Cloudflare Tunnel not running
- Backend container not running
- Backend crashed/error

**Fix:**
```bash
# On backend server, check tunnel status
cloudflared tunnel list
cloudflared tunnel info versicherung-x-backend

# Check backend container
docker ps | grep versicherung-x-backend
docker logs versicherung-x-backend --tail 50
```

---

## Step 3: Check CORS Configuration

### 3.1 Verify CORS allows the frontend domain
```bash
# Test CORS from frontend origin
curl -H "Origin: https://versicherung.justcom.de" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     -v https://api.navitank.org/routes/sync-status

# Look for: "Access-Control-Allow-Origin: https://versicherung.justcom.de"
# If missing: CORS not configured correctly
```

**Common Issues:**
- `CORS_ALLOWED_ORIGINS` environment variable doesn't include frontend domain
- Backend code changes not deployed
- Backend not restarted after CORS changes

**Fix:**
1. Check backend logs for CORS configuration:
   ```bash
   docker logs versicherung-x-backend | grep -i cors
   ```
   Should show: `✅ CORS allowed origins: ['https://versicherung.justcom.de', ...]`

2. Verify environment variable on backend server:
   ```bash
   docker exec versicherung-x-backend env | grep CORS
   ```

3. If wrong, update `CORS_ALLOWED_ORIGINS` in backend `.env` or `docker-compose.yml`:
   ```
   CORS_ALLOWED_ORIGINS=https://versicherung.justcom.de,http://localhost:5173
   ```

4. Restart backend:
   ```bash
   docker-compose restart backend
   ```

---

## Step 4: Check Frontend Build Configuration

### 4.1 Verify frontend is built with correct API URL
```bash
# On your local machine, check the built frontend
cd frontend
grep -r "api.navitank.org" dist/assets/*.js | head -3

# Should show: api.navitank.org (not localhost:8000)
```

**Common Issues:**
- Frontend built with wrong `VITE_API_URL`
- Old build deployed (still has localhost)
- `.env.production` has wrong value

**Fix:**
1. Check `.env.production`:
   ```bash
   cat frontend/.env.production | grep VITE_API_URL
   ```
   Should be: `VITE_API_URL=https://api.navitank.org`

2. Rebuild frontend:
   ```bash
   cd frontend
   ./build-production.sh
   ```

3. Re-upload to ISPConfig:
   ```bash
   # Upload dist/ folder contents to ISPConfig
   scp -r dist/* user@ispconfig-server:/var/www/versicherung.justcom.de/versicherung-x/frontend/dist/
   ```

---

## Step 5: Check Browser Console Errors

### 5.1 What errors do customers see?

**Open browser DevTools (F12) → Console tab**

**Common Errors:**

#### Error: "CORS policy: No 'Access-Control-Allow-Origin' header"
- **Cause**: Backend CORS not allowing frontend domain
- **Fix**: See Step 3

#### Error: "Failed to fetch" or "NetworkError"
- **Cause**: Backend not accessible or wrong API URL
- **Fix**: See Step 2 and Step 4

#### Error: "404 Not Found" on API calls
- **Cause**: Wrong API path or backend route not found
- **Fix**: Check API endpoint exists: `curl https://api.navitank.org/routes/cases`

#### Error: "502 Bad Gateway"
- **Cause**: Cloudflare Tunnel can't reach backend
- **Fix**: Check backend container and Cloudflare Tunnel status

---

## Step 6: Check Network Connectivity

### 6.1 Can customers reach both domains?
```bash
# Test from customer's network (or use online tool like https://downforeveryoneorjustme.com)
# Test frontend
curl -I https://versicherung.justcom.de

# Test backend
curl -I https://api.navitank.org/routes/
```

**Common Issues:**
- Corporate firewall blocking domains
- ISP blocking
- Regional DNS issues

**Fix:**
- Ask customer to test from different network (mobile data)
- Check if domains are accessible from different locations
- Verify DNS propagation

---

## Step 7: Check Authentication

### 7.1 Can customers log in?
- **Check**: Firebase authentication working?
- **Check**: Backend auth endpoint accessible?

```bash
# Test auth endpoint
curl -X POST https://api.navitank.org/routes/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test"}'
```

**Common Issues:**
- Firebase config wrong in frontend
- Backend can't verify Firebase tokens
- Auth endpoint not working

---

## Quick Diagnostic Commands

Run these on your backend server:

```bash
# 1. Check backend container status
docker ps | grep versicherung-x-backend

# 2. Check backend logs (last 50 lines)
docker logs versicherung-x-backend --tail 50

# 3. Check CORS configuration in logs
docker logs versicherung-x-backend | grep -i cors

# 4. Check Cloudflare Tunnel status
cloudflared tunnel list
cloudflared tunnel info versicherung-x-backend

# 5. Test backend endpoint directly
curl -v https://api.navitank.org/routes/

# 6. Test CORS
curl -H "Origin: https://versicherung.justcom.de" \
     -X OPTIONS \
     -v https://api.navitank.org/routes/sync-status
```

---

## Most Common Issues & Quick Fixes

### Issue 1: CORS Error
**Symptom**: `Access-Control-Allow-Origin` header missing
**Fix**: 
1. Add `https://versicherung.justcom.de` to `CORS_ALLOWED_ORIGINS`
2. Restart backend: `docker-compose restart backend`

### Issue 2: Backend Not Accessible
**Symptom**: 502 Bad Gateway or connection refused
**Fix**:
1. Check Cloudflare Tunnel: `cloudflared tunnel list`
2. Check backend container: `docker ps`
3. Restart if needed: `docker-compose restart backend`

### Issue 3: Frontend Using Wrong API URL
**Symptom**: Requests going to `localhost:8000` instead of `api.navitank.org`
**Fix**:
1. Check `.env.production`: `VITE_API_URL=https://api.navitank.org`
2. Rebuild: `./build-production.sh`
3. Re-upload to ISPConfig

### Issue 4: Frontend Not Loading
**Symptom**: Blank page or 404
**Fix**:
1. Check ISPConfig Document Root points to `dist/` folder
2. Check file permissions
3. Check Nginx/Apache configuration for SPA routing

---

## Next Steps

1. **Run Step 1-7** in order
2. **Note which step fails** - that's your issue
3. **Apply the fix** for that step
4. **Test again** from customer's perspective

If still not working, share:
- Which step failed
- Error messages from browser console
- Backend logs (`docker logs versicherung-x-backend`)
- Results of diagnostic commands

