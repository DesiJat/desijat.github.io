# create flutter project
import os

# Base directory
base_dir = "/Users/apple/data/desijat.github.io/khata/KhataSheetApp"

# File mappings
files = {}

# 1. pubspec.yaml
files["pubspec.yaml"] = """name: khata_sheet_app
description: A cross-platform offline-first Family Khata SaaS with Google Sheets Sync.
version: 1.0.0+1

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.5
  provider: ^6.0.5
  http: ^1.1.0
  crypto: ^3.0.3
  sqflite: ^2.3.0
  path: ^1.8.3
  path_provider: ^2.1.1
  fl_chart: ^0.63.0
  intl: ^0.18.1

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.1

flutter:
  uses-material-design: true
"""

# 2. lib/models.dart
files["lib/models.dart"] = """import 'dart:convert';

class Member {
  final int? id;
  final String name;
  final String relation;
  final String phone;
  final String email;
  final String password;
  final int parentId;
  final int familyId;
  final String photo;
  final double contribution;
  final double balance;

  Member({
    this.id,
    required this.name,
    required this.relation,
    required this.phone,
    this.email = '',
    this.password = '',
    this.parentId = 0,
    required this.familyId,
    this.photo = '',
    this.contribution = 0.0,
    this.balance = 0.0,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'relation': relation,
      'phone': phone,
      'email': email,
      'password': password,
      'parent_id': parentId,
      'familyId': familyId,
      'photo': photo,
      'contribution': contribution,
      'balance': balance,
    };
  }

  factory Member.fromMap(Map<String, dynamic> map) {
    return Member(
      id: map['id'] != null ? int.tryParse(map['id'].toString()) : null,
      name: map['name'] ?? '',
      relation: map['relation'] ?? '',
      phone: map['phone'] ?? '',
      email: map['email'] ?? '',
      password: map['password'] ?? '',
      parentId: int.tryParse(map['parent_id']?.toString() ?? '0') ?? 0,
      familyId: int.tryParse(map['familyId']?.toString() ?? '0') ?? 0,
      photo: map['photo'] ?? '',
      contribution: double.tryParse(map['contribution']?.toString() ?? '0.0') ?? 0.0,
      balance: double.tryParse(map['balance']?.toString() ?? '0.0') ?? 0.0,
    );
  }
}

class Transaction {
  final int? id;
  final String date;
  final String type;
  final String category;
  final int memberId;
  final int? externalAccountId;
  final double amount;
  final String description;
  final String status;
  final int familyId;

  Transaction({
    this.id,
    required this.date,
    required this.type,
    required this.category,
    required this.memberId,
    this.externalAccountId,
    required this.amount,
    required this.description,
    required this.status,
    required this.familyId,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'date': date,
      'type': type,
      'category': category,
      'memberId': memberId,
      'externalAccountId': externalAccountId,
      'amount': amount,
      'description': description,
      'status': status,
      'familyId': familyId,
    };
  }

  factory Transaction.fromMap(Map<String, dynamic> map) {
    return Transaction(
      id: map['id'] != null ? int.tryParse(map['id'].toString()) : null,
      date: map['date'] ?? '',
      type: map['type'] ?? 'Expense',
      category: map['category'] ?? '',
      memberId: int.tryParse(map['memberId']?.toString() ?? '0') ?? 0,
      externalAccountId: map['externalAccountId'] != null ? int.tryParse(map['externalAccountId'].toString()) : null,
      amount: double.tryParse(map['amount']?.toString() ?? '0.0') ?? 0.0,
      description: map['description'] ?? '',
      status: map['status'] ?? 'Completed',
      familyId: int.tryParse(map['familyId']?.toString() ?? '0') ?? 0,
    );
  }
}

class ExternalAccount {
  final int? id;
  final String name;
  final String type;
  final String phone;
  final String address;
  final double openingBalance;
  final double currentBalance;
  final int familyId;

  ExternalAccount({
    this.id,
    required this.name,
    required this.type,
    this.phone = '',
    this.address = '',
    required this.openingBalance,
    required this.currentBalance,
    required this.familyId,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'type': type,
      'phone': phone,
      'address': address,
      'openingBalance': openingBalance,
      'currentBalance': currentBalance,
      'familyId': familyId,
    };
  }

  factory ExternalAccount.fromMap(Map<String, dynamic> map) {
    return ExternalAccount(
      id: map['id'] != null ? int.tryParse(map['id'].toString()) : null,
      name: map['name'] ?? '',
      type: map['type'] ?? '',
      phone: map['phone'] ?? '',
      address: map['address'] ?? '',
      openingBalance: double.tryParse(map['openingBalance']?.toString() ?? '0.0') ?? 0.0,
      currentBalance: double.tryParse(map['currentBalance']?.toString() ?? '0.0') ?? 0.0,
      familyId: int.tryParse(map['familyId']?.toString() ?? '0') ?? 0,
    );
  }
}

class Budget {
  final int? id;
  final String category;
  final double limit;
  final int familyId;

  Budget({
    this.id,
    required this.category,
    required this.limit,
    required this.familyId,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'category': category,
      'limit': limit,
      'familyId': familyId,
    };
  }

  factory Budget.fromMap(Map<String, dynamic> map) {
    return Budget(
      id: map['id'] != null ? int.tryParse(map['id'].toString()) : null,
      category: map['category'] ?? '',
      limit: double.tryParse(map['limit']?.toString() ?? '0.0') ?? 0.0,
      familyId: int.tryParse(map['familyId']?.toString() ?? '0') ?? 0,
    );
  }
}

class Loan {
  final int? id;
  final String person;
  final String loanType;
  final double amount;
  final double interest;
  final double emi;
  final String dueDate;
  final double paidAmount;
  final String notes;
  final List<dynamic> paymentHistory;
  final int memberId;
  final int familyId;

  Loan({
    this.id,
    required this.person,
    required this.loanType,
    required this.amount,
    required this.interest,
    required this.emi,
    required this.dueDate,
    this.paidAmount = 0.0,
    this.notes = '',
    required this.paymentHistory,
    required this.memberId,
    required this.familyId,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'person': person,
      'loanType': loanType,
      'amount': amount,
      'interest': interest,
      'emi': emi,
      'dueDate': dueDate,
      'paidAmount': paidAmount,
      'notes': notes,
      'paymentHistory': jsonEncode(paymentHistory),
      'memberId': memberId,
      'familyId': familyId,
    };
  }

  factory Loan.fromMap(Map<String, dynamic> map) {
    List<dynamic> history = [];
    try {
      if (map['paymentHistory'] != null) {
        if (map['paymentHistory'] is String) {
          history = jsonDecode(map['paymentHistory']);
        } else {
          history = map['paymentHistory'];
        }
      }
    } catch (_) {}

    return Loan(
      id: map['id'] != null ? int.tryParse(map['id'].toString()) : null,
      person: map['person'] ?? '',
      loanType: map['loanType'] ?? 'Given',
      amount: double.tryParse(map['amount']?.toString() ?? '0.0') ?? 0.0,
      interest: double.tryParse(map['interest']?.toString() ?? '0.0') ?? 0.0,
      emi: double.tryParse(map['emi']?.toString() ?? '0.0') ?? 0.0,
      dueDate: map['dueDate'] ?? '',
      paidAmount: double.tryParse(map['paidAmount']?.toString() ?? '0.0') ?? 0.0,
      notes: map['notes'] ?? '',
      paymentHistory: history,
      memberId: int.tryParse(map['memberId']?.toString() ?? '0') ?? 0,
      familyId: int.tryParse(map['familyId']?.toString() ?? '0') ?? 0,
    );
  }
}
"""

