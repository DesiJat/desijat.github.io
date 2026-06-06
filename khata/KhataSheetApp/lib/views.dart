import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'providers.dart';
import 'models.dart';
import 'storage_service.dart';

// Responsive Glassmorphic Card Decoration
BoxDecoration glassDecoration(BuildContext context, {Color? customColor}) {
  final theme = context.watch<AuthProvider>().theme;
  final isLight = theme == 'light';
  final isEPaper = theme == 'e-paper';

  if (isEPaper) {
    return BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.black, width: 1.5),
    );
  }

  return BoxDecoration(
    color: isLight 
        ? (customColor ?? Colors.white.withValues(alpha: 0.75)) 
        : (customColor ?? const Color(0xFF1E293B).withValues(alpha: 0.7)),
    borderRadius: BorderRadius.circular(16),
    border: Border.all(
      color: isLight ? Colors.black.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.08),
    ),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.04),
        blurRadius: 10,
        offset: const Offset(0, 4),
      )
    ],
  );
}

// Global Text Theme helpers
TextStyle titleStyle(BuildContext context, {double size = 18, Color? color}) {
  final theme = context.watch<AuthProvider>().theme;
  final isEPaper = theme == 'e-paper';
  return TextStyle(
    fontSize: size,
    fontWeight: FontWeight.bold,
    color: color ?? (isEPaper ? Colors.black : Colors.white),
  );
}

TextStyle subtitleStyle(BuildContext context, {double size = 13, Color? color}) {
  final theme = context.watch<AuthProvider>().theme;
  final isEPaper = theme == 'e-paper';
  return TextStyle(
    fontSize: size,
    color: color ?? (isEPaper ? Colors.black54 : Colors.white70),
  );
}

// -------------------------------------------------------------
// View Gatekeeper & Auth System
// -------------------------------------------------------------
class AuthLockView extends StatefulWidget {
  const AuthLockView({super.key});

  @override
  State<AuthLockView> createState() => _AuthLockViewState();
}

class _AuthLockViewState extends State<AuthLockView> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _sheetsUrlController = TextEditingController(text: StorageService.instance.sheetsUrl);
  final _jwtSecretController = TextEditingController(text: StorageService.instance.jwtSecret);
  
  final _regFamilyController = TextEditingController();
  final _regAdminController = TextEditingController();
  final _regPhoneController = TextEditingController();
  final _regEmailController = TextEditingController();
  final _regPasswordController = TextEditingController();

  bool _isAdvancedExpanded = false;

  @override
  void initState() {
    super.initState();
    debugPrint("BOOTSTRAP: AuthLockView.initState() started");
    _tabController = TabController(length: 2, vsync: this);
    debugPrint("BOOTSTRAP: AuthLockView.initState() completed");
  }

  @override
  Widget build(BuildContext context) {
    debugPrint("BOOTSTRAP: AuthLockView.build() called");
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
              width: 480,
              padding: const EdgeInsets.all(28.0),
              margin: const EdgeInsets.symmetric(horizontal: 16.0),
              decoration: glassDecoration(context),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    "₹ Family Khata",
                    style: titleStyle(context, size: 28),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "Secure multi-platform ledger ecosystem",
                    style: subtitleStyle(context),
                  ),
                  const SizedBox(height: 24),
                  TabBar(
                    controller: _tabController,
                    tabs: const [Tab(text: "Sign In"), Tab(text: "Register Family")],
                    indicatorColor: const Color(0xFF6366F1),
                    labelStyle: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 520,
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
    return ListView(
      children: [
        const SizedBox(height: 12),
        _buildTextField("Phone Number", _phoneController, TextInputType.phone),
        const SizedBox(height: 12),
        _buildTextField("Password", _passwordController, TextInputType.visiblePassword, obscureText: true),
        const SizedBox(height: 16),
        InkWell(
          onTap: () => setState(() => _isAdvancedExpanded = !_isAdvancedExpanded),
          child: Row(
            children: [
              Icon(_isAdvancedExpanded ? Icons.arrow_drop_down_circle : Icons.arrow_right, color: Colors.white70),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  "Advanced Connection Configurations", 
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
        if (_isAdvancedExpanded) ...[
          const SizedBox(height: 12),
          _buildTextField("Google Sheets Sync URL", _sheetsUrlController, TextInputType.url),
          const SizedBox(height: 12),
          _buildTextField("JWT Private Secret", _jwtSecretController, TextInputType.text),
        ],
        const SizedBox(height: 32),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF6366F1),
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
          onPressed: () async {
            final auth = context.read<AuthProvider>();
            final success = await auth.login(
              _phoneController.text, 
              _passwordController.text,
              sheetsUrl: _sheetsUrlController.text,
              jwtSecret: _jwtSecretController.text,
            );
            if (!success && mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Phone or password incorrect. Register first if new."), backgroundColor: Colors.red),
              );
            } else if (mounted) {
              context.read<LedgerProvider>().fetchAllData();
            }
          },
          child: const Text("Access Workspace", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  Widget _buildRegisterForm() {
    return ListView(
      children: [
        const SizedBox(height: 12),
        _buildTextField("Family Workspace Name", _regFamilyController, TextInputType.text),
        const SizedBox(height: 12),
        _buildTextField("Admin Head Name", _regAdminController, TextInputType.text),
        const SizedBox(height: 12),
        _buildTextField("Admin Phone", _regPhoneController, TextInputType.phone),
        const SizedBox(height: 12),
        _buildTextField("Admin Email", _regEmailController, TextInputType.emailAddress),
        const SizedBox(height: 12),
        _buildTextField("Password", _regPasswordController, TextInputType.visiblePassword, obscureText: true),
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
              email: _regEmailController.text,
              sheetsUrl: _sheetsUrlController.text,
              jwtSecret: _jwtSecretController.text,
            );
            if (!success && mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text("Phone number already registered. Try logging in."), backgroundColor: Colors.red),
              );
            } else if (mounted) {
              context.read<LedgerProvider>().fetchAllData();
            }
          },
          child: const Text("Initialize Workspace", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }

  Widget _buildTextField(String label, TextEditingController controller, TextInputType type, {bool obscureText = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: type,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.04),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }
}

// -------------------------------------------------------------
// Main Frame & Navigation
// -------------------------------------------------------------
class MainViewFrame extends StatefulWidget {
  const MainViewFrame({super.key});

  @override
  State<MainViewFrame> createState() => _MainViewFrameState();
}

class _MainViewFrameState extends State<MainViewFrame> {
  int _selectedIndex = 0;
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LedgerProvider>().fetchAllData();
    });
  }

  final List<Widget> _views = [
    const DashboardOverview(),
    const LedgerView(),
    const MembersView(),
    const BudgetsView(),
    const LoansView(),
    const SettingsView(),
  ];

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isEPaper = auth.theme == 'e-paper';
    final isLight = auth.theme == 'light';

    return Scaffold(
      backgroundColor: isEPaper 
          ? const Color(0xFFF5F5F0) 
          : (isLight ? const Color(0xFFF1F5F9) : const Color(0xFF0F172A)),
      appBar: AppBar(
        title: Text(
          "₹ ${auth.familyName}",
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: isEPaper ? Colors.black : Colors.white,
          ),
        ),
        backgroundColor: isEPaper 
            ? Colors.white 
            : (isLight ? Colors.white : const Color(0xFF1E293B)),
        elevation: 0,
        actions: [
          if (_isSyncing)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    isEPaper ? Colors.black : Colors.white,
                  ),
                ),
              ),
            )
          else
            IconButton(
              icon: Icon(Icons.refresh, color: isEPaper ? Colors.black : Colors.white),
              tooltip: "Refresh Sync Data",
              onPressed: () async {
                setState(() {
                  _isSyncing = true;
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text("Syncing fresh data from Sheets..."),
                    duration: Duration(seconds: 1),
                  ),
                );
                try {
                  final success = await context.read<LedgerProvider>().syncFromSheets();
                  if (success) {
                    await context.read<LedgerProvider>().fetchAllData();
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text("Data synced successfully!"),
                          backgroundColor: Colors.green,
                        ),
                      );
                    }
                  } else {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text("Failed to sync from Sheets"),
                          backgroundColor: Colors.red,
                        ),
                      );
                    }
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text("Sync failed: $e"),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                } finally {
                  if (mounted) {
                    setState(() {
                      _isSyncing = false;
                    });
                  }
                }
              },
            ),
          Center(
            child: Text(
              auth.currentUser?.name ?? '',
              style: titleStyle(context, size: 14),
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: Icon(Icons.logout, color: isEPaper ? Colors.black : Colors.white),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: Row(
        children: [
          // Sidebar for Desktop viewports
          if (MediaQuery.of(context).size.width > 800)
            NavigationRail(
              selectedIndex: _selectedIndex,
              onDestinationSelected: (idx) => setState(() => _selectedIndex = idx),
              labelType: NavigationRailLabelType.all,
              backgroundColor: isEPaper 
                  ? Colors.white 
                  : (isLight ? Colors.white : const Color(0xFF1E293B)),
              selectedIconTheme: const IconThemeData(color: Color(0xFF6366F1)),
              unselectedIconTheme: IconThemeData(
                color: isEPaper ? Colors.black54 : Colors.white54,
              ),
              destinations: const [
                NavigationRailDestination(icon: Icon(Icons.dashboard), label: Text("Dashboard")),
                NavigationRailDestination(icon: Icon(Icons.receipt_long), label: Text("Ledger")),
                NavigationRailDestination(icon: Icon(Icons.people), label: Text("Members")),
                NavigationRailDestination(icon: Icon(Icons.pie_chart), label: Text("Budgets")),
                NavigationRailDestination(icon: Icon(Icons.handshake), label: Text("Loans")),
                NavigationRailDestination(icon: Icon(Icons.settings), label: Text("Settings")),
              ],
            ),
          Expanded(child: _views[_selectedIndex]),
        ],
      ),
      bottomNavigationBar: MediaQuery.of(context).size.width <= 800
          ? BottomNavigationBar(
              currentIndex: _selectedIndex,
              onTap: (idx) => setState(() => _selectedIndex = idx),
              type: BottomNavigationBarType.fixed,
              backgroundColor: isEPaper 
                  ? Colors.white 
                  : (isLight ? Colors.white : const Color(0xFF1E293B)),
              selectedItemColor: const Color(0xFF6366F1),
              unselectedItemColor: isEPaper ? Colors.black54 : Colors.white54,
              items: const [
                BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: "Dashboard"),
                BottomNavigationBarItem(icon: Icon(Icons.receipt_long), label: "Ledger"),
                BottomNavigationBarItem(icon: Icon(Icons.people), label: "Members"),
                BottomNavigationBarItem(icon: Icon(Icons.pie_chart), label: "Budgets"),
                BottomNavigationBarItem(icon: Icon(Icons.handshake), label: "Loans"),
                BottomNavigationBarItem(icon: Icon(Icons.settings), label: "Settings"),
              ],
            )
          : null,
    );
  }
}

