# Password Hash Analysis Results

## Test Results

**Password tested:** `IhLennox2006?`  
**Hash parameters used:** (from your import command)
- Hash key: `5msja3y5are5tEvkXpCKpmW4HAwb25xsALzZeIuo+fWT+PzK31GElXb89OJszZB8n1rDy2EflDCNtAIaML/Htg==`
- Salt separator: `Bw==`
- Rounds: `8`
- Mem cost: `14`

**Result:** ❌ **0 matches found out of 20 users**

## What This Means

The fact that **none** of the password hashes match suggests one of these scenarios:

### Scenario 1: Hash Key Mismatch (Most Likely)
You used the **OLD project's hash key** with the **NEW project**. Each Firebase project has its own unique hash key, so passwords imported with the old key won't work in the new project.

**Solution:**
1. Get the **NEW project's** hash parameters:
   - Go to Firebase Console → Authentication → Settings → Users
   - Scroll to "Password hash parameters"
   - Copy the hash key, salt separator, rounds, and mem-cost

2. Re-import users with the NEW project's parameters:
   ```bash
   firebase auth:import users.json \
     --project NEW_PROJECT_ID \
     --hash-algo=SCRYPT \
     --hash-key="<NEW_PROJECT_HASH_KEY>" \
     --salt-separator="<NEW_PROJECT_SALT_SEPARATOR>" \
     --rounds=<NEW_PROJECT_ROUNDS> \
     --mem-cost=<NEW_PROJECT_MEM_COST>
   ```

### Scenario 2: Different Passwords
The password "IhLennox2006?" might not be the actual password for any of these users. Each user might have a different password.

**Solution:**
- Test with known passwords for specific users
- Or have users reset their passwords via email

### Scenario 3: Export Format Issue
The export might not have preserved the password hashes correctly.

**Solution:**
- Re-export from the old project
- Verify the export includes `passwordHash` and `salt` for each user

## Next Steps

1. **Get NEW project's hash parameters** from Firebase Console
2. **Re-import** with the correct parameters
3. **Test login** with one user
4. If it still fails, **reset passwords** via email for all users

## How to Get New Project's Hash Parameters

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **NEW project** (versicherung-auth)
3. Go to **Authentication** → **Settings** → **Users** tab
4. Click the three dots (⋮) in the top right
5. Select **"Password hash parameters"**
6. Copy:
   - `base64_signer_key` (this is your hash-key)
   - `base64_salt_separator`
   - `rounds`
   - `mem_cost`

## Alternative: Reset All Passwords

If re-importing doesn't work, users will need to reset their passwords:

1. Users can use the "Passwort vergessen?" link on the login page
2. Or use the admin endpoint: `POST /routes/send-password-reset-to-all` (generates reset links)

