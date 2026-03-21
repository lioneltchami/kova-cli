# Kova -- AI Dev FinOps

> Know what your AI tools actually cost.

Kova tracks costs across **11 AI coding tools** with a single CLI and a unified cloud dashboard at [kova.dev](https://kova.dev).

## Quick Start

```bash
npm install -g kova-cli
kova init          # Interactive setup wizard
kova track         # Scan AI tool usage
kova costs         # View cost breakdown
kova run "your prompt"  # AI coding with cost tracking
kova sync          # Upload to cloud dashboard
```

## Supported Tools

| Tool           | Type              | Status |
| -------------- | ----------------- | ------ |
| Claude Code    | Local file parser | Stable |
| Cursor         | Local file parser | Stable |
| GitHub Copilot | Local file parser | Stable |
| Windsurf       | Local file parser | Stable |
| Devin          | API collector     | Stable |
| Cline          | Local file parser | Stable |
| Continue.dev   | Local file parser | Stable |
| Aider          | Local file parser | Stable |
| Amazon Q       | API collector     | Beta   |
| Bolt           | API collector     | Stub   |
| Lovable        | API collector     | Stub   |

## Commands

| Command            | Description                                |
| ------------------ | ------------------------------------------ |
| `kova init`        | Interactive onboarding wizard              |
| `kova track`       | Scan and record AI tool usage              |
| `kova costs`       | View cost breakdowns                       |
| `kova compare`     | Side-by-side tool/model cost comparison    |
| `kova budget`      | Manage spending budgets                    |
| `kova sync`        | Upload usage to cloud dashboard            |
| `kova report`      | Generate CSV/JSON/text reports             |
| `kova login`       | Authenticate with API key                  |
| `kova logout`      | Remove credentials                         |
| `kova account`     | View account and subscription              |
| `kova dashboard`   | Open web dashboard in browser              |
| `kova config`      | Manage configuration                       |
| `kova completions` | Generate shell completions                 |
| `kova run`         | Execute AI coding tasks with model routing |
| `kova chat`        | Interactive AI coding REPL                 |
| `kova history`     | View past AI sessions with costs           |
| `kova bench`       | Benchmark prompts across models            |
| `kova hook`        | Install Claude Code integration hooks      |
| `kova mcp`         | Start MCP server for AI assistants         |

### Enterprise Commands

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `kova tag`         | Map projects to cost centers |
| `kova audit`       | Export audit log data        |
| `kova ci-report`   | Generate CI/CD cost reports  |
| `kova sso`         | Configure SSO authentication |
| `kova policy`      | Manage org policies          |
| `kova data export` | GDPR data portability export |

## AI Orchestration

Kova v2.1 adds intelligent AI coding features on top of cost tracking.

### Smart Model Fallback

When a model returns a rate limit (429) or server error (500/502/503), Kova automatically retries with the next cheaper model. Fallback chains: Opus -> Sonnet -> Haiku, o3 -> GPT-4o -> GPT-4.1-mini, Gemini Pro -> Gemini Flash.

```bash
kova config set orchestration.fallback true   # enabled by default
```

### Session Budget Guards

Set a per-session spending cap. Kova warns at 80% and stops at 100%.

```bash
kova run "refactor auth module" --budget 2.00
kova config set orchestration.session_budget 5.00  # default for all sessions
```

### Multi-File Context

Attach files or glob patterns to give the AI more context:

```bash
kova run "fix the auth bug" --context src/auth.ts --context src/types.ts
kova run "add tests" --include "src/**/*.ts"
```

## Cloud Dashboard

Sync with `kova sync` to see unified analytics at [kova.dev/dashboard](https://kova.dev/dashboard):

- Cost overview with KPI cards and trend charts
- Per-tool, per-model, per-developer breakdowns
- Budget management with email and Slack alerts
- Cost anomaly detection and forecasting
- Team management with per-member costs
- CSV export and API access

## CI/CD Integration

### GitHub Actions

```yaml
- uses: kova-cli/kova-action@v1
  with:
    kova-api-key: ${{ secrets.KOVA_API_KEY }}
    github-token: ${{ github.token }}
```

### GitLab CI

See [templates/gitlab-ci-kova.yml](templates/gitlab-ci-kova.yml)

## Pricing

- **Free**: 1 tool, 30-day local history
- **Pro**: $15/seat/month -- all tools, cloud dashboard, alerts
- **Enterprise**: $30/seat/month -- SSO, audit logs, cost centers, API

See [kova.dev/pricing](https://kova.dev/pricing)

## Documentation

Full documentation at [kova.dev/docs](https://kova.dev/docs)

## Requirements

- Node.js >= 18.0.0

## License

MIT -- see [LICENSE](LICENSE)
