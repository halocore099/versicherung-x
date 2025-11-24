# Firebase User Import Troubleshooting

## Issue: Users can't log in after import (`auth/invalid-credential`)

### Possible Causes:

1. **Hash Key Mismatch** - Each Firebase project has its own unique hash key. If you used the OLD project's hash key, it won't work with the NEW project.

2. **Incorrect Export Format** - The `users.json` export might not have the correct password hash format.

3. **SCRYPT Parameters Mismatch** - The rounds, mem-cost, or salt-separator might be different.

## How to Fix:

### Step 1: Verify Users Were Imported

Check Firebase Console:
1. Go to Firebase Console → Authentication → Users
2. Verify that your imported users appear in the list
3. Check if they have email/password providers enabled

### Step 2: Get the NEW Project's Hash Key

**Important:** You need to use the NEW project's hash key, not the old one!

1. Go to Firebase Console → Authentication → Settings → Users
2. Scroll down to "Password hash parameters"
3. Copy the hash key, salt separator, rounds, and mem-cost

### Step 3: Re-export Users from OLD Project (if needed)

If the export didn't include password hashes correctly:

```bash
# Export users from OLD project
firebase auth:export users.json \
  --project OLD_PROJECT_ID
```

Verify the export includes `passwordHash` and `salt` fields for each user.

### Step 4: Re-import with NEW Project's Hash Parameters

```bash
firebase auth:import users.json \
  --project NEW_PROJECT_ID \
  --hash-algo=SCRYPT \
  --hash-key="<NEW_PROJECT_HASH_KEY>" \
  --salt-separator="<NEW_PROJECT_SALT_SEPARATOR>" \
  --rounds=<NEW_PROJECT_ROUNDS> \
  --mem-cost=<NEW_PROJECT_MEM_COST>
```

### Step 5: Test with a Single User

1. Try logging in with one imported user
2. If it fails, check the browser console for the exact error
3. Verify the user exists in Firebase Console

### Alternative: Reset All Passwords

If the hash parameters don't match, you'll need to reset passwords:

1. Use Firebase Admin SDK to send password reset emails to all users
2. Or manually reset passwords in Firebase Console
3. Users will receive reset emails and can set new passwords

## Verification Commands

```bash
# List users in new project
firebase auth:export users-check.json --project NEW_PROJECT_ID

# Check if a specific user exists
# (Use Firebase Console or Admin SDK)
```

## Notes

- **Hash keys are project-specific** - You cannot use the old project's hash key with the new project
- **Password hashes must match exactly** - Any mismatch will cause login failures
- **If passwords don't work after import**, users must reset their passwords via email

