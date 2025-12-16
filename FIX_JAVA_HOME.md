# Fix JAVA_HOME Error

## Problem
```
Please set the JAVA_HOME variable in your environment to match the location of your Java installation.
Error: gradlew.bat exited with non-zero code: 9009
```

## Solution: Set JAVA_HOME

Android Studio includes a JDK (Java Development Kit), but we need to tell Gradle where it is.

### Step 1: Find Your Java Installation

Android Studio typically includes Java in one of these locations:

1. **Check Android Studio's bundled JDK:**
   - `C:\Program Files\Android\Android Studio\jbr`
   - `C:\Users\User\AppData\Local\Android\Sdk\jbr`

2. **Or find it manually:**
   - Open Android Studio
   - Go to **File → Settings → Build, Execution, Deployment → Build Tools → Gradle**
   - Look at "Gradle JDK" - it will show the path

### Step 2: Set JAVA_HOME Environment Variable

#### Option A: Set Temporarily (Current Session Only)

In PowerShell, run:
```powershell
# Try this first (most common location)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

# Or if that doesn't exist, try:
$env:JAVA_HOME = "$env:LOCALAPPDATA\Android\Sdk\jbr"

# Verify it's set
$env:JAVA_HOME
```

Then try building again:
```powershell
npm.cmd run android
```

#### Option B: Set Permanently (Recommended)

1. **Press `Win + X`** → **System** → **Advanced system settings**

2. Click **"Environment Variables"**

3. Under **"User variables"**, click **"New"**:
   - **Variable name:** `JAVA_HOME`
   - **Variable value:** `C:\Program Files\Android\Android Studio\jbr`
     - (Or wherever your JDK is located - check Step 1)

4. Edit the **"Path"** variable, add:
   - `%JAVA_HOME%\bin`

5. Click **"OK"** on all dialogs

6. **Close and reopen PowerShell** for changes to take effect

7. Verify:
   ```powershell
   java -version
   $env:JAVA_HOME
   ```

### Step 3: Verify Java is Working

```powershell
java -version
```

You should see something like:
```
openjdk version "17.0.x" ...
```

### Step 4: Try Building Again

```powershell
npm.cmd run android
```

## Alternative: Install JDK Separately

If Android Studio's JDK isn't found, install JDK 17 (recommended for React Native):

1. Download: https://adoptium.net/temurin/releases/
2. Choose: **JDK 17** → **Windows** → **x64** → **.msi installer**
3. Install it
4. Set JAVA_HOME to: `C:\Program Files\Eclipse Adoptium\jdk-17.x.x-hotspot`
5. Add to PATH: `%JAVA_HOME%\bin`

## Quick Test Script

Run this in PowerShell to find and set Java:

```powershell
# Try to find Java
$paths = @(
    "C:\Program Files\Android\Android Studio\jbr",
    "$env:LOCALAPPDATA\Android\Sdk\jbr",
    "C:\Program Files\Java\jdk-17",
    "C:\Program Files\Eclipse Adoptium\jdk-17*"
)

$found = $false
foreach ($path in $paths) {
    if (Test-Path "$path\bin\java.exe") {
        Write-Host "Found Java at: $path"
        $env:JAVA_HOME = $path
        $env:Path += ";$path\bin"
        Write-Host "JAVA_HOME set to: $env:JAVA_HOME"
        java -version
        $found = $true
        break
    }
}

if (-not $found) {
    Write-Host "Java not found. Please install JDK 17 or set JAVA_HOME manually."
}
```

## Troubleshooting

### "java: command not found" after setting JAVA_HOME
- Make sure you added `%JAVA_HOME%\bin` to PATH
- Restart PowerShell/terminal
- Verify: `java -version`

### Build still fails
- Make sure JAVA_HOME points to the JDK folder (not bin subfolder)
- Check: `$env:JAVA_HOME` should show something like `C:\Program Files\Android\Android Studio\jbr`
- Verify Java works: `java -version`

### Multiple Java installations
- Use Android Studio's bundled JDK (recommended)
- Or use JDK 17 from Adoptium
- Make sure JAVA_HOME points to only one installation

## After Fixing

Once JAVA_HOME is set, try building again:
```powershell
npm.cmd run android
```

The build should now proceed past the Java error.

