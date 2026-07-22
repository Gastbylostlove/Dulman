// FCM is intentionally not initialized in v0.2.0. These values are slots for
// the later push-notification integration and must not contain credentials.
const String kFcmProjectId = String.fromEnvironment('DULMAN_FCM_PROJECT_ID');
const String kFcmSenderId = String.fromEnvironment('DULMAN_FCM_SENDER_ID');
const String kFcmAndroidAppId = String.fromEnvironment('DULMAN_FCM_ANDROID_APP_ID');
const String kFcmCredentialReference = String.fromEnvironment(
  'DULMAN_FCM_CREDENTIAL_REFERENCE',
);