// -------------------------------------------------------------
// Sub-View: Dashboard Overview
// -------------------------------------------------------------
class DashboardOverview extends StatelessWidget {
  const DashboardOverview({super.key});

  @override
  Widget build(BuildContext context) {
    final ledger = context.watch<LedgerProvider>();
    final auth = context.watch<AuthProvider>();
    final cur = auth.currency;

    // Calculate Summary Stats
    double totalContributions = 0.0;
    double totalBalances = 0.0;
    for (var m in ledger.members) {
      totalContributions += m.contribution;
      totalBalances += m.balance;
    }

    double activeLoansGiven = 0.0;
    double activeLoansTaken = 0.0;
    for (var l in ledger.loans) {
      final rem = l.amount - l.paidAmount;
      if (l.loanType == 'Given') {
        activeLoansGiven += rem;
      } else {
        activeLoansTaken += rem;
      }
    }

    return ListView(
      padding: const EdgeInsets.all(16.0),
      children: [
        // Summary Cards Layout Grid
        GridView.count(
          crossAxisCount: MediaQuery.of(context).size.width > 900 
              ? 4 
              : (MediaQuery.of(context).size.width > 600 ? 3 : 2),
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: MediaQuery.of(context).size.width > 600 ? 1.5 : 1.2,
          children: [
            _buildStatCard(context, "Net Balance", "$cur ${totalBalances.toStringAsFixed(2)}", Icons.account_balance_wallet, Colors.teal),
            _buildStatCard(context, "Contributions", "$cur ${totalContributions.toStringAsFixed(2)}", Icons.savings, Colors.blue),
            _buildStatCard(context, "Debts Given", "$cur ${activeLoansGiven.toStringAsFixed(2)}", Icons.arrow_outward, Colors.green),
            _buildStatCard(context, "Debts Taken", "$cur ${activeLoansTaken.toStringAsFixed(2)}", Icons.call_received, Colors.red),
          ],
        ),
        const SizedBox(height: 20),
        
        // Reports and Charts
        if (ledger.transactions.isNotEmpty) ...[
          Container(
            height: 240,
            padding: const EdgeInsets.all(16.0),
            decoration: glassDecoration(context),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("Category Spending Allocation", style: titleStyle(context, size: 16)),
                const Expanded(child: SimpleSpendingPieChart()),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],

        // Recent Transaction Logs Table
        Container(
          padding: const EdgeInsets.all(16.0),
          decoration: glassDecoration(context),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Recent Family Activity Ledger", style: titleStyle(context, size: 16)),
              const SizedBox(height: 12),
              if (ledger.transactions.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 20.0),
                  child: Center(child: Text("No transactions recorded yet", style: subtitleStyle(context))),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: ledger.transactions.take(5).length,
                  separatorBuilder: (_, __) => Divider(color: Colors.white.withOpacity(0.05)),
                  itemBuilder: (ctx, idx) {
                    final tx = ledger.transactions[idx];
                    final memberName = ledger.members.firstWhere((m) => m.id == tx.memberId, orElse: () => Member(name: 'Unknown', relation: '', phone: '', familyId: 0)).name;
                    final isExpense = tx.type == 'Expense';
                    return ListTile(
                      title: Text(tx.description, style: titleStyle(context, size: 14)),
                      subtitle: Text("$memberName • ${tx.date} • ${tx.category}", style: subtitleStyle(context)),
                      trailing: Text(
                        "${isExpense ? '-' : '+'} $cur ${tx.amount.toStringAsFixed(2)}",
                        style: TextStyle(
                          color: isExpense ? Colors.red : Colors.green,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(BuildContext context, String title, String val, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: glassDecoration(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: subtitleStyle(context)),
              Icon(icon, color: color, size: 20),
            ],
          ),
          const SizedBox(height: 8),
          Text(val, style: titleStyle(context, size: 20)),
        ],
      ),
    );
  }
}

// Spending Pie Chart Component
class SimpleSpendingPieChart extends StatelessWidget {
  const SimpleSpendingPieChart({super.key});

  @override
  Widget build(BuildContext context) {
    final ledger = context.watch<LedgerProvider>();
    final Map<String, double> categories = {};
    
    for (var tx in ledger.transactions) {
      if (tx.type == 'Expense') {
        categories[tx.category] = (categories[tx.category] ?? 0.0) + tx.amount;
      }
    }

    if (categories.isEmpty) return const Center(child: Text("No expenses to chart"));

    final list = categories.entries.toList();
    final colors = [Colors.blue, Colors.green, Colors.purple, Colors.orange, Colors.red, Colors.teal];

    return PieChart(
      PieChartData(
        sectionsSpace: 4,
        centerSpaceRadius: 40,
        sections: List.generate(list.length, (idx) {
          final entry = list[idx];
          return PieChartSectionData(
            color: colors[idx % colors.length],
            value: entry.value,
            title: '${entry.key}\n${entry.value.toStringAsFixed(0)}',
            radius: 50,
            titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
          );
        }),
      ),
    );
  }
}

// -------------------------------------------------------------
// Sub-View: Double-Entry Ledger View (Paginated Grid)
// -------------------------------------------------------------
class LedgerView extends StatefulWidget {
  const LedgerView({super.key});

  @override
  State<LedgerView> createState() => _LedgerViewState();
}

class _LedgerViewState extends State<LedgerView> {
  final _descController = TextEditingController();
  final _amountController = TextEditingController();
  final _categoryController = TextEditingController();
  final _searchController = TextEditingController();
  String _txType = 'Expense';
  int? _selectedMember;

  @override
  void dispose() {
    _searchController.dispose();
    _descController.dispose();
    _amountController.dispose();
    _categoryController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ledger = context.watch<LedgerProvider>();
    final auth = context.watch<AuthProvider>();
    final cur = auth.currency;

    final budgetCats = ledger.budgets.map((b) => b.category).toSet();
    final txCats = ledger.transactions.map((t) => t.category).toSet();
    final combinedCats = {...budgetCats, ...txCats}
        .where((c) => c.trim().isNotEmpty)
        .toList()
        ..sort();
    final filterCats = combinedCats.isNotEmpty
        ? combinedCats
        : ["Salary", "Business Income", "Rent Income", "Food", "Education", "Electricity", "Water", "Internet", "Medical", "Transportation", "Entertainment", "Other"];

    if (ledger.categoryFilter.isNotEmpty && !filterCats.contains(ledger.categoryFilter)) {
      filterCats.add(ledger.categoryFilter);
      filterCats.sort();
    }

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Double-Entry Ledger", style: titleStyle(context, size: 20)),
              ElevatedButton.icon(
                icon: const Icon(Icons.add, color: Colors.white),
                label: const Text("Log Transaction", style: TextStyle(color: Colors.white)),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
                onPressed: () => _showAddTxDialog(context, auth, ledger),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Filter Row
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 200,
                child: TextField(
                  controller: _searchController,
                  decoration: const InputDecoration(
                    labelText: "Search description...",
                    prefixIcon: Icon(Icons.search),
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  onChanged: (val) => ledger.setFilters(search: val),
                ),
              ),
              DropdownButton<String>(
                value: ledger.typeFilter.isEmpty ? null : ledger.typeFilter,
                hint: const Text("All Types"),
                items: const [
                  DropdownMenuItem(value: null, child: Text("All Types")),
                  DropdownMenuItem(value: "Income", child: Text("Income")),
                  DropdownMenuItem(value: "Expense", child: Text("Expense")),
                ],
                onChanged: (val) => ledger.setFilters(type: val ?? ""),
              ),
              DropdownButton<String>(
                value: ledger.categoryFilter.isEmpty ? null : ledger.categoryFilter,
                hint: const Text("All Categories"),
                items: [
                  const DropdownMenuItem(value: null, child: Text("All Categories")),
                  ...filterCats.map((c) => DropdownMenuItem(value: c, child: Text(c))),
                ],
                onChanged: (val) => ledger.setFilters(category: val ?? ""),
              ),
              DropdownButton<int>(
                value: ledger.limit,
                items: const [
                  DropdownMenuItem(value: 10, child: Text("10 / Page")),
                  DropdownMenuItem(value: 50, child: Text("50 / Page")),
                  DropdownMenuItem(value: 100, child: Text("100 / Page")),
                ],
                onChanged: (val) => ledger.updateLimit(val ?? 10),
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.white70),
                tooltip: "Reset Filters",
                onPressed: () {
                  _searchController.clear();
                  ledger.setFilters(search: "", category: "", type: "");
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Ledger Logs Grid List
          Expanded(
            child: Container(
              decoration: glassDecoration(context),
              child: ledger.transactions.isEmpty
                  ? const Center(child: Text("No records found"))
                  : ListView.builder(
                      itemCount: ledger.transactions.length,
                      itemBuilder: (ctx, idx) {
                        final tx = ledger.transactions[idx];
                        final memberName = ledger.members.firstWhere((m) => m.id == tx.memberId, orElse: () => Member(name: 'Unknown', relation: '', phone: '', familyId: 0)).name;
                        final isExpense = tx.type == 'Expense';

                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: isExpense ? Colors.red.withOpacity(0.1) : Colors.green.withOpacity(0.1),
                            child: Icon(isExpense ? Icons.arrow_downward : Icons.arrow_upward, color: isExpense ? Colors.red : Colors.green),
                          ),
                          title: Text(tx.description, style: titleStyle(context, size: 14)),
                          subtitle: Text("$memberName • ${tx.date} • ${tx.category}"),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                "$cur ${tx.amount.toStringAsFixed(2)}",
                                style: TextStyle(
                                  color: isExpense ? Colors.red : Colors.green,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              if (auth.isAdmin) // Only admin can delete transactions
                                IconButton(
                                  icon: const Icon(Icons.delete, color: Colors.white38),
                                  onPressed: () async {
                                    final success = await ledger.deleteTransaction(tx.id!, auth.currentUser!);
                                    if (!success && mounted) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text("Sync execution rollback occurred"), backgroundColor: Colors.red),
                                      );
                                    }
                                  },
                                ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ),
          // Pagination Controls
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ElevatedButton(
                onPressed: ledger.currentPage > 1 ? () => ledger.prevPage() : null,
                child: const Text("Previous"),
              ),
              Text("Page ${ledger.currentPage}"),
              ElevatedButton(
                onPressed: ledger.hasNextPage ? () => ledger.nextPage() : null,
                child: const Text("Next"),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showAddTxDialog(BuildContext context, AuthProvider auth, LedgerProvider ledger) {
    if (ledger.members.isEmpty) return;
    _selectedMember = auth.currentUser?.id;
    
    final budgetCategories = ledger.budgets.map((b) => b.category).toSet().toList()..sort();
    final dropdownCategories = budgetCategories.isNotEmpty 
        ? budgetCategories 
        : ["Salary", "Business Income", "Rent Income", "Food", "Education", "Electricity", "Water", "Internet", "Medical", "Transportation", "Entertainment", "Other"];
    
    String selectedCategory = dropdownCategories.first;
    
    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              title: const Text("Log Transaction"),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      value: _txType,
                      items: const [
                        DropdownMenuItem(value: 'Income', child: Text("Income")),
                        DropdownMenuItem(value: 'Expense', child: Text("Expense")),
                      ],
                      onChanged: (val) => setModalState(() => _txType = val!),
                    ),
                    TextField(controller: _descController, decoration: const InputDecoration(labelText: "Description")),
                    TextField(
                      controller: _amountController, 
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: "Amount (Precise decimal supported)"),
                    ),
                    DropdownButtonFormField<String>(
                      value: selectedCategory,
                      decoration: const InputDecoration(labelText: "Category"),
                      items: dropdownCategories.map((c) {
                        return DropdownMenuItem(value: c, child: Text(c));
                      }).toList(),
                      onChanged: (val) => setModalState(() => selectedCategory = val!),
                    ),
                    DropdownButtonFormField<int>(
                      value: _selectedMember,
                      decoration: const InputDecoration(labelText: "Associated Family Member"),
                      items: ledger.members.map((m) {
                        return DropdownMenuItem(value: m.id, child: Text(m.name));
                      }).toList(),
                      onChanged: (val) => setModalState(() => _selectedMember = val),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
                ElevatedButton(
                  onPressed: () async {
                    final tx = Transaction(
                      date: DateTime.now().toIso8601String().split('T').first,
                      type: _txType,
                      category: selectedCategory,
                      memberId: _selectedMember ?? auth.currentUser!.id!,
                      amount: double.tryParse(_amountController.text) ?? 0.0,
                      description: _descController.text,
                      status: 'Completed',
                      familyId: StorageService.instance.currentFamilyId ?? auth.currentUser!.familyId,
                    );
                    final success = await ledger.addTransaction(tx, auth.currentUser!);
                    if (!success && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Google Sheets sync failed. Cache write reverted."), backgroundColor: Colors.red),
                      );
                    }
                    _descController.clear();
                    _amountController.clear();
                    _categoryController.clear();
                    Navigator.pop(ctx);
                  },
                  child: const Text("Record Transaction"),
                ),
              ],
            );
          },
        );
      },
    );
  }
}

// -------------------------------------------------------------
// Sub-View: Members Management
// -------------------------------------------------------------
class MembersView extends StatefulWidget {
  const MembersView({super.key});

