import '../core/api_client.dart';

class Plan {
  Plan({
    required this.id,
    required this.planName,
    required this.displayName,
    required this.priceMonthly,
    required this.monthlyCredits,
    required this.isUnlimited,
  });

  final int id;
  final String planName;
  final String displayName;
  final num priceMonthly;
  final int monthlyCredits;
  final bool isUnlimited;

  factory Plan.fromJson(Map<String, dynamic> json) => Plan(
        id: json['id'],
        planName: json['plan_name'] ?? '',
        displayName: json['display_name'] ?? json['plan_name'] ?? '',
        priceMonthly: json['price_monthly'] ?? 0,
        monthlyCredits: json['monthly_credits'] ?? 0,
        isUnlimited: json['is_unlimited'] == true,
      );
}

class PaymentService {
  static final _dio = ApiClient.instance.dio;

  static Future<List<Plan>> getPlans() async {
    final res = await _dio.get('/api/payment/plans');
    return (res.data as List).map((e) => Plan.fromJson(e)).toList();
  }
}
