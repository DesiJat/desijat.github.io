import 'package:flutter/material.dart';
import 'models.dart';
import 'storage_service.dart';

// ─────────────────────────────────────────────────────────────────
// AuthProvider
// ─────────────────────────────────────────────────────────────────
class AuthProvider extends ChangeNotifier {
  Member? _currentUser;
  bool _isAuthenticated = false;

  // Config state
  String _familyName = 'Family Ledger';
  String _currency = '₹';
  String _theme = 'dark';

  AuthProvider() {
    tryAutoLogin();
  }

  Member? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;
  bool get isAdmin => _currentUser != null && _currentUser!.parentId == 0;

  String get familyName => _familyName;
  String get currency => _currency;
  String get theme => _theme;

  Future<void> _saveSession(String phone, String password) async {
    debugPrint("SESSION: Saving session for phone: $phone");
    final cfg = await StorageService.instance.getConfig() ?? {};
    cfg['sessionPhone'] = phone;
    cfg['sessionPassword'] = password;
    await StorageService.instance.saveConfig(cfg);
    debugPrint("SESSION: Saved session successfully");
  }

  Future<void> tryAutoLogin() async {
    debugPrint("SESSION: tryAutoLogin started");
    final cfg = await StorageService.instance.getConfig();
    if (cfg != null && cfg['sessionPhone'] != null && cfg['sessionPassword'] != null) {
      final phone = cfg['sessionPhone'].toString();
      final password = cfg['sessionPassword'].toString();
      debugPrint("SESSION: Found session credentials: $phone");
      
      final localRes = await StorageService.instance.queryMembers(
        phone: phone.trim(),
        password: password,
      );

      debugPrint("SESSION: Query members returned count: ${localRes.length}");
      if (localRes.isNotEmpty) {
        await _loginSuccess(Member.fromMap(localRes.first));
        debugPrint("SESSION: Auto-login success for member: ${localRes.first['name']}");
      } else {
        debugPrint("SESSION: Auto-login failed: member not found in local db");
      }
    } else {
      debugPrint("SESSION: No session credentials found in config");
    }
  }

  Future<void> updateTheme(String newTheme) async {
    _theme = newTheme;
    final cfg = await StorageService.instance.getConfig() ?? {};
    cfg['theme'] = newTheme;
    await StorageService.instance.saveConfig(cfg);
    notifyListeners();
  }

  Future<void> updateConfig({
    required String name,
    required String symbol,
    required String themeMode,
  }) async {
    _familyName = name;
    _currency = symbol;
    _theme = themeMode;
    final cfg = await StorageService.instance.getConfig() ?? {};
    cfg.addAll({
      'familyName': name,
      'currency': symbol,
      'theme': themeMode,
      'useSheets': StorageService.instance.useSheets ? 1 : 0,
      'sheetsUrl': StorageService.instance.sheetsUrl,
      'jwtSecret': StorageService.instance.jwtSecret,
    });
    await StorageService.instance.saveConfig(cfg);
    notifyListeners();
  }

  Future<bool> login(
    String phone,
    String password, {
    String? sheetsUrl,
    String? jwtSecret,
  }) async {
    if (sheetsUrl != null && sheetsUrl.isNotEmpty) {
      StorageService.instance.sheetsUrl = sheetsUrl;
    }
    if (jwtSecret != null && jwtSecret.isNotEmpty) {
      StorageService.instance.jwtSecret = jwtSecret;
    }

    // Try local lookup first
    final localRes = await StorageService.instance.queryMembers(
      phone: phone.trim(),
      password: password,
    );

    if (localRes.isNotEmpty) {
      await _loginSuccess(Member.fromMap(localRes.first));
      return true;
    }

    // If not found locally and Sheets is configured, try syncing members
    if (StorageService.instance.useSheets &&
        StorageService.instance.sheetsUrl.isNotEmpty) {
      try {
        final res = await StorageService.instance
            .sheetsRequest(
              action: 'read',
              sheet: 'members',
              sub: 0,
              parentId: 0,
              limit: 100000,
            )
            .timeout(const Duration(seconds: 8));

        if (res['success'] == true && res['data'] is List) {
          final List rows = res['data'];
          final memberRows = rows.map((row) => Map<String, dynamic>.from(row)).toList();
          await StorageService.instance.bulkReplaceMembers(memberRows);
          debugPrint('Synced ${rows.length} members from Sheets');
        }
      } catch (e) {
        debugPrint('Sheets sync on login failed (offline?): $e');
      }

      // Retry local lookup after sync
      final retryRes = await StorageService.instance.queryMembers(
        phone: phone.trim(),
        password: password,
      );

      if (retryRes.isNotEmpty) {
        await _loginSuccess(Member.fromMap(retryRes.first));
        return true;
      }
    }

    return false;
  }

