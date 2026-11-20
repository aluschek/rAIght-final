# ADR 0005 – Scope: external agents and automations

- **Status:** accepted
- **Date:** 2026-10-23
- **Amends:** [ADR 0004](0004-demo-first-scope.md) (named systems), concept docs 01–05, 08, 09
- **Superseded in part by:** [ADR 0008](0008-independent-vendor-framing.md), decisions 3 and 4 (the earlier business framing)

## Context

Our first concept placed rAIght inside one vendor's own agent platform. That is hard to make credible: nobody knows how many agents actually run there, and finding out would be harder than the build itself.

Most self-built AI automations are created with **third-party tools** that employees already have: Microsoft Copilot Studio, Power Automate with AI steps, OpenAI assistants, n8n and similar. That is also where sprawl nobody reviews happens ("shadow AI").

## Decision

1. **Scope A, automations, not chat.** rAIght covers **agents and automations that employees build themselves** and that run a process (each run = a sequence of steps/tool calls). **Chat usage** of assistants (e.g. asking Copilot to draft an email) is **out of scope**: it has no path to analyse, nothing to convert, and monitoring it would mean monitoring employees.
2. **External providers only (for now).** Sources are third-party tools: **Microsoft Copilot Studio, Power Automate (AI Builder), OpenAI (Assistants / GPTs), n8n**, extendable via one adapter per provider.
3. *(Replaced by [ADR 0008](0008-independent-vendor-framing.md).)*
4. *(Replaced by [ADR 0008](0008-independent-vendor-framing.md).)*
5. **Conversion stays within the tool.** A uniform agent becomes the lower ladder step in the same tool (Copilot Studio agent → Power Automate flow; n8n AI node → plain n8n workflow).

## Consequences

- Concept, demo script, data model and architecture name **external providers**. The persona Lena works in recruiting and builds with Copilot Studio and n8n.
- Agents get a `provider` field. Run logs from all providers are normalised into **one schema** by provider-specific adapters.
- **Hotspot H3 (agent inventory) becomes central**: rAIght first has to find agents across tools. In the demo this is a simulated import from all providers.
- New open question: how much step-level data each provider exposes (tokens, tool-call sequence). A short spike checks this so the demo story stays plausible ([ADR 0004](0004-demo-first-scope.md)).
- CO₂ per token for external providers is not published reliably, so tokens remain a **proxy** (H5).
- The tech-stack decision becomes ADR 0006.
