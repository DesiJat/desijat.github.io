/**
 * Storage Manager Module - js/storage.js
 * Handles LocalStorage operations, lightweight encryption,
 * and optional synchronization with the Google Sheets DB client.
 */

class StorageManager {
  constructor() {
    this.encryptionKey = "FamilyKhataKey123";
    this.useSheets = true;
    this.sheetsUrl = "https://script.google.com/macros/s/AKfycbzbCP4D7Q5yCVwWKbU-s-bD76egoTXk_93QgQZsuV0TgJ9g8J92nZlYsRhGRlyf5rDqIw/exec";
    
    // Load config from LocalStorage if present (can override defaults)
    const config = JSON.parse(localStorage.getItem("khata_config") || "{}");
    if (config.sheetsUrl) {
      this.sheetsUrl = config.sheetsUrl;
    }
    if (Object.prototype.hasOwnProperty.call(config, "useSheets")) {
      this.useSheets = !!config.useSheets;
    }
  }

  // Base64 helper for compatibility
  utf8_to_b64(str) {
    return window.btoa(unescape(encodeURIComponent(str)));
  }

  b64_to_utf8(str) {
    return decodeURIComponent(escape(window.atob(str)));
  }

  // Lightweight XOR encryption/decryption to satisfy constraints without external libs
  encrypt(dataText) {
    let result = "";
    for (let i = 0; i < dataText.length; i++) {
      const charCode = dataText.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
      result += String.fromCharCode(charCode);
    }
    return this.utf8_to_b64(result);
  }

  decrypt(cipherText) {
    try {
      if (!cipherText) return "";
      const rawText = this.b64_to_utf8(cipherText);
      let result = "";
      for (let i = 0; i < rawText.length; i++) {
        const charCode = rawText.charCodeAt(i) ^ this.encryptionKey.charCodeAt(i % this.encryptionKey.length);
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch (e) {
      console.error("Decryption failed. Returning raw text.", e);
      return cipherText;
    }
  }

  // Read data from local storage
  getLocal(key, decrypt = true) {
    const raw = localStorage.getItem(`khata_${key}`);
    if (!raw) return null;
    if (decrypt) {
      const decrypted = this.decrypt(raw);
      try {
        return JSON.parse(decrypted);
      } catch (e) {
        return null;
      }
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // Save data to local storage
  saveLocal(key, data, encrypt = true) {
    const serialized = JSON.stringify(data);
    const value = encrypt ? this.encrypt(serialized) : serialized;
    localStorage.setItem(`khata_${key}`, value);
  }

  // Remote sheets DB helper request
  async sheetsRequest(payload) {
    if (!this.sheetsUrl) return { success: false, error: "No Sheets Web App URL provided." };
    try {
      const response = await fetch(this.sheetsUrl, {
        method: "POST",
        mode: "cors",
        // Avoid OPTIONS preflight by omitting Content-Type: application/json
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });
      return await response.json();
    } catch (e) {
      console.error("SheetsDB API Request Failed:", e);
      return { success: false, error: e.message };
    }
  }

  // Generic DB APIs
  async create(table, data) {
    // Write local first
    const list = this.getLocal(table) || [];
    const newId = list.length ? Math.max(...list.map(item => Number(item.id) || 0)) + 1 : 1;
    const record = { id: newId, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    list.push(record);
    this.saveLocal(table, list);

    // Write to Sheets in the background (non-blocking)
    if (this.useSheets && this.sheetsUrl) {
      this.sheetsRequest({
        action: "create",
        sheet: table,
        data: record,
        columns: Object.keys(record)
      }).catch(err => console.error("Background sheet sync failed:", err));
    }
    return record;
  }

  async read(table) {
    // Return LocalStorage contents (always source of truth for offline/speed)
    let list = this.getLocal(table) || [];
    
    // If online and using Sheets, optionally sync/fetch
    if (this.useSheets && this.sheetsUrl && navigator.onLine) {
      try {
        const response = await this.sheetsRequest({ action: "read", sheet: table, limit: 1000 });
        if (response.success && response.data) {
          list = response.data;
          this.saveLocal(table, list); // Sync local copy
        }
      } catch (e) {
        console.warn("Could not sync with Google Sheets, using local cache.", e);
      }
    }
    return list;
  }

  async update(table, id, data) {
    const list = this.getLocal(table) || [];
    const index = list.findIndex(item => Number(item.id) === Number(id));
    if (index !== -1) {
      list[index] = { ...list[index], ...data, updatedAt: new Date().toISOString() };
      this.saveLocal(table, list);

      if (this.useSheets && this.sheetsUrl) {
        this.sheetsRequest({ action: "update", sheet: table, id: id, data: data })
          .catch(err => console.error("Background sheet sync failed:", err));
      }
      return true;
    }
    return false;
  }

  async delete(table, id) {
    let list = this.getLocal(table) || [];
    const filtered = list.filter(item => Number(item.id) !== Number(id));
    this.saveLocal(table, filtered);

    if (this.useSheets && this.sheetsUrl) {
      this.sheetsRequest({ action: "delete", sheet: table, id: id })
        .catch(err => console.error("Background sheet sync failed:", err));
    }
    return true;
  }

  // Backup and Restore
  getBackupJSON() {
    const backup = {};
    const tables = ["members", "transactions", "external_accounts", "budgets", "loans", "config"];
    tables.forEach(table => {
      backup[table] = this.getLocal(table);
    });
    return JSON.stringify(backup, null, 2);
  }

  restoreBackupJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      Object.keys(data).forEach(table => {
        if (data[table]) {
          this.saveLocal(table, data[table]);
        }
      });
      return true;
    } catch (e) {
      console.error("Failed to restore backup:", e);
      return false;
    }
  }

  async initializeSheetsSchema() {
    if (!this.sheetsUrl) return { success: false, error: "No Sheets Web App URL provided." };

    const schemas = {
      config: ["familyName", "currency", "theme", "useSheets", "sheetsUrl", "securePin"],
      members: ["name", "relation", "phone", "photo", "contribution", "balance"],
      transactions: ["date", "type", "category", "memberId", "externalAccountId", "amount", "description", "status", "dueDate"],
      external_accounts: ["name", "phone", "address", "type", "openingBalance", "currentBalance"],
      budgets: ["category", "limit"],
      loans: ["person", "loanType", "amount", "interest", "emi", "dueDate", "paidAmount", "notes", "paymentHistory"]
    };

    const results = [];
    for (const [table, columns] of Object.entries(schemas)) {
      try {
        const dummyData = {};
        columns.forEach(col => {
          dummyData[col] = "";
        });
        
        const res = await this.sheetsRequest({
          action: "create",
          sheet: table,
          data: dummyData,
          columns: columns
        });
        
        if (res.success && res.id) {
          await this.sheetsRequest({
            action: "delete",
            sheet: table,
            id: res.id
          });
        }
        results.push({ table, success: true });
      } catch (e) {
        results.push({ table, success: false, error: e.message });
      }
    }
    return results;
  }
}

export const storage = new StorageManager();