# 3. lib/crypto_utils.dart
files["lib/crypto_utils.dart"] = """import 'dart:convert';
import 'package:crypto/crypto.dart';

class CryptoUtils {
  // Base64url Encoder
  static String base64UrlEncode(String value) {
    return base64Url.encode(utf8.encode(value)).replaceAll('=', '');
  }

  // Lightweight XOR encryption/decryption for local cache security
  static String xorEncryptDecrypt(String data, String key) {
    if (key.isEmpty) return data;
    final List<int> dataBytes = utf8.encode(data);
    final List<int> keyBytes = utf8.encode(key);
    final List<int> resultBytes = List<int>.filled(dataBytes.length, 0);

    for (int i = 0; i < dataBytes.length; i++) {
      resultBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return base64.encode(resultBytes);
  }

  static String xorDecrypt(String cipherText, String key) {
    try {
      if (cipherText.isEmpty || key.isEmpty) return cipherText;
      final List<int> encryptedBytes = base64.decode(cipherText);
      final List<int> keyBytes = utf8.encode(key);
      final List<int> resultBytes = List<int>.filled(encryptedBytes.length, 0);

      for (int i = 0; i < encryptedBytes.length; i++) {
        resultBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      return utf8.decode(resultBytes);
    } catch (_) {
      return '';
    }
  }

  // HMAC-SHA256 Signer for JWT creation
  static String generateJwt({
    required int sub,
    required int familyId,
    required int parentId,
    required String jwtSecret,
  }) {
    final header = {'alg': 'HS256', 'typ': 'JWT'};
    final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    
    final payload = {
      'sub': sub.toString(),
      'familyId': familyId,
      'parentId': parentId,
      'iat': nowSeconds,
      'exp': nowSeconds + 3600,
    };

    final headerEncoded = base64UrlEncode(jsonEncode(header));
    final payloadEncoded = base64UrlEncode(jsonEncode(payload));
    final tokenInput = '$headerEncoded.$payloadEncoded';

    // HMAC Sign
    final hmac = Hmac(sha256, utf8.encode(jwtSecret));
    final signature = hmac.convert(utf8.encode(tokenInput));
    final signatureEncoded = base64Url.encode(signature.bytes).replaceAll('=', '');

    return '$tokenInput.$signatureEncoded';
  }
}
"""

