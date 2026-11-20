# Backend

Layer 1 of [ADR 0007](../decisions/0007-real-product-on-sap-btp.md): a **SAP CAP (Node.js)** backend. It turns Lena's sample data, and a simulated company around her, into single runs, computes the monitor metrics, cost and footprint from them with **plain statistics** ([ADR 0002](../decisions/0002-no-ai-to-check-ai.md)), and serves them to the existing pages and to a Fiori list. It also takes finished runs from a connected provider (n8n) and saves the owner's Retire. It runs locally and on SAP BTP (Cloud Foundry).

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run watch
```

Then open http://localhost:4004 – the `app/` pages, now with data from the API. `npm test` runs the tests.

| URL | What |
|---|---|
| `/` | The `app/` pages |
| `/api/monitor/agents` | Metrics per agent – same shape as `app/data/agents.json` |
| `/api/monitor/summary` | Totals – same shape as `app/data/summary.json` |
| `/api/monitor/impact` | Cost and footprint of the last 30 days: per agent, in total, for the uniform agents – with the prices and factors used |
| `/api/monitor/company` | Totals per owner for the CIO office – same shape as `app/data/company.json` |
| `/api/monitor/retire`, `/restore`, `/convert`, `/reset` (POST) | The owner's decision on one of Lena's agents, saved with the agent. `reset` takes every retirement and conversion back |
| `/api/monitor/runs?agent=…` | The latest runs of one of Lena's agents, each with what it cost |
| `/api/ingest/record` (POST) | Where a connected provider delivers a finished run. Needs the header `x-raight-key` |
| `/api/ingest/state?agent=…` | Tells a provider the owner's decisions on its agent: retired, or converted to a lower step |
| `/odata/v4/monitor/Runs` (also `Agents`, `Providers`, `AgentUsage`) | The run log and the agents' usage, read-only (OData) |
| `/$fiori-preview/MonitorService/AgentUsage#preview-app` | The agents as a Fiori list: status, runs, tokens, same path, cost, CO₂e; open an agent to see its runs |
| `/$fiori-preview/MonitorService/Runs#preview-app` | The run log as a Fiori list |

The Fiori lists load SAPUI5 from the internet.

## How it fits together

