import 'dart:convert';

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
