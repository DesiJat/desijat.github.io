/**
 * Transaction Manager Module - js/transactions.js
 * Tracks and logs internal/external financial transactions.
 */
import { storage } from "./storage.js";

class TransactionManager {
  async getTransactions() {
    return await storage.read("transactions");
  }

  async addTransaction(txData) {
    // Schema: { date, type, category, memberId, externalAccountId, amount, description, status, dueDate }
    const payload = {
      date: txData.date || new Date().toISOString().split("T")[0],
      type: txData.type, // Income, Expense, Internal Transfer, Credit (Lent), Debit (Borrowed)
      category: txData.category,
      memberId: txData.memberId ? Number(txData.memberId) : null,
      externalAccountId: txData.externalAccountId ? Number(txData.externalAccountId) : null,
      amount: Number(txData.amount) || 0,
      description: txData.description || "",
      status: txData.status || "Completed", // Completed, Pending, Due
      dueDate: txData.dueDate || ""
    };
    return await storage.create("transactions", payload);
  }

  async updateTransaction(id, txData) {
    return await storage.update("transactions", id, txData);
  }

  async deleteTransaction(id) {
    return await storage.delete("transactions", id);
  }

  // External Account Management CRUD
  async getExternalAccounts() {
    return await storage.read("external_accounts");
  }

  async addExternalAccount(accData) {
    // Schema: { name, phone, address, type (Vendor/Customer/Friend/Relative/Shop), openingBalance }
    const payload = {
      name: accData.name,
      phone: accData.phone || "",
      address: accData.address || "",
      type: accData.type || "Friend",
      openingBalance: Number(accData.openingBalance) || 0,
      currentBalance: Number(accData.openingBalance) || 0
    };
    return await storage.create("external_accounts", payload);
  }

  async updateExternalAccount(id, accData) {
    return await storage.update("external_accounts", id, accData);
  }

  async deleteExternalAccount(id) {
    return await storage.delete("external_accounts", id);
  }

  // Calculate dynamic current balance for external account
  async recalculateExternalBalance(accountId) {
    const accounts = await this.getExternalAccounts();
    const acc = accounts.find(a => Number(a.id) === Number(accountId));
    if (!acc) return 0;

    let balance = Number(acc.openingBalance) || 0;
    const txs = await this.getTransactions();
    
    // Process transactions linked to this external account
    txs.filter(t => Number(t.externalAccountId) === Number(accountId)).forEach(t => {
      if (t.type === "Credit" || t.type === "Income") {
        // Credit (we lent money, or they paid us) increases balance
        balance += Number(t.amount);
      } else if (t.type === "Debit" || t.type === "Expense") {
        // Debit (we borrowed money, or we paid them) decreases balance
        balance -= Number(t.amount);
      }
    });

    await this.updateExternalAccount(accountId, { currentBalance: balance });
    return balance;
  }
}

export const transactions = new TransactionManager();
