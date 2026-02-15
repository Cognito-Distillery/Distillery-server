<p align="center">
  <img src="icon.svg" width="96" alt="Distillery Server" />
</p>

<h1 align="center">Distillery Server</h1>

<p align="center">
  <em>흩어진 지식을 넣으면, 정제된 인사이트가 나온다.</em>
</p>

<p align="center">
  <strong><a href="../README.md">English</a></strong>
</p>

---

```
  Malt House        Still          Cask           Graph
 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │  수집 &   │──▶│ 임베딩 & │──▶│  관계    │──▶│  연결된  │
 │  대기열   │   │  증류    │   │  탐색    │   │  지식    │
 └──────────┘   └──────────┘   └──────────┘   └──────────┘
   원본 입력     AI 벡터 변환   AI 분석        Neo4j 그래프
```

Distillery Server는 **흩어진 생각을 연결된 지식 그래프로 증류하는** 백엔드입니다.

결정, 문제, 인사이트, 질문을 **malt**로 기록하면,
서버가 벡터로 임베딩하고 AI로 관계를 발견하여
**캐스크** — Neo4j 지식 그래프에 숙성시킵니다.
모든 노드가 제자리를 찾을 때까지.

---

## 파이프라인

파이프라인은 설정 가능한 주기(기본값: 30분)로 동적 스케줄러를 통해 실행됩니다.
설정 페이지에서 수동으로 트리거할 수도 있습니다.

### 1. Malt House — 수집

REST API로 지식 항목을 등록합니다. 각 malt에 유형을 지정합니다:

| 유형 | 설명 |
|------|------|
| **결정** | 내린 선택이나 판단 |
| **문제** | 마주한 이슈 |
| **인사이트** | 깨달음이나 배움 |
| **질문** | 탐구가 필요한 것 |

상태 흐름: `MALT_HOUSE` → `DISTILLED_READY` → `DISTILLED` → `CASKED`

### 2. Still — 증류

OpenAI를 통해 1536차원 벡터 임베딩을 생성하고
상태를 `DISTILLED_READY`에서 `DISTILLED`로 진행시킵니다.
임베딩 모델은 설정 가능하며(`text-embedding-3-small` 또는 `text-embedding-3-large`),
일관성을 위해 차원은 1536으로 강제됩니다.

### 3. Cask — 연결

지식 그래프를 구축합니다:

- Neo4j에 Knowledge 노드 생성
- pgvector 코사인 유사도로 유사한 캐스크 탐색 (설정 가능한 임계값, 기본값: 0.75)
- AI가 관계를 분류 (프로바이더 설정 가능: OpenAI 또는 Google):
  - `RELATED_TO` — 개념적 연결
  - `SUPPORTS` — 하나가 다른 하나를 뒷받침
  - `CONFLICTS_WITH` — 상충하는 인사이트
- 모든 엣지에 신뢰도 점수와 출처(`ai` 또는 `human`) 부여

### 4. Backfill — 고립 노드 방지

주간 작업이 고립된 노드를 찾아 전체 그래프에 대해 재평가합니다.
지식이 영구적으로 단절되지 않도록.

---

## API

`/docs`에서 인터랙티브 문서를 확인할 수 있습니다 (Scalar UI).

### 인증

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `POST` | `/auth/send-otp` | Slack DM으로 OTP 전송 |
| `POST` | `/auth/verify-otp` | OTP 검증 후 JWT 발급 |
| `POST` | `/auth/refresh` | 액세스 토큰 갱신 |

### Malts

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `POST` | `/malts/` | malt 단건 등록 |
| `POST` | `/malts/batch` | malt 일괄 등록 |
| `GET` | `/malts/` | malt 목록 조회 (`?status=`로 필터링) |
| `DELETE` | `/malts/:maltId` | malt 삭제 |

### 그래프

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `GET` | `/graph` | 전체 그래프 또는 필터링된 서브그래프 |
| `GET` | `/graph/node/:id` | 노드 + 1-depth 이웃 |
| `GET` | `/graph/node/:id/expand` | N-depth 서브그래프 확장 (depth 1-3) |
| `POST` | `/graph/edge` | 엣지 생성 |
| `PUT` | `/graph/edge` | 엣지 관계 타입 수정 |
| `DELETE` | `/graph/edge` | 엣지 삭제 |
| `PUT` | `/graph/node/:id` | 노드 수정 (summary, context, memo) |

### 검색

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `GET` | `/search/keyword` | 풀텍스트 키워드 검색 |
| `POST` | `/search/natural` | 자연어 검색 (Text-to-Cypher / 임베딩) |

### 설정

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `GET` | `/settings/ai` | AI 모델 설정 조회 |
| `PUT` | `/settings/ai` | AI 모델 설정 변경 |
| `GET` | `/settings/pipeline` | 파이프라인 설정 조회 |
| `PUT` | `/settings/pipeline` | 파이프라인 설정 변경 |

### 파이프라인

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `POST` | `/pipeline/trigger` | 파이프라인 수동 실행 |
| `POST` | `/pipeline/re-embed` | 전체 임베딩 재생성 |
| `POST` | `/pipeline/re-extract` | 전체 관계 재추출 |
| `GET` | `/pipeline/status` | 파이프라인 현재 상태 |