# 4. lib/storage_service.dart
files["lib/storage_service.dart"] = """import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'models.dart';
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
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
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

  // Load configuration details
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

  // Clear local database caches on logout
  Future clearDatabase() async {
    final db = await database;
    await db.delete('members');
    await db.delete('transactions');
    await db.delete('external_accounts');
    await db.delete('budgets');
    await db.delete('loans');
    await db.delete('config');
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
"""

# 5. lib/providers.dart
files["lib/providers.dart"] = """import 'package:flutter/material.dart';
import 'models.dart';
import 'storage_service.dart';

class AuthProvider extends ChangeNotifier {
  Member? _currentUser;
  bool _isAuthenticated = false;

  Member? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get isAdmin => _currentUser != null && _currentUser!.parentId == 0;

  Future<bool> login(String phone, String password) async {
    final db = await StorageService.instance.database;
    final res = await db.query(
      'members',
      where: 'phone = ? AND password = ?',
      whereArgs: [phone.trim(), password],
      limit: 1,
    );

    if (res.isNotEmpty) {
      _currentUser = Member.fromMap(res.first);
      _isAuthenticated = true;
      StorageService.instance.currentFamilyId = _currentUser!.parentId == 0 ? _currentUser!.id : _currentUser!.parentId;
      notifyListeners();
      return true;
    }
    return false;
  }

  Future logout() async {
    await StorageService.instance.clearDatabase();
    _currentUser = null;
    _isAuthenticated = false;
    StorageService.instance.currentFamilyId = null;
    notifyListeners();
  }

  Future<bool> registerFamily(String familyName, String adminName, String phone, String password) async {
    final db = await StorageService.instance.database;
    
    // Check uniqueness locally
    final check = await db.query('members', where: 'phone = ?', whereArgs: [phone], limit: 1);
    if (check.isNotEmpty) return false;

    // Create Family settings
    await StorageService.instance.saveConfig({
      'familyName': familyName,
      'currency': '₹',
      'theme': 'light',
      'useSheets': 1,
      'sheetsUrl': StorageService.instance.sheetsUrl,
      'jwtSecret': StorageService.instance.jwtSecret,
    });

    // Create Admin member
    final adminId = await db.insert('members', {
      'name': adminName,
      'relation': 'Father (Admin)',
      'phone': phone,
      'email': '',
      'password': password,
      'parent_id': 0,
      'familyId': 0, // Set temporarily
      'photo': '',
      'contribution': 0.0,
      'balance': 0.0,
    });

    // Update familyId to match admin id
    await db.update('members', {'familyId': adminId}, where: 'id = ?', whereArgs: [adminId]);

    _currentUser = Member(
      id: adminId,
      name: adminName,
      relation: 'Father (Admin)',
      phone: phone,
      familyId: adminId,
      parentId: 0,
    );
    _isAuthenticated = true;
    StorageService.instance.currentFamilyId = adminId;
    notifyListeners();
    return true;
  }
}

class LedgerProvider extends ChangeNotifier {
  List<Transaction> _transactions = [];
  List<ExternalAccount> _accounts = [];
  int _currentPage = 1;
  int _limit = 10;

  List<Transaction> get transactions => _transactions;
  List<ExternalAccount> get accounts => _accounts;
  int get currentPage => _currentPage;
  int get limit => _limit;

  void updateLimit(int newLimit) {
    _limit = newLimit;
    _currentPage = 1;
    fetchLedger();
  }

  void nextPage() {
    _currentPage++;
    fetchLedger();
  }

  void prevPage() {
    if (_currentPage > 1) {
      _currentPage--;
      fetchLedger();
    }
  }

  Future fetchLedger() async {
    final db = await StorageService.instance.database;
    final familyId = StorageService.instance.currentFamilyId ?? 0;

    final offset = (_currentPage - 1) * _limit;
    final res = await db.query(
      'transactions',
      where: 'familyId = ?',
      whereArgs: [familyId],
      limit: _limit,
      offset: offset,
      orderBy: 'date DESC',
    );

    _transactions = res.map((m) => Transaction.fromMap(m)).toList();
    notifyListeners();
  }

  Future fetchAccounts() async {
    final db = await StorageService.instance.database;
    final familyId = StorageService.instance.currentFamilyId ?? 0;

    final res = await db.query('external_accounts', where: 'familyId = ?', whereArgs: [familyId]);
    _accounts = res.map((m) => ExternalAccount.fromMap(m)).toList();
    notifyListeners();
  }

  Future<bool> addTransaction(Transaction tx, Member user) async {
    final db = await StorageService.instance.database;
    final txId = await db.insert('transactions', tx.toMap());

    // Update member balance
    final balanceDiff = tx.type == 'Income' ? tx.amount : -tx.amount;
    await db.execute(
      'UPDATE members SET balance = balance + ? WHERE id = ?',
      [balanceDiff, tx.memberId],
    );

    // Sync
    StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'transactions',
      recordData: tx.toMap(),
      sub: user.id!,
      parentId: user.parentId,
    );

    fetchLedger();
    return txId > 0;
  }

  Future<bool> deleteTransaction(int id, Member user) async {
    if (user.parentId != 0) return false;

    final db = await StorageService.instance.database;
    
    // Find transaction to adjust balance back
    final res = await db.query('transactions', where: 'id = ?', whereArgs: [id]);
    if (res.isNotEmpty) {
      final tx = Transaction.fromMap(res.first);
      final balanceDiff = tx.type == 'Income' ? -tx.amount : tx.amount;
      await db.execute(
        'UPDATE members SET balance = balance + ? WHERE id = ?',
        [balanceDiff, tx.memberId],
      );
    }

    await db.delete('transactions', where: 'id = ?', whereArgs: [id]);

    StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'transactions',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    );

    fetchLedger();
    return true;
  }
}
"""

