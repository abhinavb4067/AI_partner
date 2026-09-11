import 'package:google_sign_in/google_sign_in.dart';
import 'auth_service.dart';

/// Native Google Sign-In → same backend `/api/auth/google-login` the web app
/// uses. `serverClientId` reuses the web app's OAuth client ID so the ID
/// token audience matches what the backend already verifies against.
///
/// **Requires Google Cloud console setup this environment cannot do:** an
/// Android OAuth client (package `com.avoiga.ai_girlfriend_app` + your
/// release/debug SHA-1) and an iOS OAuth client, both in the same Google
/// Cloud project as the web client ID below. See mobile_app/README.md.
class GoogleAuthService {
  static const _webClientId = '346889761252-gdltnjnp3rtce3h9ggt9hpupa3748e1g.apps.googleusercontent.com';

  static final _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
    serverClientId: _webClientId,
  );

  /// Returns true on success. Throws on network/API failure; returns false
  /// if the user simply cancelled the picker.
  static Future<bool> signIn() async {
    final account = await _googleSignIn.signIn();
    if (account == null) return false; // user cancelled

    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null) {
      throw Exception('Google did not return an ID token — check the OAuth client configuration.');
    }
    await AuthService.googleLogin(idToken);
    return true;
  }

  static Future<void> signOut() => _googleSignIn.signOut();
}
