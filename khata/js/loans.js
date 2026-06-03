/**
 * Loan Manager Module - js/loans.js
 * Tracks loans given/taken, interest, payments, and outstanding balances.
 */
import { storage } from "./storage.js";

class LoanManager {
  async getLoans() {
    const list = await storage.read("loans") || [];
    return list.map(loan => {
      if (typeof loan.paymentHistory === "string" && loan.paymentHistory.trim() !== "") {
        try {
          loan.paymentHistory = JSON.parse(loan.paymentHistory);
        } catch (e) {
          loan.paymentHistory = [];
        }
      } else if (!Array.isArray(loan.paymentHistory)) {
        loan.paymentHistory = [];
      }
      return loan;
    });
  }

  async addLoan(loanData) {
    let history = loanData.paymentHistory || [];
    if (Array.isArray(history)) {
      history = JSON.stringify(history);
    }
    // Schema: { memberId, person, loanType (Given/Taken), amount, interest (%), emi, dueDate, paidAmount, notes }
    const payload = {
      memberId: loanData.memberId ? Number(loanData.memberId) : null,
      person: loanData.person,
      loanType: loanData.loanType, // Given or Taken
      amount: Number(loanData.amount) || 0,
      interest: Number(loanData.interest) || 0, // Interest rate percentage
      emi: Number(loanData.emi) || 0,
      dueDate: loanData.dueDate || "",
      paidAmount: Number(loanData.paidAmount) || 0,
      notes: loanData.notes || "",
      paymentHistory: history
    };
    return await storage.create("loans", payload);
  }

  async updateLoan(id, loanData) {
    const payload = { ...loanData };
    if (payload.paymentHistory && Array.isArray(payload.paymentHistory)) {
      payload.paymentHistory = JSON.stringify(payload.paymentHistory);
    }
    return await storage.update("loans", id, payload);
  }

  async deleteLoan(id) {
    return await storage.delete("loans", id);
  }

  async addRepayment(id, paymentAmount, date = new Date().toISOString().split("T")[0]) {
    const loanList = await this.getLoans();
    const loan = loanList.find(l => Number(l.id) === Number(id));
    if (!loan) return false;

    const paid = Number(loan.paidAmount) || 0;
    const newPaidAmount = paid + Number(paymentAmount);
    const history = Array.isArray(loan.paymentHistory) ? loan.paymentHistory : [];
    history.push({ date, amount: Number(paymentAmount) });

    return await this.updateLoan(id, {
      paidAmount: newPaidAmount,
      paymentHistory: history
    });
  }

  // Calculate remaining balance with optional simple interest calculation
  getRemainingBalance(loan) {
    const principal = Number(loan.amount) || 0;
    const interestRate = Number(loan.interest) || 0;
    const paid = Number(loan.paidAmount) || 0;
    
    // Total including simple interest
    const interestAmount = principal * (interestRate / 100);
    const totalToPay = principal + interestAmount;
    
    return Math.max(0, totalToPay - paid);
  }

  async getLoanAlerts() {
    const loanList = await this.getLoans();
    const alerts = [];
    const today = new Date();

    loanList.forEach(l => {
      const remaining = this.getRemainingBalance(l);
      if (remaining <= 0) return; // Settled

      if (l.dueDate) {
        const due = new Date(l.dueDate);
        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays <= 7) {
          alerts.push({
            type: "loan",
            title: `Loan Due Soon (${l.loanType})`,
            message: `Payment of EMI/balance for ${l.person} is due in ${diffDays} days (${l.dueDate}).`,
            severity: "high",
            dueDate: l.dueDate,
            loanId: l.id
          });
        } else if (diffDays < 0) {
          alerts.push({
            type: "loan",
            title: `Loan Overdue (${l.loanType})`,
            message: `Payment of EMI/balance for ${l.person} is overdue by ${Math.abs(diffDays)} days!`,
            severity: "critical",
            dueDate: l.dueDate,
            loanId: l.id
          });
        }
      }
    });

    return alerts;
  }
}

export const loans = new LoanManager();
