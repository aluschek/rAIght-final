// rAIght backend – every rule and assumption in one place (no magic numbers).

// The sample data (app/data/summary.json) ends on 25 Oct 2026, and the tests use that date. The server sets
// RAIGHT_PERIOD_END to today before this file loads (srv/server.js), so that a run arriving live from a connected
// provider falls into the last 30 days. Only the dates move with it; the generated numbers stay the same.
const periodEnd = process.env.RAIGHT_PERIOD_END || "2026-10-25";

module.exports = {
  // The observed period ends at the last import.
  periodEnd,
  lastImport: `${periodEnd}T08:00:00+01:00`,
  windowDays: 30, // one "month" in the metrics = 30 days, counted back from periodEnd
  windows: 6, // tokens_by_month covers six of them

  // Metric rules (glossary: uniform agent, unused agent)
  uniformThreshold: 0.8, // same_path_share at or above this …
  uniformMinRuns: 30, // … over at least this many runs in the last 30 days
  unusedAfterDays: 30, // no run for this many days → unused

  pathSeparator: " > ",

  // The owner's decisions and what they are worth
  stepBySuggestion: { "Convert to workflow": "workflow", "Replace with rule": "rule", "Use template": "genai_call" }, // the ladder step a suggestion leads to
  savingShareIfConverted: 0.95, // assumption of the business case: a converted agent saves 95 % of its cost
  latestRuns: 5, // runs shown on an agent's page

  // Generator assumptions – v1 only, until real run logs are imported
  seed: 20261025,
  // n8n: the model of the demo's real agent (demo/n8n). Copilot Studio: for the footprint only, see creditBilling.
  modelByProvider: { copilot_studio: "gpt-4o", power_automate: "gpt-4o", openai: "gpt-4.1", n8n: "claude-opus-5-5" },
  tokensPerRunFallback: 6000, // for agents without runs in the last 30 days: what the measured light agent needs
  fallbackSteps: { ref_check_reminder: ["read_open_checks", "send_reminder"] }, // for agents without top_paths
  workingHoursUtc: [8, 18],
  // Measured on the real agent (demo/n8n/README.md): about 96 % of a run's tokens are input, because an agent
  // sends its instructions, its tools and the documents again with every model call.
  tokensInShare: 0.95,
  tokensInSpread: 0.04, // a single run lies up to half of this above or below the share

  // The simulated company around Lena (srv/lib/generate-company.js) – assumptions, until real run logs are imported
  demoOwner: "Lena", // /api/monitor/agents, /summary and /impact show this process owner's agents
  company: {
    seed: 20261026,
    agents: 125, // Lena's five included – the business case's mid-sized company: 250 automations, half of them agents
    providerWeights: { copilot_studio: 0.35, power_automate: 0.3, n8n: 0.2, openai: 0.15 },
    uniformShare: 0.55, // share of the generated agents built to repeat one path
    uniformPathRange: [0.82, 0.97], // their share of runs on the main path
    variedPathRange: [0.36, 0.78], // the same for the others
    runsRange: [150, 3550], // runs in the last 30 days; most agents sit near the lower end, the mean is about 1,000
    tokensPerRunRange: [6000, 14000], // evenly spread: from the measured light agent to agents with more steps or longer documents
    growthRange: [-0.03, 0.09], // change of an agent's tokens per 30 days
    weekendWeight: 0.2, // a weekend day gets a fifth of a working day's runs
    unusedShare: 0.1, // share of the generated agents nobody runs any more
    unusedDaysRange: [35, 170], // days since their last run
    unusedWindowTokensRange: [120000, 840000], // tokens per 30 days while they were still used
  },

  // Cost and footprint per model – assumptions, returned with every result of /api/monitor/impact
  usdToEur: 0.9, // fixed rate for the demo, not a live exchange rate
  // Providers that bill per step, not per token. Copilot Studio charges Copilot Credits: an agent action costs
  // 5 credits, a credit 0.01 USD pay-as-you-go (Microsoft's list prices, checked 15 Nov 2026). Assumption: every
  // step of a run is one agent action. All other providers: tokens × the list price of the model.
  creditBilling: { copilot_studio: { creditsPerStep: 5, usdPerCredit: 0.01 } },
  // List prices in USD per 1 million tokens (OpenAI model pages, checked 11 Nov 2026)
  priceUsdPerMillionTokens: {
    "gpt-4o": { input: 2.5, output: 10 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4.1": { input: 2, output: 8 },
    // The models of the real n8n agent (Anthropic list prices, model overview of 3 Nov 2026)
    "claude-opus-5-5": { input: 4, output: 20 },
    "claude-sonnet-5-5": { input: 2, output: 10 },
    "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  },
  // EcoLogits 0.11.3 (ecologits.ai), providers "openai" and "anthropic" with their default electricity mix (USA),
  // for a request with 1,000 output tokens: [min, max]. EcoLogits counts output tokens only, and gives a range
  // because the model architectures are not public.
  footprintPer1kOutputTokens: {
    "gpt-4o": { gCo2e: [0.5887, 0.9585], wh: [1.436, 2.398] },
    "gpt-4o-mini": { gCo2e: [0.02691, 0.03216], wh: [0.06441, 0.07808] },
    "gpt-4.1": { gCo2e: [0.5452, 0.8436], wh: [1.328, 2.104] },
    "claude-opus-5-5": { gCo2e: [1.251, 2.343], wh: [3.086, 5.928] },
    "claude-sonnet-5-5": { gCo2e: [0.4661, 0.7216], wh: [1.131, 1.796] },
    "claude-haiku-5-5": { gCo2e: [0.02309, 0.06065], wh: [0.05645, 0.1505] },
  },
};
