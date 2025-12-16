# Development Environment Setup Guide

## ✅ Already Installed
- ✅ Node.js v24.12.0
- ✅ npm 11.6.2
- ✅ Git 2.52.0
- ✅ Expo CLI 0.24.22
- ✅ Firebase CLI 15.0.0
- ✅ Project dependencies installed
- ✅ Firebase functions dependencies installed

## 📱 Required: Android Studio Setup

### Step 1: Download and Install Android Studio

1. **Download Android Studio:**
   - Go to: https://developer.android.com/studio
   - Click "Download Android Studio"
   - Run the installer (`android-studio-*.exe`)

2. **During Installation:**
   - ✅ Check "Android SDK"
   - ✅ Check "Android SDK Platform"
   - ✅ Check "Android Virtual Device"
   - Choose installation location (default is fine: `C:\Users\User\AppData\Local\Android\Sdk`)

3. **First Launch Setup:**
   - Choose "Standard" installation
   - Let it download SDK components (this takes 10-30 minutes)
   - Accept all licenses when prompted

### Step 2: Install Required SDK Components

1. Open Android Studio
2. Go to **Tools → SDK Manager** (or click the SDK Manager icon)
3. In the **SDK Platforms** tab, ensure these are installed:
   - ✅ Android 14.0 (API 34) - or latest
   - ✅ Android 13.0 (API 33) - recommended
   - ✅ Android 12.0 (API 31) - minimum for React Native

4. In the **SDK Tools** tab, ensure these are checked:
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Command-line Tools
   - ✅ Android SDK Platform-Tools
   - ✅ Android Emulator
   - ✅ Google Play services
   - ✅ Intel x86 Emulator Accelerator (HAXM installer) - if available

5. Click **Apply** and let it install

### Step 3: Set Up Environment Variables

You need to add Android SDK paths to your system PATH:

1. **Find your Android SDK location:**
   - Default: `C:\Users\User\AppData\Local\Android\Sdk`
   - Or check in Android Studio: **File → Settings → Appearance & Behavior → System Settings → Android SDK**

2. **Set Environment Variables:**
   - Press `Win + X` → **System** → **Advanced system settings**
   - Click **Environment Variables**
   - Under **User variables**, click **New**:
     - Variable name: `ANDROID_HOME`
     - Variable value: `C:\Users\User\AppData\Local\Android\Sdk` (your actual path)
   - Edit the **Path** variable, add these entries:
     - `%ANDROID_HOME%\platform-tools`
     - `%ANDROID_HOME%\tools`
     - `%ANDROID_HOME%\tools\bin`
     - `%ANDROID_HOME%\emulator`

3. **Restart PowerShell/Terminal** after setting environment variables

### Step 4: Verify Android Setup

Open a **new** PowerShell window and run:
```powershell
adb version
java -version
```

You should see version numbers. If not, check your PATH variables.

## 🔧 Optional but Recommended

### Install VS Code (Code Editor)
- Download: https://code.visualstudio.com/
- Recommended extensions:
  - ESLint
  - Prettier
  - React Native Tools
  - Firebase

### ⚠️ Important: This Project Uses Development Builds

**This project uses `expo-dev-client`, which means you CANNOT use Expo Go.** You must build a development client first.

**Two Options:**

#### Option A: Build Locally (Recommended)
After setting up Android Studio, build the development client:
```powershell
npm.cmd run android
```
This will:
1. Compile the native Android code
2. Build the APK
3. Install it on your connected device/emulator
4. Start the Metro bundler

#### Option B: Use EAS Build (Cloud Build)
If you prefer cloud builds:
1. Install EAS CLI: `npm.cmd install -g eas-cli`
2. Login: `eas.cmd login`
3. Build: `eas.cmd build --profile development --platform android`
4. Install the downloaded APK on your device
5. Then run: `npm.cmd start`

## 🚀 Testing Your Setup

After completing Android Studio setup:

1. **Verify all tools:**
   ```powershell
   node --version
   npm.cmd --version
   git --version
   firebase.cmd --version
   adb version
   ```

2. **Start the Expo development server:**
   ```powershell
   npm.cmd start
   ```

3. **Create an Android Virtual Device (AVD):**
   - Open Android Studio
   - Go to **Tools → Device Manager**
   - Click **Create Device**
   - Choose a device (e.g., Pixel 5)
   - Select a system image (API 33 or 34 recommended)
   - Click **Finish**

4. **Build and Run the Development Client:**
   ```powershell
   # Make sure your emulator is running or device is connected
   adb devices  # Should show your device/emulator
   
   # Build and install the development client
   npm.cmd run android
   ```
   
   **Note:** The first build takes 5-15 minutes as it compiles all native code. Subsequent builds are faster.

## 📝 Notes

- **Node Version Warning:** Your functions folder expects Node 22, but you have Node 24. This should work fine, but if you encounter issues, consider using `nvm` (Node Version Manager) to switch versions.

- **PowerShell Execution Policy:** If you get script execution errors, use `npm.cmd` instead of `npm`, or run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

- **Firebase Login:** You'll need to log in to Firebase when deploying:
  ```powershell
  firebase.cmd login
  ```

## 🆘 Troubleshooting

### "adb: command not found"
- Check that ANDROID_HOME is set correctly
- Verify platform-tools is in your PATH
- Restart your terminal

### "java: command not found"
- Java comes with Android Studio, but you may need to add it to PATH
- Or install JDK separately: https://adoptium.net/

### "No development build installed" Error
- This means you need to build the development client first
- Run: `npm.cmd run android` to build and install it
- Make sure your device/emulator is connected: `adb devices`

### Expo/React Native issues
- Clear cache: `npm.cmd start -- --clear`
- Reset Metro bundler: `npm.cmd start -- --reset-cache`
- Clean Android build: `cd android && gradlew clean && cd ..`

## 📚 Next Steps

1. Complete Android Studio installation (Steps 1-3 above)
2. Set up an Android Virtual Device (AVD) in Android Studio
3. Test running the app: `npm.cmd run android`
4. Configure Firebase project settings if needed
5. Set up any environment variables (.env files) if your project requires them

---

**Need help?** Check the project README or Firebase/Expo documentation.

