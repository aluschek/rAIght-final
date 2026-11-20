// A run delivered by a connected provider is checked before it enters the run log. The tests run with the
// period of the sample data (it ends on 25 Oct 2026), so a delivery "now" lies after the period.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const config = require("../srv/lib/config");
const { runRow } = require("../srv/lib/ingest");
const { computeAgents } = require("../srv/lib/metrics");

const known = { knownAgent: (id) => id === "doc_check" };
const run = (changes = {}) => ({
  agent: "doc_check",
  steps: ["read_application", "check_documents", "confirm_complete"],
  model: "gpt-4o-mini",
  tokensIn: 11200,
  tokensOut: 480,
  startedAt: "2026-10-20T09:30:00Z",
  ...changes,
});
const rejects = (input, pattern) => assert.throws(() => runRow(input, known), (err) => err.status === 400 && pattern.test(err.message));

test("a delivered run becomes a row of the run log, marked with its source", () => {
  assert.deepEqual(runRow(run(), known), {
    agent_ID: "doc_check",
    startedAt: "2026-10-20T09:30:00.000Z",
    path: "read_application > check_documents > confirm_complete",
    model: "gpt-4o-mini",
    tokensIn: 11200,
    tokensOut: 480,
    source: "n8n",
  });
});

test("the steps can also come as one text", () => {
  const row = runRow(run({ steps: undefined, path: "read_application>check_documents > confirm_complete " }), known);
  assert.equal(row.path, "read_application > check_documents > confirm_complete");
});

test("a run without a start time, or after the observed period, is booked on the period's last day", () => {
  const lastDay = `${config.periodEnd}T23:59:59.000Z`;
  assert.equal(runRow(run({ startedAt: undefined }), { ...known, now: new Date("2026-11-20T14:42:00Z") }).startedAt, lastDay);
  assert.equal(runRow(run({ startedAt: "2026-11-20T14:42:00Z" }), known).startedAt, lastDay);
});

test("a delivered run counts in the agent's last 30 days", () => {
  const agent = { ID: "doc_check", name: "Document check", retired: false };
  const [metrics] = computeAgents([agent], [runRow(run({ startedAt: undefined }), known)]);
  assert.equal(metrics.runs_30d, 1);
  assert.equal(metrics.tokens_30d, 11680);
  assert.equal(metrics.days_since_last_run, 0);
  assert.equal(metrics.status, "active");
});

test("bad deliveries are refused with a reason", () => {
  rejects(run({ agent: "nobody" }), /Unknown agent "nobody"/);
  rejects(run({ steps: [], path: "" }), /needs its steps/);
  rejects(run({ model: "some-model" }), /No price or footprint for model "some-model" – known models: gpt-4o/);
  rejects(run({ tokensIn: -1 }), /whole numbers/);
  rejects(run({ tokensOut: 12.5 }), /whole numbers/);
  rejects(run({ tokensIn: "11200" }), /whole numbers/);
  rejects(run({ startedAt: "yesterday" }), /is not a date/);
});

test("a run without a model call is accepted when it has no tokens", () => {
  const row = runRow(run({ model: undefined, tokensIn: 0, tokensOut: 0 }), known);
  assert.equal(row.model, null);
  assert.equal(row.tokensIn + row.tokensOut, 0);
  rejects(run({ model: undefined }), /A run with tokens needs its model/);
});
