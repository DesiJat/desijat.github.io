/**
 * Member Manager Module - js/members.js
 * Manages family member CRUD actions and ledger calculations.
 */
import { storage } from "./storage.js";

class MemberManager {
  async getMembers() {
    return await storage.read("members");
  }

  async addMember(memberData) {
    // Schema: { name, relation, phone, photo, contribution, balance }
    const payload = {
      name: memberData.name,
      relation: memberData.relation,
      phone: memberData.phone || "",
      photo: memberData.photo || "",
      contribution: Number(memberData.contribution) || 0,
      balance: Number(memberData.balance) || 0
    };
    return await storage.create("members", payload);
  }

  async updateMember(id, memberData) {
    return await storage.update("members", id, memberData);
  }

  async deleteMember(id) {
    return await storage.delete("members", id);
  }

  async getMemberLedger(memberId) {
    const transactions = await storage.read("transactions");
    // Filter transactions involving this family member
    return transactions
      .filter(t => Number(t.memberId) === Number(memberId))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  async getMemberBalance(memberId) {
    const memberList = await this.getMembers();
    const member = memberList.find(m => Number(m.id) === Number(memberId));
    if (!member) return 0;

    let balance = Number(member.balance) || 0; // Opening balance
    const ledger = await this.getMemberLedger(memberId);
    
    // Calculate running balance: credit adds, debit subtracts (depending on perspective)
    // Internal context: 
    // Money Given (Debit/Expense) -> Decreases family pool, but member owes family? Or member holds it?
    // Let's specify: If category is income, it increases. If expense, it decreases.
    ledger.forEach(t => {
      if (t.type === "Income") {
        balance += Number(t.amount);
      } else if (t.type === "Expense") {
        balance -= Number(t.amount);
      }
    });

    return balance;
  }
}

export const members = new MemberManager();
