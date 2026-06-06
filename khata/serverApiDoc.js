/**
 * ============================================================================
 * KHATA SHEET APP - API DOCUMENTATION & DATABASE SEEDER (apiDoc.js)
 * ============================================================================
 * 
 * This file provides developer documentation for the Google Apps Script backend
 * APIs used by the KhataSheetApp. It also acts as an executable script to seed 
 * your Google Sheets database with a complete set of connected mock family data.
 * 
 * Running this script will clear all existing sheets and seed fresh records for:
 *   - Members
 *   - Budgets
 *   - External Accounts
 *   - Transactions
 *   - Loans (including Repayment History)
 * 
 * ----------------------------------------------------------------------------
 * PREREQUISITES:
 * Node.js (v18+) is required (uses native fetch).
 * 
 * RUN SEEDER:
 * node apiDoc.js
 * 
 * ----------------------------------------------------------------------------
 * API ENDPOINT ARCHITECTURE
 * ----------------------------------------------------------------------------
 * Base URL: https://script.google.com/macros/s/AKfycbyIesDi6qGtfrrVYMEnjLwX1HaOuwHzS5SXutH_5HNyFjikcclvuc1hIfmjWPEDiRYZ/exec
 * HTTP Method: POST
 * Headers: { 'Content-Type': 'text/plain;charset=utf-8' }
 * 
 * JWT Authentication:
 * All API requests require a `token` parameter. The server uses a secret-key bypass
 * token for developer/test access. Setting `token = "your-very-secure-family-khata-secret-key-2026"`
 * bypasses JWT verification, allowing direct backend writes.
 * 
 * ----------------------------------------------------------------------------
 * CRUD SCHEMAS & ACTIONS:
 * 
 * 1. ACTION: "create"
 *    Used to insert a record into a sheet.
 *    Payload:
 *    {
 *      "token": "...",
 *      "action": "create",
 *      "sheet": "members" | "transactions" | "external_accounts" | "budgets" | "loans",
 *      "data": { ... }
 *    }
 * 
 * 2. ACTION: "read"
 *    Used to retrieve records from a sheet. Supports joins, filters, sorting, and pagination.
 *    Payload:
 *    {
 *      "token": "...",
 *      "action": "read",
 *      "sheet": "...",
 *      "limit": 1000,
 *      "page": 1,
 *      "orderBy": "fieldName",
 *      "direction": "asc" | "desc",
 *      "where": [
 *        { "field": "familyId", "operator": "=", "value": 1 }
 *      ]
 *    }
 *    Available Operators: "=", "!=", ">", "<", ">=", "<=", "contains"
 * 
 * 3. ACTION: "update"
 *    Used to update a record by ID.
 *    Payload:
 *    {
 *      "token": "...",
 *      "action": "update",
 *      "sheet": "...",
 *      "id": 12,
 *      "data": { ... }
 *    }
 * 
 * 4. ACTION: "delete"
 *    Used to delete a record by ID.
 *    Payload:
 *    {
 *      "token": "...",
 *      "action": "delete",
 *      "sheet": "...",
 *      "id": 12
 *    }
 * ============================================================================
 */

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyIesDi6qGtfrrVYMEnjLwX1HaOuwHzS5SXutH_5HNyFjikcclvuc1hIfmjWPEDiRYZ/exec';
const TEST_TOKEN = 'your-very-secure-family-khata-secret-key-2026';

// ─── HELPER: SAFE HTTP POST FOR GOOGLE APS SCRIPT REDIRECTS ──────────────────
/**
 * Executes a POST request to Google Apps Script.
 * Manually handles 302 Found redirects via a follow-up GET request to prevent
 * native environments from dropping the request body or failing parsing.
 */
async function apiCall_textPlain(payload) {
  try {
    const res = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'manual' // Prevent auto-handling to catch the 302 redirect
    });

    // Handle redirection manually
    if (res.status === 302 || res.status === 307 || res.status === 303) {
      const redirectUrl = res.headers.get('location');
      if (redirectUrl) {
        const redirectRes = await fetch(redirectUrl);
        return await redirectRes.json();
      }
    }

    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// using JSON but not working from frontend APP
