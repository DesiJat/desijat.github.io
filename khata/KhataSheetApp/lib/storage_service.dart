import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter/foundation.dart' show debugPrint;
import 'package:http/http.dart' as http;
import 'crypto_utils.dart';

class StorageService {
  static final StorageService instance = StorageService._();
  StorageService._();

  // ─── Public config ────────────────────────────────────────────────
  String sheetsUrl = 'https://script.google.com/macros/s/AKfycbyIesDi6qGtfrrVYMEnjLwX1HaOuwHzS5SXutH_5HNyFjikcclvuc1hIfmjWPEDiRYZ/exec';
  String jwtSecret = 'your-very-secure-family-khata-secret-key-2026';
  bool useSheets = true;
  int? currentFamilyId;

  bool _ready = false;
  late Box _cfg, _mem, _txn, _acc, _bud, _loa;

  // ─── Initialization ───────────────────────────────────────────────
  Future<void> initialize() async {
    if (_ready) return;
    await Hive.initFlutter();
    _cfg = await Hive.openBox('khata_cfg');
    _mem = await Hive.openBox('khata_mem');
    _txn = await Hive.openBox('khata_txn');
    _acc = await Hive.openBox('khata_acc');
    _bud = await Hive.openBox('khata_bud');
    _loa = await Hive.openBox('khata_loa');
    _ready = true;
    await _loadConfig();
  }

  Future<void> _ensureReady() async {
    if (!_ready) await initialize();
  }

  // ─── Auto-increment ID ───────────────────────────────────────────
  int _nextId(Box box, String key) {
    final id = (box.get('__$key') as int? ?? 0) + 1;
    box.put('__$key', id);
    return id;
  }

  // ─── Config ──────────────────────────────────────────────────────
  Future<void> _loadConfig() async {
    final c = _cfg.get('data');
    if (c != null) {
      final m = _m(c);
      sheetsUrl = m['sheetsUrl'] as String? ?? sheetsUrl;
      jwtSecret = m['jwtSecret'] as String? ?? jwtSecret;
      useSheets = (_toInt(m['useSheets']) ?? 1) == 1;
    }
  }

  Future<void> saveConfig(Map<String, dynamic> cfg) async {
    await _ensureReady();
    await _cfg.put('data', cfg);
    await _loadConfig();
  }

  Future<Map<String, dynamic>?> getConfig() async {
    await _ensureReady();
    final c = _cfg.get('data');
    return c != null ? _m(c) : null;
  }

  // ─── Members ─────────────────────────────────────────────────────
  Future<int> insertMember(Map<String, dynamic> row, {int? forceId}) async {
    await _ensureReady();
    final id = forceId ?? _nextId(_mem, 'mid');
    await _mem.put('m$id', {...row, 'id': id});
    return id;
  }

  Future<void> updateMemberField(int id, Map<String, dynamic> updates) async {
    await _ensureReady();
    final v = _mem.get('m$id');
    if (v != null) {
      final m = _m(v)..addAll(updates);
      await _mem.put('m$id', m);
    }
  }

  Future<void> updateMemberBalance(int id, double delta) async {
    await _ensureReady();
    final v = _mem.get('m$id');
    if (v != null) {
      final m = _m(v);
      m['balance'] = (_toDouble(m['balance']) ?? 0.0) + delta;
      await _mem.put('m$id', m);
    }
  }

  Future<void> deleteMemberById(int id) async {
    await _ensureReady();
    await _mem.delete('m$id');
  }

  /// Returns members filtered by optional criteria.
  Future<List<Map<String, dynamic>>> queryMembers({
    String? phone,
    String? password,
    int? familyId,
  }) async {
    await _ensureReady();
    var all = _mem.keys
        .where((k) => k is String && (k as String).startsWith('m'))
        .map((k) => _m(_mem.get(k)!))
        .toList();

    if (phone != null) {
      all = all.where((m) => m['phone']?.toString() == phone).toList();
    }
    if (password != null) {
      all = all.where((m) => m['password']?.toString() == password).toList();
    }
    if (familyId != null) {
      all = all
          .where((m) =>
              _toInt(m['familyId']) == familyId ||
              _toInt(m['id']) == familyId)
          .toList();
    }
    return all;
  }

