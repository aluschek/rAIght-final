# Demo script

> This is the **scope boundary** for the build ([ADR 0006](../decisions/0006-pure-clickable-demo.md) – pure clickable demo, deadline 20 Nov 2026): what isn't in this script isn't built. Every step names the **page** that delivers it.

**Story:** A company's CIO office wants to cut token costs and CO₂ of employee-built AI automations and buys rAIght from us ([ADR 0008](../decisions/0008-independent-vendor-framing.md)). Lena, Recruiting Operations Lead in the company's HR, builds hers with Copilot Studio, Power Automate, OpenAI and n8n. With rAIght she learns when an agent is really needed, builds with the triage, sees all her agents across tools in one place, and finds out that some of them behave like workflows ([ADR 0005](../decisions/0005-scope-external-agents.md)).

**Target length:** about 3–4 minutes (fits the pitch video).

## Steps

| # | What Lena does | What the audience sees | Page |
|---|---|---|---|
| 0 | Opens rAIght | The dashboard is the landing page: headline, key figures, what needs attention | P5 |
| 1 | Starts the ladder module | Automation ladder with examples from different teams | P2 |
| 2 | Opens the triage cheat sheet | Triage questions on one page | P2 |
| 3 | Plans a new automation, answers the triage | Ladder step as result, with a read-only sketch of what that step looks like; if *agent* → one-line agent reason | P3 |
| 4 | *(time passes)* Opens her inventory | All her agents from Copilot Studio, Power Automate, OpenAI and n8n in one list | P4 |
| 5 | Opens the dashboard | Summary numbers, "needs your attention", table with provider, tokens, same-path share | P5 |
| 6 | Clicks "Application status – 94 % same path" | Agent detail: paths taken, suggestion "Convert to workflow" | P6 |
| 7 | Opens the unused agent, retires it | Status → retired, numbers on the dashboard drop | P6, P5 |
| 8 | *(optional)* Checks escalations | Cases routed to her | P7 |
| 9 | *(optional)* Opens the person menu (top right) and views the demo as the **CIO office** or the **Admin** | Each role has its own home page and menu. CIO office: company dashboard with figures per owner (aggregated, read-only). Admin: **Providers** (connect or disconnect) and **Access** (people and roles), no usage data | Finished sample data (`company.json`); client-side state only | – |
| 10 | *(optional)* Asks the **rAIght Assistant** (bottom right of the dashboard) about uniform agents or token use | Answers read from the sample data, with links to the agent pages | Keyword rules, **no model call** ([ADR 0002](../decisions/0002-no-ai-to-check-ai.md)) | – |
| 11 | *(optional)* Tells the rAIght Assistant what she wants to automate | The Assistant suggests the ladder step with the same three questions as Plan an automation (asks Yes or No where the description is not enough), shows a sketch of the step and offers an n8n draft file | Keyword rules, **no model call**; the draft is a downloadable file and the "Create in n8n" button is **simulated**, nothing is sent to n8n | – |
| 12 | *(optional)* Opens the **MCP servers and skills** panel (plug button in the Assistant), switches one off and asks a question that needs it, or connects another server by address | Three example servers (Jira MCP server, Internal Knowledge Hub, n8n) and three skills (Ladder triage, n8n draft, Token report) with on/off switches; a switched-off item makes the Assistant say so; every reply names its source | **Simulated**: nothing is connected, no model call ([ADR 0006](../decisions/0006-pure-clickable-demo.md)); the UI says so. A built-in assistant on a customer platform is only mentioned in the pitch, not built |

All numbers come from the finished sample data ([sample-data.md](sample-data.md), issue D1).

## Demo data requirements (D1)

The fixtures must make the story work:

- **Application status**: about 94 % same path → flagged *uniform* → "Convert to workflow"
- **Document check**: about 91 % → "Replace with rule"
- **Offer letters**: about 88 % → "Use template"
- **Interview scheduling**: about 52 % → "Keep agent for complex panels"
- **One unused agent** (no runs in the last 90 days) for step 7. Proposal: **Reference check reminder** (Copilot Studio), no runs for 124 days.

Values follow the illustrative table in [03-solution.md](../concept/03-solution.md).

## Named (simulated) systems

Shown in the UI and on the architecture slide by name only – no logos, no connections:

| System | Role in the story | Example agent |
|---|---|---|
| Microsoft Copilot Studio | Lena's conversational agents | Application status, Reference check reminder (unused) |
| Power Automate (AI Builder) | Flows with AI steps | Document check |
| OpenAI (Assistants) | Custom assistant via API | Offer letters |
| n8n | Workflow tool with AI nodes | Interview scheduling |
| Applicant tracking system (generic) | The HR process the agents automate (not a source of run logs) | – |

_Provider assignment is a proposal; the team can change it._

## Out of the demo

Backend, API and metric calculation (ADR 0006), chat usage of assistants (ADR 0005), further providers (later stage), login, roles that really restrict pages, real persistence, an AI model behind the Assistant, real calls to the n8n API and automatic creation of workflows (R2; the demo only offers a draft file and a simulated create step), guided conversion (R2), carbon budget (R3), agent inventory for pre-existing agents (H3), data-protection handling (H6).
