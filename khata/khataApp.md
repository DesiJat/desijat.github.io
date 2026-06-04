# Flutter Cross-Platform Family Khata SaaS - Technical Specification

This document provides a comprehensive, A-to-Z specification for building a cross-platform **Flutter** application (targeting **Android, iOS, Web, Windows, and Linux**) with the same features, multi-tenant SaaS architecture, offline-first behavior, local encryption, and secure Google Sheets sync as the web version.

---

## 1. Application Architecture Overview

*   **Platform Target:** Android, iOS, Web, Windows, Linux.
*   **Architecture Pattern:** Clean Architecture with **Provider** or **Riverpod** for State Management.
*   **Database & Storage:**
    *   **Local Caching:** SQLite (via `sqflite` or `drift` for desktop/mobile) or Hive (for simple key-value config caching) as the local database.
    *   **Local Encryption:** All financial records (transactions, loans, budgets, accounts) must be encrypted/decrypted on local database read/write using lightweight XOR or AES encryption.
    *   **Offline-First Sync Engine:** Perform all write actions optimistically on the local cache first, then run background HTTP requests to synchronize with the Google Sheets Web App.
*   **Security:** JWT verification payloads (HMAC-SHA256) signed with a dynamic secret key for all remote API communications.

---

## 2. Database Models & Schema Specifications

*   **Decimal Precision:** All `Double` fields (including balances, contributions, principal amounts, EMI values, interest rates, and repayment logs) must allow optional decimal inputs up to 2 decimal places (equivalent to `step="0.01"` HTML5 validation) for precise financial accounting.

### 2.1 Config Schema (`config` table)
Stores general application configurations:
*   `familyName` (String): Name of the family workspace (e.g., "Verma Family Finance").
*   `currency` (String): Currency symbol (e.g., "₹", "$").
*   `theme` (String): Theme mode ("light", "dark", or "e-paper").
*   `useSheets` (Boolean): Flag to enable/disable background Google Sheets synchronization.
*   `sheetsUrl` (String): Web App API sync URL.
*   `jwtSecret` (String): Private key for signing JWT authorization requests.
*   `securePin` (String): Optional local lock code.

