# Blending Room — Server 기획서

## Overview

Blending Room 웹 UI를 위한 API 서버.
Neo4j 그래프 데이터 조회/편집, 자연어 검색, 대시보드 데이터를 제공한다.

- **프레임워크**: Elysia (Bun)
- **DB**: Neo4j (그래프), PostgreSQL + pgvector (임베딩/몰트 데이터)
- **AI**: OpenAI gpt-4o-mini (자연어 쿼리 라우팅, Text-to-Cypher)

---

## API 엔드포인트

### 1. 그래프 조회

#### `GET /graph`
전체 그래프 또는 필터링된 서브그래프 반환.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| relationType | string? | RELATED_TO / SUPPORTS / CONFLICTS_WITH |
| source | string? | ai / human |
| limit | number? | 노드 수 제한 (기본 100) |

응답:
```json
{
  "nodes": [
    { "id": "...", "type": "...", "summary": "...", "context": "...", "memo": "..." }
  ],
  "edges": [
    { "sourceId": "...", "targetId": "...", "relationType": "SUPPORTS", "source": "ai", "confidence": 0.85, "createdAt": "2025-02-12T..." }
  ]
}
```

#### `GET /graph/node/:id`
특정 노드 + 직접 연결된 이웃 노드/엣지 반환.

응답: `GET /graph`와 동일한 `{ nodes, edges }` 포맷. 대상 노드 + 1-depth 이웃.

#### `GET /graph/node/:id/expand`
특정 노드 기준 N-depth 서브그래프 확장.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| depth | number? | 확장 깊이 (기본 1, 최대 3) |

응답: `GET /graph`와 동일한 `{ nodes, edges }` 포맷.

---

### 2. 그래프 편집 (Blending)

모든 편집 API는 `source: 'human'`으로 기록.

**엣지 식별 방식**: `sourceId + targetId` 복합키. 한 쌍의 노드 사이에는 하나의 관계만 존재한다.

#### `POST /graph/edge`
엣지 생성.

요청:
```json
{
  "sourceId": "...",
  "targetId": "...",
  "relationType": "SUPPORTS"
}
```

응답:
```json
{
  "sourceId": "...",
  "targetId": "...",
  "relationType": "SUPPORTS",
  "source": "human",
  "confidence": 1.0,
  "createdAt": "2025-02-12T..."
}
```

Cypher:
```cypher
MATCH (a:Knowledge { id: $sourceId })
MATCH (b:Knowledge { id: $targetId })
CALL apoc.merge.relationship(a, $relationType, {}, {source: 'human', confidence: 1.0, createdAt: datetime()}, b) YIELD rel
RETURN rel
```

#### `PUT /graph/edge`
엣지 관계 타입 변경. 내부적으로 기존 엣지 삭제 → 새 타입으로 재생성하지만, 클라이언트에게는 동일한 복합키를 유지한다.

요청:
```json
{
  "sourceId": "...",
  "targetId": "...",
  "relationType": "CONFLICTS_WITH"
}
```

응답:
```json
{
  "sourceId": "...",
  "targetId": "...",
  "relationType": "CONFLICTS_WITH",
  "source": "human",
  "confidence": 1.0,
  "updatedAt": "2025-02-12T..."
}
```

Cypher (내부 처리):
```cypher
// 1. 기존 관계 삭제
MATCH (a:Knowledge { id: $sourceId })-[r]->(b:Knowledge { id: $targetId })
DELETE r

// 2. 새 타입으로 생성
MATCH (a:Knowledge { id: $sourceId })
MATCH (b:Knowledge { id: $targetId })
CALL apoc.merge.relationship(a, $relationType, {}, {source: 'human', confidence: 1.0, updatedAt: datetime()}, b) YIELD rel
RETURN rel
```

#### `DELETE /graph/edge`
엣지 삭제.

요청:
```json
{
  "sourceId": "...",
  "targetId": "..."
}
```

Cypher:
```cypher
MATCH (a:Knowledge { id: $sourceId })-[r]->(b:Knowledge { id: $targetId })
DELETE r
```

#### `PUT /graph/node/:id`
노드 내용 수정.

요청:
```json
{
  "summary": "수정된 요약",
  "context": "수정된 맥락",
  "memo": "수정된 메모"
}
```

응답:
```json
{
  "id": "...",
  "type": "...",
  "summary": "수정된 요약",
  "context": "수정된 맥락",
  "memo": "수정된 메모",
  "updatedAt": "2025-02-12T..."
}
```

