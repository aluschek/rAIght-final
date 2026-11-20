# 4 · Value proposition & business model

rAIght is a **product sold to companies (B2B)** by us, an independent company ([ADR 0008](../decisions/0008-independent-vendor-framing.md)). The buyer is the customer's CIO office; the users are its process owners.

> **The CIO office can automate more without increasing emissions – and spends less on AI.**

## Value proposition canvas (customer: CIO office)

| Customer profile | | Value map | |
|---|---|---|---|
| **Jobs** | Let employees automate with AI · control token and licence costs · meet the company's net-zero and emissions-reporting goals · govern shadow AI | **Products & services** | rAIght training · dashboard · guided conversion |
| **Pains** | Agent sprawl across external tools nobody reviews · token costs and emissions grow with every agent · no visibility per automation or provider | **Pain relievers** | Every agent visible with its usage · uniform agents flagged and converted · unused agents retired |
| **Gains** | Same or better service level · measurable progress to net zero · lower running cost | **Gain creators** | Process owners choose lean themselves, so it scales without a central team · savings visible per unit · AI budget freed for high-value use cases |

## Business model canvas

| Block | Content |
|---|---|
| **Customer segments** | Companies whose employees build AI automations with external tools · Buyer: CIO office · Users: process owners · Stakeholder: sustainability office |
| **Value proposition** | Autonomy without emission growth – *Not more AI, but rAIght.* |
| **Channels** | Direct sales to CIO offices · connected to the tools process owners already use (Copilot Studio, Power Automate, OpenAI, n8n) · training · pilot in one unit (e.g. HR recruiting), then unit by unit |
| **Customer relationships** | Self-service · community of practice for process owners · recognition for lean teams |
| **Key activities** | Train process owners · run the dashboard · curate workflow templates · allocate and track carbon budgets · report savings |
| **Key resources** | Ladder & triage · dashboard on existing provider logs · one adapter per provider · template store · carbon accounting per run |
| **Key partners** | AI tool owners / IT (provider admin access, logs) · L&D · sustainability office · works council & data protection · providers and hyperscalers (energy data) |
| **Cost structure** | Product development and hosting · training content · sales and customer onboarding · support |
| **Revenue streams** | Paid by customers – revenue model and prices to be defined in the business case |

**Customer value** (what the customer saves and why they pay): lower token and licence costs, lower emissions, less maintenance, AI budget freed for use cases that really need an agent. On the customer's side, the main effort is **process owners' time** for conversions and change management.

## Carbon budget and the rebound effect

A carbon budget per business unit guards against the **rebound effect**, where cheaper AI simply leads to more AI. It caps total emissions, so efficiency gains turn into absolute savings.

| | Before | After, no cap | After, with budget |
|---|---|---|---|
| Emissions per task | 10 g | 4 g | 4 g |
| Tasks automated | 1,000 | 3,000 | 1,500 |
| **Total** | **10 kg** | **12 kg** | **6 kg** |

*Illustrative numbers.* The budget also gives process owners a reason to convert: freed budget can be reinvested in use cases that really need an agent. It complements an **internal carbon price** on AI compute: the budget caps the total, the price steers individual decisions.

## Ideas from a team workshop

1. Absolute carbon budget per business unit – 5 votes
2. Internal carbon price on AI compute – 3 votes
3. Pre-approved template store – 2 votes
4. Small-model-first default – team pick

## Revenue model and business case

The business case is being reworked for the independent-vendor framing. Open points to settle there (no prices or figures yet):

- **Revenue model** – e.g. subscription per customer, per monitored agent, or tiers by company size; one-time onboarding vs. recurring revenue
- **Customer value** – savings in tokens, licences and CO₂ per customer, as the basis for pricing
- **Costs** – development, hosting, sales, onboarding, support
- **Opportunity** – benchmarks across customers (with consent, aggregated and anonymised)
