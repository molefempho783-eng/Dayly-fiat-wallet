# Troubleshooting Top-Up "Internal" Error

## Problem
When clicking "Top Up" on the wallet screen, you get an error dialog showing:
- **Title:** "Top-Up Failed"
- **Message:** "internal"

## What This Means
The "internal" error indicates that the Firebase Function (`createPayFastPayment`) encountered an unhandled exception. This has been improved with better error handling, but you may still need to check a few things.

## Common Causes & Solutions

### 1. Missing PayFast Credentials (Most Likely)
The Firebase Functions need PayFast API credentials configured as secrets.

**Check if credentials are set:**
```bash
# In your Firebase project directory
firebase.cmd functions:secrets:access PAYFAST_MERCHANT_ID
firebase.cmd functions:secrets:access PAYFAST_MERCHANT_KEY
```

**If not set, configure them:**
```bash
# Set PayFast secrets (you'll need your PayFast merchant credentials)
firebase.cmd functions:secrets:set PAYFAST_MERCHANT_ID
firebase.cmd functions:secrets:set PAYFAST_MERCHANT_KEY
firebase.cmd functions:secrets:set PAYFAST_PASSPHRASE
firebase.cmd functions:secrets:set PAYFAST_ENV  # Set to "sandbox" or "live"
firebase.cmd functions:secrets:set PAYFAST_ITN_URL  # Your webhook URL
```

**After setting secrets, redeploy functions:**
```bash
cd functions
npm.cmd run build
cd ..
firebase.cmd deploy --only functions
```

### 2. Check Firebase Functions Logs
View detailed error logs to see what's actually failing:

```bash
# View recent logs
firebase.cmd functions:log

# Or view in Firebase Console:
# https://console.firebase.google.com/project/YOUR_PROJECT_ID/functions/logs
```

Look for errors containing:
- "PayFast credentials missing"
- "createPayFastPayment error"
- Any Firestore permission errors

### 3. Firestore Permissions
Ensure your Firestore security rules allow writing to `pending_payments`:

```javascript
// In firestore.rules
match /pending_payments/{paymentId} {
  allow write: if request.auth != null && request.auth.uid == resource.data.uid;
  allow read: if request.auth != null && request.auth.uid == resource.data.uid;
}
```

### 4. Network/Connectivity Issues
- Check your internet connection
- Verify Firebase project is accessible
- Check if you're signed in: The error should show "Please sign in to continue" if authentication fails

### 5. Test with Improved Error Messages
After deploying the updated code, try again. The error message should now be more descriptive:
- "PayFast credentials not configured. Please contact support." - Missing API keys
- "Server error. Please try again later." - Other server-side issues
- "Please sign in to continue" - Authentication issue

## Debugging Steps

1. **Check the console logs:**
   - Open your app's developer console (React Native Debugger or Metro bundler logs)
   - Look for "Top-up error:" messages with details

2. **Check Firebase Functions logs:**
   ```bash
   firebase.cmd functions:log --only createPayFastPayment
   ```

3. **Verify your PayFast account:**
   - Log into PayFast merchant dashboard
   - Ensure your account is active
   - Check if you're using sandbox vs live credentials correctly

4. **Test the function locally (if possible):**
   ```bash
   cd functions
   npm.cmd run serve
   # Then test the function endpoint
   ```

## Quick Fix Checklist

- [ ] PayFast credentials are set in Firebase Functions secrets
- [ ] Functions have been redeployed after setting secrets
- [ ] User is signed in to the app
- [ ] Internet connection is working
- [ ] Checked Firebase Functions logs for specific errors
- [ ] Firestore rules allow writing to `pending_payments`

## Getting More Help

If the error persists after checking the above:

1. **Check Firebase Functions logs** and share the error details
2. **Verify PayFast credentials** are correct
3. **Test with a small amount** (e.g., R1.00) to rule out amount-related issues
4. **Check if other Firebase Functions work** (to rule out general connectivity issues)

## Code Changes Made

I've improved error handling in:
1. **`functions/src/index.ts`** - Added try-catch wrapper with detailed logging
2. **`Screens/Wallet/WalletScreen.tsx`** - Improved error message extraction and display

After deploying these changes, you should see more descriptive error messages that will help identify the root cause.