  Future<void> _loginSuccess(Member user) async {
    _currentUser = user;
    _isAuthenticated = true;
    StorageService.instance.currentFamilyId =
        user.parentId == 0 ? user.id : user.parentId;

    final configRes = await StorageService.instance.getConfig();
    if (configRes != null) {
      _familyName = configRes['familyName']?.toString() ?? 'Family Ledger';
      _currency = configRes['currency']?.toString() ?? '₹';
      _theme = configRes['theme']?.toString() ?? 'dark';
    }
    await _saveSession(user.phone, user.password);
    notifyListeners();
  }

  Future logout() async {
    await StorageService.instance.clearDatabase();
    _currentUser = null;
    _isAuthenticated = false;
    StorageService.instance.currentFamilyId = null;
    notifyListeners();
  }

  Future<bool> registerFamily(
    String familyName,
    String adminName,
    String phone,
    String password, {
    String email = '',
    String? sheetsUrl,
    String? jwtSecret,
  }) async {
    final check = await StorageService.instance.queryMembers(phone: phone);
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

    int finalId = 0;
    try {
      final res = await StorageService.instance.sheetsRequest(
        action: 'create',
        sheet: 'members',
        recordData: {
          'name': adminName,
          'relation': 'Father (Admin)',
          'phone': phone,
          'email': email,
          'password': password,
          'parentId': 0,
          'familyId': 0, // Server will automatically set this to the new ID
          'photo': '',
          'contribution': 0.0,
          'balance': 0.0,
        },
        sub: 0,
        parentId: 0,
      ).timeout(const Duration(seconds: 12));

      if (res['success'] == true && res['id'] != null) {
        finalId = int.tryParse(res['id'].toString()) ?? 0;
        
        // Fail-safe client-side update to ensure familyId == finalId in Google Sheets
        await StorageService.instance.sheetsRequest(
          action: 'update',
          sheet: 'members',
          recordId: finalId,
          recordData: {'familyId': finalId},
          sub: finalId,
          parentId: 0,
        ).timeout(const Duration(seconds: 5)).catchError((_) => <String, dynamic>{});
      }
    } catch (e) {
      debugPrint('Sheets registration push failed: $e');
    }

    // Fallback to local auto-increment if Sheets creation failed
    if (finalId == 0) {
      finalId = await StorageService.instance.insertMember({
        'name': adminName,
        'relation': 'Father (Admin)',
        'phone': phone,
        'email': email,
        'password': password,
        'parentId': 0,
        'familyId': 0,
        'photo': '',
        'contribution': 0.0,
        'balance': 0.0,
      });
      await StorageService.instance.updateMemberField(finalId, {'familyId': finalId});
    } else {
      // Succeeded, insert locally using the forceId helper
      await StorageService.instance.insertMember({
        'name': adminName,
        'relation': 'Father (Admin)',
        'phone': phone,
        'email': email,
        'password': password,
        'parentId': 0,
        'familyId': finalId,
        'photo': '',
        'contribution': 0.0,
        'balance': 0.0,
      }, forceId: finalId);
    }

    await StorageService.instance.saveConfig({
      'familyName': familyName,
      'currency': '₹',
      'theme': 'dark',
      'useSheets': 1,
      'sheetsUrl': StorageService.instance.sheetsUrl,
      'jwtSecret': StorageService.instance.jwtSecret,
    });

    _currentUser = Member(
      id: finalId,
      name: adminName,
      relation: 'Father (Admin)',
      phone: phone,
      email: email,
      password: password,
      familyId: finalId,
      parentId: 0,
    );
    _isAuthenticated = true;
    StorageService.instance.currentFamilyId = finalId;

    await _saveSession(phone, password);
    notifyListeners();
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────
// LedgerProvider
// ─────────────────────────────────────────────────────────────────
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
  bool _hasNextPage = false;

  bool get hasNextPage => _hasNextPage;

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
    final familyId = StorageService.instance.currentFamilyId ?? 0;
    final offset = (_currentPage - 1) * _limit;

    final res = await StorageService.instance.queryTransactions(
      familyId: familyId,
      search: _searchQuery,
      category: _categoryFilter,
      type: _typeFilter,
      limit: _limit + 1,
      offset: offset,
    );

    final allItems = res.map((m) => Transaction.fromMap(m)).toList();
    if (allItems.length > _limit) {
      _hasNextPage = true;
      _transactions = allItems.take(_limit).toList();
    } else {
      _hasNextPage = false;
      _transactions = allItems;
    }
    notifyListeners();
  }

