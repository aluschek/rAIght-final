// AgentUsage is a flat snapshot of the same numbers the pages get from MonitorApi – one row per agent.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const sampleAgents = require("../app/data/agents.json");
const sampleSummary = require("../app/data/summary.json");
const { generateRuns } = require("../srv/lib/generate-runs");
const { usageRows } = require("../srv/lib/usage");

const generated = generateRuns(sampleAgents, sampleSummary.providers);
const rowsById = (agents) => Object.fromEntries(usageRows(agents, generated.runs).map((row) => [row.ID, row]));

test("one row per agent with the numbers of the last 30 days", () => {
  const rows = rowsById(generated.agents);
  assert.equal(Object.keys(rows).length, sampleAgents.length);
  assert.deepEqual(rows.app_status, {
    ID: "app_status",
    name: "Application status",
    provider_ID: "copilot_studio",
    owner: "Lena",
    unit: null, // the sample data has no units; the simulated company adds them
    state: "uniform",
    stateCriticality: 1,
    runs30d: 1129,
    tokens30d: 7010000,
    samePathPercent: 94,
    daysSinceLastRun: 0,
    cost30dEur: 153.41,
    co2e30dKg: 0.273,
    suggestion: "Convert to workflow",
  });
});

test("state: uniform, healthy, unused and retired, each with its Fiori colour", () => {
  const rows = rowsById(generated.agents.map((agent) => ({ ...agent, retired: agent.ID === "doc_check" })));
  const stateOf = (id) => [rows[id].state, rows[id].stateCriticality];
  assert.deepEqual(stateOf("app_status"), ["uniform", 1]);
  assert.deepEqual(stateOf("interview_scheduling"), ["healthy", 3]);
  assert.deepEqual(stateOf("ref_check_reminder"), ["unused", 2]);
  assert.deepEqual(stateOf("doc_check"), ["retired", 0]);
  assert.equal(rows.ref_check_reminder.samePathPercent, null); // no runs in the last 30 days
});
