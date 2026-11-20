# Sample data

> The format of the texts and sample data in `app/data/`. In the clickable-demo phase ([ADR 0006](../decisions/0006-pure-clickable-demo.md)) the pages ran on these files alone. Since [ADR 0007](../decisions/0007-real-product-on-sap-btp.md) the backend computes the numbers from the run log.

All files live in `app/data/`. Use glossary names ([09-glossary.md](../concept/09-glossary.md)).

## `agents.json` – Lena's automations, metrics already filled in

| Field | Type | Example / note |
|---|---|---|
| `id` | string | `app_status` |
| `name` | string | `Application status` |
| `provider` | enum | `copilot_studio`, `power_automate`, `openai`, `n8n` – shown by name, no logos ([ADR 0005](../decisions/0005-scope-external-agents.md)) |
| `owner` | string | `Lena` |
| `purpose` | string | One line |
| `ladder_step` | enum | `rule`, `workflow`, `classic_ml`, `genai_call`, `agent`, `multi_agent` |
| `agent_reason` | string | One-line reason why it's an agent |
| `status` | enum | `active`, `unused`, `retired`, `converted` (retired and converted only through the buttons in the demo) |
| `runs_30d` | integer | `1129` |
| `tokens_30d` | integer | `7010000` – per run at the level we measured on real agents (6,200 to 15,100 tokens, [demo/n8n](../../demo/n8n/README.md)) |
| `same_path_share` | number 0–1 | `0.94` |
| `uniform_agent` | boolean | `true` if it acts like a workflow – set by hand, consistent with `same_path_share` (≥ 0.8) |
| `conversion` | object or null | The owner's decision to convert and what the run log shows since: `{ to, since, runs, tokens, done }`. `null` in the sample data |
| `days_since_last_run` | integer | `124` for the unused agent |
| `top_paths` | list | up to 3 × `{ "steps": ["read_request","lookup_status","send_reply"], "share": 0.94 }` |
| `suggestion` | string | `Convert to workflow`, `Replace with rule`, `Use template`, `Keep agent`, `Retire` |
| `suggestion_text` | string | One sentence why |
| `tokens_by_month` | list of 6 integers | Tokens per month, May → Oct 2026; last value = `tokens_30d`. Feeds the 6-month trend in the dashboard table |
| `runs_by_day` | list of 30 integers | Runs per day for the last 30 days; sum = `runs_30d`. Feeds "Runs per day" on the agent page |

**The five agents** (values from [03-solution.md](../concept/03-solution.md) and the demo script):

| Agent | Provider | Same path | Suggestion |
|---|---|---|---|
| Application status | Copilot Studio | 94 % | Convert to workflow |
| Document check | n8n | 91 % | Replace with rule |
| Offer letters | OpenAI | 88 % | Use template |
| Interview scheduling | n8n | 52 % | Keep agent |
| Reference check reminder | n8n | – (no runs for 124 days) | Retire |

Document check and Reference check reminder exist for real as workflows in n8n, so n8n is their provider.

> **Lena is a persona, not the audience.** rAIght is for any team that builds its own automations. Her sample agents come from HR recruiting because that is the pilot we describe; keep every text, example and placeholder outside the agent data neutral, and show other teams where it helps (the ladder examples, the company dashboard).

## `summary.json` – numbers for the start page and dashboard header

Totals must match `agents.json` (sum of tokens and runs, number of uniform and unused agents). Optional: a value per period (7 / 30 / 90 days) if the period switch is shown.

| Field | Type | Note |
|---|---|---|
| `period`, `period_end` | string | `last_30_days`, `2026-10-25` |
| `last_import` | ISO datetime | Shown in the source strip ("Run logs imported …") |
| `runs_30d`, `tokens_30d` | integer | Sums over `agents.json` |
| `tokens_30d_previous` | integer | Previous 30 days – for the "vs previous 30 d" chip |
| `agents_total`, `agents_active`, `agents_unused`, `agents_converted`, `agents_uniform` | integer | Counts over `agents.json` |
| `tokens_uniform_30d` | integer | Sum of `tokens_30d` of uniform agents |
| `uniform_threshold` | number 0–1 | `0.8` – drawn as the threshold line |
| `providers` | list | `{ "id", "name" }` – sidebar "Connected providers" and source strip |
| `tokens_by_month` | list | `{ "month": "2026-05", "tokens_uniform", "tokens_other" }` × 6 – "Token usage by month" chart |

