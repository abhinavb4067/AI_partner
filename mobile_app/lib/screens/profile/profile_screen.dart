import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/env.dart';
import '../../core/session.dart';
import '../../core/theme.dart';
import '../../services/google_auth_service.dart';
import '../../services/profile_service.dart';
import '../../widgets/gradient_avatar.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ProfileService.getProfile();
      setState(() => _profile = data);
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Failed to load profile.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    // Best-effort: tell the backend to forget this device's push token
    // first, while Session.instance.token is still set (ApiClient's
    // interceptor attaches it automatically) — so a shared/resold device
    // stops receiving this account's notifications after logout.
    try {
      await ApiClient.instance.dio.delete('/api/profile/fcm-token');
    } catch (_) {
      // Ignore — logout must proceed either way.
    }
    // Best-effort: also end the native Google session so the account picker
    // doesn't silently re-auth the same account next time. Session logout
    // (clearing the app's own token) must still happen even if this fails.
    try {
      await GoogleAuthService.signOut();
    } catch (_) {
      // Ignore — user may not have signed in via Google, or Play Services
      // may be unavailable; either way it shouldn't block logging out.
    }
    await Session.instance.logout();
    if (mounted) context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.pink))
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.textSecondary)))
              : RefreshIndicator(
                  color: AppColors.pink,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      Center(
                        child: Column(
                          children: [
                            GradientAvatar(
                              name: _profile?['name'] ?? '?',
                              photoUrl: Env.media(_profile?['avatar_url']),
                              size: 88,
                              ring: true,
                            ),
                            const SizedBox(height: 14),
                            Text(_profile?['name'] ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                            Text('@${_profile?['username'] ?? ''}', style: const TextStyle(color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      _buildPlanCard(),
                      const SizedBox(height: 20),
                      _sectionTitle('Account'),
                      _tile(Icons.email_outlined, 'Email', _profile?['email'] ?? '—'),
                      _tile(Icons.chat_bubble_outline, 'Messages sent', '${_profile?['total_messages'] ?? 0}'),
                      const SizedBox(height: 20),
                      _sectionTitle('Manage'),
                      _actionTile(Icons.workspace_premium_outlined, 'Upgrade / Plans', () => context.push('/pricing')),
                      _actionTile(Icons.logout, 'Log out', _logout, danger: true),
                    ],
                  ),
                ),
    );
  }

  Widget _buildPlanCard() {
    final plan = _profile?['plan'] as Map<String, dynamic>?;
    final unlimited = _profile?['is_unlimited'] == true;
    final credits = _profile?['credits_remaining'];
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(gradient: AppColors.gradient, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          const Icon(Icons.diamond, color: Colors.white, size: 28),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(plan?['display_name'] ?? 'Free', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 2),
                Text(
                  unlimited ? 'Unlimited messages' : '$credits credits remaining',
                  style: const TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => context.push('/pricing'),
            style: TextButton.styleFrom(backgroundColor: Colors.white.withOpacity(0.15), foregroundColor: Colors.white),
            child: const Text('Upgrade'),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String title) => Padding(
        padding: const EdgeInsets.only(bottom: 8, left: 4),
        child: Text(title, style: const TextStyle(color: AppColors.textFaint, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
      );

  Widget _tile(IconData icon, String label, String value) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(color: AppColors.bgCard, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Icon(icon, color: AppColors.textSecondary, size: 20),
            const SizedBox(width: 14),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 14))),
            Text(value, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ],
        ),
      );

  Widget _actionTile(IconData icon, String label, VoidCallback onTap, {bool danger = false}) => Material(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Icon(icon, color: danger ? AppColors.pink : AppColors.textSecondary, size: 20),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(label, style: TextStyle(fontSize: 14, color: danger ? AppColors.pink : AppColors.textPrimary)),
                ),
                const Icon(Icons.chevron_right, color: AppColors.textFaint, size: 18),
              ],
            ),
          ),
        ),
      );
}
