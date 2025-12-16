# Password Reset Setup Guide

The password reset function has been successfully implemented. It generates a strong password and sends it to the user's email address.

## What's Been Implemented

1. **Firebase Cloud Function** (`resetPassword`):
   - Generates a strong 16-character password (uppercase, lowercase, numbers, special characters)
   - Updates the user's password in Firebase Auth
   - Sends the new password via email

2. **Client-Side UI** (AuthScreen):
   - Added "Forgot Password?" link on the login screen
   - Shows a password reset form when clicked
   - Displays success/error messages

## Required Setup: Email Configuration

The password reset function requires email credentials to send emails. You need to configure these as Firebase Functions secrets.

### Option 1: Gmail (Recommended for Testing)

**IMPORTANT:** Do NOT use your regular Gmail password. You need to create an App Password.

#### Step-by-Step: Creating a Gmail App Password

1. **Go to Google Account Settings:**
   - Visit: https://myaccount.google.com/
   - Or go to: Google Account → Security

2. **Enable 2-Step Verification (if not already enabled):**
   - In Security settings, find "2-Step Verification"
   - If it's OFF, click it and follow the steps to enable it
   - **Note:** App Passwords require 2-Step Verification to be enabled

3. **Create an App Password:**
   - After 2-Step Verification is enabled, go back to Security settings
   - Look for "App passwords" (it should appear below "2-Step Verification")
   - Click on "App passwords"
   - If you don't see it, make sure 2-Step Verification is fully enabled first

4. **Generate the Password:**
   - Select "Mail" as the app type
   - Select "Other (Custom name)" as the device, and type "Firebase Functions"
   - Click "Generate"
   - Google will show you a 16-character password (like: `abcd efgh ijkl mnop`)
   - **Copy this password immediately** - you won't be able to see it again!

5. **Set Firebase Secrets:**
   ```bash
   # Set email user (your Gmail address)
   firebase functions:secrets:set EMAIL_USER
   # When prompted, enter: your-email@gmail.com

   # Set email password (paste the 16-character app password WITHOUT spaces)
   firebase functions:secrets:set EMAIL_PASSWORD
   # When prompted, paste: abcdefghijklmnop (remove any spaces)
   ```

#### Alternative: If You Don't Want to Enable 2-Step Verification

If you prefer not to enable 2-Step Verification, you can use your regular Gmail password, but you'll need to:
1. Enable "Less secure app access" in your Google Account (not recommended, less secure)
2. Or use a different email provider that supports SMTP without 2FA

**However, using App Passwords is the recommended and more secure approach.**

### Option 2: Other Email Providers (SMTP)

If you want to use a different email provider (e.g., SendGrid, Mailgun, custom SMTP), you'll need to modify the email transporter configuration in `functions/src/index.ts`:

```typescript
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: requireEnv('EMAIL_USER'),
    pass: requireEnv('EMAIL_PASSWORD'),
  },
});
```

Then set the `EMAIL_USER` and `EMAIL_PASSWORD` secrets as described above.

## Deploy the Function

After setting up the secrets, deploy the function:

```bash
cd functions
npm run build
firebase deploy --only functions:resetPassword
```

## Testing

1. Open the app and go to the login screen
2. Click "Forgot Password?"
3. Enter your email address
4. Click "Send New Password"
5. Check your email for the new password
6. Use the new password to log in

## Security Notes

- The function does not reveal whether an email exists in the system (prevents email enumeration)
- Passwords are generated with strong randomness
- Users should change their password after logging in with the generated password
- The email includes instructions to change the password after login

## Troubleshooting

### "Missing secret: EMAIL_USER" or "Missing secret: EMAIL_PASSWORD"
- Make sure you've set both secrets using `firebase functions:secrets:set`
- Redeploy the function after setting secrets

### Email not received
- Check spam/junk folder
- Verify the email address is correct
- Check Firebase Functions logs: `firebase functions:log`
- Ensure your email provider allows SMTP access

### Gmail "Less secure app access" error
- Use App Passwords instead of your regular Gmail password
- Make sure 2-Step Verification is enabled on your Google Account

