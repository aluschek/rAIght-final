// The metrics computed from the generated runs must give back the finished sample data (app/data/),
// so the pages show the same numbers with and without the backend.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const sampleAgents = require("../app/data/agents.json");
const sampleSummary = require("../app/data/summary.json");
const { generateRuns } = require("../srv/lib/generate-runs");
const { computeAgents, computeSummary } = require("../srv/lib/metrics");

const generated = generateRuns(sampleAgents, sampleSummary.providers);
const agents = computeAgents(generated.agents, generated.runs);

test("the generator is deterministic", () => {
  assert.deepEqual(generateRuns(sampleAgents, sampleSummary.providers), generated);
});

test("paths are split with the largest-remainder method (app_status, last 30 days: 1061 / 45 / 23)", () => {
  const counts = {};
  for (const run of generated.runs) {
    if (run.agent_ID === "app_status" && run.startedAt >= "2026-09-26") counts[run.path] = (counts[run.path] || 0) + 1;
  }
  assert.deepEqual(Object.values(counts).sort((a, b) => b - a), [1061, 45, 23]);
});

for (const sample of sampleAgents) {
  test(`${sample.id}: computed metrics equal the sample data`, () => {
    const expected = { ...sample };
    // Known exception: the hand-made sample says offer_letters last ran 1 day ago, but its own runs_by_day
    // has 15 runs on the last day – computed from the runs, it is 0.
    if (sample.id === "offer_letters") expected.days_since_last_run = 0;
    assert.deepEqual(agents.find((a) => a.id === sample.id), expected);
  });
}

test("summary: computed totals equal the sample data", () => {
  assert.deepEqual(computeSummary(agents, generated.providers), sampleSummary);
});

test("status: retired (decision) wins over unused, which wins over active", () => {
  const rows = generated.agents.map((a) => ({ ...a, retired: a.ID === "app_status" || a.ID === "ref_check_reminder" }));
  const status = Object.fromEntries(computeAgents(rows, generated.runs).map((a) => [a.id, a.status]));
  assert.equal(status.app_status, "retired");
  assert.equal(status.ref_check_reminder, "retired");
  assert.equal(status.doc_check, "active");
});

const runsOn = (count, path) => Array.from({ length: count }, () => ({ agent_ID: "x", startedAt: "2026-10-25T10:00:00.000Z", path, tokensIn: 70, tokensOut: 30 }));
const agentWith = (runs) => computeAgents([{ ID: "x", retired: false }], runs)[0];

test("uniform: needs a same_path_share of at least 0.8 over at least 30 runs", () => {
  const uniform = (runs) => agentWith(runs).uniform_agent;
  assert.equal(uniform(runsOn(29, "a > b")), false);
  assert.equal(uniform(runsOn(30, "a > b")), true);
  assert.equal(uniform([...runsOn(24, "a > b"), ...runsOn(6, "a > c")]), true); // 0.80
  assert.equal(uniform([...runsOn(23, "a > b"), ...runsOn(7, "a > c")]), false); // 0.77
});

test("uniform: compares the exact share, not the rounded one shown (159 / 200 = 79.5 % is not uniform)", () => {
  const below = agentWith([...runsOn(159, "a > b"), ...runsOn(41, "a > c")]);
  assert.equal(below.same_path_share, 0.8); // still shown rounded
  assert.equal(below.uniform_agent, false);
  assert.equal(agentWith([...runsOn(160, "a > b"), ...runsOn(40, "a > c")]).uniform_agent, true);
});

const modelRun = (startedAt) => ({ agent_ID: "x", startedAt, path: "a > b", model: "gpt-4o", tokensIn: 70, tokensOut: 30 });
const ruleRun = (startedAt) => ({ agent_ID: "x", startedAt, path: "a > b", model: null, tokensIn: 0, tokensOut: 0 });
const decided = { ID: "x", retired: false, ladderStep: "agent", convertedTo: "rule", convertedAt: "2026-10-20T00:00:00.000Z" };
const agentRuns = Array.from({ length: 40 }, () => modelRun("2026-10-15T10:00:00.000Z"));

test("conversion: the owner's decision alone is a plan, the agent stays a uniform agent", () => {
  const [agent] = computeAgents([decided], agentRuns);
  assert.deepEqual(agent.conversion, { to: "rule", since: "2026-10-20T00:00:00.000Z", runs: 0, tokens: 0, done: false });
  assert.deepEqual([agent.status, agent.ladder_step, agent.uniform_agent], ["active", "agent", true]);
});

test("conversion: the first run without a model after the decision confirms it", () => {
  const runs = [...agentRuns, ruleRun("2026-10-19T10:00:00.000Z"), ruleRun("2026-10-21T10:00:00.000Z"), ruleRun("2026-10-22T10:00:00.000Z")];
  const [agent] = computeAgents([decided], runs);
  assert.deepEqual(agent.conversion, { to: "rule", since: "2026-10-20T00:00:00.000Z", runs: 2, tokens: 0, done: true }); // the run of 19 Oct was before the decision
  assert.deepEqual([agent.status, agent.ladder_step, agent.uniform_agent], ["converted", "rule", false]);
  assert.equal(computeSummary([agent], []).agents_converted, 1);
  assert.equal(computeSummary([agent], []).agents_uniform, 0);
});

test("conversion: without a decision there is none, whatever the runs", () => {
  const [agent] = computeAgents([{ ID: "x", retired: false, ladderStep: "agent" }], [...agentRuns, ruleRun("2026-10-21T10:00:00.000Z")]);
  assert.equal(agent.conversion, null);
  assert.equal(agent.status, "active");
});