  Future<void> bulkReplaceMembers(List<Map<String, dynamic>> rows) async {
    await _ensureReady();
    final del = _mem.keys
        .where((k) => k is String && (k as String).startsWith('m'))
        .toList();
    await _mem.deleteAll(del);
    for (final row in rows) {
      final id = _toInt(row['id']);
      if (id != null && id > 0) await _mem.put('m$id', Map<String, dynamic>.from(row));
    }
  }

  // ─── Transactions ─────────────────────────────────────────────────
  Future<int> insertTransaction(Map<String, dynamic> row) async {
    await _ensureReady();
    final id = _nextId(_txn, 'tid');
    await _txn.put('t$id', {...row, 'id': id});
    return id;
  }

  Future<void> deleteTransactionById(int id) async {
    await _ensureReady();
    await _txn.delete('t$id');
  }

  Future<Map<String, dynamic>?> getTransactionById(int id) async {
    await _ensureReady();
    final v = _txn.get('t$id');
    return v != null ? _m(v) : null;
  }

  Future<List<Map<String, dynamic>>> queryTransactions({
    required int familyId,
    String? search,
    String? category,
    String? type,
    required int limit,
    required int offset,
  }) async {
    await _ensureReady();
    var all = _txn.keys
        .where((k) => k is String && (k as String).startsWith('t'))
        .map((k) => _m(_txn.get(k)!))
        .where((t) => _toInt(t['familyId']) == familyId)
        .toList();

    debugPrint('queryTransactions: familyId=$familyId, total_txn_keys=${_txn.keys.length}, filtered_all=${all.length}, limit=$limit, offset=$offset');

    if (search != null && search.isNotEmpty) {
      all = all
          .where((t) =>
              (t['description']?.toString() ?? '')
                  .toLowerCase()
                  .contains(search.toLowerCase()))
          .toList();
    }
    if (category != null && category.isNotEmpty) {
      all = all.where((t) => t['category']?.toString() == category).toList();
    }
    if (type != null && type.isNotEmpty) {
      all = all.where((t) => t['type']?.toString() == type).toList();
    }
    all.sort((a, b) =>
        (b['date']?.toString() ?? '').compareTo(a['date']?.toString() ?? ''));
    return all.skip(offset).take(limit).toList();
  }

  Future<void> bulkReplaceTransactions(
      List<Map<String, dynamic>> rows, int familyId) async {
    await _ensureReady();
    final incomingIds = rows
        .where((r) => _toInt(r['familyId'] ?? r['family_id']) == familyId)
        .map((r) => _toInt(r['id']))
        .toSet();
    final keysToDelete = _txn.keys
        .where((k) => k is String && (k as String).startsWith('t'))
        .where((k) {
          final t = _m(_txn.get(k)!);
          final fId = _toInt(t['familyId'] ?? t['family_id']);
          final id = _toInt(t['id']);
          return fId == familyId && !incomingIds.contains(id);
        })
        .toList();
    await _txn.deleteAll(keysToDelete);
    int maxId = _txn.get('__tid') as int? ?? 0;
    for (final row in rows) {
      final id = _toInt(row['id']);
      final fId = _toInt(row['familyId'] ?? row['family_id']);
      if (id != null && id > 0 && fId == familyId) {
        await _txn.put('t$id', Map<String, dynamic>.from(row));
        if (id > maxId) maxId = id;
      }
    }
    await _txn.put('__tid', maxId);
  }

  // ─── External Accounts ────────────────────────────────────────────
  Future<int> insertAccount(Map<String, dynamic> row) async {
    await _ensureReady();
    final id = _nextId(_acc, 'aid');
    await _acc.put('a$id', {...row, 'id': id});
    return id;
  }

  Future<void> deleteAccountById(int id) async {
    await _ensureReady();
    await _acc.delete('a$id');
  }

  Future<Map<String, dynamic>?> getAccountById(int id) async {
    await _ensureReady();
    final v = _acc.get('a$id');
    return v != null ? _m(v) : null;
  }

  Future<void> updateAccountBalance(int id, double delta) async {
    await _ensureReady();
    final v = _acc.get('a$id');
    if (v != null) {
      final m = _m(v);
      m['currentBalance'] = (_toDouble(m['currentBalance']) ?? 0.0) + delta;
      await _acc.put('a$id', m);
    }
  }

  Future<List<Map<String, dynamic>>> queryAccounts(int familyId) async {
    await _ensureReady();
    return _acc.keys
        .where((k) => k is String && (k as String).startsWith('a'))
        .map((k) => _m(_acc.get(k)!))
        .where((a) => _toInt(a['familyId']) == familyId)
        .toList();
  }

