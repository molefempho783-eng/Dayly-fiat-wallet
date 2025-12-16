# Fix Email Secret Permissions

## Problem
You're getting: **"Missing secret: EMAIL_USER"**

This means the Cloud Run service account doesn't have permission to read the email secrets.

## Quick Fix (5 minutes) - Use Google Cloud Console

### Step 1: Open Secret Manager
Go to: **https://console.cloud.google.com/security/secret-manager?project=communitychat-f3fb0**

### Step 2: Grant Access to Email Secrets

For **each** of these 2 secrets, follow these steps:

1. **Click on the secret name** (e.g., `EMAIL_USER`)
2. Click the **"PERMISSIONS"** tab at the top
3. Click the **"GRANT ACCESS"** button
4. In the **"New principals"** field, paste:
   ```
   975021405125-compute@developer.gserviceaccount.com
   ```
5. In the **"Select a role"** dropdown, choose:
   ```
   Secret Manager Secret Accessor
   ```
6. Click **"SAVE"**

**Repeat for these 2 secrets:**
- ✅ `EMAIL_USER`
- ✅ `EMAIL_PASSWORD`

### Step 3: Wait & Test

1. **Wait 1-2 minutes** for permissions to propagate
2. **Test the password reset function** in your app

## Alternative: Grant at Project Level (Faster)

If you want to grant access to **all secrets at once**:

1. Go to: **https://console.cloud.google.com/iam-admin/iam?project=communitychat-f3fb0**

2. Look for or click **"GRANT ACCESS"** button

3. In **"New principals"**, paste:
   ```
   975021405125-compute@developer.gserviceaccount.com
   ```

4. Click **"Select a role"** and choose:
   ```
   Secret Manager Secret Accessor
   ```

5. Click **"SAVE"**

6. Wait 1-2 minutes, then test the password reset function

## Verify It Worked

After granting permissions and waiting 1-2 minutes:
1. Open your app
2. Go to login screen
3. Click "Forgot Password?"
4. Enter an email address
5. Click "Send New Password"
6. You should see a success message (no more "Missing secret" error)

