import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../services/payment_service.dart';

class PricingScreen extends StatefulWidget {
  const PricingScreen({super.key});

  @override
  State<PricingScreen> createState() => _PricingScreenState();
}

class _PricingScreenState extends State<PricingScreen> {
  List<Plan> _plans = [];
  bool _loading = true;
  String? _error;

  static const _icons = {'free': '🆓', 'starter': '⭐', 'pro': '💜', 'elite': '👑'};
  static const _colors = {
    'free': AppColors.textFaint,
    'starter': Color(0xFF2196F3),
    'pro': AppColors.purple,
    'elite': Color(0xFFFFD700),
  };

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
      final plans = await PaymentService.getPlans();
      setState(() => _plans = plans);
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Failed to load plans.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _subscribe(Plan plan) {
    if (plan.priceMonthly == 0) {
      context.go('/characters');
      return;
    }
    // Real-money checkout is handled by the existing, already-integrated web
    // payment flow — opened in an in-app browser rather than reimplemented
    // natively (avoids app-store in-app-purchase requirements for a web
    // subscription product).
    context.push('/pricing/checkout?plan=${Uri.encodeComponent(plan.planName)}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Choose Your Plan')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.pink))
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.textSecondary)))
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    const Text('Simple, Transparent Pricing', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    const Text('Credit-based system. Upgrade, downgrade or cancel anytime.',
                        style: TextStyle(color: AppColors.textSecondary)),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.pink.withOpacity(0.08),
                        border: Border.all(color: AppColors.pink.withOpacity(0.2)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Text('💎 1 credit/message · 📸 5 credits/photo · 🎤 2 credits/voice',
                          style: TextStyle(color: AppColors.pink, fontSize: 12.5)),
                    ),
                    const SizedBox(height: 20),
                    ..._plans.map(_buildPlanCard),
                    const SizedBox(height: 12),
                    const Text('Payments are secure & encrypted · Cancel anytime',
                        textAlign: TextAlign.center, style: TextStyle(color: AppColors.textFaint, fontSize: 12)),
                  ],
                ),
    );
  }

  Widget _buildPlanCard(Plan plan) {
    final color = _colors[plan.planName] ?? AppColors.textFaint;
    final icon = _icons[plan.planName] ?? '✨';
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Text(icon, style: const TextStyle(fontSize: 30)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(plan.displayName, style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                Text(
                  plan.isUnlimited ? 'Unlimited messages' : '${plan.monthlyCredits} credits / month',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
                const SizedBox(height: 6),
                Text(
                  plan.priceMonthly == 0 ? 'Free' : '₹${plan.priceMonthly.toStringAsFixed(0)}/mo',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: () => _subscribe(plan),
            style: ElevatedButton.styleFrom(backgroundColor: color == AppColors.textFaint ? AppColors.bgElevated : color),
            child: Text(plan.priceMonthly == 0 ? 'Use' : 'Subscribe'),
          ),
        ],
      ),
    );
  }
}
