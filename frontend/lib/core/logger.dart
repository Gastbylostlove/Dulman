import 'dart:developer' as dev;
import 'package:flutter/foundation.dart';

class Log {
  static void i(String tag, String msg) {
    if (kDebugMode) dev.log(msg, name: tag);
  }

  static void w(String tag, String msg) {
    if (kDebugMode) dev.log('⚠ $msg', name: tag, level: 900);
  }

  static void e(String tag, String msg, [Object? error, StackTrace? stack]) {
    if (kDebugMode) {
      dev.log('✗ $msg${error != null ? '\n$error' : ''}',
          name: tag, level: 1000, error: error, stackTrace: stack);
    }
  }
}