  Future fetchAccounts() async {
    final familyId = StorageService.instance.currentFamilyId ?? 0;
    final res = await StorageService.instance.queryAccounts(familyId);
    _accounts = res.map((m) => ExternalAccount.fromMap(m)).toList();
    notifyListeners();
  }

  Future fetchMembers() async {
    final familyId = StorageService.instance.currentFamilyId ?? 0;
    final res = await StorageService.instance.queryMembers(familyId: familyId);
    _members = res.map((m) => Member.fromMap(m)).toList();
    notifyListeners();
  }

  Future fetchBudgets() async {
    final familyId = StorageService.instance.currentFamilyId ?? 0;
    final res = await StorageService.instance.queryBudgets(familyId);
    _budgets = res.map((m) => Budget.fromMap(m)).toList();
    notifyListeners();
  }

  Future fetchLoans() async {
    final familyId = StorageService.instance.currentFamilyId ?? 0;
    final res = await StorageService.instance.queryLoans(familyId);
    _loans = res.map((m) => Loan.fromMap(m)).toList();
    notifyListeners();
  }

  /// Sync all data from Google Sheets (background-safe, best-effort)
  Future<bool> syncFromSheets() async {
    if (!StorageService.instance.useSheets ||
        StorageService.instance.sheetsUrl.isEmpty) {
      return false;
    }

    final familyId = StorageService.instance.currentFamilyId ?? 0;

    try {
      // 1. Sync Members
      final membersRes = await StorageService.instance
          .sheetsRequest(
            action: 'read',
            sheet: 'members',
            sub: 0,
            parentId: 0,
            limit: 100000,
          )
          .timeout(const Duration(seconds: 10));
      if (membersRes['success'] == true && membersRes['data'] is List) {
        final List rows = membersRes['data'];
        final List<Map<String, dynamic>> filteredRows = [];
        for (var row in rows) {
          final m = Member.fromMap(Map<String, dynamic>.from(row));
          if (m.familyId == familyId || m.id == familyId) {
            filteredRows.add(m.toMap());
          }
        }
        await StorageService.instance.bulkReplaceMembers(filteredRows);
      }

      // 2. Sync Transactions
      final txRes = await StorageService.instance
          .sheetsRequest(
            action: 'read',
            sheet: 'transactions',
            sub: 0,
            parentId: 0,
            limit: 100000,
          )
          .timeout(const Duration(seconds: 10));
      if (txRes['success'] == true && txRes['data'] is List) {
        final List rows = txRes['data'];
        debugPrint('syncFromSheets: read transactions, count=${rows.length}');
        for (var row in rows) {
          debugPrint('txn row: id=${row['id']}, familyId=${row['familyId']}, description=${row['description']}');
        }
        final txRows = rows.map((row) => Map<String, dynamic>.from(row)).toList();
        await StorageService.instance.bulkReplaceTransactions(txRows, familyId);
      }

      // 3. Sync Accounts
      final accRes = await StorageService.instance
          .sheetsRequest(
            action: 'read',
            sheet: 'external_accounts',
            sub: 0,
            parentId: 0,
            limit: 100000,
          )
          .timeout(const Duration(seconds: 10));
      if (accRes['success'] == true && accRes['data'] is List) {
        final List rows = accRes['data'];
        final accRows = rows.map((row) => Map<String, dynamic>.from(row)).toList();
        await StorageService.instance.bulkReplaceAccounts(accRows, familyId);
      }

      // 4. Sync Budgets
      final budgetRes = await StorageService.instance
          .sheetsRequest(
            action: 'read',
            sheet: 'budgets',
            sub: 0,
            parentId: 0,
            limit: 100000,
          )
          .timeout(const Duration(seconds: 10));
      if (budgetRes['success'] == true && budgetRes['data'] is List) {
        final List rows = budgetRes['data'];
        final budgetRows = rows.map((row) => Map<String, dynamic>.from(row)).toList();
        await StorageService.instance.bulkReplaceBudgets(budgetRows, familyId);
      }

      // 5. Sync Loans
      final loanRes = await StorageService.instance
          .sheetsRequest(
            action: 'read',
            sheet: 'loans',
            sub: 0,
            parentId: 0,
            limit: 100000,
          )
          .timeout(const Duration(seconds: 10));
      if (loanRes['success'] == true && loanRes['data'] is List) {
        final List rows = loanRes['data'];
        final loanRows = rows.map((row) => Map<String, dynamic>.from(row)).toList();
        await StorageService.instance.bulkReplaceLoans(loanRows, familyId);
      }
      return true;
    } catch (e) {
      debugPrint('Sheets sync failed: $e');
      return false;
    }
  }

