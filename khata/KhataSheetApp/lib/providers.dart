import 'package:flutter/material.dart';
import 'models.dart';
import 'storage_service.dart';

class AuthProvider extends ChangeNotifier {
  Member? _currentUser;
  bool _isAuthenticated = false;
  
  // Config state
  String _familyName = 'Family Ledger';
  String _currency = '₹';
  String _theme = 'dark';
  
  Member? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get isAdmin => _currentUser != null && _currentUser!.parentId == 0;
  
  String get familyName => _familyName;
  String get currency => _currency;
  String get theme => _theme;

  Future<void> updateTheme(String newTheme) async {
    _theme = newTheme;
    final db = await StorageService.instance.database;
    await db.update('config', {'theme': newTheme});
    notifyListeners();
  }

  Future<void> updateConfig({required String name, required String symbol, required String themeMode}) async {
    _familyName = name;
    _currency = symbol;
    _theme = themeMode;
    await StorageService.instance.saveConfig({
      'familyName': name,
      'currency': symbol,
      'theme': themeMode,
      'useSheets': StorageService.instance.useSheets ? 1 : 0,
      'sheetsUrl': StorageService.instance.sheetsUrl,
      'jwtSecret': StorageService.instance.jwtSecret,
    });
    notifyListeners();
  }

  Future<bool> login(String phone, String password, {String? sheetsUrl, String? jwtSecret}) async {
    if (sheetsUrl != null && sheetsUrl.isNotEmpty) {
      StorageService.instance.sheetsUrl = sheetsUrl;
    }
    if (jwtSecret != null && jwtSecret.isNotEmpty) {
      StorageService.instance.jwtSecret = jwtSecret;
    }

    final db = await StorageService.instance.database;
    
    // Attempt online sync verification first if possible
    if (StorageService.instance.useSheets && StorageService.instance.sheetsUrl.isNotEmpty) {
      try {
        final res = await StorageService.instance.sheetsRequest(
          action: 'read',
          sheet: 'members',
          sub: 0,
          parentId: 0,
        );
        if (res['success'] == true && res['data'] is List) {
          final List rows = res['data'];
          // Sync all members locally to keep local cache updated
          await db.delete('members');
          for (var row in rows) {
            await db.insert('members', Map<String, dynamic>.from(row));
          }
        }
      } catch (_) {}
    }

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
      
      final configRes = await db.query('config', limit: 1);
      if (configRes.isNotEmpty) {
        _familyName = configRes.first['familyName']?.toString() ?? 'Family Ledger';
        _currency = configRes.first['currency']?.toString() ?? '₹';
        _theme = configRes.first['theme']?.toString() ?? 'dark';
      }
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

  Future<bool> registerFamily(String familyName, String adminName, String phone, String password, {String? sheetsUrl, String? jwtSecret}) async {
    final db = await StorageService.instance.database;
    
    final check = await db.query('members', where: 'phone = ?', whereArgs: [phone], limit: 1);
    if (check.isNotEmpty) return false;

    if (sheetsUrl != null && sheetsUrl.isNotEmpty) {
      StorageService.instance.sheetsUrl = sheetsUrl;
    }
    if (jwtSecret != null && jwtSecret.isNotEmpty) {
      StorageService.instance.jwtSecret = jwtSecret;
    }

    _familyName = familyName;
    _currency = '₹';
    _theme = 'dark';

    await StorageService.instance.saveConfig({
      'familyName': familyName,
      'currency': '₹',
      'theme': 'dark',
      'useSheets': 1,
      'sheetsUrl': StorageService.instance.sheetsUrl,
      'jwtSecret': StorageService.instance.jwtSecret,
    });

    final adminId = await db.insert('members', {
      'name': adminName,
      'relation': 'Father (Admin)',
      'phone': phone,
      'email': '',
      'password': password,
      'parent_id': 0,
      'familyId': 0,
      'photo': '',
      'contribution': 0.0,
      'balance': 0.0,
    });

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

    // Push to sheets
    StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'members',
      recordData: _currentUser!.toMap(),
      sub: adminId,
      parentId: 0,
    );

    notifyListeners();
    return true;
  }
}

