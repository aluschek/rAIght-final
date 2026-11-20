# 1 · Problem & thesis

## The customer's problem

We are an **independent company** that sells rAIght to companies. Our buyer is the customer's **CIO office**, which faces this problem:

> *Employees build more and more AI automations with external tools – Copilot Studio, Power Automate, OpenAI, n8n. We need to cut the token costs and CO₂ emissions they cause, without slowing down adoption.*

rAIght is our answer – a product sold to companies (B2B), not an internal tool ([ADR 0008](../decisions/0008-independent-vendor-framing.md)).

*Updated 26 Oct 2026: rAIght is framed as a product for any company ([ADR 0008](../decisions/0008-independent-vendor-framing.md)).*

## The tension

| More automation | Cost and climate targets |
|---|---|
| Agents and AI steps in more and more processes, built by employees themselves | Token and licence costs grow with every agent |
| Each agent plans, calls tools, checks and retries | Many large companies have committed to net-zero targets and report emissions (e.g. under CSRD) – external AI compute counts towards their value-chain (Scope 3) emissions |
| Built with external tools nobody reviews centrally | No one sees what each automation consumes |

## Root cause

The waste is not AI itself, but **using the wrong tool**: an agent doing a task a simple workflow could do. Process owners build their own automations with external tools, are trained on the tool but not on *when to use which step*, and never see what their agents consume.

## Thesis: the automation ladder

**Always use the lowest step that does the job.**

| Step | Example (recruiting) |
|---|---|
| 1 Rule | Check that all required documents are uploaded |
| 2 Workflow | Send status notifications at each stage of an application |
| 3 Classic ML | Suggest optional onboarding modules by role |
| 4 GenAI call | Draft a personalised message from a template |
| 5 Agent | Schedule a multi-round panel across time zones |
| 6 Multi-agent | Coordinate an international relocation across HR, IT and facilities |

Compute and energy need rise with every step.

## Key idea: agents explore, workflows execute

Agents are useful for new, messy cases. Once logs show that an agent keeps taking the same path, that path is frozen into a workflow, and the agent only handles the remaining exceptions. The ladder becomes a **cycle**, not a one-off choice.
