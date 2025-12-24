# Deploy Dayly App for PayFast Verification

This guide will help you deploy your Dayly app as a web application that PayFast can verify.

## Quick Deploy (Recommended - Netlify)

### Step 1: Build the Web Version

```bash
cd C:\Users\User\Documents\Dayly-fiat-wallet-main
npm run build:web
```

This will create a `dist` folder with your web app.

### Step 2: Deploy to Netlify

1. Go to [netlify.com](https://www.netlify.com) and sign up/login (free)
2. Drag and drop the `dist` folder onto Netlify
3. Your app will be live at: `https://your-app-name.netlify.app`
4. Send this URL to PayFast

## Alternative: Vercel

### Step 1: Build
```bash
npm run build:web
```

### Step 2: Deploy
1. Go to [vercel.com](https://vercel.com)
2. Sign up/login (free)
3. Click "New Project"
4. Upload the `dist` folder
5. Deploy and get your URL

## Alternative: Firebase Hosting

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Login
```bash
firebase login
```

### Step 3: Initialize (if not already done)
```bash
firebase init hosting
```
- Select `dist` as your public directory
- Configure as single-page app: Yes
- Don't overwrite existing index.html: No

### Step 4: Build and Deploy
```bash
npm run build:web
firebase deploy --only hosting
```

## Troubleshooting

### If build fails:
- Make sure all dependencies are installed: `npm install`
- Check for any web-specific errors in the console
- Some native modules may not work on web (that's okay for verification)

### If some features don't work on web:
- That's normal - some native features (camera, location) may have limited web support
- PayFast just needs to see the app is functional and has payment integration
- Focus on showing: Wallet screen, payment flow, business listings

## What PayFast Needs to See

PayFast wants to verify:
1. ✅ Your app exists and is functional
2. ✅ You have a wallet/payment system
3. ✅ PayFast integration is present
4. ✅ The app is accessible via a public URL

The web version should show:
- Login/Authentication
- Wallet screen (with balance)
- Payment/top-up functionality
- Business listings
- Map view (if possible)

## Notes

- The web build may not support all native features (camera, push notifications, etc.)
- This is fine for verification purposes
- Once verified, you can continue using the mobile app normally