## `impact.json` – cost and CO₂e of Lena's agents

What `/api/monitor/impact` answers for the sample data, so the pages show cost and CO₂e without a backend too. A test keeps the file equal to the computed values, and `node demo/write-sample-data.js` writes it again together with `summary.json` and `company.json`. How cost and footprint are computed is in [backend.md](backend.md#cost-and-footprint).

| Field | Note |
|---|---|
| `agents` | `{ id, cost_30d_eur, co2e_30d_kg, co2e_30d_kg_range, energy_30d_kwh, saved_since_conversion_eur }` per agent |
| `total`, `uniform_agents` | the same values for all agents and for the uniform agents |
| `saving_potential_30d_eur` | what converting every uniform agent would save: 95 % of their cost |
| `assumptions` | the prices, the credit billing and the footprint factors used |

## `company.json` – company-wide totals for the CIO office

Finished values, aggregated per owner: no single agent or run. Lena's row equals the sums of `agents.json` and `summary.json`; the other 23 owners are the simulated company of the backend ([backend.md](backend.md#the-simulated-company)), and a test keeps the file equal to the computed values. Totals must match the owner rows (tokens, uniform tokens, agent counts), the last month of `tokens_by_month` must equal `tokens_30d`, and the month before must equal `tokens_30d_previous`.

| Field | Note |
|---|---|
| `period`, `period_end`, `uniform_threshold` | as in `summary.json` |
| `owners_total`, `agents_total`, `agents_uniform`, `agents_unused` | counts over the owner rows |
| `tokens_30d`, `tokens_30d_previous`, `tokens_uniform_30d` | sums over the owner rows |
| `cost_30d_eur`, `cost_uniform_30d_eur`, `co2e_30d_kg`, `co2e_uniform_30d_kg` | cost and CO₂e of all agents and of the uniform agents |
| `saving_potential_30d_eur` | what converting every uniform agent would save |
| `tokens_by_month` | six `{ month, tokens_uniform, tokens_other }` entries, May → Oct 2026 |
| `owners` | `{ owner, unit, agents, uniform_agents, unused_agents, tokens_30d, tokens_uniform_30d, tokens_30d_previous, cost_30d_eur, co2e_30d_kg }` × 24 |

## `users.json` – people with access (Admin → Access) and the roles the demo can be shown as

`{ "email", "name", "role", "you" }` – 3 entries. `role` is `process_owner`, `cio_office` or `admin`; `you: true` marks the person the demo starts as (Lena); the person menu in the top bar switches it, and whoever is shown cannot change their own role or be removed. What a role may do is defined in `app/assets/data.js` (`PERMISSIONS`). Use demo e-mail addresses (`@customer.demo`), never real ones. Added, changed or removed people are client-side state, not written to the file.

## `escalations.json` – cases for the Escalations page

`{ "id", "agent_id", "category", "priority", "text", "time" }` – about 9 entries across the agents. `category` is one of *Unclear request*, *Missing information*, *Exception to a rule*, *Needs a decision*, *Unusual case*; `priority` is `high`, `medium` or `low`; `time` is an ISO datetime. Whether a case is handled is client-side state, not stored in the file. The page counts these rows for its summary tiles and the agent × category matrix.

## `content/guide.json` – plain-language texts for the Guidelines page

Written for colleagues who are **not** technical: `headline` and `intro` (what rAIght does), `how` (three steps with a button each; `needs` names the permission a role must have to see the button), `steps` (one plain sentence for each ladder step, keyed by the ids in `ladder.json`), `terms` (a one-sentence meaning for words such as token or run log); keep every text to one short sentence and add no examples or comparisons. `ladder.json` and `triage.json` stay as they are.

## `content/` – texts

Ladder steps with examples from different teams (finance, IT, support, HR), triage questions and outcomes, start-page texts.

## Rules

- No real names or personal data – Lena is a persona.
- Numbers must be **consistent** across files; the click-through before merging checks this.
- If a page needs a new field, add it here first.
