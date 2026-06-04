/**
 * App Main Controller - app.js
 * SaaS Refactored: Ties together authentication, isolates transactions by familyId,
 * handles phone/password login & registration, and initializes mock tenants.
 */

import { storage } from "./js/storage.js";
import { auth } from "./js/auth.js";
import { members } from "./js/members.js";
import { transactions } from "./js/transactions.js";
import { budgets } from "./js/budgets.js";
import { loans } from "./js/loans.js";
import { reports } from "./js/reports.js";
import { exporter } from "./js/export.js";

// Global App State
const state = {
  currentView: "dashboard",
  currentExternalAccountId: null,
  activeCurrency: "₹"
};

// Seed sample data if empty
async function initDemoData() {
  const usersExist = await auth.hasRegisteredUsers();
  if (usersExist) return; // Already seeded/configured

  console.log("SaaS Database empty. Seeding Verma Family tenant...");

  // 1. Register a new Family Workspace (automatically sets Rajesh Verma as Admin)
  const regResult = await auth.registerFamily(
    "Verma Family Finance", 
    "Rajesh Verma", 
    "9876501234", 
    "Pass@123", 
    "rajesh@verma.com"
  );

  if (!regResult.success) {
    console.error("Demo seeding registration failed:", regResult.error);
    return;
  }

  const dadUser = regResult.user;

  // 2. Add other family members under Rajesh's administration
  const mom = await members.addMember({ 
    name: "Sunita Verma", 
    relation: "Mother", 
    phone: "9876505678", 
    email: "sunita@verma.com", 
    password: "Pass@123",
    contribution: 15000, 
    balance: 8200 
  });
  
  const amit = await members.addMember({ 
    name: "Amit Verma", 
    relation: "Son", 
    phone: "9876509999", 
    email: "amit@verma.com", 
    password: "Pass@123",
    contribution: 8000, 
    balance: 1500 
  });

  // 3. Setup category spending limits for Verma Family
  await budgets.setBudget("Food", 15000);
  await budgets.setBudget("Education", 25000);
  await budgets.setBudget("Electricity", 8000);
  await budgets.setBudget("Medical", 10000);
  await budgets.setBudget("Transportation", 5000);

  // 4. Create External Accounts linked to Rajesh's Family
  await transactions.addExternalAccount({ name: "Kirana Grocery Mart", type: "Shop", phone: "9911223344", address: "Sector 15, Hissar", openingBalance: -3400 });
  await transactions.addExternalAccount({ name: "Neighbor John", type: "Friend", phone: "9812739123", address: "House 24, Delhi", openingBalance: 4000 });

  // 5. Internal Transactions
  await transactions.addTransaction({ date: "2026-06-01", type: "Income", category: "Salary", memberId: dadUser.id, amount: 75000, description: "Monthly Corporate Salary Credit" });
  await transactions.addTransaction({ date: "2026-06-01", type: "Income", category: "Rent Income", memberId: mom.id, amount: 18000, description: "Commercial Shop Rent" });
  await transactions.addTransaction({ date: "2026-06-02", type: "Expense", category: "Food", memberId: mom.id, amount: 6200, description: "Weekly wholesale groceries purchase" });
  await transactions.addTransaction({ date: "2026-06-02", type: "Expense", category: "Electricity", memberId: dadUser.id, amount: 4800, description: "DHBVN Power Bill - Main House" });
  await transactions.addTransaction({ date: "2026-06-02", type: "Expense", category: "Medical", memberId: amit.id, amount: 2500, description: "Annual dental checkup and scaling" });

  // 6. External Loans
  await loans.addLoan({ person: "SBI Bank", loanType: "Taken", amount: 120000, interest: 8.5, emi: 6000, dueDate: "2026-06-10", notes: "Car finance loan", memberId: dadUser.id });
  const relativeLoan = await loans.addLoan({ person: "Uncle Harry", loanType: "Given", amount: 20000, interest: 5, emi: 2000, dueDate: "2026-06-15", notes: "Emergency business help", memberId: mom.id });
  
  // Repay record
  await loans.addRepayment(relativeLoan.id, 4000, "2026-06-02");

  console.log("SaaS demo tenant Verma Family seeded successfully!");
}

// Show Toast message
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${type.toUpperCase()}</div>
    <div class="toast-msg">${message}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Navigation flow
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-menu .nav-item");
  const views = document.querySelectorAll(".app-view");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      
      const targetView = item.getAttribute("data-view");
      views.forEach(v => v.style.display = "none");
      
      const el = document.getElementById(`view-${targetView}`);
      if (el) el.style.display = "block";
      
      state.currentView = targetView;
      renderCurrentView();
      
      if (window.innerWidth <= 768) {
        document.getElementById("sidebar").classList.remove("active");
      }
    });
  });

  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("active");
  });
}

