import 'package:flutter_test/flutter_test.dart';
import 'package:khata_sheet_app/main.dart';

void main() {
  testWidgets('App renders login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const KhataApp());
    expect(find.text('₹ Family Khata'), findsOneWidget);
  });
}