# 6. lib/views.dart
files["lib/views.dart"] = """import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers.dart';
import 'models.dart';

class AuthLockView extends StatefulWidget {
  const AuthLockView({super.key});

  @override
  State<AuthLockView> createState() => _AuthLockViewState();
}

class _AuthLockViewState extends State<AuthLockView> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  
  final _regFamilyController = TextEditingController();
  final _regAdminController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regPasswordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            child: Container(
              width: 450,
              padding: const EdgeInsets.all(28.0),
              margin: const EdgeInsets.symmetric(horizontal: 16.0),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.1)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    "₹ Family Khata",
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    "Secure multi-platform ledger ecosystem",
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                  const SizedBox(height: 24),
                  TabBar(
                    controller: _tabController,
                    tabs: const [Tab(text: "Sign In"), Tab(text: "New Family")],
                    indicatorColor: const Color(0xFF6366F1),
                    labelColor: Colors.white,
                    unselectedLabelColor: Colors.white38,
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 480,
                    child: TabBarView(
                      controller: _tabController,
                      children: [
                        _buildLoginForm(),
                        _buildRegisterForm(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLoginForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 16),
        _buildTextField("Phone Number", _phoneController),
        const SizedBox(height: 16),
        _buildTextField("Password", _passwordController, obscureText: true),
        const SizedBox(height: 32),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF6366F1),
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          onPressed: () async {
            final auth = context.read<AuthProvider>();
            final success = await auth.login(_phoneController.text, _passwordController.text);
            if (!success && mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Invalid credentials"), backgroundColor: Colors.red),
              );
            }
          },
          child: const Text("Access Workspace", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildTextField("Family / Business Name", _regFamilyController),
        const SizedBox(height: 12),
        _buildTextField("Admin Head Name", _regAdminController),
        const SizedBox(height: 12),
        _buildTextField("Admin Phone", _regPhoneController),
        const SizedBox(height: 12),
        _buildTextField("Password", _regPasswordController, obscureText: true),
        const SizedBox(height: 24),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF10B981),
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          onPressed: () async {
            final auth = context.read<AuthProvider>();
            final success = await auth.registerFamily(
              _regFamilyController.text,
              _regAdminController.text,
              _regPhoneController.text,
              _regPasswordController.text,
            );
            if (!success && mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Phone number already exists"), backgroundColor: Colors.red),
              );
            }
          },
          child: const Text("Initialize Family Workspace", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  Widget _buildTextField(String label, TextEditingController controller, {bool obscureText = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscureText,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white.withOpacity(0.04),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }
}

class DashboardView extends StatelessWidget {
  const DashboardView({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(
        title: Text(auth.currentUser?.name ?? "Dashboard"),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: const Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          children: [
            Text("Welcome to Family Khata Dashboard"),
          ],
        ),
      ),
    );
  }
}
"""