### 사용자 설정

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `GET` | `/preferences` | 사용자 설정 조회 |
| `PUT` | `/preferences` | 사용자 설정 변경 |

### 검색 기록

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| `GET` | `/search-history` | 검색 기록 조회 |
| `DELETE` | `/search-history` | 검색 기록 삭제 |

---

## 기술 스택

```
Server    Bun · Elysia · TypeScript
Database  PostgreSQL · pgvector · Drizzle ORM
Graph     Neo4j
AI        OpenAI (임베딩) · OpenAI / Google AI (관계 추출)
Auth      Slack OTP · JWT
Infra     Docker Compose · Pino · OpenAPI + Scalar
```

---

## 셀프 호스팅

### 사전 요구사항

- [Bun](https://bun.sh)
- [Docker](https://www.docker.com/) & Docker Compose
- [Slack Bot Token](#slack-bot-설정)
- [OpenAI API Key](https://platform.openai.com/api-keys)

### 1. 클론 및 설치

```bash
git clone https://github.com/Cognito-Distillery/Distillery-server.git
cd Distillery-server

bun install
```

### 2. 인프라 실행

```bash
docker compose up -d
```

| 서비스 | 포트 |
|--------|------|
| PostgreSQL (pgvector) | `5432` |
| Neo4j Browser | `7474` |
| Neo4j Bolt | `7687` |

### 3. 환경 변수 설정

```bash
cp .env.example .env
```

| 변수 | 설명 |
|------|------|
| `JWT_ACCESS_SECRET` | 액세스 토큰 서명 키 (32자 이상) |
| `JWT_REFRESH_SECRET` | 리프레시 토큰 서명 키 (32자 이상) |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token (`xoxb-...`) |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `OPENAI_API_KEY` | OpenAI API 키 (임베딩 & 채팅) |
| `GOOGLE_AI_API_KEY` | Google AI API 키 (선택사항, 관계 추출용) |
| `NEO4J_URI` | Neo4j Bolt URI |
| `NEO4J_USER` | Neo4j 사용자명 |
| `NEO4J_PASSWORD` | Neo4j 비밀번호 |
| `PORT` | 서버 포트 (기본값: `8710`) |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` |

### 4. 초기화 및 실행

```bash
# 데이터베이스 스키마 적용
bun run db:push

# 서버 실행
bun run dev
```

서버가 `http://localhost:8710`에서 시작됩니다.

---

### Slack Bot 설정

OTP 인증을 위한 Slack 앱 생성:

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. OAuth & Permissions에서 다음 **Bot Token Scopes** 추가:

| 스코프 | 용도 |
|--------|------|
| `users:read` | 사용자 조회 |
| `users:read.email` | 이메일로 사용자 찾기 |
| `chat:write` | OTP 메시지 전송 |
| `im:write` | DM 채널 열기 |

3. **Install to Workspace** 후 Bot User OAuth Token (`xoxb-...`) 복사
4. `.env`에 `SLACK_BOT_TOKEN` 설정

---

### Docker로 배포

서버를 컨테이너로 빌드하고 실행:

```bash
docker build -t distillery-server .

docker run -d \
  --name distillery-server \
  --env-file .env \
  --network host \
  -p 8710:8710 \
  distillery-server
```

또는 `docker-compose.yml`에 추가:

```yaml
services:
  server:
    build: .
    env_file: .env
    ports:
      - "8710:8710"
    depends_on:
      postgres:
        condition: service_healthy
      neo4j:
        condition: service_healthy
```

---

### CORS

`src/config.ts`를 수정하여 허용할 Origin을 지정할 수 있습니다:

```ts
export const corsOrigins: string[] = [
  "https://app.example.com",
  "https://admin.example.com",
];
```

빈 배열(기본값)이면 모든 Origin을 허용합니다.
이 경우 프로덕션 환경에서는 리버스 프록시로 접근을 제어하세요.

<details>
<summary>Caddy</summary>

```
distillery.example.com {
    reverse_proxy localhost:8710
}
```

</details>

<details>
<summary>Nginx</summary>

```nginx
server {
    listen 443 ssl;
    server_name distillery.example.com;

    location / {
        proxy_pass http://localhost:8710;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

</details>

---

## 프로젝트 구조

```
src/
├── index.ts              # 앱 진입점 & Elysia 설정
├── config.ts             # CORS & 앱 설정
├── logger.ts             # Pino 구조화 로깅
├── i18n.ts               # 다국어 지원 (ko, en)
├── ai/                   # AI 프로바이더 추상화 (OpenAI, Google) & 설정
├── auth/                 # Slack OTP + JWT 인증
├── db/                   # Drizzle 스키마, pgvector 유사도 검색
├── malts/                # Malt CRUD 엔드포인트
├── distill/              # 임베딩 생성 파이프라인
├── cask/                 # 지식 그래프 관계 추출
├── blend/                # 그래프 조회 & 편집 API
├── search/               # 키워드 & 자연어 검색
├── search-history/       # 검색 기록 관리
├── preferences/          # 사용자 설정 API
├── pipeline/             # 동적 스케줄러, 설정, 진행 상태 추적
├── cron/                 # 스케줄링 (백필)
└── graph/                # Neo4j 드라이버 & Cypher queries
```

---

## 라이선스

MIT

---

<p align="center"><sub>copper pot, amber stream.</sub></p>
