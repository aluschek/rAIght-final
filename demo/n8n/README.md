# The real n8n agents of the demo

Two of Lena's automations exist for real, as workflows in n8n:

- **Document check** is an agent: a model with five tools that reads the files of an application and decides whether the documents are complete. `connectors/n8n.js` reads n8n's execution log and delivers every run to rAIght.
- **Reference check reminder** is the agent nobody triggers any more. When Lena retires it in rAIght, the connector switches the workflow off in n8n.

**Document check (rule)** does the same job on ladder step 1, without a model. It stays switched off until Lena converts the agent in rAIght ("Replace with rule"). Then the connector switches the agent off and the rule on, and the rule's runs arrive in rAIght without a model call and with 0 tokens. rAIght counts the agent as converted with the first of these runs. The connector switches between the two workflows, it does not build the rule. Two more workflows exist only for the measurement.

All applicants and documents are invented (`make-applications.js`, `make-status-requests.js`). The agent reads documents of the usual length of a complete application (about 1,500 words, `applications-full.json`). A shorter set (`applications.json`) is for the measurement only.

## Run it

Needs a running n8n (2.47 or newer) with an Anthropic credential, and an n8n API key.

```bash
export N8N_API_KEY_FILE=<file with the n8n API key>   # or N8N_API_KEY
node demo/n8n/setup.js        # creates or updates the workflows and switches them on
npm run watch                 # rAIght, in a second terminal
node connectors/n8n.js        # delivers runs to rAIght and carries Retire to n8n
```

Then run "Document check" in n8n. The run shows up in rAIght a few seconds later, in the Fiori list of the runs with the source `n8n`.

The connector finds an agent by its name: the n8n workflow "Document check" belongs to the rAIght agent "Document check". Its settings are at the top of `connectors/n8n.js`.

## What an agent run costs: the measurement

`measure.js` sends the test applications to a workflow, reads the executions back from n8n and writes the result to `measurements/`. Measured on 16 Nov 2026 with n8n 2.47.7, 24 inputs, three rounds each. Prices are Anthropic's list prices.

| Workflow | Model | Runs | Tokens per run (min–max) | Model calls | USD per run |
|---|---|---|---|---|---|
| Document check, short documents (about 800 words) | Claude Opus 5.5 | 67 | 9,116 (7,226–9,963) | 3 | 0.0429 |
| Document check, short documents | Claude Sonnet 5.5 | 72 | 8,919 (7,104–9,737) | 3 | 0.0202 |
| Document check, short documents | Claude Haiku 5.5 | 72 | 9,327 (7,471–10,507) | 3 | 0.0011 |
| Document check, documents of the usual length (about 1,500 words) | Claude Opus 5.5 | 72 | 11,713 (9,622–12,561) | 3 | 0.0532 |
| Application status, a light agent without documents | Claude Opus 5.5 | 72 | 6,212 (4,159–8,201) | 4 | 0.0358 |
| Document check (rule) | none | 72 | 0 | 0 | 0 |

What it shows:

- About 96 % of the tokens are input. The agent sends its instructions, its tools and the documents again with every model call.
- The number of tokens hardly depends on the model. The price does: the same job costs 40 times more on the largest of the three models we measured than on the smallest.
- The rule needs no model call at all.
- Document check ended as expected in every run on Opus and Sonnet and in 71 of 72 runs on Haiku: 88 % complete, 8 % ask for a missing document, 4 % hand over to a person.

rAIght's demo data follows these values (`srv/lib/config.js`, `app/data/agents.json`):

- Document check has 11,700 tokens per run, and Application status 6,200 like the light agent.
- The simulated agents of the company need 6,000 to 14,000 tokens per run, 95 % of them input.
- An n8n agent costs its tokens at the list price of its model. For a Copilot Studio agent we assume billing per step, like an agent action (5 Copilot Credits of 0.01 USD each), so it costs about 13.5 euro cents per run of three steps, whatever its tokens.

Two earlier passes are not in the table. Their test documents contradicted each other (a residence permit for students, a permit that expired before the start date), and the agent handed those applications over to a person. The documents were fixed; each applicant's documents are now written from one profile.
