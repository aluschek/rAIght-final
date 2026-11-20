// The n8n connector turns one execution from n8n's log into one run: the tools in the order they were called,
// the model, and the tokens of all model calls. The executions below have the shape n8n 2.47 returns.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { runFromExecution } = require("../connectors/n8n");

const modelCall = (startTime, promptTokens, completionTokens) => ({
  startTime,
  metadata: { tracing: { "gen_ai.request.model": "claude-opus-5-5" } },
  data: { ai_languageModel: [[{ json: { tokenUsage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens } } }]] },
});
const toolCall = (startTime) => ({ startTime, data: { ai_tool: [[{ json: { response: "…" } }]] } });
const step = (startTime) => ({ startTime, data: { main: [[{ json: {} }]] } });

const agentExecution = {
  id: 17,
  status: "success",
  startedAt: "2026-11-16T15:07:57.179Z",
  stoppedAt: "2026-11-16T15:08:09.350Z",
  data: { resultData: { runData: {
    "New application (webhook)": [step(9)],
    "Load application": [step(9)],
    "Anthropic Chat Model": [modelCall(686, 1081, 107), modelCall(2528, 3524, 615), modelCall(8436, 4174, 397)],
    // The model asked for the first two tools in one answer; they still have an order by start time.
    check_attachments: [toolCall(2500)],
    read_application: [toolCall(2487)],
    update_status: [toolCall(8414)],
    "AI Agent": [step(8423)],
  } } },
};

test("an agent's execution becomes one run: tools in call order, model, and the tokens of every model call", () => {
  assert.deepEqual(runFromExecution(agentExecution), {
    execution: "17",
    startedAt: "2026-11-16T15:07:57.179Z",
    seconds: 12.2,
    steps: ["read_application", "check_attachments", "update_status"],
    model: "claude-opus-5-5",
    modelCalls: 3,
    tokensIn: 8779,
    tokensOut: 1119,
  });
});

test("a workflow without a model has its nodes as steps, without triggers and branching, and no tokens", () => {
  const run = runFromExecution({
    id: 21,
    status: "success",
    startedAt: "2026-11-16T15:10:00.000Z",
    stoppedAt: "2026-11-16T15:10:00.040Z",
    workflowData: { nodes: [
      { name: "New application (webhook)", type: "n8n-nodes-base.webhook" },
      { name: "read_application", type: "n8n-nodes-base.code" },
      { name: "check_attachments", type: "n8n-nodes-base.code" },
      { name: "Which case?", type: "n8n-nodes-base.switch" },
      { name: "update_status", type: "n8n-nodes-base.set" },
    ] },
    data: { resultData: { runData: {
      "New application (webhook)": [step(1)],
      read_application: [step(2)],
      check_attachments: [step(5)],
      "Which case?": [step(7)],
      update_status: [step(9)],
    } } },
  });
  assert.deepEqual(run.steps, ["read_application", "check_attachments", "update_status"]);
  assert.deepEqual([run.model, run.modelCalls, run.tokensIn, run.tokensOut], [null, 0, 0, 0]);
});

test("an execution that failed or is still running is not a run", () => {
  assert.equal(runFromExecution({ ...agentExecution, status: "error" }), null);
  assert.equal(runFromExecution({ id: 3, status: "running", startedAt: "2026-11-16T15:07:57.179Z" }), null);
});
