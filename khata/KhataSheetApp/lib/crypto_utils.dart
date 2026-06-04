import 'dart:convert';
import 'package:crypto/crypto.dart';

class CryptoUtils {
  // Base64url Encoder
  static String base64UrlEncode(String value) {
    return base64Url.encode(utf8.encode(value)).replaceAll('=', '');
  }

  // Lightweight XOR encryption/decryption for local cache security
  static String xorEncryptDecrypt(String data, String key) {
    if (key.isEmpty) return data;
    final List<int> dataBytes = utf8.encode(data);
    final List<int> keyBytes = utf8.encode(key);
    final List<int> resultBytes = List<int>.filled(dataBytes.length, 0);

    for (int i = 0; i < dataBytes.length; i++) {
      resultBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return base64.encode(resultBytes);
  }

  static String xorDecrypt(String cipherText, String key) {
    try {
      if (cipherText.isEmpty || key.isEmpty) return cipherText;
      final List<int> encryptedBytes = base64.decode(cipherText);
      final List<int> keyBytes = utf8.encode(key);
      final List<int> resultBytes = List<int>.filled(encryptedBytes.length, 0);

      for (int i = 0; i < encryptedBytes.length; i++) {
        resultBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
      }
      return utf8.decode(resultBytes);
    } catch (_) {
      return '';
    }
  }

  // HMAC-SHA256 Signer for JWT creation
  static String generateJwt({
    required int sub,
    required int familyId,
    required int parentId,
    required String jwtSecret,
  }) {
    final header = {'alg': 'HS256', 'typ': 'JWT'};
    final nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    
    final payload = {
      'sub': sub.toString(),
      'familyId': familyId,
      'parentId': parentId,
      'iat': nowSeconds,
      'exp': nowSeconds + 3600,
    };

    final headerEncoded = base64UrlEncode(jsonEncode(header));
    final payloadEncoded = base64UrlEncode(jsonEncode(payload));
    final tokenInput = '$headerEncoded.$payloadEncoded';

    // HMAC Sign
    final hmac = Hmac(sha256, utf8.encode(jwtSecret));
    final signature = hmac.convert(utf8.encode(tokenInput));
    final signatureEncoded = base64Url.encode(signature.bytes).replaceAll('=', '');

    return '$tokenInput.$signatureEncoded';
  }
}
