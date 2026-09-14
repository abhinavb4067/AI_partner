import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/env.dart';
import '../../core/session.dart';
import '../../core/theme.dart';

/// Opens the deployed React web app's Pricing/PaymentModal flow inside an
/// in-app WebView, authenticated as the same user, so we reuse the existing
/// payment-gateway integration instead of re-implementing it natively.
///
/// The web app seeds `?mobile_token=`/`?mobile_uid=` into localStorage as
/// `token`/`user_id` before its first render (see frontend/src/main.jsx),
/// so the WebView opens already signed in as this same user — no second
/// login required.
class PaymentWebviewScreen extends StatefulWidget {
  const PaymentWebviewScreen({super.key, this.planName});
  final String? planName;

  @override
  State<PaymentWebviewScreen> createState() => _PaymentWebviewScreenState();
}

class _PaymentWebviewScreenState extends State<PaymentWebviewScreen> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    final token = Session.instance.token ?? '';
    final userId = Session.instance.userId ?? '';
    final uri = Uri.parse('${Env.webAppUrl}/pricing').replace(queryParameters: {
      if (token.isNotEmpty) 'mobile_token': token,
      if (userId.isNotEmpty) 'mobile_uid': userId,
      if (widget.planName != null) 'plan': widget.planName,
    });

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) => setState(() => _loading = false),
        onNavigationRequest: (request) {
          if (request.url.contains('/select-character') && request.url.contains('payment=success')) {
            // Payment completed — pop back into the native app.
            Future.microtask(() {
              if (mounted) context.go('/characters');
            });
            return NavigationDecision.prevent;
          }
          return NavigationDecision.navigate;
        },
      ))
      ..loadRequest(uri);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Checkout'),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => context.pop()),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading) const Center(child: CircularProgressIndicator(color: AppColors.pink)),
        ],
      ),
    );
  }
}