# 7. lib/main.dart
files["lib/main.dart"] = """import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'views.dart';
import 'providers.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => LedgerProvider()),
      ],
      child: const KhataApp(),
    ),
  );
}

class KhataApp extends StatelessWidget {
  const KhataApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Family Khata',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        primaryColor: const Color(0xFF6366F1),
        useMaterial3: true,
      ),
      home: const MainGatekeeper(),
    );
  }
}

class MainGatekeeper extends StatelessWidget {
  const MainGatekeeper({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return auth.isAuthenticated ? const DashboardView() : const AuthLockView();
  }
}
"""

# Create dirs and write files
os.makedirs(os.path.join(base_dir, "lib"), exist_ok=True)

for path, content in files.items():
    full_path = os.path.join(base_dir, path)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Created file: {full_path}")

"""
flutter run -d chrome
flutter build web --release
flutter devices

flutter run
flutter run -d <device_id>
flutter build apk --release
flutter build appbundle --release
flutter pub get


flutter analyze
flutter test
flutter pub get


cd /Users/apple/data/desijat.github.io/khata/KhataSheetApp

# Web (Chrome)
flutter run -d chrome

# Android (USB debug enabled)
flutter run -d <android-device-id>

# List all connected devices
flutter devices

# Or serve the built web bundle locally
cd build/web && python3 -m http.server 8080


cd /Users/apple/data/desijat.github.io/khata/KhataSheetApp/build/web
python3 -m http.server 8080
# Open: http://localhost:8080
"""

