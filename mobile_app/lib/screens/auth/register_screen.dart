import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../services/auth_service.dart';
import '../../services/google_auth_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>();

  final _name = TextEditingController();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _age = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  final _otp = TextEditingController();

  int _step = 1;
  bool _loading = false;
  bool _googleLoading = false;
  String? _error;
  String? _success;
  int _cooldown = 0;
  int _expiry = 300;
  Timer? _cooldownTimer;
  Timer? _expiryTimer;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _expiryTimer?.cancel();
    _name.dispose();
    _username.dispose();
    _email.dispose();
    _age.dispose();
    _password.dispose();
    _confirm.dispose();
    _otp.dispose();
    super.dispose();
  }

  void _startTimers({required int cooldown, required int expiry}) {
    _cooldown = cooldown;
    _expiry = expiry;
    _cooldownTimer?.cancel();
    _expiryTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_cooldown <= 0) {
        t.cancel();
        return;
      }
      setState(() => _cooldown--);
    });
    _expiryTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_expiry <= 0) {
        t.cancel();
        return;
      }
      setState(() => _expiry--);
    });
  }

  String _fmt(int s) => '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _googleLoading = true;
      _error = null;
    });
    try {
      final signedIn = await GoogleAuthService.signIn();
      if (signedIn && mounted) context.go('/characters');
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Google Sign-In failed'));
    } finally {
      if (mounted) setState(() => _googleLoading = false);
    }
  }

  Future<void> _sendOtp() async {
    if (!_formKey.currentState!.validate()) return;
    if (_password.text != _confirm.text) {
      setState(() => _error = 'Passwords do not match');
      return;
    }
    final age = int.tryParse(_age.text) ?? 0;
    if (age < 18) {
      setState(() => _error = 'You must be at least 18 years old to join.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    try {
      final d = await AuthService.sendRegisterOtp(email: _email.text.trim(), username: _username.text.trim());
      _startTimers(cooldown: d['cooldown_seconds'] ?? 60, expiry: d['expires_in_seconds'] ?? 300);
      setState(() {
        _success = d['message'] ?? 'Verification code sent to your email.';
        _step = 2;
      });
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Failed to send verification code.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resendOtp() async {
    if (_cooldown > 0) return;
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    try {
      final d = await AuthService.sendRegisterOtp(email: _email.text.trim(), username: _username.text.trim());
      _startTimers(cooldown: d['cooldown_seconds'] ?? 60, expiry: d['expires_in_seconds'] ?? 300);
      setState(() => _success = 'A fresh verification code has been sent!');
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Failed to resend code.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _verifyAndRegister() async {
    if (_otp.text.trim().length != 6) {
      setState(() => _error = 'Please enter the 6-digit verification code.');
      return;
    }
    if (_expiry <= 0) {
      setState(() => _error = 'Verification code has expired. Please resend.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await AuthService.register(
        name: _name.text.trim(),
        username: _username.text.trim(),
        email: _email.text.trim(),
        age: int.tryParse(_age.text) ?? 18,
        password: _password.text,
        otp: _otp.text.trim(),
      );
      if (mounted) context.go('/characters');
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Verification failed. Please check the code.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_step == 1 ? 'Create your account' : 'Verify your email')),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: _step == 1 ? _buildStepOne() : _buildStepTwo(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepOne() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Full Name'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _username,
            decoration: const InputDecoration(labelText: 'Username (unique)', hintText: 'cool_user99'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
            validator: (v) => (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _age,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Age', hintText: '18+'),
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password', hintText: 'Min 8 chars, 1 number'),
            validator: (v) => (v == null || v.length < 8) ? 'Min 8 characters' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _confirm,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Confirm Password'),
            validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            _errorBanner(_error!),
          ],
          const SizedBox(height: 20),
          GradientButton(
            label: _loading ? 'Sending code…' : 'Continue & Verify Email →',
            loading: _loading,
            onPressed: _loading ? null : _sendOtp,
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _googleLoading ? null : _handleGoogleSignIn,
            icon: _googleLoading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('G', style: TextStyle(fontWeight: FontWeight.w800)),
            label: const Text('Continue with Google'),
            style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Already have an account? ', style: TextStyle(color: AppColors.textFaint)),
              GestureDetector(
                onTap: () => context.pop(),
                child: const Text('Sign In', style: TextStyle(color: AppColors.pink, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStepTwo() {
    return Form(
      key: _otpFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('We sent a 6-digit code to ${_email.text}',
              textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: (_expiry > 60 ? Colors.blue : AppColors.pink).withOpacity(0.08),
              border: Border.all(color: (_expiry > 60 ? Colors.blue : AppColors.pink).withOpacity(0.25)),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('⏱️ Code expires in', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                Text(_fmt(_expiry),
                    style: TextStyle(
                        color: _expiry > 60 ? Colors.lightBlueAccent : Colors.redAccent,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        fontFamily: 'monospace')),
              ],
            ),
          ),
          const SizedBox(height: 20),
          TextFormField(
            controller: _otp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: 8),
            decoration: const InputDecoration(counterText: ''),
          ),
          if (_success != null) ...[
            const SizedBox(height: 10),
            _successBanner(_success!),
          ],
          if (_error != null) ...[
            const SizedBox(height: 10),
            _errorBanner(_error!),
          ],
          const SizedBox(height: 20),
          GradientButton(
            label: _loading ? 'Verifying…' : 'Verify & Create Account ✨',
            loading: _loading,
            onPressed: (_loading || _expiry <= 0) ? null : _verifyAndRegister,
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: () => setState(() => _step = 1),
                child: const Text('← Edit details', style: TextStyle(color: AppColors.textSecondary)),
              ),
              TextButton(
                onPressed: _cooldown > 0 ? null : _resendOtp,
                child: Text(
                  _cooldown > 0 ? 'Resend in ${_cooldown}s' : 'Resend Code',
                  style: TextStyle(color: _cooldown > 0 ? AppColors.textFaint : AppColors.pink, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _errorBanner(String msg) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.pink.withOpacity(0.1),
          border: Border.all(color: AppColors.pink.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(msg, style: const TextStyle(color: AppColors.pink, fontSize: 13)),
      );

  Widget _successBanner(String msg) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.green.withOpacity(0.1),
          border: Border.all(color: Colors.green.withOpacity(0.3)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text('✅ $msg', style: const TextStyle(color: Colors.lightGreenAccent, fontSize: 13)),
      );
}