class LedgerProvider extends ChangeNotifier {
  List<Transaction> _transactions = [];
  List<ExternalAccount> _accounts = [];
  List<Member> _members = [];
  List<Budget> _budgets = [];
  List<Loan> _loans = [];

  int _currentPage = 1;
  int _limit = 10;
  String _searchQuery = '';
  String _categoryFilter = '';
  String _typeFilter = '';

  List<Transaction> get transactions => _transactions;
  List<ExternalAccount> get accounts => _accounts;
  List<Member> get members => _members;
  List<Budget> get budgets => _budgets;
  List<Loan> get loans => _loans;

  int get currentPage => _currentPage;
  int get limit => _limit;
  String get searchQuery => _searchQuery;
  String get categoryFilter => _categoryFilter;
  String get typeFilter => _typeFilter;

  void updateLimit(int newLimit) {
    _limit = newLimit;
    _currentPage = 1;
    fetchLedger();
  }

  void setFilters({String? search, String? category, String? type}) {
    if (search != null) _searchQuery = search;
    if (category != null) _categoryFilter = category;
    if (type != null) _typeFilter = type;
    _currentPage = 1; // Reset to page 1 on filter change
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

    String whereClause = 'familyId = ?';
    List<dynamic> whereArgs = [familyId];

    if (_searchQuery.isNotEmpty) {
      whereClause += ' AND description LIKE ?';
      whereArgs.add('%$_searchQuery%');
    }
    if (_categoryFilter.isNotEmpty) {
      whereClause += ' AND category = ?';
      whereArgs.add(_categoryFilter);
    }
    if (_typeFilter.isNotEmpty) {
      whereClause += ' AND type = ?';
      whereArgs.add(_typeFilter);
    }

    final res = await db.query(
      'transactions',
      where: whereClause,
      whereArgs: whereArgs,
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

  Future fetchMembers() async {
    final db = await StorageService.instance.database;
    final familyId = StorageService.instance.currentFamilyId ?? 0;
    final res = await db.query('members', where: 'familyId = ? OR id = ?', whereArgs: [familyId, familyId]);
    _members = res.map((m) => Member.fromMap(m)).toList();
    notifyListeners();
  }

  Future fetchBudgets() async {
    final db = await StorageService.instance.database;
    final familyId = StorageService.instance.currentFamilyId ?? 0;
    final res = await db.query('budgets', where: 'familyId = ?', whereArgs: [familyId]);
    _budgets = res.map((m) => Budget.fromMap(m)).toList();
    notifyListeners();
  }

  Future fetchLoans() async {
    final db = await StorageService.instance.database;
    final familyId = StorageService.instance.currentFamilyId ?? 0;
    final res = await db.query('loans', where: 'familyId = ?', whereArgs: [familyId]);
    _loans = res.map((m) => Loan.fromMap(m)).toList();
    notifyListeners();
  }

  Future fetchAllData() async {
    await Future.wait([
      fetchLedger(),
      fetchAccounts(),
      fetchMembers(),
      fetchBudgets(),
      fetchLoans(),
    ]);
  }

  // Sync to Sheets with local rollbacks
  Future<bool> addTransaction(Transaction tx, Member user) async {
    final db = await StorageService.instance.database;
    final txId = await db.insert('transactions', tx.toMap());

    // Update balances locally
    final balanceDiff = tx.type == 'Income' ? tx.amount : -tx.amount;
    await db.execute(
      'UPDATE members SET balance = balance + ? WHERE id = ?',
      [balanceDiff, tx.memberId],
    );

    if (tx.externalAccountId != null) {
      await db.execute(
        'UPDATE external_accounts SET currentBalance = currentBalance + ? WHERE id = ?',
        [balanceDiff, tx.externalAccountId],
      );
    }

    // Sync Background request
    final syncRes = await StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'transactions',
      recordData: tx.toMap()..['id'] = txId,
      sub: user.id!,
      parentId: user.parentId,
    );

    if (syncRes['success'] == false) {
      // ROLLBACK local database write
      await db.delete('transactions', where: 'id = ?', whereArgs: [txId]);
      await db.execute(
        'UPDATE members SET balance = balance - ? WHERE id = ?',
        [balanceDiff, tx.memberId],
      );
      if (tx.externalAccountId != null) {
        await db.execute(
          'UPDATE external_accounts SET currentBalance = currentBalance - ? WHERE id = ?',
          [balanceDiff, tx.externalAccountId],
        );
      }
      await fetchAllData();
      return false;
    }

    await fetchAllData();
    return true;
  }

  Future<bool> deleteTransaction(int id, Member user) async {
    if (user.parentId != 0) return false; // Admin check

    final db = await StorageService.instance.database;
    final original = await db.query('transactions', where: 'id = ?', whereArgs: [id]);
    if (original.isEmpty) return false;
    
    final tx = Transaction.fromMap(original.first);
    final balanceDiff = tx.type == 'Income' ? -tx.amount : tx.amount;

    // Apply delete locally
    await db.delete('transactions', where: 'id = ?', whereArgs: [id]);
    await db.execute(
      'UPDATE members SET balance = balance + ? WHERE id = ?',
      [balanceDiff, tx.memberId],
    );
    if (tx.externalAccountId != null) {
      await db.execute(
        'UPDATE external_accounts SET currentBalance = currentBalance + ? WHERE id = ?',
        [balanceDiff, tx.externalAccountId],
      );
    }

    final syncRes = await StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'transactions',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    );

    if (syncRes['success'] == false) {
      // ROLLBACK
      await db.insert('transactions', tx.toMap());
      await db.execute(
        'UPDATE members SET balance = balance - ? WHERE id = ?',
        [balanceDiff, tx.memberId],
      );
      if (tx.externalAccountId != null) {
        await db.execute(
          'UPDATE external_accounts SET currentBalance = currentBalance - ? WHERE id = ?',
          [balanceDiff, tx.externalAccountId],
        );
      }
      await fetchAllData();
      return false;
    }

    await fetchAllData();
    return true;
  }

