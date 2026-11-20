// The simulated company: Lena's agents stay exactly as they are, the other owners' agents are generated around
// them, and the company view is the sum of its owners.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const sampleAgents = require("../app/data/agents.json");
const sampleSummary = require("../app/data/summary.json");
const config = require("../srv/lib/config");
const { generateRuns } = require("../srv/lib/generate-runs");
const { companyScenario } = require("../srv/lib/generate-company");
const { computeAgents } = require("../srv/lib/metrics");
const { computeImpact } = require("../srv/lib/impact");
const { computeCompany } = require("../srv/lib/company");

const scenario = companyScenario(sampleAgents);
const generated = generateRuns(scenario, sampleSummary.providers);
const agents = computeAgents(generated.agents, generated.runs);
const units = new Map(generated.agents.map((row) => [row.ID, row.unit]));
const company = computeCompany(agents, units, computeImpact(agents, generated.runs));
const sumOf = (rows, field) => rows.reduce((total, row) => total + row[field], 0);

test("the company is deterministic and has the configured size", () => {
  assert.deepEqual(companyScenario(sampleAgents), scenario);
  assert.equal(scenario.length, config.company.agents);
  assert.equal(new Set(scenario.map((agent) => agent.id)).size, scenario.length);
});

test("Lena's runs are the same with and without the company around her", () => {
  const alone = generateRuns(sampleAgents, sampleSummary.providers).runs;
  assert.deepEqual(generated.runs.slice(0, alone.length), alone);
});

test("computed from the runs, every generated agent has the runs and tokens of its scenario", () => {
  // Lena's own agents are checked field by field against the sample data in metrics.test.js.
  for (const planned of scenario.filter((agent) => agent.owner !== config.demoOwner)) {
    const computed = agents.find((agent) => agent.id === planned.id);
    assert.equal(computed.runs_30d, planned.runs_30d, planned.id);
    assert.equal(computed.tokens_30d, planned.tokens_30d, planned.id);
    assert.deepEqual(computed.tokens_by_month, planned.tokens_by_month, planned.id);
    assert.equal(computed.status, planned.status, planned.id);
    assert.equal(computed.days_since_last_run, planned.days_since_last_run, planned.id);
  }
});

test("Lena's row in the company view equals her own summary", () => {
  const lena = company.owners.find((row) => row.owner === "Lena");
  assert.deepEqual(lena, {
    owner: "Lena",
    unit: "HR · Recruiting",
    agents: sampleSummary.agents_total,
    uniform_agents: sampleSummary.agents_uniform,
    unused_agents: sampleSummary.agents_unused,
    tokens_30d: sampleSummary.tokens_30d,
    tokens_uniform_30d: sampleSummary.tokens_uniform_30d,
    tokens_30d_previous: sampleSummary.tokens_30d_previous,
    cost_30d_eur: 229.25,
    co2e_30d_kg: 1.826,
  });
});

test("the company has the size the business case assumes: about 1,000 runs per active agent, 10,000 tokens per run", () => {
  const active = agents.filter((agent) => agent.status === "active");
  const runs = sumOf(active, "runs_30d");
  assert.ok(Math.abs(runs / active.length - 1000) < 100, `${runs / active.length} runs per active agent`);
  assert.ok(Math.abs(company.tokens_30d / runs - 10000) < 1000, `${company.tokens_30d / runs} tokens per run`);
});

test("the pages' file for a start without a backend holds the same company", () => {
  assert.deepEqual(company, require("../app/data/company.json"));
});

test("the company totals are the sums of its owners", () => {
  assert.equal(company.agents_total, config.company.agents);
  assert.equal(company.owners_total, company.owners.length);
  for (const [total, field] of [
    ["agents_total", "agents"],
    ["agents_uniform", "uniform_agents"],
    ["agents_unused", "unused_agents"],
    ["tokens_30d", "tokens_30d"],
    ["tokens_uniform_30d", "tokens_uniform_30d"],
    ["tokens_30d_previous", "tokens_30d_previous"],
  ]) {
    assert.equal(company[total], sumOf(company.owners, field), total);
  }
  // Cost is rounded per agent before it is summed per owner, so allow one cent per agent.
  assert.ok(Math.abs(company.cost_30d_eur - sumOf(company.owners, "cost_30d_eur")) < config.company.agents * 0.01);
  assert.ok(company.cost_uniform_30d_eur <= company.cost_30d_eur);
});
