# Distillery Server

> 흩어진 지식을 넣으면, 정제된 인사이트가 나온다.

AI 기반 지식 증류 시스템입니다. 산발적인 메모와 아이디어를 연결된 지식 그래프로 변환합니다. 위스키 증류의 메타포를 따라 — 원재료(malt)를 증류(distill)하고, 캐스크(cask)에 숙성시켜 구조화된 지식으로 만들어냅니다.

```
  Malt House        Still          Cask           Graph
 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │  수집 &   │──▶│ 임베딩 & │──▶│  관계    │──▶│  연결된  │
 │  대기열   │   │  증류    │   │  탐색    │   │  지식    │
 └──────────┘   └──────────┘   └──────────┘   └──────────┘
   원본 입력     AI 벡터 변환   GPT 분석       Neo4j 그래프
```

## 기술 스택

| 계층 | 기술 |
|------|-----|
| 런타임 | [Bun](https://bun.sh) |
| 프레임워크 | [Elysia](https://elysiajs.com) |
| 데이터베이스 | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) |
| 그래프 DB | [Neo4j](https://neo4j.com) |
| ORM | [Drizzle](https://orm.drizzle.team) |
| AI | OpenAI (`text-embedding-3-small`, `gpt-4o-mini`) |
| 인증 | Slack OTP + JWT |

## 동작 원리

### 1. Malt House — 수집

사용자가 REST API를 통해 지식 항목(malt)을 등록합니다. 각 malt는 **유형**을 가집니다:

- **결정** — 내린 선택이나 판단
- **문제** — 마주한 이슈
- **인사이트** — 깨달음이나 배움
- **질문** — 탐구가 필요한 것

### 2. Still — 증류

스케줄링된 크론 작업이 대기 중인 malt를 처리합니다:

- OpenAI를 통해 벡터 임베딩 생성
- malt 상태를 `DISTILLED_READY` → `DISTILLED`로 갱신

### 3. Cask — 연결

캐스킹 단계에서 지식 그래프를 구축합니다:

- Neo4j에 Knowledge 노드 생성
- pgvector 코사인 유사도로 유사한 malt 탐색 (임계값: 0.75)
- GPT-4o-mini가 쌍을 분석하고 관계를 분류:
  - `RELATED_TO` — 개념적 연결
  - `SUPPORTS` — 하나가 다른 하나를 뒷받침
  - `CONFLICTS_WITH` — 상충하는 인사이트
- 모든 엣지에 신뢰도 점수 부여

### 4. Backfill — 고립 노드 방지

주간 작업이 엣지가 없는 고립된 노드를 식별하고, 전체 그래프에 대해 재평가하여 지식이 영구적으로 단절되는 것을 방지합니다.

## API

### 인증

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `POST` | `/auth/send-otp` | Slack DM으로 OTP 전송 |
| `POST` | `/auth/verify-otp` | OTP 검증 후 JWT 발급 |
| `POST` | `/auth/refresh` | 액세스 토큰 갱신 |

### Malts (인증 필요)

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `POST` | `/malts/` | malt 단건 등록 |
| `POST` | `/malts/batch` | malt 일괄 등록 |
| `GET` | `/malts/` | malt 목록 조회 (`?status=`로 필터링) |
| `DELETE` | `/malts/:maltId` | malt 삭제 |

## 시작하기

### 사전 요구사항

- [Bun](https://bun.sh) 런타임
- PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) 확장
- Neo4j 인스턴스
- Slack Bot Token (OTP 인증용)
- OpenAI API Key

### 환경 변수

```env
DATABASE_URL=postgresql://user:password@localhost:5432/distillery
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=
SLACK_BOT_TOKEN=xoxb-...
OPENAI_API_KEY=sk-...
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
```

### 실행

```bash
# 의존성 설치
bun install

# 데이터베이스 스키마 적용
bunx drizzle-kit push

# 개발 서버 실행
bun run dev
```

## 프로젝트 구조

```
src/
├── index.ts          # 앱 진입점 & Elysia 설정
├── logger.ts         # Pino 구조화 로깅
├── i18n.ts           # 한국어 / 영어 메시지
├── auth/             # Slack OTP + JWT 인증
├── db/               # Drizzle 스키마, pgvector 유사도 검색
├── malts/            # Malt CRUD 엔드포인트
├── distill/          # 임베딩 생성 파이프라인
├── cask/             # 지식 그래프 관계 추출
├── cron/             # 스케줄링 (증류 & 백필)
└── graph/            # Neo4j 드라이버 & Cypher 쿼리
```

## 라이선스

Private
