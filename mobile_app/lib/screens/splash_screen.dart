import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/crypto_service.dart';
import '../core/session.dart';
import '../core/ws_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _decide();
  }

  Future<void> _decide() async {
    await Future.wait([Session.instance.restore(), CryptoService.instance.init()]);
    if (Session.instance.isLoggedIn) WsService.instance.connect();
    if (!mounted) return;
    context.go(Session.instance.isLoggedIn ? '/characters' : '/login');
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Text('💕', style: TextStyle(fontSize: 56)),
      ),
    );
  }
}