  @override
  State<MembersView> createState() => _MembersViewState();
}

class _MembersViewState extends State<MembersView> {
  final _nameController = TextEditingController();
  final _relationController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final ledger = context.watch<LedgerProvider>();
    final auth = context.watch<AuthProvider>();
    final cur = auth.currency;

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Family Members Roles", style: titleStyle(context, size: 20)),
              if (auth.isAdmin) // Only admin can add members
                ElevatedButton.icon(
                  icon: const Icon(Icons.person_add, color: Colors.white),
                  label: const Text("Add Member Profile", style: TextStyle(color: Colors.white)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                  onPressed: () => _showAddMemberDialog(context, auth, ledger),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: GridView.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: MediaQuery.of(context).size.width > 600 ? 3 : 1,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: auth.isAdmin ? 1.7 : 2.2,
              ),
              itemCount: ledger.members.length,
              itemBuilder: (ctx, idx) {
                final mem = ledger.members[idx];
                return Container(
                  padding: const EdgeInsets.all(14.0),
                  decoration: glassDecoration(context),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(mem.name, style: titleStyle(context, size: 16)),
                          Chip(label: Text(mem.relation, style: const TextStyle(fontSize: 11))),
                        ],
                      ),
                      Text("Phone: ${mem.phone}", style: subtitleStyle(context)),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text("Balance: $cur ${mem.balance.toStringAsFixed(2)}", style: titleStyle(context, size: 13, color: Colors.teal)),
                          Text("Contr: $cur ${mem.contribution.toStringAsFixed(2)}", style: titleStyle(context, size: 13)),
                        ],
                      ),
                      if (auth.isAdmin)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton.icon(
                              icon: const Icon(Icons.edit, size: 16, color: Colors.indigoAccent),
                              label: const Text("Edit", style: TextStyle(fontSize: 12, color: Colors.indigoAccent)),
                              onPressed: () => _showEditMemberDialog(context, auth, ledger, mem),
                            ),
                            const SizedBox(width: 8),
                            TextButton.icon(
                              icon: const Icon(Icons.delete, size: 16, color: Colors.redAccent),
                              label: const Text("Delete", style: TextStyle(fontSize: 12, color: Colors.redAccent)),
                              onPressed: () => _showDeleteMemberConfirmation(context, auth, ledger, mem),
                            ),
                          ],
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showAddMemberDialog(BuildContext context, AuthProvider auth, LedgerProvider ledger) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text("Add Family Member Profile"),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: _nameController, decoration: const InputDecoration(labelText: "Display Name")),
                TextField(controller: _relationController, decoration: const InputDecoration(labelText: "Relation (e.g. Son, Wife)")),
                TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: "Phone (Login ID)")),
                TextField(controller: _emailController, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: "Email (Optional)")),
                TextField(controller: _passwordController, obscureText: true, decoration: const InputDecoration(labelText: "Initial Login Password")),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
            ElevatedButton(
              onPressed: () async {
                final newMember = Member(
                  name: _nameController.text,
                  relation: _relationController.text,
                  phone: _phoneController.text,
                  email: _emailController.text,
                  password: _passwordController.text,
                  parentId: auth.currentUser!.id!,
                  familyId: StorageService.instance.currentFamilyId ?? auth.currentUser!.familyId,
                  contribution: 0.0,
                  balance: 0.0,
                );
                final success = await ledger.addMember(newMember, auth.currentUser!);
                if (!success && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Failed to register member on Google Sheets"), backgroundColor: Colors.red),
                  );
                }
                _nameController.clear();
                _relationController.clear();
                _phoneController.clear();
                _emailController.clear();
                _passwordController.clear();
                Navigator.pop(ctx);
              },
              child: const Text("Add Member"),
            ),
          ],
        );
      },
    );
  }

  void _showEditMemberDialog(BuildContext context, AuthProvider auth, LedgerProvider ledger, Member mem) {
    _nameController.text = mem.name;
    _relationController.text = mem.relation;
    _phoneController.text = mem.phone;
    _emailController.text = mem.email;
    _passwordController.text = mem.password;
    final contributionController = TextEditingController(text: mem.contribution.toString());

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text("Edit Member: ${mem.name}"),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: _nameController, decoration: const InputDecoration(labelText: "Display Name")),
                TextField(controller: _relationController, decoration: const InputDecoration(labelText: "Relation (e.g. Son, Wife)")),
                TextField(controller: _phoneController, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: "Phone (Login ID)")),
                TextField(controller: _emailController, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: "Email (Optional)")),
                TextField(controller: _passwordController, obscureText: true, decoration: const InputDecoration(labelText: "Password")),
                TextField(
                  controller: contributionController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: "Monthly Contribution (Decimal allowed)"),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () {
                _nameController.clear();
                _relationController.clear();
                _phoneController.clear();
                _emailController.clear();
                _passwordController.clear();
                Navigator.pop(ctx);
              },
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () async {
                final updatedMember = Member(
                  id: mem.id,
                  name: _nameController.text,
                  relation: _relationController.text,
                  phone: _phoneController.text,
                  email: _emailController.text,
                  password: _passwordController.text,
                  parentId: mem.parentId,
                  familyId: mem.familyId,
                  photo: mem.photo,
                  contribution: double.tryParse(contributionController.text) ?? 0.0,
                  balance: mem.balance,
                );

                final success = await ledger.updateMember(updatedMember, auth.currentUser!);
                if (!success && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Failed to update member on Google Sheets"), backgroundColor: Colors.red),
                  );
                } else if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Member details updated successfully!"), backgroundColor: Colors.green),
                  );
                }

                _nameController.clear();
                _relationController.clear();
                _phoneController.clear();
                _emailController.clear();
                _passwordController.clear();
                Navigator.pop(ctx);
              },
              child: const Text("Save Changes"),
            ),
          ],
        );
      },
    );
  }

  void _showDeleteMemberConfirmation(BuildContext context, AuthProvider auth, LedgerProvider ledger, Member mem) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text("Delete Member Profile?"),
          content: Text("Are you sure you want to delete ${mem.name} from the family list? This action will also delete their credentials."),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () async {
                final success = await ledger.deleteMember(mem.id!, auth.currentUser!);
                if (!success && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Failed to delete member on Google Sheets"), backgroundColor: Colors.red),
                  );
                } else if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Member deleted successfully!"), backgroundColor: Colors.green),
                  );
                }
                Navigator.pop(ctx);
              },
              child: const Text("Delete"),
            ),
          ],
        );
      },
    );
  }
}

