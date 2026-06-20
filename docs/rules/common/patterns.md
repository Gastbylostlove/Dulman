# 패턴

이 문서는 여러 프로젝트에서 반복적으로 사용할 수 있는 구조와 판단 기준을 정리한다. 패턴은 문제를 단순하게 만들 때만 사용한다.

## 구조 패턴

### Facade Pattern

복잡한 하위 시스템을 단일 인터페이스로 묶는다.

- 호출부가 알아야 하는 세부사항이 줄어들 때 사용한다.
- 내부 구현을 숨기되 에러와 결과의 의미는 흐리지 않는다.

### Adapter Pattern

호환되지 않는 외부 인터페이스를 내부 표준 인터페이스로 변환한다.

```typescript
const userRepository = {
    findById: (id: string) => externalClient.getUser({ user_id: id }),
};
```

### Factory Function + Strategy

생성 과정과 교체 가능한 정책을 분리한다.

```typescript
const createFormatter = (format: (value: string) => string) => ({
    format,
    formatAll: (values: string[]) => values.map(format),
});
```

### Parameter Object

파라미터가 3개 이상이거나 같은 타입의 값이 나열되면 객체로 전달한다.

```typescript
await createJob({
    type,
    scheduledAt,
    priority,
});
```

## 행위 패턴

### Result Type Pattern

예외를 던지는 대신 호출자가 분기할 수 있는 명시적 결과를 반환한다.

```typescript
const { data, error } = await repository.find(id);
if (error) return { data: null, error };
return { data, error: null };
```

### Two-Phase Pattern

준비와 실행을 분리해야 할 때 1단계가 2단계 함수를 반환한다.

```typescript
const commit = await prepareUpdate(input);
const result = await commit();
```

### Guard Clause

조건 불만족 시 조기 반환으로 중첩을 제거한다.

- guard에서 걸러진 조건은 이후 다시 체크하지 않는다.
- 조기 반환 후 `else`는 대부분 필요 없다.

### Declarative Conditionals

조건 분기는 "어떻게 처리할까"보다 "무엇이 우선인가"가 드러나게 작성한다.

```typescript
if (isUnauthorized) return unauthorizedResult;
if (isValidationError) return validationResult;
return defaultResult;
```

### DRY in Conditions

같은 의미의 조건 체크는 변수로 추출하여 한 번만 계산한다.

```typescript
const isRetryableFailure = isNetworkError && attempt < maxAttempts;

if (!isRetryableFailure) throw error;
```

### Tap Pattern

side effect를 수행한 뒤 원래 값을 그대로 반환한다.

```typescript
const persistAndReturn = async <T>(value: T) => {
    await repository.save(value);
    return value;
};
```

### Colocation

로깅, 검증, 메트릭 같은 부수 행위는 관련 데이터가 생성되거나 변환되는 위치에 둔다.

## 비동기 패턴

### Divergent vs Convergent Error Handling

에러 후 흐름이 갈라지면 `try-catch`, 에러를 변환하고 같은 흐름으로 돌아오면 `.catch()`를 사용한다.

```typescript
// 분기형: 성공/실패 흐름이 다름
try {
    return await createRecord(input);
} catch (error) {
    if (isConflict(error)) return await updateRecord(input);
    throw error;
}

// 수렴형: 실패를 기본값으로 바꾼 뒤 같은 흐름으로 진행
const config = await loadConfig().catch(() => defaultConfig);
return runWithConfig(config);
```
