# app/: the pages of rAIght

Plain HTML, CSS and JavaScript, with no framework and no build step. The SAP CAP backend at the repository root serves these pages together with the API ([ADR 0007](../docs/decisions/0007-real-product-on-sap-btp.md)). The pages show what the backend computes from the run log.

## Run it

From the repository root: `npm install`, then `npm run watch`, and open <http://localhost:4004>. More in the [README](../README.md) and in [backend.md](../docs/technical/backend.md).

## Structure

| Path | What |
|---|---|
| `index.html` | Entry, forwards to the dashboard |
| `assets/tokens.css` | Design tokens from [design-system.md](../docs/technical/design-system.md), the only place with colour values |
| `assets/app.css` | Shared layout and components: shell, cards, KPI tiles, chips, buttons, tables, chart marks |
| `assets/data.js` | The only file that reads data. It calls the API, and `rAIght.fmt` and `rAIght.labels` format what comes back |
| `assets/shell.js` | Fills the sidebar and the source strip, `rAIght.h()` builds DOM safely |
| `data/` | Texts and sample data the pages use ([sample-data.md](../docs/technical/sample-data.md)) |
| `pages/<name>/` | One folder per page: `index.html` plus `<name>.js` and `<name>.css` |

## Pages

| Page | What it shows |
|---|---|
| `pages/dashboard/` | Lena's dashboard: cost, CO₂e, tokens and runs, the agents that need attention, all her agents |
| `pages/agent/?id=…` | One agent: key figures, runs per day, path breakdown, latest runs, rAIght's suggestion and the conversion |
| `pages/company/` | The CIO office: totals per unit and where repeating agents sit, aggregated and read-only |
| `pages/plan/` | Plan an automation: three triage questions lead to the lowest ladder step that does the job |
| `pages/inventory/` | All automations with provider, ladder step and the reason why something is an agent |
| `pages/learn/` | Guidelines: the automation ladder and the triage cheat sheet |
| `pages/escalations/` | Cases an agent could not handle, routed to Lena |
| `pages/about/` | Scope, version history and "Reset demo" |
| `pages/providers/`, `pages/access/` | Admin pages for providers and people |
