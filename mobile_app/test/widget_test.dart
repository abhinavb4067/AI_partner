import 'package:flutter_test/flutter_test.dart';

import 'package:ai_girlfriend_app/main.dart';

void main() {
  testWidgets('App boots to the splash screen', (WidgetTester tester) async {
    await tester.pumpWidget(const AiGirlfriendApp());
    await tester.pump();
    expect(find.text('💕'), findsOneWidget);
  });
}
