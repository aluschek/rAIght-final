# rAIght

Team Scrumsterz, University of Mannheim, IS 613 Enterprise Cloud Design and Development, November 2026.

rAIght helps companies find AI agents that should be workflows. It reads the run logs that tools like n8n, Copilot Studio, Power Automate and OpenAI already write. Plain statistics then show each process owner which of her agents repeat the same steps, what they cost and what they emit. She can replace such an agent with a workflow or a rule, or retire it. The CIO office sees the totals per unit.

## Live app

https://raight-daring-bat-tg.cfapps.us10-001.hana.ondemand.com

It ran on SAP BTP (Cloud Foundry, trial account) for the final presentation on 20 November 2026. SAP stops trial apps every night, so the link may be offline. The menu at the top right switches between the process owner Lena and the CIO office. There is no login: anyone with the link can try the decisions, and "Reset demo" on the About page takes them all back. The n8n part needs our local n8n, which only ran during the presentation. Without it, "Replace with rule" on Document check stays at "Change planned", because rAIght waits for the first run of the rule.

## What is real and what is simulated

**Real:** the backend on SAP BTP built with SAP CAP, the run log, the statistics, cost and CO₂e, Retire, the conversion of an agent to a rule, and both views. One agent runs for real in n8n ("Document check"). Its runs reach rAIght a few seconds after they end, and when the process owner replaces it with a rule, n8n switches over to the rule.

**Simulated:** the run logs of Copilot Studio, Power Automate and OpenAI, and the company around Lena with 125 agents of 24 process owners and about 650,000 runs. They are generated with a fixed seed, so every start gives the same company.

What an agent run costs was measured on the real agent. The results are in `demo/n8n/README.md`.

## Run it locally

Needs Node.js 20 or newer.

```
npm install
npm run watch
```

Then open http://localhost:4004. `npm test` runs the tests. The real n8n agent needs a local n8n, see `demo/n8n/README.md`.

## Where things are

| Folder | What is in it |
|---|---|
| `app/` | The pages, in plain HTML, CSS and JavaScript |
| `srv/`, `db/` | The backend (SAP CAP) and the data model. Every rule and assumption is in `srv/lib/config.js` |
| `connectors/` | The n8n connector |
| `demo/n8n/` | The real n8n agents of the demo and the measurement |
| `test/` | The tests |
| `docs/concept/` | The product concept |
| `docs/decisions/` | The decisions we made along the way |
| `docs/technical/` | Backend, data model, API, design system and demo script |

## How we built it

We built rAIght with the help of an AI coding assistant (Claude Code). This repository is a copy of the final state of our team repository.

## Disclaimer

rAIght is a student project. It is not affiliated with or endorsed by SAP, Microsoft, OpenAI, Anthropic or n8n. Their names are trademarks of their owners.