  /// Fetch all data from local DB, then sync from Sheets in background
  Future fetchAllData() async {
    await Future.wait([
      fetchLedger(),
      fetchAccounts(),
      fetchMembers(),
      fetchBudgets(),
      fetchLoans(),
    ]);
    // Sync from Sheets in background — don't block UI
    syncFromSheets().then((_) async {
      await Future.wait([
        fetchLedger(),
        fetchAccounts(),
        fetchMembers(),
        fetchBudgets(),
        fetchLoans(),
      ]);
    }).catchError((_) => null);
  }

  // ── LOCAL-FIRST CRUD (always writes locally; Sheets sync is fire-and-forget) ──

  Future<bool> addTransaction(Transaction tx, Member user) async {
    final txId = await StorageService.instance.insertTransaction(tx.toMap());

    final balanceDiff = tx.type == 'Income' ? tx.amount : -tx.amount;
    await StorageService.instance.updateMemberBalance(tx.memberId, balanceDiff);
    if (tx.externalAccountId != null) {
      await StorageService.instance.updateAccountBalance(tx.externalAccountId!, balanceDiff);
    }

    // Background Sheets sync — no rollback
    StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'transactions',
      recordData: tx.toMap()..['id'] = txId,
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await Future.wait([fetchLedger(), fetchMembers(), fetchAccounts()]);
    return true;
  }

  Future<bool> deleteTransaction(int id, Member user) async {
    if (user.parentId != 0) return false;

    final original = await StorageService.instance.getTransactionById(id);
    if (original == null) return false;

    final tx = Transaction.fromMap(original);
    final balanceDiff = tx.type == 'Income' ? -tx.amount : tx.amount;

    await StorageService.instance.deleteTransactionById(id);
    await StorageService.instance.updateMemberBalance(tx.memberId, balanceDiff);
    if (tx.externalAccountId != null) {
      await StorageService.instance.updateAccountBalance(tx.externalAccountId!, balanceDiff);
    }

    // Background sync
    StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'transactions',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await Future.wait([fetchLedger(), fetchMembers(), fetchAccounts()]);
    return true;
  }

