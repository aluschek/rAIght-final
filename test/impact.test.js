// Cost and footprint are plain arithmetic on the run log: tokens × list price (or credits per step where the
// provider bills that way), and output tokens × EcoLogits factor.
// The expected numbers below follow from the assumptions in srv/lib/config.js; change them together.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const sampleAgents = require("../app/data/agents.json");
const sampleSummary = require("../app/data/summary.json");
const { generateRuns } = require("../srv/lib/generate-runs");
const { computeAgents } = require("../srv/lib/metrics");
const { computeImpact, impactSums, impactFrom } = require("../srv/lib/impact");

const run = (startedAt, model = "gpt-4o") => ({ agent_ID: "x", startedAt, path: "a > b", model, tokensIn: 2000000, tokensOut: 2000000 });
const impactOf = (runs) => computeImpact(computeAgents([{ ID: "x", retired: false }], runs), runs);

test("one run: 2 M input and 2 M output tokens on gpt-4o", () => {
  const { agents, total } = impactOf([run("2026-10-25T10:00:00.000Z")]);
  const expected = {
    cost_30d_eur: 22.5, // (2 × $2.50 + 2 × $10) × 0.9
    co2e_30d_kg: 1.547, // the middle of the range
    co2e_30d_kg_range: [1.177, 1.917], // 2,000 × 0.5887 g and 2,000 × 0.9585 g
    energy_30d_kwh: 3.834, // the middle of 2,000 × 1.436 Wh and 2,000 × 2.398 Wh
  };
  assert.deepEqual(agents, [{ id: "x", ...expected, saved_since_conversion_eur: 0 }]);
  assert.deepEqual(total, expected);
});

test("Copilot Studio is billed per step, not per token: 10 runs of 2 steps at 5 credits of $0.01", () => {
  const runs = Array.from({ length: 10 }, () => run("2026-10-25T10:00:00.000Z"));
  const billedBy = (provider) => computeImpact(computeAgents([{ ID: "x", provider_ID: provider, retired: false }], runs), runs).total;
  assert.equal(billedBy("copilot_studio").cost_30d_eur, 0.9); // 10 × 2 × 5 × $0.01 × 0.9, whatever the tokens
  assert.equal(billedBy("openai").cost_30d_eur, 225); // the same runs by tokens
  assert.equal(billedBy("copilot_studio").co2e_30d_kg, billedBy("openai").co2e_30d_kg); // the footprint follows the tokens
});

test("only the last 30 days count", () => {
  const inside = run("2026-09-26T08:00:00.000Z");
  const before = run("2026-09-25T17:00:00.000Z");
  const after = run("2026-10-26T08:00:00.000Z");
  assert.deepEqual(impactOf([inside, before, after]).total, impactOf([inside]).total);
});

test("a model without a price or footprint is an error, not a silent zero", () => {
  assert.throws(() => impactOf([run("2026-10-25T10:00:00.000Z", "unknown-model")]), /No price or footprint for model "unknown-model"/);
});

test("sample data: Lena's agents, and the share of the uniform agents", () => {
  const generated = generateRuns(sampleAgents, sampleSummary.providers);
  const impact = computeImpact(computeAgents(generated.agents, generated.runs), generated.runs);
  const byId = Object.fromEntries(impact.agents.map((agent) => [agent.id, agent]));

  assert.equal(impact.agents.length, sampleAgents.length);
  assert.equal(byId.ref_check_reminder.cost_30d_eur, 0); // unused: no run in the last 30 days
  assert.equal(byId.app_status.cost_30d_eur, 153.41); // Copilot Studio: 1,129 runs of 3 steps on average, 15 credits each
  assert.equal(byId.doc_check.cost_30d_eur, 42.66); // n8n: 9.86 M tokens at the list price of its model
  assert.deepEqual(impact.total, { cost_30d_eur: 229.24, co2e_30d_kg: 1.826, co2e_30d_kg_range: [1.299, 2.353], energy_30d_kwh: 4.567 });
  assert.deepEqual(impact.uniform_agents, { cost_30d_eur: 202.72, co2e_30d_kg: 1.28, co2e_30d_kg_range: [0.918, 1.641], energy_30d_kwh: 3.197 });
  assert.equal(impact.saving_potential_30d_eur, 192.58); // 95 % of what the uniform agents cost
  assert.deepEqual(impact, require("../app/data/impact.json")); // what the pages show without a backend
});

test("computed one agent at a time, the result is the same as in one pass over all runs", () => {
  const generated = generateRuns(sampleAgents, sampleSummary.providers);
  const agents = computeAgents(generated.agents, generated.runs);
  const sums = new Map(agents.map((agent) => [agent.id, impactSums([agent], generated.runs.filter((run) => run.agent_ID === agent.id)).get(agent.id)]));
  assert.deepEqual(impactFrom(agents, sums), computeImpact(agents, generated.runs));
});

test("the assumptions are returned with the result", () => {
  const { assumptions } = impactOf([]);
  assert.equal(assumptions.usd_to_eur, 0.9);
  assert.equal(assumptions.saving_share_if_converted, 0.95);
  assert.deepEqual(assumptions.credit_billing, [{ provider: "copilot_studio", credits_per_step: 5, usd_per_credit: 0.01 }]);
  assert.deepEqual(assumptions.prices.find((price) => price.model === "gpt-4o"), {
    model: "gpt-4o",
    usd_per_million_input_tokens: 2.5,
    usd_per_million_output_tokens: 10,
  });
  assert.deepEqual(assumptions.footprints.find((footprint) => footprint.model === "gpt-4o-mini"), {
    model: "gpt-4o-mini",
    g_co2e_per_1k_output_tokens_range: [0.02691, 0.03216],
    wh_per_1k_output_tokens_range: [0.06441, 0.07808],
  });
});

test("after a conversion: runs without a model cost nothing, and they count as saved agent runs", () => {
  const before = Array.from({ length: 4 }, () => run("2026-10-10T10:00:00.000Z")); // 22.50 EUR each
  const after = Array.from({ length: 2 }, () => ({ agent_ID: "x", startedAt: "2026-10-22T10:00:00.000Z", path: "a > b", model: null, tokensIn: 0, tokensOut: 0 }));
  const runs = [...before, ...after];
  const converted = computeAgents([{ ID: "x", retired: false, convertedTo: "rule", convertedAt: "2026-10-20T00:00:00.000Z" }], runs);
  const { agents: [agent], total } = computeImpact(converted, runs);
  assert.equal(total.cost_30d_eur, 90); // only the four agent runs
  assert.equal(agent.saved_since_conversion_eur, 45); // two runs × the agent's 22.50 EUR per run

  const notConverted = computeAgents([{ ID: "x", retired: false }], runs);
  assert.equal(computeImpact(notConverted, runs).agents[0].saved_since_conversion_eur, 0);
});
