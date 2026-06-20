// 실기기 LAN 사용 시: ifconfig en0 | grep 'inet '  으로 현재 IP 확인 후 변경
// 에뮬레이터: http://10.0.2.2:4000
const String kBaseUrl = 'http://172.21.100.123:4000';

const String kStorageKeyAccessToken  = 'access_token';
const String kStorageKeyRefreshToken = 'refresh_token';
const String kStorageKeyLoginId      = 'login_id';
const String kStorageKeyDeviceId     = 'device_id';

const String kErrDeviceReplaced = 'AUTH_DEVICE_REPLACED';
const String kErrSessionExpired = 'AUTH_SESSION_EXPIRED';
const String kErrChatActiveExists = 'CHAT_ACTIVE_EXISTS';
