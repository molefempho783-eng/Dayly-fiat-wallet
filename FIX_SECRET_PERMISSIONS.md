# Fix PayFast Secret Permissions Error

## Problem
When deploying Firebase Functions, you're getting this error:
```
Permission denied on secret: projects/communitychat-f3fb0/secrets/PAYFAST_MERCHANT_ID/versions/1 
for Revision service account 975021405125-compute@developer.gserviceaccount.com. 
The service account used must be granted the 'Secret Manager Secret Accessor' role 
(roles/secretmanager.secretAccessor) at the secret, project or higher level.
```

## Root Cause
The Cloud Run service account (`975021405125-compute@developer.gserviceaccount.com`) doesn't have permission to read the PayFast secrets from Google Secret Manager.

## Solution: Grant Secret Accessor Role

You have **three options** to fix this. **Option 1 (Google Cloud Console) is recommended** since you don't have gcloud CLI installed.

### Option 1: Using Google Cloud Console (RECOMMENDED - No CLI needed) ⭐

**This is the easiest method and doesn't require installing anything.**

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/security/secret-manager?project=communitychat-f3fb0

2. **For each PayFast secret, grant access:**
   - Click on `PAYFAST_MERCHANT_ID`
   - Click the **"PERMISSIONS"** tab
   - Click **"GRANT ACCESS"**
   - In "New principals", enter: `975021405125-compute@developer.gserviceaccount.com`
   - Select role: **"Secret Manager Secret Accessor"**
   - Click **"SAVE"**
   
   **Repeat for these secrets:**
   - `PAYFAST_MERCHANT_ID`
   - `PAYFAST_MERCHANT_KEY`
   - `PAYFAST_PASSPHRASE`
   - `PAYFAST_ENV`
   - `PAYFAST_ITN_URL`

### Option 2: Using gcloud CLI (If you have it installed)

Run these commands in PowerShell:

```powershell
# Set your project
gcloud config set project communitychat-f3fb0

# Grant access to each secret
gcloud secrets add-iam-policy-binding PAYFAST_MERCHANT_ID `
  --member="serviceAccount:975021405125-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding PAYFAST_MERCHANT_KEY `
  --member="serviceAccount:975021405125-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding PAYFAST_PASSPHRASE `
  --member="serviceAccount:975021405125-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding PAYFAST_ENV `
  --member="serviceAccount:975021405125-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding PAYFAST_ITN_URL `
  --member="serviceAccount:975021405125-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

### Option 3: Grant at Project Level (Alternative)

If you want to grant access to all secrets at once:

**Via Console:**
1. Go to: https://console.cloud.google.com/iam-admin/iam?project=communitychat-f3fb0
2. Find or add: `975021405125-compute@developer.gserviceaccount.com`
3. Click **"EDIT"** (pencil icon)
4. Click **"ADD ANOTHER ROLE"**
5. Select: **"Secret Manager Secret Accessor"**
6. Click **"SAVE"**

**Via CLI:**
```powershell
gcloud projects add-iam-policy-binding communitychat-f3fb0 `
  --member="serviceAccount:975021405125-compute@developer.gserviceaccount.com" `
  --role="roles/secretmanager.secretAccessor"
```

## After Granting Permissions

1. **Wait 1-2 minutes** for permissions to propagate

2. **Redeploy the functions:**
   ```powershell
   cd functions
   npm.cmd run build
   cd ..
   firebase.cmd deploy --only functions:createPayFastPayment,functions:verifyPayFastPayment,functions:payfastITN
   ```

3. **Verify deployment:**
   ```powershell
   firebase.cmd functions:list
   ```

## Verify Secrets Exist

Before deploying, make sure all secrets are created:

```powershell
# List all secrets
firebase.cmd functions:secrets:access PAYFAST_MERCHANT_ID
firebase.cmd functions:secrets:access PAYFAST_MERCHANT_KEY
firebase.cmd functions:secrets:access PAYFAST_PASSPHRASE
firebase.cmd functions:secrets:access PAYFAST_ENV
firebase.cmd functions:secrets:access PAYFAST_ITN_URL
```

If any are missing, create them:
```powershell
firebase.cmd functions:secrets:set PAYFAST_MERCHANT_ID
# Enter your PayFast merchant ID when prompted
```

## Quick Reference

- **Service Account:** `975021405125-compute@developer.gserviceaccount.com`
- **Required Role:** `roles/secretmanager.secretAccessor`
- **Project:** `communitychat-f3fb0`
- **Secrets Needed:**
  - PAYFAST_MERCHANT_ID
  - PAYFAST_MERCHANT_KEY
  - PAYFAST_PASSPHRASE
  - PAYFAST_ENV
  - PAYFAST_ITN_URL

## Troubleshooting

If you still get permission errors after granting access:
1. Wait 2-3 minutes for IAM changes to propagate
2. Check the service account email is correct: `975021405125-compute@developer.gserviceaccount.com`
3. Verify you have "Owner" or "Editor" role on the project to grant permissions
4. Try granting at project level instead of per-secret

