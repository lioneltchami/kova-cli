# Kova AI Cost Report GitHub Action

Automatically generate AI coding tool cost reports on every pull request and post them as PR comments.

## Usage

Add the following to your workflow file (e.g., `.github/workflows/kova-cost-report.yml`):

```yaml
name: AI Cost Report

on:
  pull_request:
    branches: [main]

jobs:
  cost-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Kova AI Cost Report
        uses: kova-cli/kova-action@v1
        with:
          kova-api-key: ${{ secrets.KOVA_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          period: "7d"
```

## Inputs

| Input              | Required | Default               | Description                                                 |
| ------------------ | -------- | --------------------- | ----------------------------------------------------------- |
| `kova-api-key`     | Yes      | -                     | Your Kova API key from kova.dev/dashboard/settings          |
| `github-token`     | Yes      | `${{ github.token }}` | GitHub token for posting PR comments                        |
| `period`           | No       | `7d`                  | Report period: `7d` or `30d`                                |
| `fail-on-increase` | No       | `false`               | Set `true` to fail the check if costs increased vs baseline |

## What it does

1. Installs the Kova CLI
2. Runs `kova ci-report --format json --period <period>` to generate a cost report
3. Posts the report as a comment on the pull request (updates existing comment if present)

## PR Comment Format

The action posts a comment like:

```
## Kova AI Cost Report

**Period cost:** $12.34
**Sessions:** 42

[View Dashboard](https://kova.dev/dashboard)
```

## Setup

1. Get your API key from [kova.dev/dashboard/settings](https://kova.dev/dashboard/settings)
2. Add it as a repository secret named `KOVA_API_KEY`
3. Add the workflow file above to your repository
4. Run `kova track` on your developer machines to collect usage data