Cypher:
```cypher
MATCH (k:Knowledge { id: $id })
SET k.summary = $summary, k.context = $context, k.memo = $memo, k.updatedAt = datetime()
RETURN k
```

---

### 3. 검색

#### `GET /search/keyword`
키워드 기반 노드 검색.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| q | string | 검색어 |
| limit | number? | 결과 수 (기본 10) |

Neo4j 텍스트 인덱스 또는 CONTAINS로 summary, context, memo 검색.

응답:
```json
{
  "nodes": [
    { "id": "...", "type": "...", "summary": "...", "context": "...", "memo": "..." }
  ]
}
```

#### `POST /search/natural` (MVP 이후)
자연어 검색. LLM이 질문 유형 판단 후 라우팅.

```json
{
  "query": "서로 충돌하는 보안 관련 노트 보여줘"
}
```

내부 흐름:
1. gpt-4o-mini에 질문 유형 분류 요청 (structural / exploratory)
2. structural → Text-to-Cypher → Neo4j 실행
3. exploratory → 임베딩 생성 → pgvector 검색 → 시작점 노드 → Neo4j 확장
4. 결과를 nodes + edges 형태로 반환 (`GET /graph`와 동일한 응답 포맷)

Text-to-Cypher 시스템 프롬프트에 포함할 스키마:
```
Node: Knowledge { id, type, summary, context, memo }
Edges: RELATED_TO, SUPPORTS, CONFLICTS_WITH
Edge properties: { source: 'ai'|'human', confidence: float }
```

---

### 4. 대시보드 (MVP 이후)

#### `GET /dashboard/stats`

```json
{
  "totalNodes": 150,
  "totalEdges": 320,
  "edgesByType": {
    "RELATED_TO": 200,
    "SUPPORTS": 80,
    "CONFLICTS_WITH": 40
  },
  "edgesBySource": {
    "ai": 290,
    "human": 30
  },
  "isolatedNodes": 12,
  "recentEdges": [...]
}
```

---

## 아키텍처

```
┌────────────┐     ┌──────────────────────┐     ┌─────────┐
│ SvelteKit  │────▶│   Elysia API Server  │────▶│  Neo4j  │
│ (Web UI)   │◀────│                      │◀────│         │
└────────────┘     │  - Graph CRUD        │     └─────────┘
                   │  - Search            │
┌────────────┐     │  - Dashboard         │     ┌─────────┐
│ Tauri App  │────▶│  - Cask Pipeline     │────▶│ PG +    │
│ (Notes)    │◀────│                      │◀────│ pgvector│
└────────────┘     └──────────────────────┘     └─────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │ OpenAI gpt-4o-mini│
                   │ (관계 추출,       │
                   │  자연어 쿼리)     │
                   └──────────────────┘
```

---

## 에러 처리

| 상황 | 응답 |
|------|------|
| 존재하지 않는 노드 ID 또는 엣지 쌍 | 404 Not Found |
| 중복 엣지 생성 시도 | MERGE이므로 idempotent, 기존 엣지 반환 |
| Neo4j 연결 실패 | 503 Service Unavailable + 재시도 안내 |
| 자연어 검색 LLM 실패 | 500 + 키워드 검색 fallback 안내 |

---

## 인증

사내 시스템이므로 MVP에서는 최소한으로.
- 기본: 사내 네트워크 내에서만 접근 가능하도록 네트워크 레벨 제한
- 필요 시: 간단한 API key 또는 사내 SSO 연동

---

## MVP 범위

### 포함
- 그래프 조회 API (전체, 노드 상세, 확장)
- 엣지 CRUD API (생성, 수정, 삭제)
- 노드 수정 API
- 키워드 검색 API

### 제외 (이후 단계)
- 자연어 검색 (Text-to-Cypher, 임베딩 검색)
- 대시보드 통계 API
- 인증/권한 관리
- 실시간 WebSocket (동시 편집 알림)

---

## 파일 구조 (예상)

```
src/
├── blend/
│   ├── blend.controller.ts    # 엔드포인트 정의
│   ├── blend.service.ts       # 비즈니스 로직
│   └── blend.schema.ts        # 요청/응답 Zod 스키마
├── search/
│   ├── search.controller.ts
│   ├── search.service.ts
│   └── cypher.generator.ts    # Text-to-Cypher (이후 단계)
├── dashboard/
│   ├── dashboard.controller.ts
│   └── dashboard.service.ts
└── db/
    ├── neo4j.ts               # Neo4j 드라이버 설정
    └── similarity.ts          # pgvector 검색 (기존)
```
