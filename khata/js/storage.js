/**
 * Storage Manager Module - js/storage.js
 * Handles LocalStorage operations, lightweight encryption,
 * and optional synchronization with the Google Sheets DB client.
 * Extends capabilities to support SaaS multi-family isolation using familyId.
 */

class StorageManager {
  constructor() {
    this.encryptionKey = "FamilyKhataKey123";
    this.useSheets = true;
    this.sheetsUrl = "https://script.google.com/macros/s/AKfycbyIesDi6qGtfrrVYMEnjLwX1HaOuwHzS5SXutH_5HNyFjikcclvuc1hIfmjWPEDiRYZ/exec";
    this.jwtSecret = "your-very-secure-family-khata-secret-key-2026";
    this.currentFamilyId = null; // Active family workspace context
    
    // Load config from LocalStorage if present (can override defaults)
    let config = {};
    try {
      const raw = localStorage.getItem("khata_config");
      if (raw) {
        if (raw.trim().startsWith("{")) {
          config = JSON.parse(raw);
        } else {
          // If it looks like ciphertext, try decrypting first
          config = JSON.parse(this.decrypt(raw) || "{}");
        }
      }
    } catch (e) {
      config = {};
    }

    if (config.sheetsUrl) {
      this.sheetsUrl = config.sheetsUrl;
    }
    if (config.jwtSecret) {
      this.jwtSecret = config.jwtSecret;
    }
    if (Object.prototype.hasOwnProperty.call(config, "useSheets")) {
      this.useSheets = !!config.useSheets;
    }
  }

  async generateJwt(payload) {
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

    if (typeof crypto !== "undefined" && crypto.subtle) {
      try {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(this.jwtSecret),
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
        return tokenInput + "." + base64url(signatureString);
      } catch (e) {
        console.warn("Subtle crypto sign failed. Trying pure JS fallback.", e);
      }
    }

    // Pure JS Fallback for insecure contexts (e.g. HTTP IP address access)
    console.warn("Web Crypto API (crypto.subtle) is not available. Falling back to pure JavaScript HMAC-SHA256.");
    const signatureHex = hmac_sha256_pure(this.jwtSecret, tokenInput);
    const bytes = new Uint8Array(signatureHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    let signatureString = "";
    for (let i = 0; i < bytes.length; i++) {
      signatureString += String.fromCharCode(bytes[i]);
    }
    return tokenInput + "." + base64url(signatureString);
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
      
      payload.token = await this.generateJwt(tokenPayload);

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

/* ==========================================
   Pure JS Fallback HMAC-SHA256 Implementation
   ========================================== */

function sha256_pure(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = "length";
  let i, j;
  let result = "";

  const words = [];
  const asciiLength = ascii[lengthProperty] * 8;

  // Initialize initial hash values (fractional parts of the square roots of the first 8 primes)
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  // Table of round constants (fractional parts of the cube roots of the first 64 primes)
  const k = [];
  const isPrime = function(n) {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  const getFractionalBits = function(n) {
    return ((n - Math.floor(n)) * maxWord) | 0;
  };

  let candidate = 2;
  let kCounter = 0;
  while (kCounter < 64) {
    if (isPrime(candidate)) {
      k[kCounter] = getFractionalBits(mathPow(candidate, 1 / 3));
      kCounter++;
    }
    candidate++;
  }

  ascii += "\x80";
  while (ascii[lengthProperty] % 64 - 56) ascii += "\x00";
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return; // supports ASCII only
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words[lengthProperty]] = ((asciiLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiLength | 0);

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0));
      const temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    let val = hash[i];
    if (val < 0) val += maxWord;
    let hex = val.toString(16);
    while (hex[lengthProperty] < 8) hex = "0" + hex;
    result += hex;
  }
  return result;
}

function hmac_sha256_pure(key, message) {
  let keyBytes = new TextEncoder().encode(key);
  const messageBytes = new TextEncoder().encode(message);

  if (keyBytes.length > 64) {
    const hashedKeyHex = sha256_pure(String.fromCharCode.apply(null, keyBytes));
    keyBytes = new Uint8Array(hashedKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  }

  const paddedKey = new Uint8Array(64);
  paddedKey.set(keyBytes);

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }

  const innerInput = new Uint8Array(64 + messageBytes.length);
  innerInput.set(ipad);
  innerInput.set(messageBytes, 64);
  const innerInputStr = String.fromCharCode.apply(null, innerInput);
  const innerHashHex = sha256_pure(innerInputStr);
  const innerHashBytes = new Uint8Array(innerHashHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  const outerInput = new Uint8Array(64 + innerHashBytes.length);
  outerInput.set(opad);
  outerInput.set(innerHashBytes, 64);
  const outerInputStr = String.fromCharCode.apply(null, outerInput);

  return sha256_pure(outerInputStr);
}