  Future<bool> addMember(Member member, Member user) async {
    try {
      final id = await StorageService.instance.insertMember(member.toMap());
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

      // Background sync
      StorageService.instance.sheetsRequest(
        action: 'create',
        sheet: 'members',
        recordData: updatedMember.toMap(),
        sub: user.id!,
        parentId: user.parentId,
      ).catchError((_) => <String, dynamic>{});

      await fetchMembers();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> deleteMember(int id, Member user) async {
    if (user.parentId != 0) return false;
    await StorageService.instance.deleteMemberById(id);

    StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'members',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await fetchMembers();
    return true;
  }

  Future<bool> addAccount(ExternalAccount acc, Member user) async {
    final id = await StorageService.instance.insertAccount(acc.toMap());
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

    StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'external_accounts',
      recordData: updatedAcc.toMap(),
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await fetchAccounts();
    return true;
  }

  Future<bool> deleteAccount(int id, Member user) async {
    if (user.parentId != 0) return false;
    await StorageService.instance.deleteAccountById(id);

    StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'external_accounts',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await fetchAccounts();
    return true;
  }

  Future<bool> setBudget(Budget budget, Member user) async {
    final existingIdx = _budgets.indexWhere(
        (b) => b.category.trim().toLowerCase() == budget.category.trim().toLowerCase());

    if (existingIdx != -1) {
      final existing = _budgets[existingIdx];
      final updatedBudget = Budget(
        id: existing.id,
        category: existing.category,
        limit: budget.limit,
        familyId: budget.familyId,
      );

      await StorageService.instance.updateBudgetData(existing.id!, updatedBudget.toMap());

      StorageService.instance.sheetsRequest(
        action: 'update',
        sheet: 'budgets',
        recordId: existing.id,
        recordData: updatedBudget.toMap(),
        sub: user.id!,
        parentId: user.parentId,
      ).catchError((_) => <String, dynamic>{});

      await fetchBudgets();
      return true;
    } else {
      final id = await StorageService.instance.insertBudget(budget.toMap());
      final updatedBudget = Budget(
        id: id,
        category: budget.category,
        limit: budget.limit,
        familyId: budget.familyId,
      );

      StorageService.instance.sheetsRequest(
        action: 'create',
        sheet: 'budgets',
        recordData: updatedBudget.toMap(),
        sub: user.id!,
        parentId: user.parentId,
      ).catchError((_) => <String, dynamic>{});

      await fetchBudgets();
      return true;
    }
  }

  Future<bool> deleteBudget(int id, Member user) async {
    if (user.parentId != 0) return false;
    await StorageService.instance.deleteBudgetById(id);

    StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'budgets',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await fetchBudgets();
    return true;
  }

  Future<bool> addLoan(Loan loan, Member user) async {
    final id = await StorageService.instance.insertLoan(loan.toMap());
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

    StorageService.instance.sheetsRequest(
      action: 'create',
      sheet: 'loans',
      recordData: updatedLoan.toMap(),
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await fetchLoans();
    return true;
  }

  Future<bool> logLoanRepayment(
    int loanId,
    double paymentAmount,
    Member user, {
    int? paidByMemberId,
    String? dateStr,
  }) async {
    final original = await StorageService.instance.getLoanById(loanId);
    if (original == null) return false;

    final loan = Loan.fromMap(original);
    final updatedHistory = List.from(loan.paymentHistory);
    final finalDateStr = dateStr ?? DateTime.now().toIso8601String().split('T').first;
    final finalMemberId = paidByMemberId ?? user.id;
    updatedHistory.add({
      'date': finalDateStr,
      'amount': paymentAmount,
      'memberId': finalMemberId,
    });

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

    await StorageService.instance.updateLoanData(loanId, updatedLoan.toMap());

    StorageService.instance.sheetsRequest(
      action: 'update',
      sheet: 'loans',
      recordId: loanId,
      recordData: updatedLoan.toMap(),
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await fetchLoans();
    return true;
  }

  Future<bool> deleteLoan(int id, Member user) async {
    if (user.parentId != 0) return false;
    await StorageService.instance.deleteLoanById(id);

    StorageService.instance.sheetsRequest(
      action: 'delete',
      sheet: 'loans',
      recordId: id,
      sub: user.id!,
      parentId: user.parentId,
    ).catchError((_) => <String, dynamic>{});

    await fetchLoans();
    return true;
  }
}
