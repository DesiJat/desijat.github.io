/**
 * Auth Manager Module - js/auth.js
 * Handles Phone & Password SaaS logins, Registering new families,
 * session timeouts, and credentials encryption.
 */
import { storage } from "./storage.js";

class AuthManager {
  constructor() {
    this.sessionTimeoutMs = 15 * 60 * 1000; // 15 Minutes session timeout
    this.lastActivityTime = Date.now();
    
    // Restore session on bootstrap
    const savedUser = storage.getLocal("currentUser");
    if (savedUser) {
      this.isAuthenticated = true;
      this.currentUser = savedUser;
      storage.currentFamilyId = Number(savedUser.parentId) === 0 ? Number(savedUser.id) : Number(savedUser.parentId);
      
      const config = storage.getLocal("config") || {};
      if (config.sheetsUrl) storage.sheetsUrl = config.sheetsUrl;
      if (config.jwtSecret) storage.jwtSecret = config.jwtSecret;
      if (config.useSheets !== undefined) storage.useSheets = config.useSheets;
    } else {
      this.isAuthenticated = false;
      this.currentUser = null;
    }
  }

  // Check if any admin users exist in local storage to guide registration vs login
  async hasRegisteredUsers() {
    const list = await storage.getLocal("members") || [];
    return list.length > 0;
  }

  // Register a new Admin & Family tenant
  async registerFamily(familyName, adminName, phone, password, email = "", customSheetsUrl = "", customJwtSecret = "") {
    // If a custom Sheets URL is provided, override default storage configuration
    if (customSheetsUrl.trim() !== "") {
      storage.sheetsUrl = customSheetsUrl.trim();
      storage.useSheets = true;
    }
    if (customJwtSecret.trim() !== "") {
      storage.jwtSecret = customJwtSecret.trim();
    }

    // Force a fresh sync of the global members list from Google Sheets before validation
    if (storage.useSheets && storage.sheetsUrl && navigator.onLine) {
      try {
        const response = await storage.sheetsRequest({ action: "read", sheet: "members", limit: 2000 });
        if (response.success && response.data) {
          storage.saveLocal("members", response.data);
        }
      } catch (e) {
        console.warn("Could not sync global members for registration, using cache.", e);
      }
    }

    const list = storage.getLocal("members") || [];
    
    // Check if phone or email already exists
    if (phone) {
      const phoneExists = list.some(m => String(m.phone).trim() === String(phone).trim());
      if (phoneExists) {
        return { success: false, error: "Phone number already exists!" };
      }
    }

    if (email) {
      const emailExists = list.some(m => String(m.email).trim().toLowerCase() === String(email).trim().toLowerCase());
      if (emailExists) {
        return { success: false, error: "Email address already exists!" };
      }
    }

    // 2. Generate a temporary ID to isolate this admin initially (will set parent_id = 0)
    const newId = list.length ? Math.max(...list.map(item => Number(item.id) || 0)) + 1 : 1;
    
    // An Admin has parent_id = 0, and their familyId matches their own generated user ID.
    const adminUser = {
      id: newId,
      name: adminName,
      relation: "Father (Admin)",
      phone: phone,
      email: email,
      password: password, // plain password for simple local SaaS checks
      parentId: 0,
      familyId: newId, // Self-anchored family tenant
      photo: "",
      contribution: 0,
      balance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save directly to storage members table bypass filter
    list.push(adminUser);
    storage.saveLocal("members", list);

    // Sync to Sheets in the background
    if (storage.useSheets && storage.sheetsUrl) {
      const { id, createdAt, updatedAt, ...sheetsData } = adminUser;
      storage.sheetsRequest({
        action: "create",
        sheet: "members",
        data: sheetsData,
        columns: Object.keys(sheetsData)
      }).catch(err => console.error("Background sync admin creation failed:", err));
    }

    // Initialize custom family configuration locally
    storage.saveLocal("config", {
      familyName: familyName,
      currency: "₹",
      theme: "light",
      useSheets: storage.useSheets,
      sheetsUrl: storage.sheetsUrl,
      jwtSecret: storage.jwtSecret,
    }, false);

    // Automate login
    this.isAuthenticated = true;
    this.currentUser = adminUser;
    storage.currentFamilyId = adminUser.familyId;
    storage.saveLocal("currentUser", adminUser, false);
    this.resetTimer();

    return { success: true, user: adminUser };
  }

  // Login existing Admin or family member
  async login(phone, password, customSheetsUrl = "", customJwtSecret = "") {
    // If a custom Sheets URL is provided, override default storage configuration
    if (customSheetsUrl.trim() !== "") {
      storage.sheetsUrl = customSheetsUrl.trim();
      storage.useSheets = true;
    }
    if (customJwtSecret.trim() !== "") {
      storage.jwtSecret = customJwtSecret.trim();
    }

    if (customSheetsUrl.trim() !== "" || customJwtSecret.trim() !== "") {
      // Persist the override locally
      const config = storage.getLocal("config") || {};
      config.sheetsUrl = storage.sheetsUrl;
      config.jwtSecret = storage.jwtSecret;
      config.useSheets = storage.useSheets;
      storage.saveLocal("config", config, false);
    }

    let user = null;

    // Authenticate against Google Sheets (online check with where filter)
    if (storage.useSheets && storage.sheetsUrl && navigator.onLine) {
      try {
        const response = await storage.sheetsRequest({
          action: "read",
          sheet: "members",
          where: [
            { field: "phone", operator: "=", value: String(phone).trim() },
            { field: "password", operator: "=", value: password }
          ],
          limit: 1
        });
        
        if (response.success && response.data && response.data.length > 0) {
          user = response.data[0];
          
          // Sync authenticated user into local cache
          const localList = storage.getLocal("members") || [];
          const idx = localList.findIndex(m => Number(m.id) === Number(user.id));
          if (idx !== -1) {
            localList[idx] = user;
          } else {
            localList.push(user);
          }
          storage.saveLocal("members", localList);
        }
      } catch (e) {
        console.warn("Could not authenticate online, falling back to local cache.", e);
      }
    }

    // Offline or network error fallback: Check LocalStorage cache
    if (!user) {
      const list = storage.getLocal("members") || [];
      user = list.find(m => String(m.phone).trim() === String(phone).trim() && m.password === password);
    }
    
    if (user) {
      this.isAuthenticated = true;
      this.currentUser = user;
      // If user has parent_id = 0 (Admin), their familyId is their own ID. Otherwise it is their parent_id
      storage.currentFamilyId = Number(user.parentId) === 0 ? Number(user.id) : Number(user.parentId);
      
      this.resetTimer();
      storage.saveLocal("currentUser", user, false);
      return { success: true, user };
    }
    
    return { success: false, error: "Invalid phone number or password." };
  }

  logout() {
    this.isAuthenticated = false;
    this.currentUser = null;
    storage.currentFamilyId = null;
    localStorage.clear();
  }

  resetTimer() {
    this.lastActivityTime = Date.now();
  }

  checkSessionTimeout(onTimeoutCallback) {
    // Inactivity timeout disabled per user request: "no need to login until it logout"
    return false;
  }
}

export const auth = new AuthManager();
