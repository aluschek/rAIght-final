# Decision records (ADRs)

Short records of decisions that affect the whole team. One file per decision, numbered consecutively: `NNNN-short-title.md`.

Format:

```markdown
# ADR NNNN – Title
- Status: proposed | accepted | superseded by ADR NNNN
- Date: YYYY-MM-DD

## Context        – why we need to decide
## Decision       – what we decided
## Consequences   – what follows from it, good and bad
```

| ADR | Decision |
|---|---|
| [0001](0001-process-owner-owns-the-lifecycle.md) | The process owner owns the whole lifecycle |
| [0002](0002-no-ai-to-check-ai.md) | Monitoring uses statistics on existing logs, not AI |
| [0004](0004-demo-first-scope.md) | Demo-first scope: external systems mocked, metrics real, demo script as scope boundary |
| [0005](0005-scope-external-agents.md) | Scope: external agents and automations (Copilot Studio, Power Automate, OpenAI, n8n); chat out; conversion stays within the tool *(framing superseded by 0008)* |
| [0006](0006-pure-clickable-demo.md) | Pure clickable demo: frontend only, finished sample data, one issue per page *(superseded by 0007)* |
| [0007](0007-real-product-on-sap-btp.md) | rAIght as a real product on SAP BTP: CAP backend, simulated company, real n8n agents – three demo-ready layers |
| [0008](0008-independent-vendor-framing.md) | Independent vendor framing: we sell rAIght to companies; buyer is the customer's CIO office; no SAP framing |
