# 📒 Family Khata — Cross-Platform Finance Manager

> **A self-hosted, offline-first family finance management app** powered by Flutter and Google Sheets as a free cloud backend.

---

## 🗂️ Table of Contents
1. [WHAT — What is this project?](#-what--what-is-this-project)
2. [WHY — Why was it built?](#-why--why-was-it-built)
3. [WHERE — Where does it run?](#-where--where-does-it-run)
4. [HOW — How does it work?](#-how--how-does-it-work)
   - [Architecture](#architecture)
   - [Data Models](#data-models)
   - [Tech Stack](#tech-stack)
   - [Project Structure](#project-structure)
   - [Setup & Installation](#setup--installation)
   - [Build for Each Platform](#build-for-each-platform)
5. [Features at a Glance](#-features-at-a-glance)
6. [Role-Based Access](#-role-based-access)
7. [Screens Overview](#-screens-overview)

---

## ❓ WHAT — What is this project?

**Family Khata** is a **multi-user family finance tracker** app built with Flutter. It acts as a digital ledger — like the traditional Indian "khata" register — but modernized for multiple family members with real-time cloud sync.

It manages:

| Module | What it Tracks |
|--------|---------------|
| 📊 **Dashboard** | Net balance, contributions, active loans — at a glance |
| 📒 **Ledger** | Every income and expense entry with category, member, and date |
| 👨‍👩‍👧‍👦 **Members** | All family members — their roles, balances, and contributions |
| 💰 **Budgets** | Monthly spending caps per category with visual progress bars |
| 🤝 **Loans** | Debts given to and taken from others — with EMI and repayment tracking |
| ⚙️ **Settings** | Theme, currency, Google Sheets URL, backup & restore |

---

## 💡 WHY — Why was it built?

Most family finance apps either:
- Require expensive subscriptions
- Don't support multi-user family sharing
- Store data on third-party servers you don't control
- Are too complex or too simple

**Family Khata solves this by:**

1. ✅ **Zero cost** — Uses your own Google Sheets as the database (free forever)
2. ✅ **Privacy first** — Your data stays in your own Google account
3. ✅ **Works offline** — Hive local database stores everything; syncs when online
4. ✅ **Multi-user** — Each family member gets their own login with role-based access
5. ✅ **Cross-platform** — One codebase runs on Android, iOS, Web, Windows, macOS, Linux
6. ✅ **No server needed** — Google Sheets Web App script acts as the backend API

---

## 🌍 WHERE — Where does it run?

Family Khata is a **truly cross-platform** app. It runs on:

| Platform | Status | Notes |
|----------|--------|-------|
| 🤖 **Android** | ✅ Production Ready | APK + Play Store AAB supported |
| 🍎 **iOS** | ✅ Supported | Build via macOS + Xcode |
| 🌐 **Web Browser** | ✅ Production Ready | Hosted on GitHub Pages or any static host |
| 🪟 **Windows** | ✅ Supported | Desktop `.exe` build |
| 🍏 **macOS** | ✅ Supported | Desktop `.app` build |
| 🐧 **Linux** | ✅ Supported | Desktop binary build |

**Data lives in two places simultaneously:**

```
📱 Device (Local)              ☁️ Cloud (Google Sheets)
┌─────────────────┐            ┌──────────────────────┐
│  Hive Database  │ ◄──sync──► │  Google Sheets API   │
│  (Offline-first)│            │  (Free cloud backend)│
└─────────────────┘            └──────────────────────┘
```

The app works **fully offline** and syncs to Google Sheets whenever an internet connection is available.

---

## ⚙️ HOW — How does it work?

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Flutter UI Layer                      │
│  (views.dart — Dashboard, Ledger, Members, Budget, Loans)│
└───────────────────────┬─────────────────────────────────┘
                        │  watch / read
┌───────────────────────▼─────────────────────────────────┐
│              Provider State Management Layer              │
│         AuthProvider          LedgerProvider              │
│   (login, session, theme)  (CRUD, filters, pagination)   │
└───────────────────────┬─────────────────────────────────┘
                        │  read / write
┌───────────────────────▼─────────────────────────────────┐
│                  StorageService (Singleton)               │
│         Local Hive DB  ◄──────────►  Google Sheets API   │
│    (offline-first cache)      (JWT-signed HTTP requests) │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action (e.g. Add Loan)
        │
        ▼
1️⃣  Write to local Hive DB immediately  →  UI updates instantly
        │
        ▼
2️⃣  Fire background HTTP request to Google Sheets Web App
        │
        ▼
3️⃣  Google Apps Script processes it → writes to Sheet
        │
        ▼
4️⃣  On next sync/refresh → pull latest from Sheets → update local DB
```

This **local-first** approach means the UI never blocks waiting for the network.

---

### Data Models

The app uses 5 core data models (defined in `lib/models.dart`):

#### 👤 Member
Represents a family member / user account.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Unique member ID |
| `name` | String | Display name |
| `relation` | String | Role in family (Father, Son, Wife…) |
| `phone` | String | Used as login username |
| `password` | String | Login password |
| `parentId` | int | `0` = Admin/Parent, else = member's parent ID |
| `familyId` | int | Links to which family group this member belongs |
| `contribution` | double | Monthly contribution amount |
| `balance` | double | Current calculated balance |

#### 💸 Transaction
A single income or expense entry in the ledger.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Unique transaction ID |
| `date` | String | Date (YYYY-MM-DD) |
| `type` | String | `"Income"` or `"Expense"` |
| `category` | String | Category (Food, Salary, Medical…) |
| `memberId` | int | Which member made this transaction |
| `amount` | double | Transaction amount (supports decimals) |
| `description` | String | Narration/notes |
| `familyId` | int | Family group scope |

#### 💰 Budget
A monthly spending cap for a category.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Unique budget ID |
| `category` | String | Category name |
| `limit` | double | Maximum allowed spend for the month |
| `familyId` | int | Family group scope |

#### 🤝 Loan
Tracks money lent or borrowed.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Unique loan ID |
| `person` | String | Person/Bank name |
| `loanType` | String | `"Given"` (debtor) or `"Taken"` (creditor) |
| `amount` | double | Principal loan amount |
| `interest` | double | Interest rate (%) |
| `emi` | double | Monthly EMI installment |
| `dueDate` | String | Repayment due date |
| `paidAmount` | double | Total repaid so far |
| `paymentHistory` | List | JSON list of repayment entries |
| `memberId` | int | Responsible family member |

#### 🏦 ExternalAccount
External bank/wallet accounts.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Unique account ID |
| `name` | String | Account/bank name |
| `type` | String | Type (Savings, Current, Wallet…) |
| `openingBalance` | double | Starting balance |
| `currentBalance` | double | Running balance |
| `familyId` | int | Family group scope |

---

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | Flutter 3.41 (Dart) | Cross-platform UI |
| **State Management** | Provider | Reactive state across widgets |
| **Local Database** | Hive (hive_flutter) | Offline-first key-value storage |
| **Cloud Backend** | Google Sheets + Apps Script | Free serverless database API |
| **HTTP Client** | http package | REST calls to Sheets Web App |
| **Security** | crypto (HMAC-SHA256) | JWT-style signed API requests |
| **Charts** | fl_chart | Pie chart for spending breakdown |
| **Themes** | Custom CSS-like system | Dark Glow / Light Minimal / E-Paper |

---

### Project Structure

```
KhataSheetApp/
│
├── lib/
│   ├── main.dart           # App entry point, theme setup, Provider registration
│   ├── models.dart         # Data models: Member, Transaction, Budget, Loan, ExternalAccount
│   ├── providers.dart      # AuthProvider + LedgerProvider (state management + CRUD)
│   ├── storage_service.dart # Hive local DB + Google Sheets HTTP API layer
│   ├── views.dart          # All UI screens (6 views + dialogs + helpers)
│   └── crypto_utils.dart   # HMAC-SHA256 JWT signing utility
│
├── android/                # Android-specific build config
├── ios/                    # iOS-specific build config
├── web/                    # Web-specific files (index.html, manifest)
├── windows/                # Windows desktop build config
├── macos/                  # macOS desktop build config
├── linux/                  # Linux desktop build config
│
├── pubspec.yaml            # Dependencies & app metadata
├── flutterGuide.md         # Flutter commands reference guide
└── README.md               # This file
```

---

### Setup & Installation

#### Prerequisites
- Flutter SDK 3.0+ → [Install Flutter](https://docs.flutter.dev/get-started/install)
- Android Studio / Xcode (for mobile builds)
- A Google account (for Sheets backend)

#### Step 1 — Clone & Install
```bash
git clone <your-repo-url>
cd KhataSheetApp
flutter pub get
```

#### Step 2 — Set Up Google Sheets Backend

1. Create a new **Google Sheet** with these tabs:
   - `members`, `transactions`, `budgets`, `loans`, `external_accounts`

2. Go to **Extensions → Apps Script** and deploy the backend script as a Web App
   - Execute as: **Me**
   - Access: **Anyone**

3. Copy the Web App URL (looks like `https://script.google.com/macros/s/.../exec`)

#### Step 3 — Configure the App

Open the app → **Register Family** screen → paste your:
- Google Sheets Web App URL
- JWT Secret token (any secret string you choose)

Or update defaults in `lib/storage_service.dart`:
```dart
String sheetsUrl = 'YOUR_SHEETS_WEB_APP_URL';
String jwtSecret = 'YOUR_SECRET_KEY';
```

#### Step 4 — Run
```bash
# Web (instant, no setup)
flutter run -d chrome

# Android
flutter run -d <android_device_id>

# iOS (macOS only)
flutter run -d "iPhone 15"
```

---

### Build for Each Platform

```bash
# Android APK (sideload install)
flutter build apk --release

# Android App Bundle (Play Store)
flutter build appbundle --release

# iOS (App Store)
flutter build ipa --release

# Web (static files → deploy to GitHub Pages, Netlify, etc.)
flutter build web --release

# Windows
flutter build windows --release

# macOS
flutter build macos --release

# Linux
flutter build linux --release
```

---

## ✨ Features at a Glance

| Feature | Details |
|---------|---------|
| 🔐 **Multi-user Login** | Phone-based login for each family member |
| 📵 **Offline Support** | Works without internet; syncs when connected |
| 🔄 **Auto Sync** | Data syncs silently with Google Sheets on every open |
| 📊 **Dashboard** | Summary cards + spending pie chart + recent activity |
| 📒 **Double-Entry Ledger** | Paginated, filterable income & expense log |
| 👨‍👩‍👧 **Member Management** | Add/edit/delete members with search & pagination |
| 🎯 **Budget Caps** | Per-category monthly limits with % progress bars |
| 🤝 **Loan Tracker** | Given/taken loans with EMI, interest, repayment history |
| 💾 **Backup & Restore** | Export/import encrypted local database backup |
| 🎨 **3 Themes** | Dark Glow, Light Minimal, E-Paper Ink |
| 💱 **Custom Currency** | Set any currency symbol (₹, $, €, etc.) |
| 📱 **Responsive UI** | Sidebar on desktop, bottom nav on mobile |

---

## 🛡️ Role-Based Access

The app has **2 roles**:

| Action | 👑 Admin (Parent) | 👤 Member |
|--------|:-----------------:|:---------:|
| View dashboard | ✅ | ✅ |
| Add transactions | ✅ | ✅ |
| View ledger | ✅ | ✅ |
| Add/edit/delete members | ✅ | ❌ |
| Add/edit/delete budgets | ✅ | ❌ |
| Delete transactions | ✅ | ❌ |
| Add/delete loans | ✅ | ✅ |
| Log loan repayment | ✅ | ✅ |
| Sync/Refresh data | ✅ | ✅ |
| Change settings | ✅ | ✅ (limited) |
| Backup & restore | ✅ | ✅ |

> **Admin** = member whose `parentId == 0` (the family account creator)  
> **Member** = anyone whose `parentId != 0` (added by admin)

---

## 🖥️ Screens Overview

```
┌─────────────────────┐
│   Login / Register  │  ← Phone + password login, or new family setup
└────────┬────────────┘
         │ authenticated
┌────────▼────────────────────────────────────────┐
│  Main App — Sidebar (desktop) / Bottom Nav (mobile)
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┬────────┐
│  │Dashboard │  Ledger  │ Members  │ Budgets  │  Loans   │Settings│
│  └──────────┴──────────┴──────────┴──────────┴──────────┴────────┘
└─────────────────────────────────────────────────┘

Dashboard   → Summary cards + Pie chart + Recent 5 transactions
Ledger      → Full paginated list with search/filter/type filter
Members     → Grid cards with search, pagination, edit/delete (admin)
Budgets     → Progress bars per category, edit/delete caps (admin)
Loans       → Tabular view with repayment log, EMI tracking
Settings    → Theme picker, currency, Sheets URL, backup/restore
```

---

## 📄 License

This project is for private family use. All rights reserved.

---

> 💡 **Tip:** See [`flutterGuide.md`](./flutterGuide.md) for a full reference of Flutter commands for building, running, and deploying on all platforms.
