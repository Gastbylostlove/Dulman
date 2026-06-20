# Dulman

## Run

```bash
npm run start
```

## Test

```bash
npm test
```

## HTTP Integration

```bash
npm run test:http:keep-data
```

`HTTP_INTEGRATION_KEEP_DATA=true`가 설정되어 HTTP 통합 테스트 종료 후 DB 정리를 건너뜁니다.
보호된 API는 `Authorization: Bearer <access_token>` 형식을 사용합니다.

## Local Env

`DB_PROVIDER=postgres`
`DATABASE_URL=postgres://postgres:postgres@localhost:5432/dulman`
`DB_SSL=false`
`DB_AUTO_MIGRATE=true`
`PORT=3000`
`TOKEN_SECRET=change-me`
`STORAGE_BASE_URL=https://storage.local`
