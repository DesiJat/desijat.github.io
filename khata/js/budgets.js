/**
 * Budget Planner Module - js/budgets.js
 * Tracks category-specific limits, utilization rates, and alerts.
 */
import { storage } from "./storage.js";

class BudgetManager {
  async getBudgets() {
    return await storage.read("budgets") || [];
  }

  async setBudget(category, limit) {
    const budgets = await this.getBudgets();
    const existing = budgets.find(b => b.category === category);
    
    if (existing) {
      return await storage.update("budgets", existing.id, { limit: Number(limit) });
    } else {
      return await storage.create("budgets", { category, limit: Number(limit) });
    }
  }

  async getBudgetUtilization() {
    const budgets = await this.getBudgets();
    const transactions = await storage.read("transactions") || [];
    
    // Filter this month's expenses
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const thisMonthExpenses = transactions.filter(t => {
      if (t.type !== "Expense") return false;
      const tDate = new Date(t.date);
      return tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;
    });

    const utilization = {};

    budgets.forEach(b => {
      const spent = thisMonthExpenses
        .filter(t => t.category === b.category)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      utilization[b.category] = {
        limit: b.limit,
        spent: spent,
        percent: Math.min(Math.round(pct), 100),
        rawPercent: pct,
        exceeded: spent > b.limit
      };
    });

    return utilization;
  }

  async getAlerts() {
    const utils = await this.getBudgetUtilization();
    const alerts = [];
    Object.keys(utils).forEach(cat => {
      const data = utils[cat];
      if (data.exceeded) {
        alerts.push({
          type: "budget",
          title: "Budget Exceeded",
          message: `Category "${cat}" spending (${data.spent}) has exceeded the budget limit of ${data.limit}!`,
          severity: "high"
        });
      } else if (data.percent >= 85) {
        alerts.push({
          type: "budget",
          title: "Budget Warning",
          message: `Category "${cat}" spending has reached ${data.percent}% of its limit.`,
          severity: "medium"
        });
      }
    });
    return alerts;
  }
}

export const budgets = new BudgetManager();
