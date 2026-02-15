<p align="center">
  <img src="docs/icon.svg" width="96" alt="Distillery Server" />
</p>

<h1 align="center">Distillery Server</h1>

<p align="center">
  <em>Raw knowledge in, refined insights out.</em>
</p>

<p align="center">
  <strong><a href="docs/README_ko.md">한국어</a></strong>
</p>

---

```
  Malt House        Still          Cask           Graph
 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │  Queue &  │──▶│ Embed &  │──▶│ Discover │──▶│ Connected│
 │  Collect  │   │ Distill  │   │ Relations│   │ Knowledge│
 └──────────┘   └──────────┘   └──────────┘   └──────────┘
   raw input     AI embedding   AI analysis     Neo4j graph
```

Distillery Server is the backend that **distills scattered thoughts into a connected knowledge graph**.

Users capture decisions, problems, insights, and questions as **malts**.
The server embeds them into vectors, discovers relationships via AI,
and ages them in the **cask** — a Neo4j knowledge graph
where every node finds its place.

---

## The Pipeline

The pipeline runs on a configurable interval (default: every 30 minutes)
with a dynamic scheduler. It can also be triggered manually from the settings page.

### 1. Malt House — Collect

Queue knowledge items via REST API. Each malt has a type:

| Type | Description |
|------|-------------|
| **Decision** | A choice that was made |
| **Problem** | An issue encountered |
| **Insight** | A realization or learning |
| **Question** | Something to explore |

Status flow: `MALT_HOUSE` → `DISTILLED_READY` → `DISTILLED` → `CASKED`

### 2. Still — Distill

Generate 1536-dim vector embeddings via OpenAI
and advance status from `DISTILLED_READY` to `DISTILLED`.
The embedding model is configurable (`text-embedding-3-small` or `text-embedding-3-large`),
with dimensions forced to 1536 for consistency.

### 3. Cask — Connect

Build the knowledge graph:

- Create Knowledge nodes in Neo4j
- Find similar casks using pgvector cosine similarity (configurable threshold, default: 0.75)
- AI classifies relationships (provider configurable: OpenAI or Google):
  - `RELATED_TO` — conceptual connection
  - `SUPPORTS` — one reinforces another
  - `CONFLICTS_WITH` — contradictory insights
- Each edge carries a confidence score and source (`ai` or `human`)

### 4. Backfill — No Node Left Behind

A weekly job finds isolated nodes and re-evaluates them against the full graph,
so no knowledge stays permanently disconnected.

---

## API

Interactive documentation available at `/docs` (Scalar UI).

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/send-otp` | Send OTP via Slack DM |
| `POST` | `/auth/verify-otp` | Verify OTP, receive JWT |
| `POST` | `/auth/refresh` | Refresh access token |

### Malts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/malts/` | Queue a single malt |
| `POST` | `/malts/batch` | Queue multiple malts |
| `GET` | `/malts/` | List malts (filter by `?status=`) |
| `DELETE` | `/malts/:maltId` | Remove a malt |

### Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/graph` | Full graph or filtered subgraph |
| `GET` | `/graph/node/:id` | Node + 1-depth neighbors |
| `GET` | `/graph/node/:id/expand` | N-depth subgraph (depth 1-3) |
| `POST` | `/graph/edge` | Create edge |
| `PUT` | `/graph/edge` | Update edge relationship type |
| `DELETE` | `/graph/edge` | Delete edge |
| `PUT` | `/graph/node/:id` | Update node (summary, context, memo) |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search/keyword` | Full-text keyword search |
| `POST` | `/search/natural` | Natural language search (Text-to-Cypher / embedding) |

### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/settings/ai` | Get AI model settings |
| `PUT` | `/settings/ai` | Update AI model settings |
| `GET` | `/settings/pipeline` | Get pipeline settings |
| `PUT` | `/settings/pipeline` | Update pipeline settings |

### Pipeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/pipeline/trigger` | Manually trigger the pipeline |
| `POST` | `/pipeline/re-embed` | Re-generate all embeddings |
| `POST` | `/pipeline/re-extract` | Re-extract all relationships |
| `GET` | `/pipeline/status` | Current pipeline status |

### Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/preferences` | Get user preferences |
| `PUT` | `/preferences` | Update user preferences |

### Search History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search-history` | Get search history |
| `DELETE` | `/search-history` | Clear search history |

---

## Tech Stack

```
Server    Bun · Elysia · TypeScript
Database  PostgreSQL · pgvector · Drizzle ORM
Graph     Neo4j
AI        OpenAI (embedding) · OpenAI / Google AI (relation extraction)
Auth      Slack OTP · JWT
Infra     Docker Compose · Pino · OpenAPI + Scalar
```

---

## Self-Hosting

### Prerequisites

- [Bun](https://bun.sh)
- [Docker](https://www.docker.com/) & Docker Compose
- [Slack Bot Token](#slack-bot-setup)
- [OpenAI API Key](https://platform.openai.com/api-keys)

### 1. Clone and install

```bash
git clone https://github.com/Cognito-Distillery/Distillery-server.git
cd Distillery-server

bun install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

| Service | Port |
|---------|------|
| PostgreSQL (pgvector) | `5432` |
| Neo4j Browser | `7474` |
| Neo4j Bolt | `7687` |

### 3. Configure environment

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `JWT_ACCESS_SECRET` | Access token signing key (32+ chars) |
| `JWT_REFRESH_SECRET` | Refresh token signing key (32+ chars) |
| `SLACK_BOT_TOKEN` | Slack Bot User OAuth Token (`xoxb-...`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key for embeddings & chat |
| `GOOGLE_AI_API_KEY` | Google AI API key (optional, for relation extraction) |
| `NEO4J_URI` | Neo4j Bolt URI |
| `NEO4J_USER` | Neo4j username |
| `NEO4J_PASSWORD` | Neo4j password |
| `PORT` | Server port (default: `8710`) |
| `LOG_LEVEL` | `debug`, `info`, `warn`, `error` |

### 4. Initialize and run

```bash
# Push database schema
bun run db:push

# Start server
bun run dev
```

The server starts at `http://localhost:8710`.

---

### Slack Bot Setup

Create a Slack app to enable OTP authentication:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. Add the following **Bot Token Scopes** under OAuth & Permissions:

| Scope | Purpose |
|-------|---------|
| `users:read` | Look up users |
| `users:read.email` | Find users by email |
| `chat:write` | Send OTP messages |
| `im:write` | Open DM channels |

3. **Install to Workspace** and copy the Bot User OAuth Token (`xoxb-...`)
4. Set `SLACK_BOT_TOKEN` in your `.env`

---

### Deploy with Docker

Build and run the server as a container:

```bash
docker build -t distillery-server .

docker run -d \
  --name distillery-server \
  --env-file .env \
  --network host \
  -p 8710:8710 \
  distillery-server
```

Or add it to `docker-compose.yml`:

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

Edit `src/config.ts` to restrict allowed origins at the application level:

```ts
export const corsOrigins: string[] = [
  "https://app.example.com",
  "https://admin.example.com",
];
```

When the list is empty (default), all origins are allowed.
In that case, use a reverse proxy to control access in production.

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

## Project Structure

```
src/
├── index.ts              # App entry point & Elysia setup
├── config.ts             # CORS & app configuration
├── logger.ts             # Pino structured logging
├── i18n.ts               # Internationalization (ko, en)
├── ai/                   # AI provider abstraction (OpenAI, Google) & settings
├── auth/                 # Slack OTP + JWT authentication
├── db/                   # Drizzle schema, pgvector similarity
├── malts/                # Malt CRUD endpoints
├── distill/              # Embedding generation pipeline
├── cask/                 # Knowledge graph relationship extraction
├── blend/                # Graph query & editing API
├── search/               # Keyword & natural language search
├── search-history/       # Search history tracking
├── preferences/          # User preferences API
├── pipeline/             # Dynamic scheduler, settings, progress tracking
├── cron/                 # Scheduled backfill jobs
└── graph/                # Neo4j driver & Cypher queries
```

---

## License

MIT

---

<p align="center"><sub>copper pot, amber stream.</sub></p>