| File | What it does |
|---|---|
| `db/schema.cds` | Data model (namespace `raight`): `Providers`, `Agents`, `Runs` – one row per run with start time, path of steps, model, tokens in/out – and `AgentUsage`, a snapshot of the numbers per agent |
| `srv/monitor-service.cds`, `.js` | `MonitorService` (OData, read-only) and `MonitorApi` (REST: the JSON endpoints and the owner's Retire). It keeps every agent's numbers and reads only the agent again whose runs changed |
| `srv/ingest-service.cds`, `.js` | `IngestApi` (REST): takes a run from a connected provider and checks its key |
| `srv/lib/ingest.js` | Pure function: checks a delivered run and turns it into a row of `Runs` |
| `srv/lib/run-log.js`, `srv/usage-snapshot.js` | Tell the services which agent changed, and bring its row in `AgentUsage` up to date |
| `srv/server.js` | The database lives in memory, so it is empty after every start: generates the runs one agent at a time, inserts them and writes `AgentUsage` (log: "generated 650217 runs for 125 agents"). The server answers only after that |
| `connectors/n8n.js`, `demo/n8n/` | The connector that delivers n8n's runs, and the real n8n agents of the demo with their measurement ([README](../../demo/n8n/README.md)) |
| `srv/lib/generate-company.js` | The simulated company: Lena's agents plus generated agents for 23 more owners |
| `srv/lib/generate-runs.js` | Makes the runs from the agents – seeded, so every start gives exactly the same runs |
| `srv/lib/metrics.js` | Pure functions: rows in, the JSON shapes of `app/data/` out |
| `srv/lib/impact.js` | Pure functions: cost and footprint of the runs |
| `srv/lib/company.js` | Pure functions: the totals per owner for the CIO office |
| `srv/lib/usage.js` | The rows of `AgentUsage`, from `metrics.js` and `impact.js` |
| `srv/lib/config.js` | All thresholds, prices, factors and assumptions in one place |
| `test/` | The metrics computed from the runs must equal the sample data; cost, footprint and the usage rows follow from `config.js` |
| `manifest.yml`, `.cfignore` | Deployment to SAP BTP |

`app/assets/data.js` asks the API first and falls back to the JSON files, so GitHub Pages (no API) keeps working. The dashboard and the agent page ask the API again every four seconds, so a new run or a decision shows up without a reload.

## The simulated company

A CIO office looks at a whole company, not at one process owner. So the backend builds a company around Lena: **125 agents of 24 process owners** in HR, finance, customer support, IT, sales and operations. It is invented data, generated with a fixed seed – every start gives the same company. Its size follows the mid-sized reference company of the business case: 250 automations, half of them agents, about 1,000 runs per active agent in 30 days and about 10,000 tokens per run.

- **Lena stays as she is.** Her five agents come first and produce exactly the runs they produce alone; a test checks this. `agents`, `summary` and `impact` show only her agents.
- **The other 120 agents** get a name, a purpose and steps that fit their unit. About half of them repeat one path in more than 80 % of their runs, about 10 % have had no run for more than 30 days. All ranges are in `srv/lib/config.js` under `company`.
- **`/api/monitor/company`** sums the agents per owner: agents, uniform and unused agents, tokens, cost and CO₂e. No single run or agent is shown.
- **In the last 30 days:** 115,725 runs, 1,164.7 million tokens, 62 uniform and 13 unused agents, 8,148.78 EUR and 55.1 kg CO₂e. That is 7.0 euro cents per agent run.
- The Fiori list shows all 125 agents, with a filter for the unit.

The run log has 650,000 runs. The backend generates, inserts and computes one agent at a time, so it never holds the whole log in memory: the start takes about 15 seconds on a laptop and the app needs about 500 MB. After a run arrives, only its agent is read again.

## Generated runs

- **Windows:** six 30-day windows ending at `period_end`. The server sets `period_end` to the day it starts, so a run that a provider delivers now counts in the last 30 days. Only the dates move with it, the numbers stay. The tests and the sample files use 2026-10-25 – W0 = 26 Sep–25 Oct, W1 = 27 Aug–25 Sep, …, W5 = 29 Apr–28 May. Each window is labelled by the month of its last day; `tokens_by_month` lists them oldest first.
- **Runs per day:** W0 exactly as `runs_by_day`. Older windows: the window's tokens ÷ the agent's tokens per run in W0, spread over the days with the same weekly pattern.
- **Paths:** each top path gets round(share × runs) runs (largest-remainder method), in shuffled order – e.g. `app_status` in W0: 1061 / 45 / 23.
- **Tokens:** a random weight per run (longer paths weigh more), scaled so each window adds up exactly to `tokens_by_month`; about 95 % in, 5 % out, as measured on the real agent.
- **Tokens per run** follow the measurement of 16 Nov 2026 ([demo/n8n](../../demo/n8n/README.md)): Document check 11,700, Application status 6,200, the agents of the company 6,000 to 14,000.
- **Times:** working hours, 08:00–18:00 UTC.
- **Unused agent** `ref_check_reminder`: has no `top_paths`, so its runs take `read_open_checks > send_reminder`, at 6,000 tokens per run. Its last run was 124 days before `period_end`.
- **Model per provider** (assumption): Copilot Studio → gpt-4o (for the footprint only), Power Automate → gpt-4o, OpenAI → gpt-4.1, n8n → claude-opus-5-5, the model of the demo's real agent.

## Metrics

- **Per agent:** `runs_30d`, `tokens_30d`, `top_paths` (top 3 with their share), `same_path_share` (share of the most frequent path, 2 decimals), `days_since_last_run`, `tokens_by_month`, `runs_by_day`.
- **Uniform agent:** `same_path_share` ≥ 0.8 over at least 30 runs in the last 30 days.
- **Status:** retired (the owner's decision) before converted (next point) before unused (no run in the last 30 days) before active.
- **Conversion:** the owner's decision to move an agent to a lower step is a plan at first. It counts as done with the first run after the decision that called no model, so the run log confirms it. From then on the status is `converted`, the ladder step is the new one, and the agent is no uniform agent any more. `conversion` holds the step, the time of the decision, and the runs and tokens since.
- **Summary:** totals, `tokens_30d_previous` (W1), and `tokens_by_month` split into uniform and other agents.
- Names, purposes, agent reasons and suggestion texts are passed through from the sample data.

**Known difference:** the hand-made sample says `offer_letters` last ran 1 day ago, but its own `runs_by_day` has 15 runs on the last day – computed from the runs, `days_since_last_run` is 0. Everything else equals the sample data.

## Cost and footprint

Both are plain arithmetic on the runs of the last 30 days. Every price and factor is in `srv/lib/config.js` and is returned by `/api/monitor/impact` under `assumptions`.

- **Cost of a Copilot Studio agent:** it is billed per step, not per token. Every step of a run counts as one agent action of 5 Copilot Credits, and a credit costs 0.01 USD (Microsoft's list prices, checked 15 Nov 2026). Counting every step as an agent action is our assumption. A run of three steps costs 13.5 euro cents, whatever its tokens.
- **Cost of all other agents:** input tokens × input price + output tokens × output price of the run's model, in USD per 1 million tokens (list prices of OpenAI, checked 11 Nov 2026, and of Anthropic). Power Automate bills in credits too; pricing it by the tokens of the underlying model is our simplification.
- Both are converted with a fixed rate of 0.90 EUR per USD.
- **Footprint:** output tokens × the factor of the run's model. The factors come from [EcoLogits](https://ecologits.ai) 0.11.3 (providers `openai` and `anthropic`, their default electricity mix USA, a request with 1,000 output tokens), computed locally with its Python package. EcoLogits counts output tokens only. It gives a range, because the model architectures are not public; `co2e_30d_kg` and `energy_30d_kwh` are the middle of that range, and `co2e_30d_kg_range` is the range itself.
- **Uniform agents:** the same sums for the agents flagged as uniform – the part a workflow would no longer spend on model calls. For Lena that is 202.72 of 229.24 EUR and 1.28 of 1.83 kg CO₂e in 30 days. Application status alone costs 153.41 EUR, because it runs on Copilot Studio.
- **Saving potential:** 95 % of what the uniform agents cost (`savingShareIfConverted`, the business case's assumption for a converted agent). For Lena that is 192.58 EUR in 30 days.
- **A run without a model** (a rule or a plain workflow) costs and emits nothing here. For a converted agent, `saved_since_conversion_eur` is the number of such runs since the decision × the agent's average cost per run before.
- A model without a price or factor is an error, not a silent zero.

`AgentUsage` holds these numbers and the metrics per agent as a snapshot, written when the run log is filled and again for an agent when a run arrives or its owner decides, so the Fiori list can filter and sort in the database. Its `state` is `uniform`, `healthy` (active and not uniform), `unused` or `retired`.

## A connected provider: n8n

Two of Lena's agents exist for real as workflows in n8n ([demo/n8n](../../demo/n8n/README.md)).

- **Runs come in.** `connectors/n8n.js` reads n8n's execution log and sends every finished run of "Document check" to `/api/ingest/record`: its steps, its model and its tokens. The run is in the run log, in the numbers of the pages and in the Fiori list a few seconds later, with the source `n8n`.
- **Decisions go back.** When Lena retires "Reference check reminder" in rAIght, the connector switches the workflow off in n8n. "Reset demo" switches it on again.
- **A conversion switches over.** When Lena converts "Document check" to a rule, the connector switches the agent's workflow off and "Document check (rule)" on, and delivers that workflow's runs as the agent's runs, without a model and with 0 tokens. It finds the lower step by its name: the agent's name with the step in brackets. The connector switches, it does not build the rule.
- **The key.** A delivery needs the header `x-raight-key`. The backend compares it with the environment variable `RAIGHT_INGEST_KEY`, which is never in the repository. Without the variable, deliveries are refused in production; locally the key is `dev`.
- Only Lena's agents can be retired or converted. Everything else stays read-only.

## Deploy to SAP BTP

One Cloud Foundry app serves the pages and the API. It needs a BTP subaccount with the Cloud Foundry environment (a trial account is enough) and the [cf CLI](https://github.com/cloudfoundry/cli).

```bash
cf login -a <API endpoint of the subaccount>
cf push
cf set-env raight RAIGHT_INGEST_KEY <a long random key>   # once, so a connector can deliver runs
cf restage raight
```

`cf push` reads `manifest.yml` and prints the app's address (`routes:`). The app gets 1 GB of memory for the run log of the simulated company, and 180 seconds to start, because it answers only when the run log is filled.

What differs in the cloud (`cds` section of `package.json`):

- **Database:** SQLite in memory, as locally. The app fills it on every start, so there is nothing to back up. HANA is the path for real, growing run logs.
- **No login:** the demo is public (`auth: dummy` in production). Every entity is `@readonly`; writes to them get a 405. Two things can be written: the owner's decisions on Lena's agents (retire, convert), and runs from a provider that knows the key.
- **Fiori preview** is switched on in production too.

## Not built yet

HANA, connectors for Copilot Studio, Power Automate and OpenAI, single sign-on, and building the lower step: rAIght switches an n8n agent over to a rule that already exists, it does not generate that rule from the agent's paths yet.
