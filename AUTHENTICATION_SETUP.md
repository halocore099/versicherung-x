# 🔐 API Authentication Setup

## ✅ What Was Implemented

### 1. **Backend Authentication Enabled**
- **File**: `backend/routers.json`
- **Changes**: Enabled authentication for all case-related endpoints:
  - `view_cases` - Main cases API (GET /routes/cases, GET /routes/repair-case/{id})
  - `simple_sync` - Sync endpoints (POST /routes/sync-insurance-cases, POST /routes/sync-all-insurance-cases, GET /routes/sync-status)
  - `repair_case_exports` - Export endpoints

**Before:**
```json
"view_cases": {"disableAuth": true}
"simple_sync": {"disableAuth": true}
```

**After:**
```json
"view_cases": {"disableAuth": false}
"simple_sync": {"disableAuth": false}
"repair_case_exports": {"disableAuth": false}
```

### 2. **Frontend Already Configured**
The frontend was already set up to send authentication tokens:
- **File**: `frontend/src/brain/index.ts`
- All API requests include `secure: true` in `baseApiParams`
- `securityWorker` automatically adds `Authorization: Bearer <token>` header to all requests
- Token is retrieved from Firebase Auth: `firebaseAuth.currentUser.getIdToken()`

### 3. **401 Error Handling**
- **File**: `frontend/src/brain/http-client.ts`
- Added automatic redirect to login page when API returns 401 Unauthorized
- Preserves current path in `next` query parameter for redirect after login

## 🔍 How It Works

### Authentication Flow:
1. **User logs in** → Firebase Auth creates ID token
2. **Frontend makes API request** → `securityWorker` adds `Authorization: Bearer <token>` header
3. **Backend receives request** → Validates token using Firebase JWT verification
4. **If valid** → Request proceeds
5. **If invalid/missing** → Backend returns 401 Unauthorized
6. **Frontend receives 401** → Automatically redirects to login page

### Backend Token Validation:
- Backend uses Firebase's public JWKS (JSON Web Key Set) to verify tokens
- JWKS URL: `https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`
- Audience validation uses Firebase project ID from `FIREBASE_CONFIG`

## 📋 Required Environment Variables

### Backend (`backend/.env` or `backend/docker-compose.yml`):
```bash
# Firebase Client Config (for token verification)
FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"versicherung-auth",...}

# Firebase Service Account (for admin operations - optional)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### Frontend (`frontend/.env.production`):
```bash
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"versicherung-auth",...}
```

## 🧪 Testing

### Test Authentication:
1. **Without login**: Try accessing `https://api.navitank.org/routes/cases` directly
   - Should return: `401 Unauthorized` with `{"detail": "Not authenticated"}`

2. **With login**: 
   - Log in to frontend at `https://versicherung.justcom.de`
   - Open browser DevTools → Network tab
   - Check API requests → Should see `Authorization: Bearer <token>` header
   - API calls should succeed

3. **Expired token**:
   - If token expires, frontend will automatically redirect to login
   - Firebase tokens auto-refresh, so this should be rare

### Verify Protection:
```bash
# Test without auth token
curl -X GET "https://api.navitank.org/routes/cases?page=1&limit=10"
# Expected: 401 Unauthorized

# Test with valid token
curl -X GET "https://api.navitank.org/routes/cases?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN"
# Expected: 200 OK with cases data
```

## 🔄 Next Steps

1. **Restart Backend**: After updating `routers.json`, restart the backend container:
   ```bash
   cd backend
   docker-compose restart backend
   ```

2. **Verify Firebase Config**: Ensure `FIREBASE_CONFIG` is set in backend environment with correct `projectId`

3. **Test End-to-End**: 
   - Log out of frontend
   - Try to access dashboard → Should redirect to login
   - Log in → Should access dashboard successfully
   - Check browser DevTools → Verify `Authorization` header is present in API requests

## ⚠️ Important Notes

- **Token Expiration**: Firebase ID tokens expire after 1 hour. The Firebase SDK automatically refreshes them.
- **CORS**: Make sure `CORS_ALLOWED_ORIGINS` includes your frontend domain (`https://versicherung.justcom.de`)
- **UserGuard**: Frontend routes are already protected by `UserGuard` component, which redirects unauthenticated users to login
- **401 Handling**: If a logged-in user's token expires or becomes invalid, they will be automatically redirected to login

## 🐛 Troubleshooting

### Issue: "Not authenticated" errors even when logged in
- **Check**: Backend `FIREBASE_CONFIG` has correct `projectId`
- **Check**: Frontend and backend use same Firebase project
- **Check**: Token is being sent in request headers (check browser DevTools)

### Issue: CORS errors
- **Check**: `CORS_ALLOWED_ORIGINS` includes frontend domain
- **Check**: Backend CORS middleware is configured correctly

### Issue: 401 on all requests
- **Check**: `routers.json` has `disableAuth: false` for the endpoints
- **Check**: Backend restarted after changing `routers.json`
- **Check**: Firebase config is loaded correctly in backend