  Future<void> bulkReplaceAccounts(
      List<Map<String, dynamic>> rows, int familyId) async {
    await _ensureReady();
    final incomingIds = rows
        .where((r) => _toInt(r['familyId'] ?? r['family_id']) == familyId)
        .map((r) => _toInt(r['id']))
        .toSet();
    final keysToDelete = _acc.keys
        .where((k) => k is String && (k as String).startsWith('a'))
        .where((k) {
          final a = _m(_acc.get(k)!);
          final fId = _toInt(a['familyId'] ?? a['family_id']);
          final id = _toInt(a['id']);
          return fId == familyId && !incomingIds.contains(id);
        })
        .toList();
    await _acc.deleteAll(keysToDelete);
    int maxId = _acc.get('__aid') as int? ?? 0;
    for (final row in rows) {
      final id = _toInt(row['id']);
      final fId = _toInt(row['familyId'] ?? row['family_id']);
      if (id != null && id > 0 && fId == familyId) {
        await _acc.put('a$id', Map<String, dynamic>.from(row));
        if (id > maxId) maxId = id;
      }
    }
    await _acc.put('__aid', maxId);
  }

  // ─── Budgets ─────────────────────────────────────────────────────
  Future<int> insertBudget(Map<String, dynamic> row) async {
    await _ensureReady();
    final id = _nextId(_bud, 'bid');
    await _bud.put('b$id', {...row, 'id': id});
    return id;
  }

  Future<void> updateBudgetData(int id, Map<String, dynamic> row) async {
    await _ensureReady();
    await _bud.put('b$id', Map<String, dynamic>.from(row)..['id'] = id);
  }

  Future<void> deleteBudgetById(int id) async {
    await _ensureReady();
    await _bud.delete('b$id');
  }

  Future<List<Map<String, dynamic>>> queryBudgets(int familyId) async {
    await _ensureReady();
    return _bud.keys
        .where((k) => k is String && (k as String).startsWith('b'))
        .map((k) => _m(_bud.get(k)!))
        .where((b) => _toInt(b['familyId']) == familyId)
        .toList();
  }

  Future<void> bulkReplaceBudgets(
      List<Map<String, dynamic>> rows, int familyId) async {
    await _ensureReady();
    final incomingIds = rows
        .where((r) => _toInt(r['familyId'] ?? r['family_id']) == familyId)
        .map((r) => _toInt(r['id']))
        .toSet();
    final keysToDelete = _bud.keys
        .where((k) => k is String && (k as String).startsWith('b'))
        .where((k) {
          final b = _m(_bud.get(k)!);
          final fId = _toInt(b['familyId'] ?? b['family_id']);
          final id = _toInt(b['id']);
          return fId == familyId && !incomingIds.contains(id);
        })
        .toList();
    await _bud.deleteAll(keysToDelete);
    int maxId = _bud.get('__bid') as int? ?? 0;
    for (final row in rows) {
      final id = _toInt(row['id']);
      final fId = _toInt(row['familyId'] ?? row['family_id']);
      if (id != null && id > 0 && fId == familyId) {
        await _bud.put('b$id', Map<String, dynamic>.from(row));
        if (id > maxId) maxId = id;
      }
    }
    await _bud.put('__bid', maxId);
  }

  // ─── Loans ───────────────────────────────────────────────────────
  Future<int> insertLoan(Map<String, dynamic> row) async {
    await _ensureReady();
    final id = _nextId(_loa, 'lid');
    await _loa.put('l$id', {...row, 'id': id});
    return id;
  }

  Future<void> updateLoanData(int id, Map<String, dynamic> row) async {
    await _ensureReady();
    await _loa.put('l$id', Map<String, dynamic>.from(row)..['id'] = id);
  }

  Future<void> deleteLoanById(int id) async {
    await _ensureReady();
    await _loa.delete('l$id');
  }

  Future<Map<String, dynamic>?> getLoanById(int id) async {
    await _ensureReady();
    final v = _loa.get('l$id');
    return v != null ? _m(v) : null;
  }

  Future<List<Map<String, dynamic>>> queryLoans(int familyId) async {
    await _ensureReady();
    return _loa.keys
        .where((k) => k is String && (k as String).startsWith('l'))
        .map((k) => _m(_loa.get(k)!))
        .where((l) => _toInt(l['familyId']) == familyId)
        .toList();
  }

