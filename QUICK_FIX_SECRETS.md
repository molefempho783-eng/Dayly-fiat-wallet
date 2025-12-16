# Quick Fix: Grant Secret Permissions (No CLI Required)

## The Problem
Your Firebase Functions can't access PayFast secrets because the Cloud Run service account lacks permissions.

## Quick Solution (5 minutes) - Use Google Cloud Console

### Step 1: Open Secret Manager
Go to: **https://console.cloud.google.com/security/secret-manager?project=communitychat-f3fb0**

### Step 2: Grant Access to Each Secret

For **each** of these 5 secrets, follow these steps:

1. **Click on the secret name** (e.g., `PAYFAST_MERCHANT_ID`)
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

**Repeat for these 5 secrets:**
- ✅ `PAYFAST_MERCHANT_ID`
- ✅ `PAYFAST_MERCHANT_KEY`
- ✅ `PAYFAST_PASSPHRASE`
- ✅ `PAYFAST_ENV`
- ✅ `PAYFAST_ITN_URL`

### Step 3: Wait & Redeploy

1. **Wait 1-2 minutes** for permissions to propagate

2. **Redeploy your functions:**
   ```powershell
   firebase.cmd deploy --only functions:createPayFastPayment,functions:verifyPayFastPayment,functions:payfastITN
   ```

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

6. Wait 1-2 minutes, then redeploy:
   ```powershell
   firebase.cmd deploy --only functions:createPayFastPayment,functions:verifyPayFastPayment,functions:payfastITN
   ```

## Verify It Worked

After redeploying, you should see:
```
✔  functions[createPayFastPayment(us-central1)] Successful update operation.
✔  functions[verifyPayFastPayment(us-central1)] Successful update operation.
✔  functions[payfastITN(us-central1)] Successful update operation.
```

## Need Help?

- **Service Account Email:** `975021405125-compute@developer.gserviceaccount.com`
- **Required Role:** `Secret Manager Secret Accessor`
- **Project:** `communitychat-f3fb0`

If you still get errors, make sure:
- ✅ You're logged into the correct Google account
- ✅ Your account has "Owner" or "Editor" role on the project
- ✅ You waited 2-3 minutes after granting permissions