  Future<bool> addMember(Member member, Member user) async {
    final db = await StorageService.instance.database;
    try {
      final id = await db.insert('members', member.toMap());
      final updatedMember = Member(
        id: id,
        name: member.name,
        relation: member.relation,
        phone: member.phone,
        email: member.email,
        password: member.password,
        parentId: member.parentId,
        familyId: member.familyId,
        photo: member.photo,
        contribution: member.contribution,
        balance: member.balance,
      );

      final syncRes = await StorageService.instance.sheetsRequest(
        action: 'create',
        sheet: 'members',
        recordData: updatedMember.toMap(),
        sub: user.id!,
        parentId: user.parentId,
      );

      if (syncRes['success'] == false) {
        await db.delete('members', where: 'id = ?', whereArgs: [id]);
        await fetchAllData();
        return false;
      }

      await fetchAllData();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> addAccount(ExternalAccount acc, Member user) async {
    final db = await StorageService.instance.database;
    final id = await db.insert('external_accounts', acc.toMap());
    final updatedAcc = ExternalAccount(
      id: id,
      name: acc.name,
      type: acc.type,
      phone: acc.phone,
      address: acc.address,
      openingBalance: acc.openingBalance,
      currentBalance: acc.currentBalance,
      familyId: acc.familyId,
    );

    final syncRes = await StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'external_accounts',
      recordData: updatedAcc.toMap(),
      sub: user.id!,
      parentId: user.parentId,
    );

    if (syncRes['success'] == false) {
      await db.delete('external_accounts', where: 'id = ?', whereArgs: [id]);
      await fetchAllData();
      return false;
    }

    await fetchAllData();
    return true;
  }

  Future<bool> deleteAccount(int id, Member user) async {
    if (user.parentId != 0) return false;
    final db = await StorageService.instance.database;
    final original = await db.query('external_accounts', where: 'id = ?', whereArgs: [id]);
    if (original.isEmpty) return false;
    
    final acc = ExternalAccount.fromMap(original.first);
    await db.delete('external_accounts', where: 'id = ?', whereArgs: [id]);

    final syncRes = await StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'external_accounts',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    );

    if (syncRes['success'] == false) {
      await db.insert('external_accounts', acc.toMap());
      await fetchAllData();
      return false;
    }

    await fetchAllData();
    return true;
  }

