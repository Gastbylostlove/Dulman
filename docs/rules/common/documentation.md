# 문서 작성 가이드

## 원칙

- 구분선(`---`) 사용하지 않음
- 심플하고 간결하게 작성
- 외부 문서 도구에 바로 붙여넣기 가능한 plain Markdown 형식

## 문서 구조

### 개별 모듈 문서

1. **제목 + 모듈 설명** — 제목 바로 아래 한 문단으로 요약
2. **기능별 섹션** — 번호 붙은 `##` 헤딩으로 연관 메서드 그룹화

### 인덱스 문서

Quick Reference 테이블로 전체 기능을 훑을 수 있게 한다.

## 메서드 문서 형식

```markdown
### Module.method()

메서드에 대한 간단한 설명.

> 주의사항은 blockquote로 표기

**Input**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| param1 | `string` | O | 설명 |
| param2 | `number` | X | 설명 (기본값: 0) |

**Output**

`Promise<boolean>` — 성공 여부

**예제**

\`\`\`typescript
await Module.method('param');
\`\`\`
```

### Output 표기

- **단순 반환**: 한 줄 (`Promise<boolean>` — 설명)
- **복잡한 반환**: 테이블 형식

### Quick Reference 테이블

```markdown
| 카테고리 | 메서드 | 설명 |
| --- | --- | --- |
| 기능A | `Module.methodA()` | 기능 설명 |
```