### 2.2 Member Model (`members` table)
Every user in the system is a family member.
*   `id` (Integer, Primary Key)
*   `name` (String): Display name.
*   `relation` (String): Relation to head (e.g., "Father (Admin)", "Mother", "Son").
*   `phone` (String, Unique): Mobile phone number used for login.
*   `email` (String, Unique): Optional email.
*   `password` (String): Authentication password.
*   `parent_id` (Integer): ID of the creator (`0` if the user is the Admin Head of the family).
*   `familyId` (Integer): Multi-tenant isolator ID (Admin user's `id`).
*   `photo` (String): Base64 encoded string or file path for profile picture.
*   `contribution` (Double): Tracked contribution amount.
*   `balance` (Double): Starting/calculated ledger balance.
*   `createdAt` (String): ISO 8601 Timestamp.
*   `updatedAt` (String): ISO 8601 Timestamp.

### 2.3 Transaction Model (`transactions` table)
*   `id` (Integer, Primary Key)
*   `date` (String): YYYY-MM-DD.
*   `type` (String): "Income", "Expense", or "Transfer".
*   `category` (String): Expense/Income category name.
*   `memberId` (Integer): ID of the member this transaction belongs to.
*   `externalAccountId` (Integer): Target account (Cash/Bank).
*   `amount` (Double)
*   `description` (String)
*   `status` (String): "Completed" or "Pending".
*   `dueDate` (String): Optional due date for pending actions.
*   `familyId` (Integer): Multi-tenant isolator ID.
*   `createdAt` (String): ISO 8601 Timestamp.
*   `updatedAt` (String): ISO 8601 Timestamp.

### 2.4 External Account Model (`external_accounts` table)
*   `id` (Integer, Primary Key)
*   `name` (String): Account name (e.g., "SBI Savings", "Main Wallet Cash").
*   `phone` (String): Contact phone associated with account (optional).
*   `address` (String): Branch address or details.
*   `type` (String): "Cash" or "Bank".
*   `openingBalance` (Double)
*   `currentBalance` (Double)
*   `familyId` (Integer): Multi-tenant isolator ID.
*   `createdAt` (String): ISO 8601 Timestamp.
*   `updatedAt` (String): ISO 8601 Timestamp.

### 2.5 Budget Model (`budgets` table)
*   `id` (Integer, Primary Key)
*   `category` (String): Target category name.
*   `limit` (Double): Monthly spending cap.
*   `familyId` (Integer): Multi-tenant isolator ID.
*   `createdAt` (String): ISO 8601 Timestamp.
*   `updatedAt` (String): ISO 8601 Timestamp.

### 2.6 Loan Model (`loans` table)
*   `id` (Integer, Primary Key)
*   `person` (String): Third-party name.
*   `loanType` (String): "Given" or "Taken".
*   `amount` (Double): Principal loan amount.
*   `interest` (Double): Interest rate percentage.
*   `emi` (Double): Monthly payment target.
*   `dueDate` (String): Due date timestamp.
*   `paidAmount` (Double): Cumulative principal paid.
*   `notes` (String)
*   `paymentHistory` (String): JSON encoded array of repayment objects.
    *   **Structure:** `[{"date": "YYYY-MM-DD", "amount": 1000.0, "memberId": 1}]`
*   `memberId` (Integer): Family member handling/responsible for the loan.
*   `familyId` (Integer): Multi-tenant isolator ID.
*   `createdAt` (String): ISO 8601 Timestamp.
*   `updatedAt` (String): ISO 8601 Timestamp.

---

## 3. JWT Security & Synchronization Engine

All network API operations with Google Sheets must be authorized by a JSON Web Token signed locally in Flutter using the `crypto` package.

### 3.1 Generating the JWT (HMAC-SHA256)
*   **Header:** `{"alg": "HS256", "typ": "JWT"}`
*   **Payload Claims:**
    *   `sub` (String): Logged-in user member ID.
    *   `familyId` (Integer): Logged-in user family workspace ID.
    *   `parentId` (Integer): Parent ID of the active user (`0` for Admin, matching `parent_id` in member model).
    *   `iat` (Integer): Current timestamp (seconds).
    *   `exp` (Integer): Expiration timestamp (`iat + 3600`).
*   **Secret Key:** Dynamically read from the local config state (`config.jwtSecret`).
*   **Construction Format:** Standard JWT format `[Header_Base64url].[Payload_Base64url].[Signature_Base64url]`.

### 3.2 Network Sync Request Wrapper
Flutter requests must send the JWT token in the POST body to avoid triggering preflight checks on the Apps Script web app endpoint:
```json
{
  "token": "<JWT_TOKEN>",
  "action": "create|read|update|delete|bulkUpdate",
  "sheet": "members|transactions|external_accounts|budgets|loans|config",
  "id": 1,
  "data": { ... }
}
```

### 3.3 Optimistic Sync Rollback Logic
When a write action occurs in Flutter:
1. Save the new/updated entry into the local encrypted SQLite cache immediately.
2. Trigger the HTTP sync request asynchronously (non-blocking).
3. If the Sheets response returns `success: false` or throws an error (e.g. duplicate email/phone check fails on server side), **revert** the changes in the local SQLite database.
4. Dispatch a global state event to alert the UI and display a red Snackbar notification indicating: `"Sync Error: [Error Message]. Local changes reverted."`.

### 3.4 Cryptographic Sign Fallback (Non-Secure Contexts)
*   **Context Safety Check:** In web and sandboxed platforms, native crypto APIs (e.g. `SubtleCrypto`) are only available in secure contexts (HTTPS or localhost).
*   **IP Address Fallback:** If the application is accessed over an insecure context (such as a local IP address using `http://`), the app must fall back to a self-contained, pure JavaScript/Dart HMAC-SHA256 signer.
*   **State Isolation:** The SHA-256 compression variables (initial hash buffers and round constants) must be initialized fresh on every invocation of the fallback hash function. Caching or reusing buffer states across hashing passes is strictly prohibited to avoid signature failures.

---

## 4. State & Authentication Workflows

### 4.1 Login Flow
1. User provides `Phone Number`, `Password`, and optional `Sheets URL` and `JWT Secret` overrides.
2. If custom credentials are typed:
    *   Override `sheetsUrl` and `jwtSecret` dynamically in config.
3. If online:
    *   Generate a temp guest JWT token.
    *   Call Google Sheets API `read` action on sheet `members` passing a `where` clause:
        ```json
        "where": [
          { "field": "phone", "operator": "=", "value": "<PHONE>" },
          { "field": "password", "operator": "=", "value": "<PASSWORD>" }
        ]
        ```
    *   If returned data is valid, update/save the member record locally and proceed.
4. If offline or HTTP fails:
    *   Fall back to local SQLite cache lookup to match phone and password.
5. On success: Sets `isAuthenticated = true`, `currentFamilyId = adminUser.familyId`, saves `currentUser` in local storage for indefinite session persistence, and opens the Dashboard.

### 4.2 Registration Flow
1. User enters `Family Name`, `Admin Name`, `Phone`, `Password`, `Email`, and optional custom `Sheets URL` and `JWT Secret`.
2. Generate admin record locally with `parent_id: 0` and `familyId` set to its own user ID.
3. Save `currentUser` in local storage, and push the database row to Sheets in the background.

### 4.3 Session Persistence & Timeout Behavior
1. **Persistent Sign-In:** The logged-in member session is saved in local encrypted storage. On application launch, if a valid user session is detected, the app automatically bypasses the lock/login screen.
2. **Inactivity Lock Disabled:** The automatic inactivity timer is disabled. Users remain authenticated indefinitely until they explicitly log out.
3. **Logout & Cache Purging:** Logging out must clear all local databases, cached preferences, configuration overrides, and tokens (`localStorage.clear()` equivalent), resetting the app to a clean, non-configured state, and returning the user to the login screen.

### 4.4 Role-Based Permissions (Admin Only Actions)
1. **Role Verification:** A user is designated as an Admin if `parent_id == 0`. Other members have `parent_id != 0`.
2. **Update & Delete Restrictions:** Only Admin users are authorized to update or delete records (Members, Ledger transactions, External accounts, and Loans). Non-admin users are restricted to **read and add-only** permissions (they can log new transactions, add external accounts, register new members, or register new loans and repayments, but cannot edit or delete any existing profiles or logs).
3. **UI Adjustments:** Edit and delete buttons are hidden from non-admin views. Settings page controls and budget setup limit inputs are disabled (with submit/save controls hidden) for non-admin accounts.
4. **Security Enforcement:** All client-side mutation methods must include a safety guard verifying the active user's admin role before executing updates or deletions.

---

## 5. UI Views & Visual Blueprint

Build a responsive UI that adapts to desktop screens (Windows/Linux), web browsers (Web), and mobile screens (Android/iOS) using a premium **Glassmorphism Theme** with Outfit/Inter typography, smooth micro-animations, and visual indicator cards.

### 5.1 Auth Lock Screen
*   Login Tab: Phone, password, and expandable "Advanced Sheet Settings" dropdown containing Sheets URL and JWT Secret. Designed to fit clean on mobile screens with scroll safety constraints.
*   Register Tab: Family details, admin credentials, and Sheets connection configurations.

### 5.2 Dashboard
*   **Balance Summary Cards:** Clean metrics for Net Family Balance, Monthly Income, Monthly Expenses, and Active Debts/Loans.
*   **Recent Transactions Ledger:** A list showing the last 5 transactions with color-coded badges (Green for Income, Red for Expense).
*   **System Alert Card:** Shows due dates, overdue loans, or budget warnings.

### 5.3 Members Management
*   Displays a list of family members with relations, contributions, and account balances.
*   Include forms to add family members (generating email/password logins). Edit/delete options are hidden if the logged-in user is not an Admin.

### 5.4 Double-Entry Ledger
*   List view of all transactions with filtering (by category, type, date range, or member) and pagination.
*   Form modals to log income/expense, linking transactions to family members and Cash/Bank accounts.

### 5.5 Budget Cap Tracker
*   Linear Progress bars showing spent amounts vs Cap limits for categories (e.g. Groceries, Entertainment). Show warnings when spent is > 90%. Inputs and save buttons are disabled for non-admins.

### 5.6 Debt & Loan Center
*   List tracking of third-party loans (Given/Taken) with pagination.
*   Details view showing remaining simple interest calculations.
*   "Log Repayment" modal to record partial repayments. Delete button is hidden for non-admins.

### 5.7 Visual Reports
*   Render clean canvas charts (via `fl_chart` package):
    *   Category spending pie chart.
    *   Monthly Income vs Expense comparative bar chart.
    *   Savings progress line chart.

### 5.8 Configuration & Backups
*   Options to adjust currency symbols and toggle themes (Light/Dark/E-paper).
*   Input fields for Sheet sync URL and JWT secret keys (hidden/disabled for non-admins).
*   **Sync Button:** Triggers `initializeSheetsSchema()` setting up empty sheet table headers dynamically on Google Drive.
*   **Backup Buttons:** Export local cache to an encrypted JSON backup file, and import a JSON database backup.

### 5.9 Global List Pagination Specifications
1. **Default Record Size:** Paginate all list views (Members, Ledger, Accounts, and Loans) with a default size of `10` records per page.
2. **Page Limit Selector:** Display a dropdown selector option on each list view to update the limit to `10`, `50`, or `100` records per page. Changing the size resets the active page index to `1`.
3. **Boundary Control Navigation:** Provide Prev and Next buttons. Disable navigation controls when viewing boundary limits (e.g., page 1 disables Prev, final page disables Next).
4. **Search and Filter Reset:** Changing search parameters, categories, or filtering constraints on the ledger must automatically reset the list's active page back to `1` before displaying results.
