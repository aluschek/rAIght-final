# Architecture

One SAP CAP app (Node.js) serves the pages in `app/` and the API. It runs on SAP BTP in the Cloud Foundry environment ([ADR 0007](../decisions/0007-real-product-on-sap-btp.md)).

| Part | Where | What it does |
|---|---|---|
| Pages | `app/` | Plain HTML, CSS and JavaScript. For the process owner Lena: dashboard, agent detail, plan an automation, automations, guidelines, escalations. For the CIO office: the company view. For the admin: providers and access |
| Monitor API | `srv/monitor-service.*` | Agents, summary, cost and CO₂e, the company view and the latest runs of an agent. The decisions retire, restore, convert and reset |
| Ingest API | `srv/ingest-service.*` | Takes runs from a connector (`record`, only with the right key) and tells the connector the state of an agent (`state`) |
| Run log and metrics | `db/`, `srv/lib/` | The run log lives in a database in memory that is filled at every start: a generated company with 125 agents of 24 process owners and about 650,000 runs. The metrics are plain statistics per agent ([ADR 0002](../decisions/0002-no-ai-to-check-ai.md)): same-path share, uniform, unused, cost and CO₂e. Every rule and assumption is in `srv/lib/config.js` |
| n8n connector | `connectors/n8n.js` | Reads the executions of the real n8n agent every three seconds through n8n's API and delivers each finished run. The other way round, it switches workflows in n8n when an agent is retired, converted or reset |
| Real agents | `demo/n8n/` | The n8n workflows of the demo, the invented applications they read, and the measurement of what a run costs |

What is real and what is simulated is in the [README](../../README.md).

**Not built:** a login (the menu at the top right switches between Lena and the CIO office), SAP HANA Cloud (the database in memory is enough for the demo), connectors for Copilot Studio, Power Automate and OpenAI, and building a rule or workflow automatically from an agent's paths.
