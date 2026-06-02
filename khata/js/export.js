/**
 * Export & Import Module - js/export.js
 * Enables database backup/restoration and CSV table exportation.
 */
import { storage } from "./storage.js";

class ExportManager {
  // Convert objects array into CSV format
  convertToCSV(objArray) {
    if (!objArray || !objArray.length) return "";
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '';
    
    // Headers
    const headers = Object.keys(array[0]);
    str += headers.join(',') + '\r\n';

    // Rows
    for (let i = 0; i < array.length; i++) {
      let line = '';
      for (let index in headers) {
        const key = headers[index];
        let val = array[i][key] === null || array[i][key] === undefined ? "" : array[i][key];
        
        // Handle strings with commas
        if (typeof val === 'string') {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        
        line += val + ',';
      }
      str += line.slice(0, -1) + '\r\n';
    }
    return str;
  }

  // Trigger file download in browser
  downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Exports
  exportTableToCSV(table, filename) {
    const list = storage.getLocal(table) || [];
    if (!list.length) {
      alert("No data available to export.");
      return;
    }
    const csvContent = this.convertToCSV(list);
    this.downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  exportJSONBackup() {
    const jsonStr = storage.getBackupJSON();
    const familyConfig = storage.getLocal("config") || {};
    const familyName = (familyConfig.familyName || "Family").replace(/\s+/g, "_");
    this.downloadFile(jsonStr, `${familyName}_Khata_Backup_${new Date().toISOString().split("T")[0]}.json`, 'application/json');
  }

  // Imports
  importJSONRestore(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const success = storage.restoreBackupJSON(e.target.result);
      if (callback) callback(success);
    };
    reader.readAsText(file);
  }
}

export const exporter = new ExportManager();
