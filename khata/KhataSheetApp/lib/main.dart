import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'views.dart';
import 'providers.dart';

void main() {
  debugPrint("BOOTSTRAP: main() started");
  runApp(const KhataApp());
  debugPrint("BOOTSTRAP: runApp() completed");
}

class KhataApp extends StatelessWidget {
  const KhataApp({super.key});

  @override
  Widget build(BuildContext context) {
    debugPrint("BOOTSTRAP: KhataApp.build() called");
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => LedgerProvider()),
      ],
      child: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          final themeMode = auth.theme;
          debugPrint("BOOTSTRAP: Consumer<AuthProvider> builder called with theme: $themeMode");
          
          ThemeData appTheme;
          if (themeMode == 'e-paper') {
            appTheme = ThemeData(
              brightness: Brightness.light,
              scaffoldBackgroundColor: const Color(0xFFF5F5F0),
              primaryColor: Colors.black,
              useMaterial3: true,
              cardTheme: const CardThemeData(
                color: Colors.white,
                elevation: 0,
              ),
            );
          } else if (themeMode == 'light') {
            appTheme = ThemeData(
              brightness: Brightness.light,
              scaffoldBackgroundColor: const Color(0xFFF8FAFC),
              primaryColor: const Color(0xFF6366F1),
              useMaterial3: true,
              cardTheme: const CardThemeData(
                color: Colors.white,
                elevation: 2,
                shadowColor: Colors.black12,
              ),
            );
          } else {
            // Default: Dark Mode
            appTheme = ThemeData(
              brightness: Brightness.dark,
              scaffoldBackgroundColor: const Color(0xFF0F172A),
              primaryColor: const Color(0xFF6366F1),
              useMaterial3: true,
              cardTheme: const CardThemeData(
                color: Color(0xFF1E293B),
                elevation: 2,
              ),
            );
          }

          return MaterialApp(
            title: 'Family Khata',
            theme: appTheme,
            home: const MainGatekeeper(),
            debugShowCheckedModeBanner: false,
          );
        },
      ),
    );
  }
}

class MainGatekeeper extends StatelessWidget {
  const MainGatekeeper({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    debugPrint("BOOTSTRAP: MainGatekeeper.build() called. isAuthenticated: ${auth.isAuthenticated}");
    return auth.isAuthenticated ? const MainViewFrame() : const AuthLockView();
  }
}

