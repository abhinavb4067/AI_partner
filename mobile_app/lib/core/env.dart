/// Central place for backend URLs.
///
/// Point [apiBaseUrl] at the same FastAPI backend the React web app uses.
/// Override at build/run time with:
///   flutter run --dart-define=API_BASE_URL=https://avoigabackend.ectama.com
class Env {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://avoigabackend.ectama.com',
  );

  /// The deployed React web app — used for the in-app WebView checkout flow
  /// (Pricing → PaymentModal) so we don't have to reimplement the payment
  /// gateway integration natively.
  static const webAppUrl = String.fromEnvironment(
    'WEB_APP_URL',
    defaultValue: 'https://avoiga.ectama.com',
  );

  static String media(String? path) {
    if (path == null || path.isEmpty) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return '$apiBaseUrl$path';
  }
}
