# Clear Cache and Start App from Scratch

## Complete Cache Clear (Recommended)

Run these commands in order to clear all caches:

### Step 1: Stop any running processes
- Stop Metro bundler (Ctrl+C in the terminal where it's running)
- Close the app on your device/emulator

### Step 2: Clear all caches

```powershell
# Clear Metro bundler cache
npm.cmd start -- --reset-cache

# OR if that doesn't work, clear manually:
# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm.cmd install

# Clear Expo cache
npx.cmd expo start --clear

# Clear React Native cache
npx.cmd react-native start --reset-cache

# Clear Android build cache
cd android
.\gradlew.bat clean
cd ..

# Clear watchman cache (if installed)
watchman watch-del-all

# Clear Metro bundler cache directory
Remove-Item -Recurse -Force $env:TEMP\metro-*
Remove-Item -Recurse -Force $env:TEMP\haste-map-*
```

### Step 3: Clear app data on device/emulator

**For Android Emulator:**
```powershell
# Uninstall the app
adb uninstall com.mpho.dsquare

# Or clear app data
adb shell pm clear com.mpho.dsquare
```

**For Physical Android Device:**
- Go to Settings → Apps → Your App → Storage → Clear Data

**For iOS Simulator:**
```powershell
# Reset simulator (if on Mac)
xcrun simctl erase all
```

### Step 4: Rebuild and start

```powershell
# Rebuild the app
npm.cmd run android

# OR start fresh
npm.cmd start -- --clear
```

## Quick Cache Clear (Faster)

If you just want to clear Metro cache quickly:

```powershell
# Clear Metro cache and restart
npm.cmd start -- --reset-cache

# Or
npx.cmd expo start --clear
```

## Complete Fresh Start (Nuclear Option)

If nothing else works, do a complete reset:

```powershell
# 1. Stop all processes
# 2. Delete caches
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .expo
Remove-Item -Recurse -Force android\app\build
Remove-Item -Recurse -Force android\build
Remove-Item -Recurse -Force android\.gradle

# 3. Reinstall dependencies
npm.cmd install

# 4. Clear Android build
cd android
.\gradlew.bat clean
cd ..

# 5. Rebuild
npm.cmd run android
```

## Clear Specific Caches

### Metro Bundler Cache Only
```powershell
npm.cmd start -- --reset-cache
```

### Expo Cache Only
```powershell
npx.cmd expo start --clear
```

### Android Build Cache Only
```powershell
cd android
.\gradlew.bat clean
cd ..
```

### Node Modules (Reinstall)
```powershell
Remove-Item -Recurse -Force node_modules
npm.cmd install
```

## After Clearing Cache

1. **Rebuild the app:**
   ```powershell
   npm.cmd run android
   ```

2. **Or start Metro bundler:**
   ```powershell
   npm.cmd start
   ```

3. **If you get errors, try:**
   ```powershell
   npm.cmd start -- --clear --reset-cache
   ```

## Troubleshooting

### "Port already in use" error
```powershell
# Kill process on port 8081 (Metro bundler)
netstat -ano | findstr :8081
taskkill /PID <PID_NUMBER> /F
```

### "Cache corrupted" errors
- Delete `node_modules` and reinstall
- Clear Android build cache
- Rebuild the app

### App still shows old code
- Uninstall the app from device/emulator
- Rebuild: `npm.cmd run android`
- Clear Metro cache: `npm.cmd start -- --reset-cache`

