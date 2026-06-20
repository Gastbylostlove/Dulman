// 안드로이드 에뮬레이터에서 호스트 머신 접근: 10.0.2.2
// 실기기 사용 시 Mac의 LAN IP로 변경 (예: http://192.168.0.10:4000)
const String kBaseUrl = 'http://10.0.2.2:4000';

const String kStorageKeyAccessToken  = 'access_token';
const String kStorageKeyRefreshToken = 'refresh_token';
const String kStorageKeyLoginId      = 'login_id';
const String kStorageKeyDeviceId     = 'device_id';

const String kErrDeviceReplaced = 'AUTH_DEVICE_REPLACED';
const String kErrSessionExpired = 'AUTH_SESSION_EXPIRED';
const String kErrChatActiveExists = 'CHAT_ACTIVE_EXISTS';
