/**
 * Storage Manager Module - js/storage.js
 * Handles LocalStorage operations, lightweight encryption,
 * and optional synchronization with the Google Sheets DB client.
 * Extends capabilities to support SaaS multi-family isolation using familyId.
 */

const JWT_SECRET = "your-very-secure-family-khata-secret-key-2026";

async function generateJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const base64url = (str) => {
    return btoa(str)
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const tokenInput = encodedHeader + "." + encodedPayload;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(JWT_SECRET),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(tokenInput)
  );

  const signatureArray = new Uint8Array(signature);
  let signatureString = "";
  for (let i = 0; i < signatureArray.length; i++) {
    signatureString += String.fromCharCode(signatureArray[i]);
  }
  const encodedSignature = btoa(signatureString)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return tokenInput + "." + encodedSignature;
}

class StorageManager {
  constructor() {
    this.encryptionKey = "FamilyKhataKey123";
    this.useSheets = true;
    this.sheetsUrl = "https://script.google.com/macros/s/AKfycbzbCP4D7Q5yCVwWKbU-s-bD76egoTXk_93QgQZsuV0TgJ9g8J92nZlYsRhGRlyf5rDqIw/exec";
    this.currentFamilyId = null; // Active family workspace context
    
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

  // Lightweight XOR encryption/decryption
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
      console.warn("Decryption skipped or failed. Raw text processed.", e.message);
      return cipherText;
    }
  }

  // Read data from local storage
  getLocal(key, decrypt = true) {
    const raw = localStorage.getItem(`khata_${key}`);
    if (!raw) return null;
    
    let processed = raw;
    if (decrypt) {
      const trimmed = raw.trim();
      // If it starts with JSON character brackets, it is plain-text, skip decrypt
      if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
        processed = this.decrypt(raw);
      }
    }
    
    try {
      return JSON.parse(processed);
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
      // Generate and attach a JWT token
      let tokenPayload = {
        sub: "guest",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };
      
      const { auth } = await import("./auth.js");
      if (auth && auth.currentUser) {
        tokenPayload = {
          sub: String(auth.currentUser.id),
          familyId: this.currentFamilyId,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        };
      }
      
      payload.token = await generateJwt(tokenPayload);

      const response = await fetch(this.sheetsUrl, {
        method: "POST",
        mode: "cors",
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
    
    // Inject active familyId for multi-tenancy (except for global users/members list, which handles its own routing)
    const record = { 
      id: newId, 
      ...data, 
      familyId: data.familyId || this.currentFamilyId,
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString() 
    };

    // If a user is logged in, attach memberId of the creator
    const { auth } = await import("./auth.js");
    if (auth && auth.currentUser) {
      record.memberId = record.memberId || auth.currentUser.id;
    }
    
    list.push(record);
    this.saveLocal(table, list);

    // Write to Sheets in the background (non-blocking)
    if (this.useSheets && this.sheetsUrl) {
      // Strip server-managed fields before sending to Sheets
      const { id, createdAt, updatedAt, ...sheetsData } = record;
      this.sheetsRequest({
        action: "create",
        sheet: table,
        data: sheetsData,
        columns: Object.keys(sheetsData)
      }).then(res => {
        if (res && res.success === false) {
          console.warn("Server rejected write operation:", res.error);
          // Rollback local write
          const currentList = this.getLocal(table) || [];
          const rollbackList = currentList.filter(item => Number(item.id) !== Number(record.id));
          this.saveLocal(table, rollbackList);
          
          // Dispatch custom event to notify UI
          const event = new CustomEvent("sync-rollback", { detail: { table, error: res.error } });
          window.dispatchEvent(event);
        }
      }).catch(err => console.error("Background sheet sync failed:", err));
    }
    return record;
  }

  async read(table) {
    // Return LocalStorage contents
    let list = this.getLocal(table) || [];
    
    // If online and using Sheets, optionally sync/fetch
    if (this.useSheets && this.sheetsUrl && navigator.onLine) {
      try {
        const response = await this.sheetsRequest({ action: "read", sheet: table, limit: 2000 });
        if (response.success && response.data) {
          // If sheet returns empty, but local has data, do not overwrite (prevent overwrite race conditions)
          if (response.data.length > 0 || list.length === 0) {
            list = response.data;
            this.saveLocal(table, list); // Sync local copy
          }
        }
      } catch (e) {
        console.warn("Could not sync with Google Sheets, using local cache.", e);
      }
    }

    // SaaS filter: Filter records by current logged-in familyId (except config table)
    if (table !== "config" && this.currentFamilyId !== null) {
      return list.filter(item => Number(item.familyId) === Number(this.currentFamilyId));
    }
    return list;
  }

  async update(table, id, data) {
    const list = this.getLocal(table) || [];
    const index = list.findIndex(item => Number(item.id) === Number(id));
    if (index !== -1) {
      const originalRecord = { ...list[index] };
      list[index] = { ...list[index], ...data, updatedAt: new Date().toISOString() };
      this.saveLocal(table, list);

      if (this.useSheets && this.sheetsUrl) {
        this.sheetsRequest({ action: "update", sheet: table, id: id, data: data })
          .then(res => {
            if (res && res.success === false) {
              console.warn("Server rejected update operation:", res.error);
              // Rollback local update
              const currentList = this.getLocal(table) || [];
              const currIndex = currentList.findIndex(item => Number(item.id) === Number(id));
              if (currIndex !== -1) {
                currentList[currIndex] = originalRecord;
                this.saveLocal(table, currentList);
              }
              // Dispatch custom event to notify UI
              const event = new CustomEvent("sync-rollback", { detail: { table, error: res.error } });
              window.dispatchEvent(event);
            }
          })
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
      members: ["name", "relation", "phone", "email", "password", "parent_id", "familyId", "photo", "contribution", "balance"],
      transactions: ["date", "type", "category", "memberId", "externalAccountId", "amount", "description", "status", "dueDate", "familyId"],
      external_accounts: ["name", "phone", "address", "type", "openingBalance", "currentBalance", "familyId"],
      budgets: ["category", "limit", "familyId"],
      loans: ["person", "loanType", "amount", "interest", "emi", "dueDate", "paidAmount", "notes", "paymentHistory", "memberId", "familyId"]
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