// -------------------------------------------------------------
// Sub-View: Budget Cap Tracker
// -------------------------------------------------------------
class BudgetsView extends StatefulWidget {
  const BudgetsView({super.key});

  @override
  State<BudgetsView> createState() => _BudgetsViewState();
}

class _BudgetsViewState extends State<BudgetsView> {
  final _categoryController = TextEditingController();
  final _limitController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final ledger = context.watch<LedgerProvider>();
    final auth = context.watch<AuthProvider>();
    final cur = auth.currency;

    // Calculate spent totals by category
    final Map<String, double> spents = {};
    for (var tx in ledger.transactions) {
      if (tx.type == 'Expense') {
        spents[tx.category] = (spents[tx.category] ?? 0.0) + tx.amount;
      }
    }

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Budget Control Caps", style: titleStyle(context, size: 20)),
              if (auth.isAdmin)
                ElevatedButton.icon(
                  icon: const Icon(Icons.add_chart, color: Colors.white),
                  label: const Text("Add Budget limit", style: TextStyle(color: Colors.white)),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
                  onPressed: () => _showAddBudgetDialog(context, auth, ledger),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.builder(
              itemCount: ledger.budgets.length,
              itemBuilder: (ctx, idx) {
                final b = ledger.budgets[idx];
                final spent = spents[b.category] ?? 0.0;
                final percentage = b.limit > 0 ? (spent / b.limit) : 0.0;
                final isOver = percentage > 0.90;

                return Card(
                  margin: const EdgeInsets.symmetric(vertical: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(b.category, style: titleStyle(context, size: 16)),
                            Text("$cur ${spent.toStringAsFixed(2)} / $cur ${b.limit.toStringAsFixed(2)}"),
                          ],
                        ),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(
                          value: percentage > 1.0 ? 1.0 : percentage,
                          backgroundColor: Colors.white12,
                          color: isOver ? Colors.red : Colors.green,
                        ),
                        if (isOver)
                          const Padding(
                            padding: EdgeInsets.only(top: 8.0),
                            child: Text("Warning: Approaching or Exceeded 90% budget cap limit!", style: TextStyle(color: Colors.red, fontSize: 11)),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void _showAddBudgetDialog(BuildContext context, AuthProvider auth, LedgerProvider ledger) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text("Add Budget Limit"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: _categoryController, decoration: const InputDecoration(labelText: "Category Name (e.g. Groceries)")),
              TextField(
                controller: _limitController, 
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "Monthly cap budget limit (decimal allowed)"),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
            ElevatedButton(
              onPressed: () async {
                final newBudget = Budget(
                  category: _categoryController.text,
                  limit: double.tryParse(_limitController.text) ?? 0.0,
                  familyId: StorageService.instance.currentFamilyId ?? auth.currentUser!.familyId,
                );
                final success = await ledger.setBudget(newBudget, auth.currentUser!);
                if (!success && mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Failed to save budget on Sheets"), backgroundColor: Colors.red),
                  );
                }
                _categoryController.clear();
                _limitController.clear();
                Navigator.pop(ctx);
              },
              child: const Text("Save Budget"),
            ),
          ],
        );
      },
    );
  }
}

