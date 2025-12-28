# Autobiography Builder

> Turn your digital chaos into a beautiful life story—automatically.

A web application that ingests your electronic files spanning decades, uses AI agents to analyze and curate content, and generates a beautiful, scrollable static autobiography website.

## Features

- **Bulk File Upload**: Upload ZIP files, folders, or individual documents
- **AI-Powered Analysis**: Claude analyzes your content for narrative potential
- **Smart Curation**: AI identifies the best stories and suggests chapter organization
- **Live Progress Feed**: Watch discoveries in real-time as files are processed
- **Beautiful Output**: Generate a polished, responsive autobiography website
- **Privacy Controls**: Public, unlisted, or password-protected publishing

## Tech Stack

- **Frontend**: Next.js 14+ with App Router, Tailwind CSS
- **Backend**: Cloudflare Workers with Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Queue**: Cloudflare Queues for async processing
- **AI**: Claude API for content analysis and narrative generation
- **Hosting**: Cloudflare Pages

## Project Structure

```
autobiography-builder/
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # Cloudflare Workers API
├── workers/
│   ├── parse/               # File parsing worker
│   └── analyze/             # Content analysis worker
├── packages/
│   ├── types/               # Shared TypeScript types
│   ├── database/            # Drizzle ORM schema
│   └── ui/                  # Shared React components
└── infrastructure/
    └── migrations/          # D1 database migrations
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+
- Cloudflare account
- Wrangler CLI (`npm install -g wrangler`)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/autobiography-builder.git
cd autobiography-builder
```

2. Run the setup script:
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

3. Configure secrets:
```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
# Edit .dev.vars with your JWT_SECRET and CLAUDE_API_KEY
```

4. Start development servers:
```bash
pnpm dev
```

This starts:
- Frontend at http://localhost:3000
- API at http://localhost:8787

### Manual Setup (if script fails)

```bash
# Install dependencies
pnpm install

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create autobiography-db

# Create R2 bucket
wrangler r2 bucket create autobiography-files

# Create queues
wrangler queues create autobiography-parse
wrangler queues create autobiography-analyze
wrangler queues create autobiography-write
wrangler queues create autobiography-build

# Run migrations
cd apps/api && wrangler d1 migrations apply autobiography-db --local
```

## Development

### Available Scripts

```bash
pnpm dev          # Start all development servers
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm type-check   # Type check all packages
```

### Adding a New Feature

1. Create types in `packages/types`
2. Add database schema in `packages/database`
3. Implement API endpoint in `apps/api`
4. Build UI component in `packages/ui`
5. Integrate in `apps/web`

## Deployment

### Deploy API Workers

```bash
# Set secrets (one-time)
cd apps/api
wrangler secret put JWT_SECRET
wrangler secret put CLAUDE_API_KEY

# Deploy
pnpm deploy:api
```

### Deploy Frontend

```bash
pnpm deploy:web
```

### Full Deployment

```bash
pnpm deploy
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | Yes |
| `CLAUDE_API_KEY` | Anthropic API key | Yes |
| `ENVIRONMENT` | `development` or `production` | No |

### Wrangler Bindings

The API worker uses these Cloudflare bindings:
- `DB`: D1 database
- `STORAGE`: R2 bucket
- `CACHE`: KV namespace
- `PARSE_QUEUE`, `ANALYZE_QUEUE`, etc.: Queues
- `PROGRESS_TRACKER`: Durable Object

## API Endpoints

See [05-API-Endpoints.md](./docs/05-API-Endpoints.md) for full API documentation.

Key endpoints:
- `POST /api/projects` - Create project
- `POST /api/projects/:id/upload` - Get upload URL
- `POST /api/projects/:id/process` - Start processing
- `GET /api/projects/:id/progress` - SSE progress stream
- `POST /api/projects/:id/publish` - Publish site

## Architecture

See [02-AI-Agent-Architecture.md](./docs/02-AI-Agent-Architecture.md) for the agent pipeline design.

```
Upload → Parse → Analyze → Curate → Write → Build → Publish
```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request
