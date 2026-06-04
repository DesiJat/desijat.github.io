/**
 * Member Manager Module - js/members.js
 * Manages family member CRUD actions and ledger calculations.
 * Integrates duplicate validation checks on phone and email before saving.
 */
import { storage } from "./storage.js";
import { auth } from "./auth.js";

class MemberManager {
  async getMembers() {
    return await storage.read("members");
  }

  // Helper validation check
  validateUniqueness(memberData, id = null) {
    const list = storage.getLocal("members") || [];
    
    if (memberData.phone) {
      const phoneExists = list.some(m => m.phone === memberData.phone && Number(m.id) !== Number(id));
      if (phoneExists) {
        throw new Error("Phone number already registered to another user.");
      }
    }

    if (memberData.email) {
      const emailExists = list.some(m => m.email === memberData.email && Number(m.id) !== Number(id));
      if (emailExists) {
        throw new Error("Email address already registered to another user.");
      }
    }
  }

  async addMember(memberData) {
    // 1. Validate phone/email uniqueness globally
    this.validateUniqueness(memberData);

    const activeAdminId = auth.currentUser ? auth.currentUser.id : 0;
    const activeFamilyId = storage.currentFamilyId;

    const payload = {
      name: memberData.name,
      relation: memberData.relation,
      phone: memberData.phone || "",
      email: memberData.email || "",
      password: memberData.password || "",
      parent_id: memberData.parent_id !== undefined ? memberData.parent_id : activeAdminId,
      familyId: memberData.familyId || activeFamilyId,
      photo: memberData.photo || "",
      contribution: Number(memberData.contribution) || 0,
      balance: Number(memberData.balance) || 0
    };
    return await storage.create("members", payload);
  }

  async updateMember(id, memberData) {
    // 1. Validate phone/email uniqueness globally
    this.validateUniqueness(memberData, id);

    return await storage.update("members", id, memberData);
  }

  async deleteMember(id) {
    return await storage.delete("members", id);
  }

  async getMemberLedger(memberId) {
    const transactions = await storage.read("transactions");
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
