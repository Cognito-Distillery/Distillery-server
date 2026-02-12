# Distillery Server

[한국어](docs/README_ko.md)

> Raw knowledge in, refined insights out.

AI-powered knowledge distillation system that transforms scattered notes into a connected knowledge graph. Built with the metaphor of whisky distilling — raw ideas (malts) are distilled, casked, and matured into structured, interconnected knowledge.

```
  Malt House        Still          Cask           Graph
 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │  Queue &  │──▶│ Embed &  │──▶│ Discover │──▶│ Connected│
 │  Collect  │   │ Distill  │   │ Relations│   │ Knowledge│
 └──────────┘   └──────────┘   └──────────┘   └──────────┘
   raw input     AI embedding   GPT analysis    Neo4j graph
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Framework | [Elysia](https://elysiajs.com) |
| Database | PostgreSQL + [pgvector](https://github.com/pgvector/pgvector) |
| Graph DB | [Neo4j](https://neo4j.com) |
| ORM | [Drizzle](https://orm.drizzle.team) |
| AI | OpenAI (`text-embedding-3-small`, `gpt-4o-mini`) |
| Auth | Slack OTP + JWT |

## How It Works

### 1. Malt House — Collect

Users queue knowledge items (malts) via REST API. Each malt has a **type**:

- **결정** (Decision) — A choice that was made
- **문제** (Problem) — An issue encountered
- **인사이트** (Insight) — A realization or learning
- **질문** (Question) — Something to explore

### 2. Still — Distill

A scheduled cron job processes queued malts:

- Generates vector embeddings via OpenAI
- Updates malt status from `DISTILLED_READY` → `DISTILLED`

### 3. Cask — Connect

The casking phase builds the knowledge graph:

- Creates Knowledge nodes in Neo4j
- Finds similar malts using pgvector cosine similarity (threshold: 0.75)
- GPT-4o-mini analyzes pairs and classifies relationships:
  - `RELATED_TO` — Conceptual connection
  - `SUPPORTS` — One reinforces another
  - `CONFLICTS_WITH` — Contradictory insights
- Each edge carries a confidence score

### 4. Backfill — No Node Left Behind

A weekly job identifies isolated nodes and re-evaluates them against the full graph, preventing knowledge from being permanently disconnected.

## API

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/send-otp` | Send OTP via Slack DM |
| `POST` | `/auth/verify-otp` | Verify OTP, receive JWT |
| `POST` | `/auth/refresh` | Refresh access token |

### Malts (authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/malts/` | Queue a single malt |
| `POST` | `/malts/batch` | Queue multiple malts |
| `GET` | `/malts/` | List malts (filter by `?status=`) |
| `DELETE` | `/malts/:maltId` | Remove a malt |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime
- PostgreSQL with [pgvector](https://github.com/pgvector/pgvector) extension
- Neo4j instance
- Slack Bot Token (for OTP auth)
- OpenAI API Key

### Environment Variables

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

### Run

```bash
# Install dependencies
bun install

# Push database schema
bunx drizzle-kit push

# Start development server
bun run dev
```

## Project Structure

```
src/
├── index.ts          # App entry point & Elysia setup
├── logger.ts         # Pino structured logging
├── i18n.ts           # Korean / English messages
├── auth/             # Slack OTP + JWT authentication
├── db/               # Drizzle schema, pgvector similarity
├── malts/            # Malt CRUD endpoints
├── distill/          # Embedding generation pipeline
├── cask/             # Knowledge graph relationship extraction
├── cron/             # Scheduled distill & backfill jobs
└── graph/            # Neo4j driver & Cypher queries
```

## License

Private
