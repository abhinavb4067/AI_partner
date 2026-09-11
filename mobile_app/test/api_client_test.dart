import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ai_girlfriend_app/core/api_client.dart';

DioException _errorWith({int? statusCode, dynamic data, DioExceptionType type = DioExceptionType.badResponse}) {
  final requestOptions = RequestOptions(path: '/test');
  return DioException(
    requestOptions: requestOptions,
    type: type,
    response: statusCode == null
        ? null
        : Response(requestOptions: requestOptions, statusCode: statusCode, data: data),
  );
}

void main() {
  group('apiErrorMessage', () {
    test('extracts a string "detail" field from a FastAPI error body', () {
      final e = _errorWith(statusCode: 400, data: {'detail': 'Email already in use'});
      expect(apiErrorMessage(e), 'Email already in use');
    });

    test('stringifies a non-string "detail" (e.g. structured 402 payload)', () {
      final e = _errorWith(statusCode: 402, data: {
        'detail': {'code': 'out_of_credits', 'required': 5, 'available': 0}
      });
      expect(apiErrorMessage(e), contains('out_of_credits'));
    });

    test('falls back to a friendly message on connection errors', () {
      final e = _errorWith(type: DioExceptionType.connectionError);
      expect(apiErrorMessage(e), contains('Could not reach the server'));
    });

    test('falls back to a friendly message on timeouts', () {
      final e = _errorWith(type: DioExceptionType.receiveTimeout);
      expect(apiErrorMessage(e), contains('Could not reach the server'));
    });

    test('uses the caller-supplied fallback when nothing else applies', () {
      final e = _errorWith(type: DioExceptionType.cancel);
      expect(apiErrorMessage(e, fallback: 'Custom fallback'), 'Custom fallback');
    });

    test('handles non-Dio errors via the generic fallback', () {
      expect(apiErrorMessage(Exception('boom'), fallback: 'Something went wrong'), 'Something went wrong');
    });

    test('default fallback text is used when none supplied', () {
      expect(apiErrorMessage(Exception('boom')), 'Something went wrong. Please try again.');
    });
  });
}
