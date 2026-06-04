import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:path/path.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:flutter/foundation.dart' show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';
import 'crypto_utils.dart';

class StorageService {
  static final StorageService instance = StorageService._init();
  static Database? _database;

  // Defaults
  String sheetsUrl = "https://script.google.com/macros/s/AKfycbyIesDi6qGtfrrVYMEnjLwX1HaOuwHzS5SXutH_5HNyFjikcclvuc1hIfmjWPEDiRYZ/exec";
  String jwtSecret = "your-very-secure-family-khata-secret-key-2026";
  bool useSheets = true;
  int? currentFamilyId;

  StorageService._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('khata_database.db');
    await loadConfig();
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    if (kIsWeb) {
      // Use simple web factory — sqflite_sw.js + sqlite3.wasm are in web/
      databaseFactory = createDatabaseFactoryFfiWeb();
    } else if (!kIsWeb && _isDesktop()) {
      sqfliteFfiInit();
      databaseFactory = databaseFactoryFfi;
    }

    String path;
    if (kIsWeb) {
      path = filePath;
    } else {
      final dbPath = await getDatabasesPath();
      path = join(dbPath, filePath);
    }

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  bool _isDesktop() {
    if (kIsWeb) return false;
    return defaultTargetPlatform == TargetPlatform.windows ||
        defaultTargetPlatform == TargetPlatform.linux ||
        defaultTargetPlatform == TargetPlatform.macOS;
  }

  Future _createDB(Database db, int version) async {
    await db.execute('''
      CREATE TABLE config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        familyName TEXT,
        currency TEXT,
        theme TEXT,
        useSheets INTEGER,
        sheetsUrl TEXT,
        jwtSecret TEXT
      )
    ''');

    await db.execute('''
      CREATE TABLE members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        relation TEXT,
        phone TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        parent_id INTEGER,
        familyId INTEGER,
        photo TEXT,
        contribution REAL,
        balance REAL
      )
    ''');

    await db.execute('''
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        type TEXT,
        category TEXT,
        memberId INTEGER,
        externalAccountId INTEGER,
        amount REAL,
        description TEXT,
        status TEXT,
        familyId INTEGER
      )
    ''');

    await db.execute('''
      CREATE TABLE external_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        type TEXT,
        phone TEXT,
        address TEXT,
        openingBalance REAL,
        currentBalance REAL,
        familyId INTEGER
      )
    ''');

    await db.execute('''
      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT,
        "limit" REAL,
        familyId INTEGER
      )
    ''');

    await db.execute('''
      CREATE TABLE loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person TEXT,
        loanType TEXT,
        amount REAL,
        interest REAL,
        emi REAL,
        dueDate TEXT,
        paidAmount REAL,
        notes TEXT,
        paymentHistory TEXT,
        memberId INTEGER,
        familyId INTEGER
      )
    ''');
  }

  Future loadConfig() async {
    final db = await database;
    final res = await db.query('config', limit: 1);
    if (res.isNotEmpty) {
      final config = res.first;
      sheetsUrl = config['sheetsUrl']?.toString() ?? sheetsUrl;
      jwtSecret = config['jwtSecret']?.toString() ?? jwtSecret;
      useSheets = (int.tryParse(config['useSheets']?.toString() ?? '1') ?? 1) == 1;
    }
  }

  Future saveConfig(Map<String, dynamic> config) async {
    final db = await database;
    await db.delete('config');
    await db.insert('config', config);
    await loadConfig();
  }

  Future clearDatabase() async {
    final db = await database;
    await db.delete('members');
    await db.delete('transactions');
    await db.delete('external_accounts');
    await db.delete('budgets');
    await db.delete('loans');
    await db.delete('config');
  }

  // Backup & Recovery functionality
  Future<String> exportBackup() async {
    final db = await database;
    final Map<String, dynamic> backupData = {};
    
    backupData['config'] = await db.query('config');
    backupData['members'] = await db.query('members');
    backupData['transactions'] = await db.query('transactions');
    backupData['external_accounts'] = await db.query('external_accounts');
    backupData['budgets'] = await db.query('budgets');
    backupData['loans'] = await db.query('loans');

    final jsonString = jsonEncode(backupData);
    // Secure with XOR encryption using active jwtSecret
    return CryptoUtils.xorEncryptDecrypt(jsonString, jwtSecret);
  }

  Future<bool> importBackup(String encryptedBackup) async {
    try {
      final jsonString = CryptoUtils.xorDecrypt(encryptedBackup, jwtSecret);
      if (jsonString.isEmpty) return false;
      
      final Map<String, dynamic> backupData = jsonDecode(jsonString);
      final db = await database;

      await db.transaction((txn) async {
        if (backupData.containsKey('config')) {
          await txn.delete('config');
          for (var row in backupData['config']) {
            await txn.insert('config', Map<String, dynamic>.from(row));
          }
        }
        
        final tables = ['members', 'transactions', 'external_accounts', 'budgets', 'loans'];
        for (var table in tables) {
          if (backupData.containsKey(table)) {
            await txn.delete(table);
            for (var row in backupData[table]) {
              await txn.insert(table, Map<String, dynamic>.from(row));
            }
          }
        }
      });
      
      await loadConfig();
      return true;
    } catch (_) {
      return false;
    }
  }

  // Sheets Sync helper
  Future<Map<String, dynamic>> sheetsRequest({
    required String action,
    required String sheet,
    int? recordId,
    Map<String, dynamic>? recordData,
    List<dynamic>? bulkData,
    required int sub,
    required int parentId,
  }) async {
    if (!useSheets || sheetsUrl.isEmpty) {
      return {'success': false, 'error': 'Sync disabled or empty URL'};
    }

    try {
      final token = CryptoUtils.generateJwt(
        sub: sub,
        familyId: currentFamilyId ?? 0,
        parentId: parentId,
        jwtSecret: jwtSecret,
      );

      final Map<String, dynamic> body = {
        'token': token,
        'action': action,
        'sheet': sheet,
      };
      if (recordId != null) body['id'] = recordId;
      if (recordData != null) body['data'] = recordData;
      if (bulkData != null) body['data'] = bulkData;

      final res = await http.post(
        Uri.parse(sheetsUrl),
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: jsonEncode(body),
      ).timeout(const Duration(seconds: 15));

      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return {'success': false, 'error': 'HTTP ${res.statusCode}'};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }
}
