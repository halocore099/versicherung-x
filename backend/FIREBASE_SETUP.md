# Firebase Setup Guide

This guide explains how to configure Firebase for authentication in the backend.

## What Firebase Provides

1. **Firebase Authentication** - User login/authentication (frontend)
2. **Firebase Admin SDK** - Backend user management (create users, verify tokens)

## Required Environment Variables

Add these to your `.env` file:

### 1. Firebase Service Account (for Admin SDK)

This is used by the backend to:
- Create new users
- List users
- Verify authentication tokens

**How to get it:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file
6. Copy the **entire JSON content** and paste it into your `.env` file as a single line:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}
```

**Important:**
- Keep it all on **one line**
- Escape any quotes if needed (or use single quotes around the whole value)
- The JSON contains newlines in `private_key` - keep the `\n` characters

**Alternative:** You can also base64 encode it:

```bash
# Encode
cat service-account.json | base64

# Then in .env:
FIREBASE_SERVICE_ACCOUNT_JSON_B64=<base64-encoded-string>
```

(You'd need to update the code to decode it if using this method)

### 2. Firebase Client Config (for Authentication)

This is used by the backend to verify JWT tokens from the frontend.

**How to get it:**

1. Go to Firebase Console → **Project Settings** → **General**
2. Scroll down to **Your apps** section
3. If you have a web app, click on it, or create a new web app
4. Copy the `firebaseConfig` object:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

5. Convert to JSON and add to `.env`:

```env
FIREBASE_CONFIG={"apiKey":"AIza...","authDomain":"your-project.firebaseapp.com","projectId":"your-project-id","storageBucket":"your-project.appspot.com","messagingSenderId":"123456789","appId":"1:123456789:web:abcdef"}
```

**Important:**
- The backend only needs `projectId` from this config, but you can provide the full config
- Keep it on one line

## Complete .env Example

```env
# Database
MYSQL_HOST=localhost
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database

# Firebase Service Account (Admin SDK)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Firebase Client Config (for auth verification)
FIREBASE_CONFIG={"apiKey":"AIza...","authDomain":"your-project.firebaseapp.com","projectId":"your-project-id","storageBucket":"your-project.appspot.com","messagingSenderId":"123456789","appId":"1:123456789:web:abcdef"}

# Repairline API
REPAIRLINE_API_USERNAME=your_username
REPAIRLINE_API_PASSWORD=your_password

# Optional
DATABUTTON_SERVICE_TYPE=production
```

## What Each Part Does

### FIREBASE_SERVICE_ACCOUNT_JSON
- Used by `backend/app/apis/admin_users/__init__.py`
- Enables:
  - Creating Firebase users (`/routes/create-firebase-user`)
  - Listing Firebase users (`/routes/list-firebase-users`)
  - Admin operations

### FIREBASE_CONFIG
- Used by `backend/main.py`
- Extracts `projectId` to verify JWT tokens
- Enables authentication middleware to work
- Without this, all routes with `disableAuth: false` will fail

## Testing Firebase Setup

1. **Check if service account loads:**
   ```bash
   # Start the server and check logs
   # Should see: "Firebase Admin SDK initialized successfully"
   ```

2. **Check if auth config loads:**
   ```bash
   # Should see: "Firebase config found"
   # Not: "No firebase config found"
   ```

3. **Test authentication:**
   - Try accessing a protected route without token → should get 401
   - Try with valid Firebase token → should work

## Troubleshooting

### "Service account info was not in the expected format"
- Make sure the JSON is valid
- Check that all required fields are present
- Ensure it's on one line in `.env`

### "No firebase config found"
- Check `FIREBASE_CONFIG` is set in `.env`
- Verify JSON is valid (can test with `python -c "import json; json.loads('your-json')"`)

### Authentication not working
- Verify `FIREBASE_CONFIG` has `projectId` field
- Check that Firebase project ID matches between service account and client config
- Ensure frontend is sending tokens in `Authorization: Bearer <token>` header

## Security Notes

- **Never commit `.env` file to git**
- Keep service account JSON secure (it has admin privileges)
- Rotate service account keys periodically
- Use different service accounts for dev/prod if possible

