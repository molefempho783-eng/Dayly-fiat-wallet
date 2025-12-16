# Building the Development Client

## Problem
You're getting: `No development build (com.mpho.dsquare) for this project is installed`

## Solution: Build Locally (Recommended - Faster)

Since you have Android Studio set up, you can build directly on your machine:

### Step 1: Make sure your device/emulator is connected

```powershell
# Check connected devices
adb devices
```

You should see at least one device listed (your physical device or emulator).

### Step 2: Build and install the development client

```powershell
# This will compile native code, build APK, and install it
npm.cmd run android
```

**Note:** The first build takes 10-15 minutes as it compiles all native code. Subsequent builds are much faster.

### Step 3: After installation

Once the build completes and the app is installed:
1. The Metro bundler will start automatically
2. The app should open on your device/emulator
3. You can now use `npm.cmd start` to start the dev server

## Alternative: EAS Build (Cloud Build)

If you prefer cloud builds or local build fails:

### Step 1: Install EAS CLI

```powershell
npm.cmd install -g eas-cli
```

**Note:** In PowerShell, use `;` instead of `&&` to chain commands:
```powershell
npm.cmd install -g eas-cli; eas.cmd login
```

### Step 2: Login to EAS

```powershell
eas.cmd login
```

### Step 3: Build development client

```powershell
eas.cmd build --platform android --profile development
```

This will:
- Build in the cloud (takes 10-20 minutes)
- Give you a download link for the APK
- You'll need to install the APK manually on your device

### Step 4: Install the APK

After the build completes:
1. Download the APK from the link provided
2. Transfer to your Android device
3. Install it (you may need to enable "Install from unknown sources")
4. Then run `npm.cmd start` to connect to the dev server

## Troubleshooting

### "adb: command not found"
- Make sure Android SDK is in your PATH (we set this up earlier)
- Restart PowerShell if you just set environment variables

### Build fails with Gradle errors
- Make sure Java/JDK is accessible (comes with Android Studio)
- Try: `cd android; .\gradlew clean; cd ..` then rebuild

### "No devices found"
- Start an Android emulator in Android Studio, OR
- Connect a physical device via USB with USB debugging enabled

### Build takes too long
- First build always takes 10-15 minutes (compiling native code)
- Subsequent builds are faster (2-5 minutes)
- Make sure you have a stable internet connection

## Quick Reference

**Local Build (Recommended):**
```powershell
adb devices                    # Check devices
npm.cmd run android           # Build and install
```

**EAS Cloud Build:**
```powershell
npm.cmd install -g eas-cli    # Install EAS CLI
eas.cmd login                  # Login to Expo
eas.cmd build --platform android --profile development
```

**After Build:**
```powershell
npm.cmd start                  # Start Metro bundler
```

## Which Method to Use?

- **Local Build (`npm run android`):** 
  - ✅ Faster (no upload/download)
  - ✅ Free
  - ✅ Better for debugging
  - ❌ Requires Android Studio setup (you have this!)

- **EAS Build (`eas build`):**
  - ✅ No local setup needed
  - ✅ Consistent build environment
  - ❌ Slower (cloud build + download)
  - ❌ Requires EAS account (free tier available)

**Recommendation:** Use local build since you already have Android Studio set up!

