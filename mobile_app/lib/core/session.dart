import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Holds the logged-in user's token + cached profile summary, mirroring what
/// the web app keeps in localStorage (token / user_id / user_name / user_info).
class Session extends ChangeNotifier {
  Session._();
  static final Session instance = Session._();

  static const _storage = FlutterSecureStorage();

  String? token;
  String? userId;
  String? userName;
  String? email;
  String? planName;
  int? creditsRemaining;
  bool isUnlimited = false;

  bool get isLoggedIn => token != null && token!.isNotEmpty;

  Future<void> restore() async {
    token = await _storage.read(key: 'token');
    userId = await _storage.read(key: 'user_id');
    userName = await _storage.read(key: 'user_name');
    email = await _storage.read(key: 'email');
    planName = await _storage.read(key: 'plan_name');
    final credits = await _storage.read(key: 'credits_remaining');
    creditsRemaining = credits != null ? int.tryParse(credits) : null;
    isUnlimited = (await _storage.read(key: 'is_unlimited')) == 'true';
    notifyListeners();
  }

  Future<void> setFromLoginResponse(Map<String, dynamic> d) async {
    token = d['access_token'] as String?;
    userId = d['user_id'] as String?;
    userName = d['name'] as String?;
    email = d['email'] as String?;
    planName = d['plan_name'] as String?;
    creditsRemaining = d['credits_remaining'] as int?;
    isUnlimited = d['is_unlimited'] == true;

    await _storage.write(key: 'token', value: token);
    await _storage.write(key: 'user_id', value: userId);
    await _storage.write(key: 'user_name', value: userName);
    if (email != null) await _storage.write(key: 'email', value: email);
    if (planName != null) await _storage.write(key: 'plan_name', value: planName);
    if (creditsRemaining != null) {
      await _storage.write(key: 'credits_remaining', value: creditsRemaining.toString());
    }
    await _storage.write(key: 'is_unlimited', value: isUnlimited.toString());

    notifyListeners();
  }

  void updateCredits(int credits) {
    creditsRemaining = credits;
    _storage.write(key: 'credits_remaining', value: credits.toString());
    notifyListeners();
  }

  Future<void> logout() async {
    token = null;
    userId = null;
    userName = null;
    email = null;
    planName = null;
    creditsRemaining = null;
    isUnlimited = false;
    await _storage.deleteAll();
    notifyListeners();
  }
}
