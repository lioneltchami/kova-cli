# Kova -- AI Dev FinOps

> Know what your AI tools actually cost.

Kova tracks costs across **11 AI coding tools** with a single CLI and a unified cloud dashboard at [kova.dev](https://kova.dev).

## Quick Start

```bash
npm install -g kova-cli
kova init          # Interactive setup wizard
kova track         # Scan AI tool usage
kova costs         # View cost breakdown
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

| Command            | Description                             |
| ------------------ | --------------------------------------- |
| `kova init`        | Interactive onboarding wizard           |
| `kova track`       | Scan and record AI tool usage           |
| `kova costs`       | View cost breakdowns                    |
| `kova compare`     | Side-by-side tool/model cost comparison |
| `kova budget`      | Manage spending budgets                 |
| `kova sync`        | Upload usage to cloud dashboard         |
| `kova report`      | Generate CSV/JSON/text reports          |
| `kova login`       | Authenticate with API key               |
| `kova logout`      | Remove credentials                      |
| `kova account`     | View account and subscription           |
| `kova dashboard`   | Open web dashboard in browser           |
| `kova config`      | Manage configuration                    |
| `kova completions` | Generate shell completions              |

### Enterprise Commands

| Command            | Description                  |
| ------------------ | ---------------------------- |
| `kova tag`         | Map projects to cost centers |
| `kova audit`       | Export audit log data        |
| `kova ci-report`   | Generate CI/CD cost reports  |
| `kova sso`         | Configure SSO authentication |
| `kova policy`      | Manage org policies          |
| `kova data export` | GDPR data portability export |

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