  Future<void> bulkReplaceLoans(
      List<Map<String, dynamic>> rows, int familyId) async {
    await _ensureReady();
    final incomingIds = rows
        .where((r) => _toInt(r['familyId'] ?? r['family_id']) == familyId)
        .map((r) => _toInt(r['id']))
        .toSet();
    final keysToDelete = _loa.keys
        .where((k) => k is String && (k as String).startsWith('l'))
        .where((k) {
          final l = _m(_loa.get(k)!);
          final fId = _toInt(l['familyId'] ?? l['family_id']);
          final id = _toInt(l['id']);
          return fId == familyId && !incomingIds.contains(id);
        })
        .toList();
    await _loa.deleteAll(keysToDelete);
    int maxId = _loa.get('__lid') as int? ?? 0;
    for (final row in rows) {
      final id = _toInt(row['id']);
      final fId = _toInt(row['familyId'] ?? row['family_id']);
      if (id != null && id > 0 && fId == familyId) {
        await _loa.put('l$id', Map<String, dynamic>.from(row));
        if (id > maxId) maxId = id;
      }
    }
    await _loa.put('__lid', maxId);
  }

  // ─── Clear all ────────────────────────────────────────────────────
  Future<void> clearDatabase() async {
    await _ensureReady();
    for (final box in [_mem, _txn, _acc, _bud, _loa]) {
      await box.clear();
    }
    await _cfg.clear();
    sheetsUrl = 'https://script.google.com/macros/s/AKfycbyIesDi6qGtfrrVYMEnjLwX1HaOuwHzS5SXutH_5HNyFjikcclvuc1hIfmjWPEDiRYZ/exec';
    jwtSecret = 'your-very-secure-family-khata-secret-key-2026';
    useSheets = true;
    currentFamilyId = null;
  }

  // ─── Backup ──────────────────────────────────────────────────────
  Future<String> exportBackup() async {
    await _ensureReady();
    final familyId = currentFamilyId ?? 0;
    final data = {
      'config': await getConfig(),
      'members': await queryMembers(familyId: familyId),
      'transactions': await queryTransactions(
          familyId: familyId, limit: 99999, offset: 0),
      'external_accounts': await queryAccounts(familyId),
      'budgets': await queryBudgets(familyId),
      'loans': await queryLoans(familyId),
    };
    return CryptoUtils.xorEncryptDecrypt(jsonEncode(data), jwtSecret);
  }

  Future<bool> importBackup(String encryptedBackup) async {
    try {
      await _ensureReady();
      final str = CryptoUtils.xorDecrypt(encryptedBackup, jwtSecret);
      if (str.isEmpty) return false;
      final data = jsonDecode(str) as Map<String, dynamic>;
      if (data['config'] != null) {
        await saveConfig(Map<String, dynamic>.from(data['config'] as Map));
      }
      return true;
    } catch (e) {
      debugPrint('importBackup error: $e');
      return false;
    }
  }

  // ─── Sheets HTTP ─────────────────────────────────────────────────
  Future<Map<String, dynamic>> sheetsRequest({
    required String action,
    required String sheet,
    int? recordId,
    Map<String, dynamic>? recordData,
    List<dynamic>? bulkData,
    required int sub,
    required int parentId,
    int? limit,
    int? page,
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
      final body = <String, dynamic>{
        'token': token,
        'action': action,
        'sheet': sheet,
      };
      if (recordId != null) body['id'] = recordId;
      if (recordData != null) body['data'] = recordData;
      if (bulkData != null) body['data'] = bulkData;
      if (limit != null) body['limit'] = limit;
      if (page != null) body['page'] = page;

      var res = await http
          .post(
            Uri.parse(sheetsUrl),
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 15));

      if (res.statusCode == 302 || res.statusCode == 307 || res.statusCode == 303) {
        final location = res.headers['location'];
        if (location != null) {
          res = await http.get(Uri.parse(location)).timeout(const Duration(seconds: 15));
        }
      }

      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return {'success': false, 'error': 'HTTP ${res.statusCode}'};
    } catch (e) {
      debugPrint('sheetsRequest error: $e');
      return {'success': false, 'error': e.toString()};
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  Map<String, dynamic> _m(dynamic v) => Map<String, dynamic>.from(v as Map);
  int? _toInt(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toInt();
    final d = double.tryParse(v.toString());
    return d?.toInt();
  }
  double? _toDouble(dynamic v) => v != null ? double.tryParse(v.toString()) : null;
}
