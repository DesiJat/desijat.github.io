# 🚀 Flutter Complete Command Guide
> A comprehensive reference for managing Flutter apps across all platforms.

---

## 📋 Table of Contents
1. [Environment Setup](#1-environment-setup)
2. [Project Management](#2-project-management)
3. [Running the App](#3-running-the-app)
4. [Building for Each Platform](#4-building-for-each-platform)
5. [Debugging & Logs](#5-debugging--logs)
6. [Packages & Dependencies](#6-packages--dependencies)
7. [Testing](#7-testing)
8. [Code Quality](#8-code-quality)
9. [Device Management](#9-device-management)
10. [Release & Signing](#10-release--signing)
11. [Flutter Upgrade & Version Management](#11-flutter-upgrade--version-management)
12. [Common Issues & Fixes](#12-common-issues--fixes)

---

## 1. Environment Setup

```bash
# Check Flutter installation and environment health
flutter doctor

# Show detailed output with verbose info
flutter doctor -v

# Check Android licenses (accept all required licenses)
flutter doctor --android-licenses

# Show Flutter version
flutter --version

# Show Dart version
dart --version

# Show Flutter SDK path
flutter sdk-path
```

---

## 2. Project Management

### Create a New Project
```bash
# Create a new Flutter project
flutter create my_app

# Create with specific organization name
flutter create --org com.mycompany my_app

# Create with specific platforms only
flutter create --platforms android,ios my_app

# Create with a specific template
flutter create --template app my_app        # Standard app
flutter create --template plugin my_plugin  # Plugin package
flutter create --template package my_pkg    # Dart package

# Create with specific language (default is Dart)
flutter create --android-language kotlin --ios-language swift my_app
```

### Project Structure Commands
```bash
# Clean build artifacts and cache
flutter clean

# Get all dependencies listed in pubspec.yaml
flutter pub get

# Upgrade all dependencies to latest versions
flutter pub upgrade

# Show outdated packages
flutter pub outdated

# Generate code (for packages like build_runner)
flutter pub run build_runner build

# Watch and regenerate code on changes
flutter pub run build_runner watch

# Delete generated files and rebuild
flutter pub run build_runner build --delete-conflicting-outputs
```

---

## 3. Running the App

### General Run Commands
```bash
# Run on default connected device
flutter run

# Run on a specific device (use device ID from flutter devices)
flutter run -d <device_id>

# Run in release mode (optimized, no debug tools)
flutter run --release

# Run in profile mode (for performance profiling)
flutter run --profile

# Run in debug mode (default)
flutter run --debug

# Run with verbose logging
flutter run -v

# Run on a specific port (for web)
flutter run -d chrome --web-port 8080
```

### Hot Reload & Restart (while app is running)
```bash
# Hot Reload — updates UI without restarting app (press in terminal)
r

# Hot Restart — full restart, resets app state
R

# Quit the running app
q

# Print performance overlay
P

# Toggle debug paint (layout borders)
p

# Open DevTools in browser
v

# Screenshot the current screen
s
```

---

## 4. Building for Each Platform

---

### 🤖 Android

```bash
# Build debug APK
flutter build apk --debug

# Build release APK (unsigned or debug-signed)
flutter build apk --release

# Build split APKs per ABI (smaller size, recommended for Play Store)
flutter build apk --release --split-per-abi

# Build App Bundle (AAB) for Google Play Store upload
flutter build appbundle --release

# Build with specific flavor
flutter build apk --flavor production

# Build with target file
flutter build apk -t lib/main_prod.dart

# Install APK directly to connected device
flutter install
# OR via ADB
adb install build/app/outputs/flutter-apk/app-release.apk
```

**Output paths:**
| Build Type | Output Path |
|-----------|-------------|
| APK Debug | `build/app/outputs/flutter-apk/app-debug.apk` |
| APK Release | `build/app/outputs/flutter-apk/app-release.apk` |
| APK Split (arm64) | `build/app/outputs/flutter-apk/app-arm64-v8a-release.apk` |
| App Bundle | `build/app/outputs/bundle/release/app-release.aab` |

---

### 🍎 iOS

> **Requires:** macOS + Xcode installed

```bash
# Run on iOS Simulator
flutter run -d "iPhone 15"

# Build iOS debug
flutter build ios --debug

# Build iOS release (for device)
flutter build ios --release

# Build iOS App Archive (for App Store submission)
flutter build ipa --release

# Build IPA with export options plist
flutter build ipa --release --export-options-plist=ExportOptions.plist

# Open in Xcode (for manual archiving/signing)
open ios/Runner.xcworkspace
```

**Output paths:**
| Build Type | Output Path |
|-----------|-------------|
| IPA | `build/ios/ipa/*.ipa` |
| Archive | `build/ios/archive/Runner.xcarchive` |

---

### 🌐 Web

```bash
# Run on Chrome browser (default)
flutter run -d chrome

# Run on Edge browser
flutter run -d edge

# Run on Web Server (any browser via localhost)
flutter run -d web-server --web-port 8080

# Build web app (release)
flutter build web --release

# Build web with specific base href (for subdirectory deployment)
flutter build web --base-href /myapp/

# Build web with HTML renderer (better compatibility)
flutter build web --web-renderer html

# Build web with CanvasKit renderer (better graphics)
flutter build web --web-renderer canvaskit

# Build web with auto renderer (default)
flutter build web --web-renderer auto
```

**Output path:** `build/web/`

**Serve locally after build:**
```bash
# Using Python
cd build/web && python3 -m http.server 8080

# Using Node.js serve package
npx serve build/web
```

---

### 🪟 Windows

> **Requires:** Windows OS + Visual Studio with "Desktop development with C++" workload

```bash
# Run on Windows desktop
flutter run -d windows

# Build Windows app (release)
flutter build windows --release
```

**Output path:** `build/windows/x64/runner/Release/`

---

### 🍏 macOS

> **Requires:** macOS + Xcode

```bash
# Run on macOS desktop
flutter run -d macos

# Build macOS app (release)
flutter build macos --release
```

**Output path:** `build/macos/Build/Products/Release/<AppName>.app`

---

### 🐧 Linux

> **Requires:** Linux OS + build tools (`clang`, `cmake`, `ninja-build`, `pkg-config`, `libgtk-3-dev`)

```bash
# Run on Linux desktop
flutter run -d linux

# Build Linux app (release)
flutter build linux --release
```

**Output path:** `build/linux/x64/release/bundle/`

---

## 5. Debugging & Logs

```bash
# View logs from a running app
flutter logs

# View logs from a specific device
flutter logs -d <device_id>

# Run with verbose output
flutter run -v

# Open Flutter DevTools (performance, widget inspector, memory)
flutter devtools

# Analyze app performance
flutter run --profile
# Then press 'P' to show performance overlay

# Trace startup time
flutter run --trace-startup

# Dump widget tree to console (while app is running)
# Press 'w' in terminal during flutter run

# Dump layer tree
# Press 'L' in terminal during flutter run
```

---

## 6. Packages & Dependencies

```bash
# Add a package
flutter pub add package_name

# Add a dev dependency
flutter pub add --dev package_name

# Remove a package
flutter pub remove package_name

# Get all packages
flutter pub get

# Upgrade a specific package
flutter pub upgrade package_name

# Upgrade all packages to latest compatible versions
flutter pub upgrade

# Upgrade packages ignoring version constraints (be careful!)
flutter pub upgrade --major-versions

# Show dependency graph
flutter pub deps

# Verify and fix pubspec.lock
flutter pub get --enforce-lockfile

# Publish a package to pub.dev
flutter pub publish
```

---

## 7. Testing

```bash
# Run all unit and widget tests
flutter test

# Run a specific test file
flutter test test/widget_test.dart

# Run tests with verbose output
flutter test -v

# Run tests and show coverage report
flutter test --coverage

# View coverage report (requires lcov)
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html

# Run integration tests on a device
flutter test integration_test/app_test.dart -d <device_id>

# Run tests in headless mode
flutter test --machine
```

---

## 8. Code Quality

```bash
# Analyze code for errors and warnings
flutter analyze

# Format all Dart files in project
dart format .

# Format a specific file
dart format lib/main.dart

# Check formatting without changing files
dart format --output=none .

# Fix auto-fixable lint issues
dart fix --apply

# Preview fixes without applying
dart fix --dry-run
```

---

## 9. Device Management

```bash
# List all connected devices and emulators
flutter devices

# List all available emulators
flutter emulators

# Launch an emulator by ID
flutter emulators --launch <emulator_id>

# Create a new Android emulator
flutter emulators --create --name MyEmulator

# Connect to a device over WiFi (Android)
adb connect <device_ip>:5555

# List ADB devices
adb devices

# Take a screenshot via ADB
adb exec-out screencap -p > screenshot.png

# Install APK via ADB
adb install path/to/app.apk

# Uninstall app via ADB
adb uninstall com.your.package.name

# Clear app data via ADB
adb shell pm clear com.your.package.name

# View device logs (Android)
adb logcat

# View Flutter-only logs
adb logcat | grep flutter
```

---

## 10. Release & Signing

### Android Signing

**Step 1: Generate a keystore**
```bash
keytool -genkey -v \
  -keystore ~/upload-keystore.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias upload
```

**Step 2: Create `android/key.properties`**
```properties
storePassword=<your_store_password>
keyPassword=<your_key_password>
keyAlias=upload
storeFile=<path_to_keystore>/upload-keystore.jks
```

**Step 3: Update `android/app/build.gradle.kts`**
```kotlin
// Add signing config referencing key.properties
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

**Step 4: Build signed release APK**
```bash
flutter build apk --release
# OR for Play Store
flutter build appbundle --release
```

---

### iOS Signing
> Done via Xcode. Open `ios/Runner.xcworkspace` → Select team → Build.

```bash
# Build IPA for App Store
flutter build ipa --release
```

---

## 11. Flutter Upgrade & Version Management

```bash
# Upgrade Flutter to latest stable
flutter upgrade

# Switch Flutter channel
flutter channel stable     # Stable (recommended for production)
flutter channel beta       # Beta (newer features, some bugs)
flutter channel master     # Bleeding edge (unstable)

# Show current channel
flutter channel

# Downgrade to a specific version (via git)
cd $(flutter sdk-path)
git checkout 3.19.0

# Use FVM (Flutter Version Manager) for multiple versions
# Install FVM
dart pub global activate fvm

# Install a specific Flutter version
fvm install 3.19.0

# Use a version in your project
fvm use 3.19.0

# Run flutter commands with FVM
fvm flutter run
fvm flutter build apk
```

---

## 12. Common Issues & Fixes

### ❌ `flutter doctor` shows issues
```bash
# Accept Android licenses
flutter doctor --android-licenses

# Re-run doctor after fixing
flutter doctor -v
```

### ❌ Build fails with Gradle errors
```bash
# Clean and rebuild
flutter clean
flutter pub get
flutter build apk --release
```

### ❌ Pods / iOS dependencies broken
```bash
cd ios
pod deintegrate
pod install
cd ..
flutter run
```

### ❌ App not reflecting code changes
```bash
# Full hot restart (press R during flutter run)
# OR stop and re-run
flutter run
```

### ❌ `pub get` fails (network issue)
```bash
# Use mirror (China/restricted networks)
export PUB_HOSTED_URL=https://pub.flutter-io.cn
export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn
flutter pub get
```

### ❌ Android SDK not found
```bash
# Set ANDROID_HOME in shell profile (~/.zshrc or ~/.bashrc)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### ❌ Web build not updating (cached)
```bash
flutter clean
flutter build web --release
```

### ❌ Too many open files (macOS)
```bash
ulimit -n 10240
```

---

## 🔑 Quick Reference Cheatsheet

| Task | Command |
|------|---------|
| Check setup | `flutter doctor` |
| Create project | `flutter create my_app` |
| Get packages | `flutter pub get` |
| Run (debug) | `flutter run` |
| Run on Chrome | `flutter run -d chrome` |
| Hot reload | Press `r` in terminal |
| Hot restart | Press `R` in terminal |
| Build Android APK | `flutter build apk --release` |
| Build Play Store Bundle | `flutter build appbundle --release` |
| Build iOS | `flutter build ipa --release` |
| Build Web | `flutter build web --release` |
| Build Windows | `flutter build windows --release` |
| Build macOS | `flutter build macos --release` |
| Build Linux | `flutter build linux --release` |
| List devices | `flutter devices` |
| Clean project | `flutter clean` |
| Analyze code | `flutter analyze` |
| Format code | `dart format .` |
| Run tests | `flutter test` |
| Upgrade Flutter | `flutter upgrade` |

---

> 📖 **Official Docs:** https://docs.flutter.dev  
> 📦 **Package Registry:** https://pub.dev  
> 💬 **Community:** https://flutter.dev/community
