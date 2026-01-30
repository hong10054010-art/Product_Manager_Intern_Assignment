# Feedback Insights - Cloudflare Workers Prototype

A feedback analysis and visualization dashboard built with Cloudflare Workers, Workers AI, D1, R2, and KV.

## Features

- Multi-source feedback collection (support tickets, GitHub, Discord, email, Twitter)
- AI-powered analysis (themes, sentiment, urgency, value)
- Interactive dashboard with charts
- Filter by product, platform, country, and time range
- Save & Share views
- AI recommendations

## Quick Start

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
wrangler login
```

### 2. Configure Resources

Update `wrangler.toml` with your resource IDs:
- D1 Database ID
- R2 Bucket name
- KV Namespace ID

### 3. Initialize Database

```bash
wrangler d1 create feedback-db
wrangler d1 execute feedback-db --remote --file=schema.sql
```

### 4. Deploy

```bash
wrangler pages deploy . --project-name=your-project-name
```

### 5. Seed Data

```bash
curl -X POST https://your-domain.pages.dev/api/seed
curl -X POST https://your-domain.pages.dev/api/process
```

## API Endpoints

- `GET /api/query` - Query feedback data
- `POST /api/seed` - Generate mock data
- `POST /api/process` - Process feedback with AI
- `POST /api/ai-advice` - Get AI recommendations
- `POST /api/save-view` - Save filtered view

## Project Structure

```
feedback-insights/
├── index.html          # Main dashboard
├── functions/
│   └── api/           # API endpoints
│       ├── query.js
│       ├── seed.js
│       ├── process.js
│       ├── ai-advice.js
│       └── save-view.js
├── schema.sql         # Database schema
└── wrangler.toml      # Cloudflare configuration
```

## License

MIT
