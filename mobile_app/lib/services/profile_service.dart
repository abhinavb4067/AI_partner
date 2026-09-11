import '../core/api_client.dart';

class ProfileService {
  static final _dio = ApiClient.instance.dio;

  static Future<Map<String, dynamic>> getProfile() async {
    final res = await _dio.get('/api/profile/me');
    return res.data as Map<String, dynamic>;
  }

  static Future<void> updateProfile({String? name, String? username, String? email}) async {
    await _dio.put('/api/profile/update', data: {
      if (name != null) 'name': name,
      if (username != null) 'username': username,
      if (email != null) 'email': email,
    });
  }

  static Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmPassword,
  }) async {
    await _dio.put('/api/profile/change-password', data: {
      'current_password': currentPassword,
      'new_password': newPassword,
      'confirm_password': confirmPassword,
    });
  }

  static Future<void> deleteAccount(String password) async {
    await _dio.delete('/api/profile/delete-account', data: {'password': password});
  }

  static Future<void> registerFcmToken(String fcmToken) async {
    await _dio.post('/api/profile/fcm-token', data: {'fcm_token': fcmToken});
  }
}
