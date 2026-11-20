# ADR 0007 – rAIght as a real product on SAP BTP

- **Status:** accepted
- **Date:** 2026-10-27
- **Supersedes:** [ADR 0006](0006-pure-clickable-demo.md) (pure clickable demo); brings back "metrics computed for real" from [ADR 0004](0004-demo-first-scope.md)

## Context

- We want a prototype that runs online and can grow, and SAP BTP is the platform our target customers already use.
- ADR 0006 made the prototype a clickable demo on finished sample data. That kept it simple, but our core claim, "plain statistics on run logs find agents that act like workflows" (ADR 0002), stays unproven, and nothing a user clicks has a real effect.
- We want a prototype that goes beyond that: real logic, real data where possible, real effects, built so that we always have a working demo.

## Decision: three layers, each one demo-ready

### Layer 1: the real backend (by 6 Nov)

1. **SAP CAP (Node.js)** at the repo root. It serves our `app/` frontend and the API as one app on **SAP BTP** (Cloud Foundry).
2. **Data model from our EventStorming:** Department, ProcessOwner, Provider, Agent, Run (with its path of steps, tokens in/out, model), Decision.
3. **A simulated company:** a deterministic generator creates departments, their process owners and their agents across Copilot Studio, Power Automate, OpenAI and n8n, with months of runs. Lena's five agents keep their story (94 / 91 / 88 / 52 %, one unused for 124 days). Generated at start, not committed as huge files.
4. **Metrics computed in the backend, plain statistics only (ADR 0002):** tokens, runs, top paths and same-path share, uniform, unused, trends. Cost from a provider price table, energy and CO₂e per model with the **EcoLogits** methodology.
5. **Actions saved:** retire, convert, keep, agent reason, "Reset demo".
6. **Database:** SAP HANA Cloud on BTP, SQLite locally and as fallback.
7. **Frontend:** the same pages, still plain HTML/CSS/JS, with no framework and no SAPUI5/Fiori port, because the pages already exist and match our design system. `data.js` calls the API with the same function names, and the JSON files stay as fallback.

### Layer 2: real agents and the buyer's view (by 13 Nov)

8. **Real agents:** we build some of Lena's agents for real in **n8n** (LLM via API) and run them with scripted requests.
9. **Real connector:** rAIght imports their executions through the n8n API (steps and tokens) into the same run model. Part of the dashboard is then real data, and in the live demo a new run shows up.
10. **CIO overview:** company totals by department, € and CO₂e at company scale, realised savings and savings potential, the scale where these numbers matter.

### Layer 3: actions with a real effect (by the freeze, 16 Nov)

11. **"Retire"** deactivates the real n8n workflow through the API.
12. **"Convert to workflow"** generates an n8n workflow from the agent's most frequent path and creates it in n8n through the API (ADR 0005: conversion stays within the tool).
13. Optional: login with two roles (process owner, CIO office) via BTP (XSUAA).

## Fallbacks

Every layer keeps the one below working: no real n8n data → simulated data only; HANA down → SQLite; BTP down → a static copy with the JSON files. **Feature freeze on 16 Nov:** whatever isn't stable by then stays out of the live demo and goes on a slide.

## Consequences

- The demo can say "computed live on SAP BTP from the run logs of a whole company, part of them from real agents" and show a click that changes a real agent.
- The demo script stays the scope boundary. It gets the new steps (live run, CIO overview, real retire and convert).
- Much more work in 3.5 weeks, so the layer order and the freeze date are binding.
- Small costs: LLM API calls for the real agents (a few euros).

## Outcome (20 Nov 2026)

- **Layer 1** was built with a database in memory instead of HANA: the simulated company (125 agents of 24 process owners, about 650,000 runs) fits in memory and is generated at every start.
- **Layer 2** was built with one real agent in n8n (the document check), a real but unused workflow (the reference check reminder), the connector and the CIO office's view.
- **Layer 3:** "Retire" switches the n8n workflow off. The conversion switches n8n from the agent to a rule we built by hand, and rAIght marks the agent as converted once the run log shows the first run without a model call. Generating the workflow from the agent's path and the login were not built.
