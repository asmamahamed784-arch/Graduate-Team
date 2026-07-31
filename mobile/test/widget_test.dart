import 'package:flutter_test/flutter_test.dart';
import 'package:nqs_mobile/core/utils/validators.dart';

void main() {
  group('phone normalisation', () {
    test('strips the +252 country code and a leading zero', () {
      expect(Validators.normalizePhone('+252 61 234 5678'), '612345678');
      expect(Validators.normalizePhone('0612345678'), '612345678');
      expect(Validators.normalizePhone('612345678'), '612345678');
    });

    test('accepts only Somali mobile numbers', () {
      expect(Validators.isValidPhone('+252612345678'), isTrue);
      expect(Validators.isValidPhone('71234567'), isFalse);
      expect(Validators.isValidPhone('6123456'), isFalse);
    });
  });

  group('password rules', () {
    test('mirrors the backend strength requirement', () {
      expect(Validators.password('Passw0rd!'), isNull);
      expect(Validators.password('password'), isNotNull);
      expect(Validators.password('Pass1!'), isNotNull);
    });
  });

  group('username rules', () {
    test('rejects spaces and short names', () {
      expect(Validators.username('asma.dev'), isNull);
      expect(Validators.username('as'), isNotNull);
      expect(Validators.username('bad name'), isNotNull);
    });
  });
}