// -------------------------------------------------------------
// Sub-View: Debt & Loan Center
// -------------------------------------------------------------
class LoansView extends StatefulWidget {
  const LoansView({super.key});

  @override
  State<LoansView> createState() => _LoansViewState();
}

class _LoansViewState extends State<LoansView> {
  final _personController = TextEditingController();
  final _amountController = TextEditingController();
  final _interestController = TextEditingController();
  final _emiController = TextEditingController();
  final _repayController = TextEditingController();
  final _notesController = TextEditingController();
  String _loanType = 'Given';
  int? _selectedMember;
  int _loansPage = 1;
  int _loansLimit = 10;

  @override
  Widget build(BuildContext context) {
    final ledger = context.watch<LedgerProvider>();
    final auth = context.watch<AuthProvider>();
    final cur = auth.currency;

    final isDark = auth.theme == 'dark';
    final isEPaper = auth.theme == 'e-paper';
    final cardBg = isDark 
        ? const Color(0xFF1E293B) 
        : (isEPaper ? const Color(0xFFFFFFFA) : Colors.white);
    final headerBg = isDark ? const Color(0xFF334155) : const Color(0xFFF8FAFC);
    final borderColor = isDark ? const Color(0xFF475569) : const Color(0xFFE2E8F0);
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.blueGrey[200]! : Colors.grey[600]!;

    // Pagination calculations
    final totalLoans = ledger.loans.length;
    final totalPages = (totalLoans / _loansLimit).ceil();
    final displayedLoans = ledger.loans.skip((_loansPage - 1) * _loansLimit).take(_loansLimit).toList();

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("Loans Portfolio", style: titleStyle(context, size: 20)),
              ElevatedButton.icon(
                icon: const Icon(Icons.add, color: Colors.white, size: 18),
                label: const Text("New Loan Entry", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8.0),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                onPressed: () => _showAddLoanDialog(context, auth, ledger),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SingleChildScrollView(
                scrollDirection: Axis.vertical,
                child: SizedBox(
                  width: 1100,
                  child: Container(
                    decoration: BoxDecoration(
                      color: cardBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: borderColor),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header Row
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                          decoration: BoxDecoration(
                            color: headerBg,
                            borderRadius: const BorderRadius.only(
                              topLeft: Radius.circular(12),
                              topRight: Radius.circular(12),
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(flex: 30, child: _buildTableHeaderText("Person/Bank", subtitleColor)),
                              Expanded(flex: 20, child: _buildTableHeaderText("Type", subtitleColor)),
                              Expanded(flex: 20, child: _buildTableHeaderText("Principal", subtitleColor)),
                              Expanded(flex: 15, child: _buildTableHeaderText("Interest", subtitleColor)),
                              Expanded(flex: 20, child: _buildTableHeaderText("EMI", subtitleColor)),
                              Expanded(flex: 20, child: _buildTableHeaderText("Paid Amount", subtitleColor)),
                              Expanded(flex: 25, child: _buildTableHeaderText("Remaining", subtitleColor)),
                              Expanded(flex: 30, child: _buildTableHeaderText("Due Date", subtitleColor)),
                              Expanded(flex: 35, child: _buildTableHeaderText("Actions", subtitleColor)),
                            ],
                          ),
                        ),
                        // Data Rows
                        if (displayedLoans.isEmpty)
                          Padding(
                            padding: const EdgeInsets.all(32.0),
                            child: Center(
                              child: Text(
                                "No loan entries found.",
                                style: TextStyle(color: subtitleColor, fontSize: 16),
                              ),
                            ),
                          )
                        else
                          ...displayedLoans.map((l) {
                            final interestAmt = l.amount * (l.interest / 100.0);
                            final remaining = (l.amount + interestAmt) - l.paidAmount;

                            final assocMember = ledger.members.firstWhere(
                              (m) => m.id == l.memberId,
                              orElse: () => Member(id: l.memberId, name: "Member ${l.memberId}", relation: "", phone: "", familyId: 0, parentId: 0),
                            );

                            return Container(
                              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                              decoration: BoxDecoration(
                                border: Border(
                                  bottom: BorderSide(color: borderColor),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Expanded(
                                    flex: 30,
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          l.person,
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
                                            color: textColor,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          "Member: ${assocMember.name}",
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: subtitleColor,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Expanded(
                                    flex: 20,
                                    child: Align(
                                      alignment: Alignment.centerLeft,
                                      child: _buildTypeBadge(l.loanType),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 20,
                                    child: Text(
                                      "$cur${l.amount.toStringAsFixed(0)}",
                                      style: TextStyle(color: textColor, fontSize: 14),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 15,
                                    child: Text(
                                      "${l.interest.toStringAsFixed(0)}%",
                                      style: TextStyle(color: textColor, fontSize: 14),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 20,
                                    child: Text(
                                      "$cur${l.emi.toStringAsFixed(0)}/mo",
                                      style: TextStyle(color: textColor, fontSize: 14),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 20,
                                    child: Text(
                                      "$cur${l.paidAmount.toStringAsFixed(2)}",
                                      style: TextStyle(color: textColor, fontSize: 14),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 25,
                                    child: Text(
                                      "$cur${remaining.toStringAsFixed(2)}",
                                      style: TextStyle(
                                        color: textColor,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 30,
                                    child: Text(
                                      l.dueDate,
                                      style: TextStyle(
                                        color: textColor,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 35,
                                    child: Row(
                                      children: [
                                        _buildActionButton("View", const Color(0xFFEEF2FF), const Color(0xFF4338CA), () {
                                          _showDetailsDialog(context, auth, ledger, l);
                                        }),
                                        const SizedBox(width: 8),
                                        _buildActionButton("Repay", const Color(0xFFF3E8FF), const Color(0xFF7E22CE), () {
                                          _showRepayDialog(context, auth, ledger, l);
                                        }),
                                        const SizedBox(width: 8),
                                        if (auth.isAdmin)
                                          GestureDetector(
                                            onTap: () async {
                                              final success = await ledger.deleteLoan(l.id!, auth.currentUser!);
                                              if (!success && mounted) {
                                                ScaffoldMessenger.of(context).showSnackBar(
                                                  const SnackBar(content: Text("Sync failure. Loan delete reverted."), backgroundColor: Colors.red),
                                                );
                                              }
                                            },
                                            child: Container(
                                              padding: const EdgeInsets.all(4),
                                              decoration: const BoxDecoration(
                                                color: Colors.red,
                                                shape: BoxShape.circle,
                                              ),
                                              child: const Icon(
                                                Icons.close,
                                                color: Colors.white,
                                                size: 14,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    "Show ",
                    style: TextStyle(color: subtitleColor, fontSize: 14),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    decoration: BoxDecoration(
                      border: Border.all(color: borderColor),
                      borderRadius: BorderRadius.circular(6),
                      color: cardBg,
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<int>(
                        value: _loansLimit,
                        dropdownColor: cardBg,
                        style: TextStyle(color: textColor, fontSize: 14),
                        items: const [
                          DropdownMenuItem(value: 5, child: Text("5")),
                          DropdownMenuItem(value: 10, child: Text("10")),
                          DropdownMenuItem(value: 20, child: Text("20")),
                          DropdownMenuItem(value: 50, child: Text("50")),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _loansLimit = val;
                              _loansPage = 1;
                            });
                          }
                        },
                      ),
                    ),
                  ),
                  Text(
                    " per page",
                    style: TextStyle(color: subtitleColor, fontSize: 14),
                  ),
                ],
              ),
              Row(
                children: [
                  ElevatedButton(
                    onPressed: _loansPage > 1
                        ? () {
                            setState(() {
                              _loansPage--;
                            });
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEEF2FF),
                      foregroundColor: const Color(0xFF4338CA),
                      disabledBackgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    ),
                    child: const Text(
                      "‹ Prev",
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    "Page $_loansPage of ${totalPages > 0 ? totalPages : 1}",
                    style: TextStyle(
                      color: textColor,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _loansPage < totalPages
                        ? () {
                            setState(() {
                              _loansPage++;
                            });
                          }
                        : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEEF2FF),
                      foregroundColor: const Color(0xFF4338CA),
                      disabledBackgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    ),
                    child: const Text(
                      "Next ›",
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _showAddLoanDialog(BuildContext context, AuthProvider auth, LedgerProvider ledger) {
    if (ledger.members.isEmpty) return;
    _selectedMember = auth.currentUser?.id;

    DateTime selectedDueDate = DateTime.now().add(const Duration(days: 30));
    final dueDateController = TextEditingController(
      text: "${selectedDueDate.day.toString().padLeft(2, '0')}/${selectedDueDate.month.toString().padLeft(2, '0')}/${selectedDueDate.year}",
    );

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              title: const Text("Register Loan Record"),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    DropdownButtonFormField<String>(
                      value: _loanType,
                      decoration: const InputDecoration(labelText: "Loan Type"),
                      items: const [
                        DropdownMenuItem(value: 'Given', child: Text("Given (Debtor)")),
                        DropdownMenuItem(value: 'Taken', child: Text("Taken (Creditor)")),
                      ],
                      onChanged: (val) => setModalState(() => _loanType = val!),
                    ),
                    TextField(controller: _personController, decoration: const InputDecoration(labelText: "Party / Person Name")),
                    TextField(
                      controller: _amountController, 
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: "Principal Loan Amount (decimal supported)"),
                    ),
                    TextField(
                      controller: _interestController, 
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: "Interest rate (%)"),
                    ),
                    TextField(
                      controller: _emiController, 
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: "Target EMI payments amount"),
                    ),
                    DropdownButtonFormField<int>(
                      value: _selectedMember,
                      decoration: const InputDecoration(labelText: "Responsible Member"),
                      items: ledger.members.map((m) {
                        return DropdownMenuItem(value: m.id, child: Text(m.name));
                      }).toList(),
                      onChanged: (val) => setModalState(() => _selectedMember = val),
                    ),
                    TextField(
                      controller: dueDateController,
                      readOnly: true,
                      decoration: const InputDecoration(
                        labelText: "Due Date",
                        suffixIcon: Icon(Icons.calendar_today),
                      ),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: selectedDueDate,
                          firstDate: DateTime(2000),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setModalState(() {
                            selectedDueDate = picked;
                            dueDateController.text =
                                "${picked.day.toString().padLeft(2, '0')}/${picked.month.toString().padLeft(2, '0')}/${picked.year}";
                          });
                        }
                      },
                    ),
                    TextField(
                      controller: _notesController,
                      decoration: const InputDecoration(labelText: "Notes / Description"),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    _personController.clear();
                    _amountController.clear();
                    _interestController.clear();
                    _emiController.clear();
                    _notesController.clear();
                    Navigator.pop(ctx);
                  },
                  child: const Text("Cancel"),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final loan = Loan(
                      person: _personController.text,
                      loanType: _loanType,
                      amount: double.tryParse(_amountController.text) ?? 0.0,
                      interest: double.tryParse(_interestController.text) ?? 0.0,
                      emi: double.tryParse(_emiController.text) ?? 0.0,
                      dueDate: "${selectedDueDate.year}-${selectedDueDate.month.toString().padLeft(2, '0')}-${selectedDueDate.day.toString().padLeft(2, '0')}",
                      notes: _notesController.text,
                      paymentHistory: [],
                      memberId: _selectedMember ?? auth.currentUser!.id!,
                      familyId: StorageService.instance.currentFamilyId ?? auth.currentUser!.familyId,
                    );
                    final success = await ledger.addLoan(loan, auth.currentUser!);
                    if (!success && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Sync failure. Loan write reverted."), backgroundColor: Colors.red),
                      );
                    }
                    _personController.clear();
                    _amountController.clear();
                    _interestController.clear();
                    _emiController.clear();
                    _notesController.clear();
                    Navigator.pop(ctx);
                  },
                  child: const Text("Register Loan"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showRepayDialog(BuildContext context, AuthProvider auth, LedgerProvider ledger, Loan loan) {
    Member? selectedMember;
    try {
      final membersList = ledger.members.isNotEmpty ? ledger.members : [auth.currentUser!];
      selectedMember = membersList.firstWhere(
        (m) => m.id == auth.currentUser?.id,
        orElse: () => membersList.first,
      );
    } catch (_) {
      selectedMember = auth.currentUser;
    }

    DateTime selectedDate = DateTime.now();
    final dateController = TextEditingController(
      text: "${selectedDate.day.toString().padLeft(2, '0')}/${selectedDate.month.toString().padLeft(2, '0')}/${selectedDate.year}",
    );

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            final isDark = auth.theme == 'dark';
            final isEPaper = auth.theme == 'e-paper';
            final bgColor = isDark 
                ? const Color(0xFF1E293B) 
                : (isEPaper ? const Color(0xFFFFFFFA) : Colors.white);
            final textColor = isDark ? Colors.white : Colors.black87;
            final labelColor = isDark ? Colors.blueGrey[200]! : Colors.grey[600]!;
            final borderColor = isDark ? const Color(0xFF475569) : const Color(0xFFCBD5E1);
            final dropdownItems = ledger.members.isNotEmpty ? ledger.members : [auth.currentUser!];

            return Dialog(
              backgroundColor: bgColor,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16.0),
              ),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 450, maxHeight: 480),
                padding: const EdgeInsets.all(24.0),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "Record Loan Payment",
                          style: TextStyle(
                            fontSize: 20.0,
                            fontWeight: FontWeight.bold,
                            color: textColor,
                          ),
                        ),
                        IconButton(
                          icon: Icon(Icons.close, color: textColor.withOpacity(0.6)),
                          onPressed: () {
                            _repayController.clear();
                            Navigator.pop(ctx);
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 16.0),
                    Text(
                      "Paid By (Family Member)",
                      style: TextStyle(
                        fontSize: 14.0,
                        fontWeight: FontWeight.w600,
                        color: labelColor,
                      ),
                    ),
                    const SizedBox(height: 8.0),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12.0),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(color: borderColor),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<Member>(
                          value: selectedMember,
                          dropdownColor: bgColor,
                          isExpanded: true,
                          style: TextStyle(color: textColor, fontSize: 16),
                          items: dropdownItems.map((m) {
                            return DropdownMenuItem<Member>(
                              value: m,
                              child: Text(m.name),
                            );
                          }).toList(),
                          onChanged: (val) {
                            setDialogState(() {
                              selectedMember = val;
                            });
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 16.0),
                    Text(
                      "Repayment Date",
                      style: TextStyle(
                        fontSize: 14.0,
                        fontWeight: FontWeight.w600,
                        color: labelColor,
                      ),
                    ),
                    const SizedBox(height: 8.0),
                    TextField(
                      controller: dateController,
                      readOnly: true,
                      style: TextStyle(color: textColor),
                      decoration: InputDecoration(
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8.0),
                          borderSide: BorderSide(color: borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8.0),
                          borderSide: BorderSide(color: borderColor),
                        ),
                        suffixIcon: Icon(Icons.calendar_today, color: labelColor),
                      ),
                      onTap: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: selectedDate,
                          firstDate: DateTime(2000),
                          lastDate: DateTime(2100),
                        );
                        if (picked != null) {
                          setDialogState(() {
                            selectedDate = picked;
                            dateController.text =
                                "${picked.day.toString().padLeft(2, '0')}/${picked.month.toString().padLeft(2, '0')}/${picked.year}";
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 16.0),
                    Text(
                      "Amount Paid",
                      style: TextStyle(
                        fontSize: 14.0,
                        fontWeight: FontWeight.w600,
                        color: labelColor,
                      ),
                    ),
                    const SizedBox(height: 8.0),
                    TextField(
                      controller: _repayController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: TextStyle(color: textColor),
                      decoration: InputDecoration(
                        hintText: "Enter amount",
                        hintStyle: TextStyle(color: labelColor.withOpacity(0.6)),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8.0),
                          borderSide: BorderSide(color: borderColor),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8.0),
                          borderSide: BorderSide(color: borderColor),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24.0),
                    SizedBox(
                      width: double.infinity,
                      height: 48.0,
                      child: ElevatedButton(
                        onPressed: () async {
                          final amt = double.tryParse(_repayController.text) ?? 0.0;
                          if (amt <= 0) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text("Please enter a valid amount.")),
                            );
                            return;
                          }
                          final dateStr =
                              "${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}";

                          final success = await ledger.logLoanRepayment(
                            loan.id!,
                            amt,
                            auth.currentUser!,
                            paidByMemberId: selectedMember?.id,
                            dateStr: dateStr,
                          );

                          if (!success && mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("Sync failure. Repayment logged locally but rollback occurred."),
                                backgroundColor: Colors.red,
                              ),
                            );
                          }
                          _repayController.clear();
                          if (context.mounted) {
                            Navigator.pop(ctx);
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF4F46E5),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8.0),
                          ),
                        ),
                        child: const Text(
                          "Submit Repayment",
                          style: TextStyle(
                            fontSize: 16.0,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
          },
        );
      },
    );
  }

  Widget _buildTypeBadge(String type) {
    final isTaken = type == 'Taken';
    final bgColor = isTaken ? const Color(0xFFFEE2E2) : const Color(0xFFD1FAE5);
    final textColor = isTaken ? const Color(0xFFEF4444) : const Color(0xFF10B981);
    final text = isTaken ? 'TAKEN' : 'GIVEN';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: textColor,
          fontWeight: FontWeight.bold,
          fontSize: 11,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildActionButton(String label, Color bgColor, Color textColor, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: textColor,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ),
    );
  }

  Widget _buildTableHeaderText(String label, Color color) {
    return Text(
      label,
      style: TextStyle(
        color: color,
        fontWeight: FontWeight.bold,
        fontSize: 13,
      ),
    );
  }

  void _showDetailsDialog(BuildContext context, AuthProvider auth, LedgerProvider ledger, Loan loan) {
    showDialog(
      context: context,
      builder: (ctx) {
        final isDark = auth.theme == 'dark';
        final isEPaper = auth.theme == 'e-paper';
        final bgColor = isDark 
            ? const Color(0xFF1E293B) 
            : (isEPaper ? const Color(0xFFFFFFFA) : Colors.white);
        final textColor = isDark ? Colors.white : Colors.black87;
        final labelColor = isDark ? Colors.blueGrey[200]! : Colors.grey[600]!;
        final borderColor = isDark ? const Color(0xFF475569) : const Color(0xFFE2E8F0);
        final cur = auth.currency;

        final interestAmt = loan.amount * (loan.interest / 100.0);
        final outstanding = (loan.amount + interestAmt) - loan.paidAmount;

        final assocMember = ledger.members.firstWhere(
          (m) => m.id == loan.memberId,
          orElse: () => Member(id: loan.memberId, name: "Member ${loan.memberId}", relation: "", phone: "", familyId: 0, parentId: 0),
        );

        return Dialog(
          backgroundColor: bgColor,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16.0)),
          child: Container(
            constraints: const BoxConstraints(maxWidth: 550, maxHeight: 520),
            padding: const EdgeInsets.all(24.0),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          "${loan.person} Loan Details",
                          style: TextStyle(
                            fontSize: 20.0,
                            fontWeight: FontWeight.bold,
                            color: textColor,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, color: textColor.withOpacity(0.6)),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16.0),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildDetailItem("Associated Member:", assocMember.name, textColor, labelColor),
                            const SizedBox(height: 12.0),
                            _buildDetailItem("Principal Amount:", "$cur${loan.amount.toStringAsFixed(2)}", textColor, labelColor),
                            const SizedBox(height: 12.0),
                            _buildDetailItem("Monthly EMI Amount:", "$cur${loan.emi.toStringAsFixed(2)}", textColor, labelColor),
                            const SizedBox(height: 12.0),
                            _buildDetailItem("Total Paid Amount:", "$cur${loan.paidAmount.toStringAsFixed(2)}", textColor, labelColor),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildDetailItem("Loan Type:", loan.loanType == 'Taken' ? "Borrowed (Taken)" : "Lent (Given)", textColor, labelColor),
                            const SizedBox(height: 12.0),
                            _buildDetailItem("Interest Rate:", "${loan.interest.toStringAsFixed(2)}% Simple", textColor, labelColor),
                            const SizedBox(height: 12.0),
                            _buildDetailItem("Due Date:", loan.dueDate, textColor, labelColor),
                            const SizedBox(height: 12.0),
                            _buildDetailItem("Outstanding Balance:", "$cur${outstanding.toStringAsFixed(2)}", textColor, labelColor),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16.0),
                  Text(
                    "Notes:",
                    style: TextStyle(
                      fontSize: 14.0,
                      fontWeight: FontWeight.bold,
                      color: labelColor,
                    ),
                  ),
                  const SizedBox(height: 4.0),
                  Text(
                    loan.notes.isNotEmpty ? loan.notes : "-",
                    style: TextStyle(fontSize: 15.0, color: textColor),
                  ),
                  const SizedBox(height: 24.0),
                  Text(
                    "Repayment Ledger History",
                    style: TextStyle(
                      fontSize: 16.0,
                      fontWeight: FontWeight.bold,
                      color: textColor,
                    ),
                  ),
                  const SizedBox(height: 8.0),
                  Divider(color: borderColor),
                  const SizedBox(height: 8.0),
                  if (loan.paymentHistory.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16.0),
                      child: Center(
                        child: Text(
                          "No repayments logged yet.",
                          style: TextStyle(color: labelColor.withOpacity(0.8)),
                        ),
                      ),
                    )
                  else
                    Table(
                      columnWidths: const {
                        0: FlexColumnWidth(1.2),
                        1: FlexColumnWidth(1.2),
                        2: FlexColumnWidth(1),
                      },
                      children: [
                        TableRow(
                          children: [
                            _buildTableHeaderCell("Payment Date", labelColor),
                            _buildTableHeaderCell("Paid By", labelColor),
                            _buildTableHeaderCell("Amount Settled", labelColor),
                          ],
                        ),
                        ...loan.paymentHistory.reversed.map((h) {
                          final hMap = Map<String, dynamic>.from(h as Map);
                          final dateVal = hMap['date']?.toString() ?? '-';
                          final amtVal = double.tryParse(hMap['amount']?.toString() ?? '0') ?? 0.0;
                          final mId = int.tryParse(hMap['memberId']?.toString() ?? '0') ?? 0;
                          final payer = ledger.members.firstWhere(
                            (m) => m.id == mId,
                            orElse: () => Member(id: mId, name: "Member $mId", relation: "", phone: "", familyId: 0, parentId: 0),
                          );

                          return TableRow(
                            children: [
                              _buildTableCell(dateVal, textColor),
                              _buildTableCell(payer.name, textColor),
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8.0),
                                child: Text(
                                  "$cur${amtVal.toStringAsFixed(2)}",
                                  style: const TextStyle(
                                    color: Colors.green,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14.0,
                                  ),
                                ),
                              ),
                            ],
                          );
                        }).toList(),
                      ],
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetailItem(String title, String value, Color textColor, Color labelColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 13.0,
            fontWeight: FontWeight.bold,
            color: labelColor,
          ),
        ),
        const SizedBox(height: 2.0),
        Text(
          value,
          style: TextStyle(
            fontSize: 15.0,
            color: textColor,
          ),
        ),
      ],
    );
  }

  Widget _buildTableHeaderCell(String text, Color labelColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Text(
        text,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: labelColor,
          fontSize: 13.0,
        ),
      ),
    );
  }

  Widget _buildTableCell(String text, Color textColor) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Text(
        text,
        style: TextStyle(color: textColor, fontSize: 14.0),
      ),
    );
  }
}