// Render selected view
async function renderCurrentView() {
  auth.resetTimer();
  const config = storage.getLocal("config") || {};
  state.activeCurrency = config.currency || "₹";

  // If user is logged in, display their specific family title
  if (auth.currentUser) {
    document.getElementById("sidebarFamilyName").textContent = config.familyName || "My Family Workspace";
    document.getElementById("familyInitial").textContent = (config.familyName || "F")[0].toUpperCase();
  }

  switch (state.currentView) {
    case "dashboard":
      renderDashboard();
      break;
    case "members":
      renderMembers();
      break;
    case "internal-khata":
      renderInternalKhata();
      break;
    case "external-khata":
      renderExternalKhata();
      break;
    case "budget":
      renderBudget();
      break;
    case "loans":
      renderLoans();
      break;
    case "reports":
      renderReports();
      break;
    case "settings":
      renderSettings();
      break;
  }
}

// Render Dashboard View
async function renderDashboard() {
  const sum = await reports.getSummary();
  const txList = await transactions.getTransactions();
  
  const netBalance = sum.income - sum.expenses + sum.savings;
  document.getElementById("dashNetBalance").textContent = `${state.activeCurrency}${netBalance.toLocaleString()}`;
  document.getElementById("dashIncome").textContent = `${state.activeCurrency}${sum.income.toLocaleString()}`;
  document.getElementById("dashExpenses").textContent = `${state.activeCurrency}${sum.expenses.toLocaleString()}`;
  
  const netLoans = sum.loansGiven - sum.loansTaken;
  const loansLabel = netLoans >= 0 ? `+${state.activeCurrency}${netLoans.toLocaleString()}` : `-${state.activeCurrency}${Math.abs(netLoans).toLocaleString()}`;
  document.getElementById("dashLoans").textContent = loansLabel;

  const sorted = txList.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const tbody = document.getElementById("dashRecentTxTableBody");
  tbody.innerHTML = "";
  
  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No transactions recorded yet.</td></tr>`;
  } else {
    for (const t of sorted) {
      const tr = document.createElement("tr");
      const typeBadge = t.type === "Income" ? `<span class="badge badge-income">Income</span>` : `<span class="badge badge-expense">Expense</span>`;
      tr.innerHTML = `
        <td>${t.date}</td>
        <td>${typeBadge}</td>
        <td>${t.category}</td>
        <td style="font-weight: 700; color: ${t.type === 'Income' ? 'var(--success)' : 'var(--danger)'}">
          ${state.activeCurrency}${Number(t.amount).toLocaleString()}
        </td>
        <td>${t.description}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  const alertsList = document.getElementById("dashAlertsList");
  alertsList.innerHTML = "";
  
  const budgetAlerts = await budgets.getAlerts();
  const loanAlerts = await loans.getLoanAlerts();
  const allAlerts = [...budgetAlerts, ...loanAlerts];

  if (allAlerts.length === 0) {
    alertsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 12px;">All budgets and loans healthy.</div>`;
  } else {
    allAlerts.forEach(alert => {
      const item = document.createElement("div");
      item.className = `alert-item ${alert.severity === 'critical' || alert.severity === 'high' ? 'high' : 'medium'}`;
      item.innerHTML = `
        <div><strong>${alert.title}</strong><br><span style="font-size: 12px; color: var(--text-secondary);">${alert.message}</span></div>
      `;
      alertsList.appendChild(item);
    });
  }
}

