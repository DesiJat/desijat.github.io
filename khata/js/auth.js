/**
 * Auth Manager Module - js/auth.js
 * Handles Local PIN Lock, Session Timeout, and Encryption key configs.
 */
import { storage } from "./storage.js";

class AuthManager {
  constructor() {
    this.sessionTimeoutMs = 5 * 60 * 1000; // 5 Minutes default session timeout
    this.lastActivityTime = Date.now();
    this.isAuthenticated = false;
  }

  isPinSet() {
    const config = storage.getLocal("config") || {};
    return !!config.securePin;
  }

  setPin(newPin) {
    const config = storage.getLocal("config") || {};
    // Encrypt the PIN using storage helper before saving
    config.securePin = storage.encrypt(newPin);
    storage.saveLocal("config", config);
    return true;
  }

  verifyPin(pin) {
    const config = storage.getLocal("config") || {};
    if (!config.securePin) return false;
    
    const decryptedPin = storage.decrypt(config.securePin);
    if (decryptedPin === pin) {
      this.isAuthenticated = true;
      this.resetTimer();
      return true;
    }
    return false;
  }

  logout() {
    this.isAuthenticated = false;
  }

  resetTimer() {
    this.lastActivityTime = Date.now();
  }

  checkSessionTimeout(onTimeoutCallback) {
    if (!this.isPinSet() || !this.isAuthenticated) return false;
    
    const inactiveDuration = Date.now() - this.lastActivityTime;
    if (inactiveDuration >= this.sessionTimeoutMs) {
      this.logout();
      if (onTimeoutCallback) onTimeoutCallback();
      return true;
    }
    return false;
  }
}

export const auth = new AuthManager();