// -------------------------------------------------------------
// Sub-View: Settings & Backups
// -------------------------------------------------------------
class SettingsView extends StatefulWidget {
  const SettingsView({super.key});

  @override
  State<SettingsView> createState() => _SettingsViewState();
}

class _SettingsViewState extends State<SettingsView> {
  late TextEditingController _nameController;
  late TextEditingController _symbolController;
  late TextEditingController _urlController;
  late TextEditingController _secretController;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    _nameController = TextEditingController(text: auth.familyName);
    _symbolController = TextEditingController(text: auth.currency);
    _urlController = TextEditingController(text: StorageService.instance.sheetsUrl);
    _secretController = TextEditingController(text: StorageService.instance.jwtSecret);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return ListView(
      padding: const EdgeInsets.all(16.0),
      children: [
        Text("Preferences & Configuration", style: titleStyle(context, size: 20)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16.0),
          decoration: glassDecoration(context),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Theme Selector Mode", style: titleStyle(context, size: 16)),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildThemeButton(context, 'dark', 'Dark Glow'),
                  const SizedBox(width: 8),
                  _buildThemeButton(context, 'light', 'Light Minimal'),
                  const SizedBox(width: 8),
                  _buildThemeButton(context, 'e-paper', 'E-Paper Ink'),
                ],
              ),
              const SizedBox(height: 20),
              TextField(controller: _nameController, decoration: const InputDecoration(labelText: "Family Workspace Name")),
              const SizedBox(height: 12),
              TextField(controller: _symbolController, decoration: const InputDecoration(labelText: "Currency symbol")),
              const SizedBox(height: 12),
              TextField(
                controller: _urlController,
                decoration: const InputDecoration(labelText: "Google Sheets WebApp Script URL"),
                enabled: auth.isAdmin,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _secretController,
                decoration: const InputDecoration(labelText: "Private JWT Secret Token"),
                enabled: auth.isAdmin,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  auth.updateConfig(
                    name: _nameController.text,
                    symbol: _symbolController.text,
                    themeMode: auth.theme,
                  );
                  StorageService.instance.sheetsUrl = _urlController.text;
                  StorageService.instance.jwtSecret = _secretController.text;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Configurations updated successfully!")),
                  );
                },
                child: const Text("Save System Settings"),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        
        // Backups Section
        Container(
          padding: const EdgeInsets.all(16.0),
          decoration: glassDecoration(context),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Offline Backup & recovery center", style: titleStyle(context, size: 16)),
              const SizedBox(height: 8),
              Text("Export local databases cache to a secure file. You can import the file to restore operations.", style: subtitleStyle(context)),
              const SizedBox(height: 16),
              Row(
                children: [
                  ElevatedButton.icon(
                    icon: const Icon(Icons.download),
                    label: const Text("Export encrypted backup"),
                    onPressed: () async {
                      final backup = await StorageService.instance.exportBackup();
                      // Copy backup string to Clipboard
                      showDialog(
                        context: context,
                        builder: (ctx) {
                          return AlertDialog(
                            title: const Text("Export Completed"),
                            content: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text("Here is your secure encrypted backup text. Copy and save this string safely:"),
                                const SizedBox(height: 8),
                                SelectableText(
                                  backup,
                                  style: const TextStyle(fontFamily: 'monospace', fontSize: 10),
                                ),
                              ],
                            ),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("OK")),
                            ],
                          );
                        },
                      );
                    },
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton.icon(
                    icon: const Icon(Icons.upload),
                    label: const Text("Import database backup"),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                    onPressed: () => _showImportBackupDialog(context),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showImportBackupDialog(BuildContext context) {
    final textController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text("Import Database Backup"),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text("Paste the secure encrypted backup string below:"),
              const SizedBox(height: 8),
              TextField(
                controller: textController,
                maxLines: 5,
                decoration: const InputDecoration(border: OutlineInputBorder()),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
            ElevatedButton(
              onPressed: () async {
                final success = await StorageService.instance.importBackup(textController.text);
                if (success) {
                  if (mounted) {
                    context.read<LedgerProvider>().fetchAllData();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Database restored successfully!")),
                    );
                  }
                } else {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Failed to restore backup. Check the string validity."), backgroundColor: Colors.red),
                    );
                  }
                }
                Navigator.pop(ctx);
              },
              child: const Text("Restore Backup"),
            ),
          ],
        );
      },
    );
  }

  Widget _buildThemeButton(BuildContext context, String mode, String label) {
    final auth = context.watch<AuthProvider>();
    final active = auth.theme == mode;
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: active ? const Color(0xFF6366F1) : Colors.grey.shade800,
      ),
      onPressed: () => auth.updateTheme(mode),
      child: Text(label, style: const TextStyle(color: Colors.white)),
    );
  }
}