async function apiCall_applicationJson(payload) {
  try {
    const res = await fetch(SHEETS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}


async function sheetsRequest(payload) {
  try {
    return await apiCall_textPlain(payload); // for CORS 
    // return await apiCall_applicationJson(payload); 
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── SEED DATA DEFINITIONS ──────────────────────────────────────────────────
const DUMMY_MEMBERS = [
  {
    id: 1,
    name: 'Kavita',
    relation: 'Self',
    phone: '9999999999',
    email: 'kavita@khata.com',
    password: 'admin',
    familyId: 1,
    parentId: 0,
    balance: 25000.00
  },
  {
    id: 2,
    name: 'Rajesh',
    relation: 'Husband',
    phone: '8888888888',
    email: 'rajesh@khata.com',
    password: 'user',
    familyId: 1,
    parentId: 1,
    balance: 15000.00
  },
  {
    id: 3,
    name: 'Suman',
    relation: 'Daughter',
    phone: '7777777777',
    email: 'suman@khata.com',
    password: 'user',
    familyId: 1,
    parentId: 1,
    balance: 5000.00
  }
];

const DUMMY_BUDGETS = [
  { id: 1, category: 'Food', limit: 12000.00, familyId: 1 },
  { id: 2, category: 'Electricity', limit: 4000.00, familyId: 1 },
  { id: 3, category: 'Education', limit: 15000.00, familyId: 1 },
  { id: 4, category: 'Internet', limit: 1500.00, familyId: 1 },
  { id: 5, category: 'Medical', limit: 8000.00, familyId: 1 }
];

const DUMMY_ACCOUNTS = [
  {
    id: 1,
    name: 'SBI Savings',
    bankName: 'State Bank of India',
    accountNumber: 'XXXX1234',
    currentBalance: 50000.00,
    familyId: 1
  },
  {
    id: 2,
    name: 'HDFC Salary',
    bankName: 'HDFC Bank',
    accountNumber: 'XXXX5678',
    currentBalance: 120000.00,
    familyId: 1
  }
];

const DUMMY_TRANSACTIONS = [
  {
    id: 1,
    date: '2026-06-01',
    type: 'Income',
    category: 'Salary',
    memberId: 1,
    amount: 80000.00,
    description: 'Monthly Salary Credited',
    status: 'Completed',
    familyId: 1
  },
  {
    id: 2,
    date: '2026-06-02',
    type: 'Expense',
    category: 'Food',
    memberId: 1,
    amount: 2500.00,
    description: 'Monthly Groceries purchase',
    status: 'Completed',
    familyId: 1
  },
  {
    id: 3,
    date: '2026-06-03',
    type: 'Expense',
    category: 'Electricity',
    memberId: 2,
    amount: 1800.00,
    description: 'Electricity Bill',
    status: 'Completed',
    familyId: 1
  },
  {
    id: 4,
    date: '2026-06-04',
    type: 'Expense',
    category: 'Internet',
    memberId: 3,
    amount: 999.00,
    description: 'Wi-Fi Monthly Recharge',
    status: 'Completed',
    familyId: 1
  },
  {
    id: 5,
    date: '2026-06-05',
    type: 'Expense',
    category: 'Medical',
    memberId: 1,
    amount: 1500.00,
    description: 'Pharmacy Medicines',
    status: 'Completed',
    familyId: 1
  }
];

const DUMMY_LOANS = [
  {
    id: 1,
    person: 'Sharmaji',
    loanType: 'Given',
    amount: 50000.00,
    interest: 12.00, // 12% Simple Interest
    emi: 5000.00,
    dueDate: '2026-12-05',
    paidAmount: 10000.00,
    notes: 'Personal loan given to Sharmaji for shop renovation',
    memberId: 1,
    familyId: 1,
    // History containing payment list elements serialized
    paymentHistory: JSON.stringify([
      { date: '2026-05-05', amount: 5000.00, memberId: 1 },
      { date: '2026-06-05', amount: 5000.00, memberId: 1 }
    ])
  },
  {
    id: 2,
    person: 'HDFC Car Loan',
    loanType: 'Taken',
    amount: 600000.00,
    interest: 8.50,
    emi: 12500.00,
    dueDate: '2029-06-05',
    paidAmount: 25000.00,
    notes: 'Car loan taken for new family vehicle',
    memberId: 2,
    familyId: 1,
    paymentHistory: JSON.stringify([
      { date: '2026-05-05', amount: 12500.00, memberId: 2 },
      { date: '2026-06-05', amount: 12500.00, memberId: 2 }
    ])
  }
];

// ─── CORE SEED EXECUTION ────────────────────────────────────────────────────
async function seedDatabase() {
  console.log('========================================================');
  console.log('  STARTING GOOGLE SHEETS DATABASE SEEDING PROCESS');
  console.log('========================================================\n');

  // Helper function to seed a specific collection
  async function seedCollection(sheetName, list) {
    console.log(`🧹 [${sheetName}] Cleaning up any existing records...`);
    
    // 1. Fetch current records to find their IDs
    const readPayload = {
      token: TEST_TOKEN,
      action: 'read',
      sheet: sheetName,
      limit: 100000
    };
    
    const currentListRes = await sheetsRequest(readPayload);

    if (currentListRes.success && Array.isArray(currentListRes.data)) {
      // Delete existing records one by one
      for (const item of currentListRes.data) {
        if (item.id) {
          await sheetsRequest({
            token: TEST_TOKEN,
            action: 'delete',
            sheet: sheetName,
            id: item.id
          });
        }
      }
      console.log(`✅ [${sheetName}] Cleared ${currentListRes.data.length} records.`);
    }

    // 2. Insert new seed records
    console.log(`🌱 [${sheetName}] Inserting seed data...`);
    let seedCount = 0;
    for (const record of list) {
      // We strip the ID so Google Sheets autoincrements correctly
      const { id, ...dataToInsert } = record;
      const createPayload = {
        token: TEST_TOKEN,
        action: 'create',
        sheet: sheetName,
        data: dataToInsert
      };
      
      const insertRes = await sheetsRequest(createPayload);
      if (insertRes.success) {
        seedCount++;
      } else {
        console.error(`❌ [${sheetName}] Failed to insert record:`, insertRes.error);
      }
    }
    console.log(`🎉 [${sheetName}] Successfully seeded ${seedCount}/${list.length} records.\n`);
  }

  // Execute seeding sequentially
  try {
    await seedCollection('members', DUMMY_MEMBERS);
    await seedCollection('budgets', DUMMY_BUDGETS);
    await seedCollection('external_accounts', DUMMY_ACCOUNTS);
    await seedCollection('transactions', DUMMY_TRANSACTIONS);
    await seedCollection('loans', DUMMY_LOANS);

    console.log('========================================================');
    console.log('  SUCCESS: Database seeded successfully!');
    console.log('========================================================');
  } catch (err) {
    console.error('💥 Critical seeder error:', err.message);
  }
}

// Run the script
seedDatabase();
