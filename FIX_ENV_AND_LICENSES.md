# Fix Environment Variable Loading and Android SDK Licenses

## Issue 1: "env: load .env" Error

Expo CLI is trying to use a Unix `env` command on Windows, which doesn't exist. This is a known issue.

### Solution: Accept the licenses first, then we'll work around the env issue

## Issue 2: Android SDK Licenses Not Accepted

The build needs NDK licenses to be accepted.

### Solution: Accept SDK Licenses

#### Option A: Using Android Studio (Easiest)

1. Open **Android Studio**
2. Go to **Tools → SDK Manager**
3. Click the **"SDK Tools"** tab
4. Check **"NDK (Side by side)"** and ensure version **27.1.12297006** is installed
5. If not installed, check it and click **"Apply"**
6. During installation, it will prompt you to accept licenses - click **"Accept"** for all

#### Option B: Using Command Line

1. Open **Android Studio**
2. Go to **Tools → SDK Manager**
3. Note your **Android SDK Location** (usually `C:\Users\User\AppData\Local\Android\Sdk`)
4. In PowerShell, run:

```powershell
# Set your SDK path
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"

# Find sdkmanager (it might be in different locations)
$sdkmanager = Get-ChildItem $sdkPath -Recurse -Filter "sdkmanager.bat" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($sdkmanager) {
    Write-Host "Found sdkmanager at: $($sdkmanager.FullName)"
    # Accept all licenses (press 'y' for each)
    & $sdkmanager.FullName --licenses
} else {
    Write-Host "sdkmanager not found. Please use Android Studio SDK Manager instead."
}
```

#### Option C: Manual License Acceptance

If the above don't work, you can manually create license files:

1. Create directory: `C:\Users\User\AppData\Local\Android\Sdk\licenses`
2. Create file: `android-sdk-license` with content:
   ```
   24333f8a63b6825ea9c5514f83c2829b004d1fee
   ```
3. Create file: `android-sdk-preview-license` with content:
   ```
   84831b9409646a918e30573bab4c9c91346d8abd
   ```
4. For NDK, create: `android-ndk-license` with content:
   ```
   2442a87b8cdfe61e6b186c0bc429782b2d7c7d4b
   ```

## After Accepting Licenses

### Try Building Again

Once licenses are accepted, try building:

```powershell
# Make sure environment variables are set
$env:EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "AIzaSyDR5JhBnTT53KmUwNQI6QcWG5RjY5sdYRM"
$env:EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY = "pk_live_9584c6cf2bb9017d43d70d5b3af19233fa62fc17"

# Try building with Expo
npm.cmd run android
```

### If "env: load .env" Error Persists

The error is coming from Expo trying to use Unix commands. You can work around it by:

1. **Building directly with Gradle** (bypasses Expo's env loading):
   ```powershell
   cd android
   .\gradlew.bat assembleDebug
   cd ..
   ```

2. **Or install Git Bash** (which provides Unix commands):
   - Download: https://git-scm.com/download/win
   - Install it
   - Add Git Bash to PATH
   - Then `npm run android` should work

3. **Or use WSL** (Windows Subsystem for Linux):
   - Install WSL: `wsl --install`
   - Run commands in WSL environment

## Quick Fix Summary

1. ✅ Accept Android SDK licenses (use Android Studio SDK Manager)
2. ✅ Set environment variables in PowerShell before building
3. ✅ Try building again: `npm.cmd run android`

If the env error persists, use direct Gradle build or install Git Bash.