// Render Members View
async function renderMembers() {
  const list = await members.getMembers();
  const container = document.getElementById("membersGridContainer");
  container.innerHTML = "";

  list.forEach(m => {
    const card = document.createElement("div");
    card.className = "card-glass member-card";
    card.innerHTML = `
      <div class="member-avatar-lg">
        ${m.photo ? `<img src="${m.photo}">` : (m.name || "M")[0].toUpperCase()}
      </div>
      <h3 style="font-weight: 700;">${m.name}</h3>
      <p style="color: var(--text-secondary); font-size: 13px; margin: 4px 0 6px 0;">${m.relation}</p>
      <p style="color: var(--text-muted); font-size: 11px; margin-bottom: 12px;">📞 ${m.phone}</p>
      
      <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
        <span style="color: var(--text-muted)">Contribution:</span>
        <span style="font-weight: 600">${state.activeCurrency}${Number(m.contribution).toLocaleString()}</span>
      </div>
      <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px;">
        <span style="color: var(--text-muted)">Current balance:</span>
        <span style="font-weight: 700; color: var(--primary)">${state.activeCurrency}${Number(m.balance).toLocaleString()}</span>
      </div>
      
      <div style="display: flex; gap: 8px; width: 100%;">
        <button class="btn btn-secondary btn-sm" onclick="window.editMember(${m.id})" style="flex: 1; padding: 6px;">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="window.deleteMember(${m.id})" style="padding: 6px;">×</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render Ledger View
async function renderInternalKhata() {
  const txList = await transactions.getTransactions();
  const userList = await members.getMembers();
  const tbody = document.getElementById("internalKhataTableBody");
  tbody.innerHTML = "";

  const catSelect = document.getElementById("filterCategory");
  const defaultCats = ["Salary", "Business Income", "Rent Income", "Food", "Education", "Electricity", "Water", "Internet", "Medical", "Transportation", "Entertainment", "Other"];
  catSelect.innerHTML = `<option value="">All Categories</option>`;
  defaultCats.forEach(c => {
    catSelect.innerHTML += `<option value="${c}">${c}</option>`;
  });

  const memberSelect = document.getElementById("filterMember");
  memberSelect.innerHTML = `<option value="">All Members</option>`;
  userList.forEach(m => {
    memberSelect.innerHTML += `<option value="${m.id}">${m.name}</option>`;
  });

  const searchVal = document.getElementById("filterSearch").value.toLowerCase();
  const typeVal = document.getElementById("filterType").value;
  const catVal = document.getElementById("filterCategory").value;
  const memberVal = document.getElementById("filterMember").value;

  const filtered = txList.filter(t => {
    if (searchVal && !t.description.toLowerCase().includes(searchVal) && !t.category.toLowerCase().includes(searchVal)) return false;
    if (typeVal && t.type !== typeVal) return false;
    if (catVal && t.category !== catVal) return false;
    if (memberVal && Number(t.memberId) !== Number(memberVal)) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No matching transactions found.</td></tr>`;
  } else {
    filtered.forEach(t => {
      const member = userList.find(m => Number(m.id) === Number(t.memberId));
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.date}</td>
        <td>${member ? member.name : 'Unknown'}</td>
        <td><span class="badge ${t.type === 'Income' ? 'badge-income' : 'badge-expense'}">${t.type}</span></td>
        <td>${t.category}</td>
        <td style="font-weight:700;">${state.activeCurrency}${Number(t.amount).toLocaleString()}</td>
        <td>${t.description}</td>
        <td><span class="badge badge-completed">${t.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.deleteTransaction(${t.id})" style="padding: 4px 8px;">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// Render External Khata View
async function renderExternalKhata() {
  const accounts = await transactions.getExternalAccounts();
  const tbody = document.getElementById("externalAccountsTableBody");
  tbody.innerHTML = "";

  accounts.forEach(a => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${a.name}</strong></td>
      <td>${a.type}</td>
      <td>${a.phone}</td>
      <td style="font-weight:700; color: ${a.currentBalance >= 0 ? 'var(--success)' : 'var(--danger)'}">
        ${state.activeCurrency}${Number(a.currentBalance).toLocaleString()}
      </td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="window.loadExternalLedger(${a.id})" style="padding: 4px 8px;">View Ledger</button>
        <button class="btn btn-danger btn-sm" onclick="window.deleteExternalAccount(${a.id})" style="padding: 4px 8px;">×</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Render Budget View
async function renderBudget() {
  const utils = await budgets.getBudgetUtilization();
  const inputGrid = document.getElementById("budgetInputGrid");
  const barContainer = document.getElementById("budgetBarsContainer");
  
  inputGrid.innerHTML = "";
  barContainer.innerHTML = "";

  const categories = ["Food", "Education", "Electricity", "Water", "Internet", "Medical", "Transportation", "Entertainment", "Other"];
  
  categories.forEach(cat => {
    const limitObj = utils[cat] || { limit: 0, spent: 0, percent: 0 };
    
    const field = document.createElement("div");
    field.className = "form-group";
    field.innerHTML = `
      <label class="form-label">${cat} Budget Limit</label>
      <input type="number" name="limit-${cat}" class="form-input" value="${limitObj.limit}">
    `;
    inputGrid.appendChild(field);

    const progress = document.createElement("div");
    const exceededClass = limitObj.spent > limitObj.limit ? "style='background: var(--danger)'" : "";
    progress.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
        <strong>${cat}</strong>
        <span>Spent: ${state.activeCurrency}${limitObj.spent} of ${state.activeCurrency}${limitObj.limit} (${limitObj.percent}%)</span>
      </div>
      <div style="background: var(--border-color); height: 8px; border-radius: 4px; overflow: hidden;">
        <div style="width: ${limitObj.percent}%; height: 100%; background: var(--primary); border-radius: 4px;" ${exceededClass}></div>
      </div>
    `;
    barContainer.appendChild(progress);
  });
}

// Render Loans View
async function renderLoans() {
  const list = await loans.getLoans();
  const userList = await members.getMembers();
  const tbody = document.getElementById("loansTableBody");
  tbody.innerHTML = "";

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No active loans recorded.</td></tr>`;
  } else {
    list.forEach(l => {
      const member = userList.find(m => Number(m.id) === Number(l.memberId));
      const memberName = member ? member.name : "Unassociated";
      const remaining = loans.getRemainingBalance(l);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${l.person}</strong><br><span style="font-size:11px; color:var(--text-muted);">Member: ${memberName}</span></td>
        <td><span class="badge ${l.loanType === 'Given' ? 'badge-income' : 'badge-expense'}">${l.loanType}</span></td>
        <td>${state.activeCurrency}${l.amount.toLocaleString()}</td>
        <td>${l.interest}%</td>
        <td>${state.activeCurrency}${l.emi.toLocaleString()}/mo</td>
        <td>${state.activeCurrency}${l.paidAmount.toLocaleString()}</td>
        <td style="font-weight:700;">${state.activeCurrency}${remaining.toLocaleString()}</td>
        <td>${l.dueDate}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.viewLoanDetails(${l.id})" style="padding: 4px 8px;">View</button>
          <button class="btn btn-secondary btn-sm" onclick="window.logLoanRepayment(${l.id})" style="padding: 4px 8px;">Repay</button>
          <button class="btn btn-danger btn-sm" onclick="window.deleteLoan(${l.id})" style="padding: 4px 8px;">×</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// Render Reports View
async function renderReports() {
  const year = Number(document.getElementById("reportYearSelect").value);
  const monthVal = document.getElementById("reportMonthSelect").value;
  const month = monthVal === "all" ? null : Number(monthVal);

  const summary = await reports.getSummary(year, month);
  const txList = await transactions.getTransactions();

  const categoryVals = {};
  txList.filter(t => {
    const d = new Date(t.date);
    return t.type === "Expense" && d.getFullYear() === year && (month === null || d.getMonth() === month);
  }).forEach(t => {
    categoryVals[t.category] = (categoryVals[t.category] || 0) + Number(t.amount);
  });

  const pieData = Object.keys(categoryVals).map(cat => ({
    label: cat,
    value: categoryVals[cat]
  }));

  const pieColors = ["#6366f1", "#f43f5e", "#10b981", "#fbbf24", "#06b6d4", "#a855f7", "#ec4899", "#f97316"];
  reports.drawPieChart("expensesPieChart", pieData, pieColors);

  reports.drawBarChart("incomeExpenseBarChart", ["Total Income", "Total Expenses"], [
    { data: [summary.income, summary.expenses] }
  ], ["#10b981", "#ef4444"]);

  const lineLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const lineData = [12000, 15000, 9000, 14000, 18000, summary.savings];
  reports.drawLineChart("savingsLineChart", lineLabels, lineData, "rgb(99, 102, 241)");
}

// Render Settings View
async function renderSettings() {
  const config = storage.getLocal("config") || {};
  document.getElementById("settFamilyName").value = config.familyName || "Family";
  document.getElementById("settCurrency").value = config.currency || "₹";
  document.getElementById("settTheme").value = config.theme || "light";
  document.getElementById("settSheetsUrl").value = config.sheetsUrl || "";
  document.getElementById("settUseSheets").checked = !!config.useSheets;
}

// Global Modals controllers
window.editMember = async function(id) {
  const list = await members.getMembers();
  const m = list.find(item => Number(item.id) === Number(id));
  if (!m) return;

  document.getElementById("memberId").value = m.id;
  document.getElementById("memberName").value = m.name;
  document.getElementById("memberRelation").value = m.relation;
  document.getElementById("memberPhone").value = m.phone;
  document.getElementById("memberEmail").value = m.email || "";
  document.getElementById("memberPassword").value = m.password || "";
  document.getElementById("memberContribution").value = m.contribution;
  document.getElementById("openingBalanceGroup").style.display = "none";
  document.getElementById("memberModalTitle").textContent = "Edit Family Member";
  document.getElementById("memberModal").classList.add("active");
};

window.deleteMember = async function(id) {
  if (confirm("Are you sure you want to delete this family member?")) {
    await members.deleteMember(id);
    showToast("Family member deleted successfully.", "success");
    renderCurrentView();
  }
};

window.deleteTransaction = async function(id) {
  if (confirm("Are you sure you want to delete this transaction entry?")) {
    await transactions.deleteTransaction(id);
    showToast("Transaction deleted.", "success");
    renderCurrentView();
  }
};

window.loadExternalLedger = async function(id) {
  state.currentExternalAccountId = id;
  const accounts = await transactions.getExternalAccounts();
  const acc = accounts.find(a => Number(a.id) === Number(id));
  if (!acc) return;

  document.getElementById("extLedgerTitle").textContent = `${acc.name} Ledger`;
  document.getElementById("extLedgerSubtitle").textContent = `Category: ${acc.type} | Address: ${acc.address}`;
  document.getElementById("extLedgerActions").style.display = "flex";

  const txList = await transactions.getTransactions();
  const extTxs = txList.filter(t => Number(t.externalAccountId) === Number(id));
  
  const tbody = document.getElementById("extLedgerTableBody");
  tbody.innerHTML = "";

  if (extTxs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No entries yet. Opening Balance: ${state.activeCurrency}${acc.openingBalance}</td></tr>`;
  } else {
    extTxs.forEach(t => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.date}</td>
        <td><span class="badge ${t.type === 'Credit' ? 'badge-income' : 'badge-expense'}">${t.type}</span></td>
        <td>${state.activeCurrency}${t.amount.toLocaleString()}</td>
        <td>${t.description}</td>
      `;
      tbody.appendChild(tr);
    });
  }
};

window.deleteExternalAccount = async function(id) {
  if (confirm("Delete this external account? All transaction links will remain but account details are wiped.")) {
    await transactions.deleteExternalAccount(id);
    showToast("External account deleted.", "success");
    renderCurrentView();
  }
};

window.viewLoanDetails = async function(id) {
  const loanList = await loans.getLoans();
  const userList = await members.getMembers();
  const l = loanList.find(item => Number(item.id) === Number(id));
  if (!l) return;

  const member = userList.find(m => Number(m.id) === Number(l.memberId));
  const memberName = member ? member.name : "Unassociated";
  const remaining = loans.getRemainingBalance(l);

  document.getElementById("loanDetailsTitle").textContent = `${l.person} Loan Details`;

  const grid = document.getElementById("loanDetailsGrid");
  grid.innerHTML = `
    <div><strong>Associated Member:</strong><br>${memberName}</div>
    <div><strong>Loan Type:</strong><br>${l.loanType === 'Given' ? 'Lent Out (Given)' : 'Borrowed (Taken)'}</div>
    <div><strong>Principal Amount:</strong><br>${state.activeCurrency}${l.amount.toLocaleString()}</div>
    <div><strong>Interest Rate:</strong><br>${l.interest}% Simple</div>
    <div><strong>Monthly EMI Amount:</strong><br>${state.activeCurrency}${l.emi.toLocaleString()}</div>
    <div><strong>Due Date:</strong><br>${l.dueDate}</div>
    <div><strong>Total Paid Amount:</strong><br>${state.activeCurrency}${l.paidAmount.toLocaleString()}</div>
    <div><strong>Outstanding Balance:</strong><br>${state.activeCurrency}${remaining.toLocaleString()}</div>
    <div style="grid-column: span 2;"><strong>Notes:</strong><br>${l.notes || "None"}</div>
  `;

  const tbody = document.getElementById("loanRepaymentHistoryTableBody");
  tbody.innerHTML = "";
  const history = Array.isArray(l.paymentHistory) ? l.paymentHistory : [];

  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No payments recorded yet.</td></tr>`;
  } else {
    const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedHistory.forEach(h => {
      const payMember = userList.find(m => Number(m.id) === Number(h.memberId));
      const payMemberName = payMember ? payMember.name : "Unknown/Admin";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${h.date}</td>
        <td>${payMemberName}</td>
        <td style="font-weight: 700; color: var(--success);">${state.activeCurrency}${Number(h.amount).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  document.getElementById("loanDetailsModal").classList.add("active");
};

window.logLoanRepayment = async function(id) {
  const list = await members.getMembers();
  const select = document.getElementById("repayMemberId");
  select.innerHTML = "";
  list.forEach(m => {
    select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
  });

  document.getElementById("repayLoanId").value = id;
  document.getElementById("repayDate").value = new Date().toISOString().split("T")[0];
  document.getElementById("repayAmount").value = "";
  document.getElementById("repayModal").classList.add("active");
};

window.deleteLoan = async function(id) {
  if (confirm("Delete this loan transaction profile?")) {
    await loans.deleteLoan(id);
    showToast("Loan profile deleted.", "success");
    renderCurrentView();
  }
};

// Check if authenticated
function checkAuthLock() {
  if (!auth.isAuthenticated) {
    document.getElementById("lockScreen").style.display = "flex";
  } else {
    document.getElementById("lockScreen").style.display = "none";
  }
}

// Binds form submissions
function bindFormSubmissions() {
  // Config save
  document.getElementById("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const familyName = document.getElementById("settFamilyName").value;
    const currency = document.getElementById("settCurrency").value;
    const theme = document.getElementById("settTheme").value;

    const config = storage.getLocal("config") || {};
    config.familyName = familyName;
    config.currency = currency;
    config.theme = theme;
    storage.saveLocal("config", config);
    
    document.documentElement.setAttribute("data-theme", theme);
    showToast("Settings updated successfully.", "success");
    renderCurrentView();
  });

  // Phone / Password Login form
  document.getElementById("authLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const phone = document.getElementById("loginPhone").value;
    const pass = document.getElementById("loginPassword").value;

    const result = await auth.login(phone, pass);
    if (result.success) {
      showToast(`Welcome back, ${result.user.name}!`, "success");
      
      // Update config family name
      const config = storage.getLocal("config") || {};
      document.getElementById("sidebarFamilyName").textContent = config.familyName || "My Family Workspace";

      checkAuthLock();
      renderCurrentView();
    } else {
      showToast(result.error, "danger");
    }
  });

  // SaaS Register New Family Workspace form
  document.getElementById("authRegisterForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fam = document.getElementById("regFamilyName").value;
    const admin = document.getElementById("regAdminName").value;
    const phone = document.getElementById("regPhone").value;
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPassword").value;

    const result = await auth.registerFamily(fam, admin, phone, pass, email);
    if (result.success) {
      showToast("Workspace Registered & Logged In!", "success");
      checkAuthLock();
      renderCurrentView();
      // Reload UI elements
      document.getElementById("authRegisterForm").reset();
    } else {
      showToast(result.error, "danger");
    }
  });

  // Member Add/Edit Save (With email/password credentials)
  document.getElementById("memberForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("memberId").value;
    const name = document.getElementById("memberName").value;
    const relation = document.getElementById("memberRelation").value;
    const phone = document.getElementById("memberPhone").value;
    const email = document.getElementById("memberEmail").value;
    const password = document.getElementById("memberPassword").value;
    const contribution = document.getElementById("memberContribution").value;
    const balance = document.getElementById("memberBalance").value;

    try {
      if (id) {
        await members.updateMember(id, { name, relation, phone, email, password, contribution });
        showToast("Member details updated.", "success");
      } else {
        await members.addMember({ name, relation, phone, email, password, contribution, balance });
        showToast("Family member created & credentialed.", "success");
      }
      window.closeModal("memberModal");
      renderCurrentView();
    } catch (err) {
      showToast(err.message, "danger");
    }
  });

  // Transaction Save
  document.getElementById("txForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const date = document.getElementById("txDate").value;
    const type = document.getElementById("txType").value;
    const category = document.getElementById("txCategory").value;
    const memberId = document.getElementById("txMemberId").value;
    const amount = document.getElementById("txAmount").value;
    const description = document.getElementById("txDescription").value;

    await transactions.addTransaction({ date, type, category, memberId, amount, description });
    
    const memberList = await members.getMembers();
    const m = memberList.find(item => Number(item.id) === Number(memberId));
    if (m) {
      const current = Number(m.balance) || 0;
      const parsedAmount = Number(amount);
      const newBal = type === "Income" ? (current + parsedAmount) : (current - parsedAmount);
      await members.updateMember(memberId, { balance: newBal });
    }

    const utils = await budgets.getBudgetUtilization();
    if (type === "Expense" && utils[category] && utils[category].spent + Number(amount) > utils[category].limit) {
      showToast(`Warning: spending exceeds budget for ${category}!`, "warning");
    } else {
      showToast("Transaction logged.", "success");
    }

    window.closeModal("txModal");
    renderCurrentView();
  });

  // External Account Save
  document.getElementById("extAccForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("extName").value;
    const type = document.getElementById("extType").value;
    const phone = document.getElementById("extPhone").value;
    const address = document.getElementById("extAddress").value;
    const openingBalance = document.getElementById("extOpeningBalance").value;

    await transactions.addExternalAccount({ name, type, phone, address, openingBalance });
    showToast("External Account created.", "success");
    window.closeModal("extAccModal");
    renderCurrentView();
  });

  // External Transaction Save
  document.getElementById("extTxForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const accountId = document.getElementById("extTxAccountId").value;
    const type = document.getElementById("extTxType").value;
    const date = document.getElementById("extTxDate").value;
    const amount = document.getElementById("extTxAmount").value;
    const notes = document.getElementById("extTxNotes").value;

    await transactions.addTransaction({ date, type, externalAccountId: accountId, amount, description: notes });
    await transactions.recalculateExternalBalance(accountId);
    
    showToast("Ledger entry added.", "success");
    window.closeModal("extTxModal");
    
    window.loadExternalLedger(accountId);
    renderCurrentView();
  });

  // Loan Add Save
  document.getElementById("loanForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const memberId = document.getElementById("loanMemberId").value;
    const person = document.getElementById("loanPerson").value;
    const loanType = document.getElementById("loanTypeSelect").value;
    const amount = document.getElementById("loanAmount").value;
    const interest = document.getElementById("loanInterest").value;
    const emi = document.getElementById("loanEmi").value;
    const dueDate = document.getElementById("loanDueDate").value;
    const notes = document.getElementById("loanNotes").value;

    await loans.addLoan({ memberId, person, loanType, amount, interest, emi, dueDate, notes });
    showToast("Loan profile saved.", "success");
    window.closeModal("loanModal");
    renderCurrentView();
  });

  // Loan Repayment Save
  document.getElementById("repayForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("repayLoanId").value;
    const memberId = document.getElementById("repayMemberId").value;
    const amount = document.getElementById("repayAmount").value;
    const date = document.getElementById("repayDate").value;

    await loans.addRepayment(id, amount, date, memberId);
    showToast("Repayment recorded.", "success");
    window.closeModal("repayModal");
    renderCurrentView();
  });

  // Budget Setup Limits
  document.getElementById("budgetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputs = document.querySelectorAll("#budgetInputGrid input");
    for (const input of inputs) {
      const category = input.name.replace("limit-", "");
      const val = input.value;
      await budgets.setBudget(category, val);
    }
    showToast("Category budgets updated.", "success");
    renderCurrentView();
  });
}

// Binds visual quick actions
function bindQuickActions() {
  document.getElementById("globalAddTxBtn").addEventListener("click", async () => {
    const list = await members.getMembers();
    const select = document.getElementById("txMemberId");
    select.innerHTML = "";
    list.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });

    document.getElementById("txForm").reset();
    document.getElementById("txId").value = "";
    document.getElementById("txDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("txModalTitle").textContent = "Add Transaction";
    document.getElementById("txModal").classList.add("active");
  });

  document.getElementById("lockAppBtn").addEventListener("click", () => {
    auth.logout();
    checkAuthLock();
  });

  document.getElementById("addMemberBtn").addEventListener("click", () => {
    document.getElementById("memberForm").reset();
    document.getElementById("memberId").value = "";
    document.getElementById("openingBalanceGroup").style.display = "block";
    document.getElementById("memberModalTitle").textContent = "Add Family Member";
    document.getElementById("memberModal").classList.add("active");
  });

  document.getElementById("addTransactionBtn").addEventListener("click", async () => {
    const list = await members.getMembers();
    const select = document.getElementById("txMemberId");
    select.innerHTML = "";
    list.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });

    document.getElementById("txForm").reset();
    document.getElementById("txDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("txModal").classList.add("active");
  });

  document.getElementById("addExternalAccountBtn").addEventListener("click", () => {
    document.getElementById("extAccForm").reset();
    document.getElementById("extAccModal").classList.add("active");
  });

  document.getElementById("extAddCreditBtn").addEventListener("click", () => {
    document.getElementById("extTxForm").reset();
    document.getElementById("extTxAccountId").value = state.currentExternalAccountId;
    document.getElementById("extTxType").value = "Credit";
    document.getElementById("extTxTitle").textContent = "Lend / Record Income Entry";
    document.getElementById("extTxDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("extTxModal").classList.add("active");
  });

  document.getElementById("extAddDebitBtn").addEventListener("click", () => {
    document.getElementById("extTxForm").reset();
    document.getElementById("extTxAccountId").value = state.currentExternalAccountId;
    document.getElementById("extTxType").value = "Debit";
    document.getElementById("extTxTitle").textContent = "Borrow / Log Payment Entry";
    document.getElementById("extTxDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("extTxModal").classList.add("active");
  });

  document.getElementById("addLoanBtn").addEventListener("click", async () => {
    const list = await members.getMembers();
    const select = document.getElementById("loanMemberId");
    select.innerHTML = "";
    list.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });

    document.getElementById("loanForm").reset();
    document.getElementById("loanId").value = "";
    document.getElementById("loanDueDate").value = new Date().toISOString().split("T")[0];
    document.getElementById("loanModal").classList.add("active");
  });

  document.getElementById("dashViewAllLedger").addEventListener("click", () => {
    document.querySelector(".nav-menu li[data-view='internal-khata']").click();
  });

  // Filter dynamic updates
  document.getElementById("filterSearch").addEventListener("input", renderInternalKhata);
  document.getElementById("filterType").addEventListener("change", renderInternalKhata);
  document.getElementById("filterCategory").addEventListener("change", renderInternalKhata);
  document.getElementById("filterMember").addEventListener("change", renderInternalKhata);
  
  document.getElementById("resetFiltersBtn").addEventListener("click", () => {
    document.getElementById("filterSearch").value = "";
    document.getElementById("filterType").value = "";
    document.getElementById("filterCategory").value = "";
    document.getElementById("filterMember").value = "";
    renderInternalKhata();
  });

  document.getElementById("reportYearSelect").addEventListener("change", renderReports);
  document.getElementById("reportMonthSelect").addEventListener("change", renderReports);

  document.getElementById("printReportBtn").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("exportBackupBtn").addEventListener("click", () => {
    exporter.exportJSONBackup();
    showToast("JSON Database backup downloaded.", "success");
  });

  document.getElementById("triggerImportBtn").addEventListener("click", () => {
    document.getElementById("importFileInput").click();
  });

  document.getElementById("importFileInput").addEventListener("change", (e) => {
    if (e.target.files.length === 0) return;
    exporter.importJSONRestore(e.target.files[0], (success) => {
      if (success) {
        showToast("Database restored successfully!", "success");
        renderCurrentView();
      } else {
        showToast("Restoration failed. Verify JSON structure.", "danger");
      }
    });
  });

  document.getElementById("initializeSheetsDbBtn").addEventListener("click", async () => {
    const btn = document.getElementById("initializeSheetsDbBtn");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Initializing Collections...";
    
    try {
      showToast("Setting up Google Sheets table layouts...", "info");
      const results = await storage.initializeSheetsSchema();
      const failed = results.filter(r => !r.success);
      if (failed.length === 0) {
        showToast("All sheets and columns set up successfully!", "success");
      } else {
        showToast(`Setup finished. ${failed.length} sheets failed. Check console.`, "warning");
        console.error("Initialization errors:", failed);
      }
    } catch (e) {
      showToast("Google Sheets error: " + e.message, "danger");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  // SaaS Authenticator view tabs bindings
  document.getElementById("tabLoginBtn").addEventListener("click", () => {
    document.getElementById("authLoginForm").style.display = "block";
    document.getElementById("authRegisterForm").style.display = "none";
    document.getElementById("tabLoginBtn").style.background = "var(--primary-glass)";
    document.getElementById("tabLoginBtn").style.color = "var(--primary)";
    document.getElementById("tabRegisterBtn").style.background = "transparent";
    document.getElementById("tabRegisterBtn").style.color = "var(--text-secondary)";
  });

  document.getElementById("tabRegisterBtn").addEventListener("click", () => {
    document.getElementById("authLoginForm").style.display = "none";
    document.getElementById("authRegisterForm").style.display = "block";
    document.getElementById("tabRegisterBtn").style.background = "var(--primary-glass)";
    document.getElementById("tabRegisterBtn").style.color = "var(--primary)";
    document.getElementById("tabLoginBtn").style.background = "transparent";
    document.getElementById("tabLoginBtn").style.color = "var(--text-secondary)";
  });
}

// Bootstrapping
async function bootstrap() {
  const config = storage.getLocal("config") || {};
  if (config.theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  // Pre-seed demo user workspace
  await initDemoData();
  
  initNavigation();
  bindFormSubmissions();
  bindQuickActions();
  
  setInterval(() => {
    auth.checkSessionTimeout(() => {
      showToast("Session expired. App locked.", "warning");
      checkAuthLock();
    });
  }, 10000);

  checkAuthLock();
  
  // If we seeded demo data, auto-login state was sets. Update views
  if (auth.isAuthenticated) {
    renderCurrentView();
  }
}

document.addEventListener("DOMContentLoaded", bootstrap);
export { showToast };