  Future<bool> setBudget(Budget budget, Member user) async {
    final db = await StorageService.instance.database;
    final id = await db.insert('budgets', budget.toMap());
    final updatedBudget = Budget(
      id: id,
      category: budget.category,
      limit: budget.limit,
      familyId: budget.familyId,
    );

    final syncRes = await StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'budgets',
      recordData: updatedBudget.toMap(),
      sub: user.id!,
      parentId: user.parentId,
    );

    if (syncRes['success'] == false) {
      await db.delete('budgets', where: 'id = ?', whereArgs: [id]);
      await fetchAllData();
      return false;
    }

    await fetchAllData();
    return true;
  }

  Future<bool> addLoan(Loan loan, Member user) async {
    final db = await StorageService.instance.database;
    final id = await db.insert('loans', loan.toMap());
    final updatedLoan = Loan(
      id: id,
      person: loan.person,
      loanType: loan.loanType,
      amount: loan.amount,
      interest: loan.interest,
      emi: loan.emi,
      dueDate: loan.dueDate,
      paidAmount: loan.paidAmount,
      notes: loan.notes,
      paymentHistory: loan.paymentHistory,
      memberId: loan.memberId,
      familyId: loan.familyId,
    );

    final syncRes = await StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'loans',
      recordData: updatedLoan.toMap(),
      sub: user.id!,
      parentId: user.parentId,
    );

    if (syncRes['success'] == false) {
      await db.delete('loans', where: 'id = ?', whereArgs: [id]);
      await fetchAllData();
      return false;
    }

    await fetchAllData();
    return true;
  }

  Future<bool> logLoanRepayment(int loanId, double paymentAmount, Member user) async {
    final db = await StorageService.instance.database;
    final original = await db.query('loans', where: 'id = ?', whereArgs: [loanId]);
    if (original.isEmpty) return false;

    final loan = Loan.fromMap(original.first);
    final updatedHistory = List.from(loan.paymentHistory);
    final nowStr = DateTime.now().toIso8601String().split('T').first;
    updatedHistory.add({'date': nowStr, 'amount': paymentAmount, 'memberId': user.id});

    final updatedLoan = Loan(
      id: loan.id,
      person: loan.person,
      loanType: loan.loanType,
      amount: loan.amount,
      interest: loan.interest,
      emi: loan.emi,
      dueDate: loan.dueDate,
      paidAmount: loan.paidAmount + paymentAmount,
      notes: loan.notes,
      paymentHistory: updatedHistory,
      memberId: loan.memberId,
      familyId: loan.familyId,
    );

    await db.update('loans', updatedLoan.toMap(), where: 'id = ?', whereArgs: [loanId]);

    // Perform sync update
    final syncRes = await StorageService.instance.sheetsRequest(
      action: 'update',
      sheet: 'loans',
      recordId: loanId,
      recordData: updatedLoan.toMap(),
      sub: user.id!,
      parentId: user.parentId,
    );

    if (syncRes['success'] == false) {
      // ROLLBACK
      await db.update('loans', loan.toMap(), where: 'id = ?', whereArgs: [loanId]);
      await fetchAllData();
      return false;
    }

    await fetchAllData();
    return true;
  }

  Future<bool> deleteLoan(int id, Member user) async {
    if (user.parentId != 0) return false;
    final db = await StorageService.instance.database;
    final original = await db.query('loans', where: 'id = ?', whereArgs: [id]);
    if (original.isEmpty) return false;
    
    final loan = Loan.fromMap(original.first);
    await db.delete('loans', where: 'id = ?', whereArgs: [id]);

    final syncRes = await StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'loans',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    );

    if (syncRes['success'] == false) {
      await db.insert('loans', loan.toMap());
      await fetchAllData();
      return false;
    }

    await fetchAllData();
    return true;
  }
}
