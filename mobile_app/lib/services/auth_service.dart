import '../core/api_client.dart';
import '../core/session.dart';

class AuthService {
  static final _dio = ApiClient.instance.dio;

  static Future<void> login({required String email, required String password}) async {
    final res = await _dio.post('/api/auth/login', data: {'email': email, 'password': password});
    await Session.instance.setFromLoginResponse(res.data as Map<String, dynamic>);
  }

  static Future<Map<String, dynamic>> sendRegisterOtp({
    required String email,
    required String username,
  }) async {
    final res = await _dio.post('/api/auth/send-register-otp', data: {
      'email': email,
      'username': username.toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), ''),
    });
    return res.data as Map<String, dynamic>;
  }

  static Future<void> register({
    required String name,
    required String username,
    required String email,
    required int age,
    required String password,
    required String otp,
  }) async {
    final res = await _dio.post('/api/auth/register', data: {
      'name': name,
      'username': username.toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), ''),
      'email': email,
      'age': age,
      'password': password,
      'otp': otp,
    });
    await Session.instance.setFromLoginResponse(res.data as Map<String, dynamic>);
  }

  /// [idToken] is the Google ID token from `GoogleSignInAuthentication` —
  /// the backend verifies it exactly as it does the web app's
  /// `@react-oauth/google` credential.
  static Future<void> googleLogin(String idToken) async {
    final res = await _dio.post('/api/auth/google-login', data: {'credential': idToken});
    await Session.instance.setFromLoginResponse(res.data as Map<String, dynamic>);
  }

  static Future<Map<String, dynamic>> forgotPassword(String email) async {
    final res = await _dio.post('/api/auth/forgot-password', data: {'email': email});
    return res.data as Map<String, dynamic>;
  }

  static Future<void> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    await _dio.post('/api/auth/reset-password', data: {
      'email': email,
      'otp': otp,
      'new_password': newPassword,
    });
  }
}
