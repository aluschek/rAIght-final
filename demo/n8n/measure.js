// rAIght demo – the measurement behind "what does an agent cost per run?".
// Sends applications to an n8n workflow's webhook, reads the executions back from n8n's log and reports
// tokens, steps and cost per run. The result is saved without any document text.
//
// Usage: node demo/n8n/measure.js <workflow name> <webhook path> <label> [rounds=1] [parallel=2]
// e.g.   node demo/n8n/measure.js "Document check" document-check opus-5-5 3
// Needs N8N_API_KEY or N8N_API_KEY_FILE. Every agent run calls the model and costs money.
// With MEASURE_COLLECT_SINCE=<ISO time> nothing is run: the executions n8n has since that time are reported.
const fs = require("node:fs");
const path = require("node:path");
const config = require("../../srv/lib/config");
const { runFromExecution, client } = require("../../connectors/n8n");

const [workflowName, hookPath, label, rounds = "1", parallel = "2"] = process.argv.slice(2);
const n8nUrl = (process.env.N8N_URL || "http://localhost:5678").replace(/\/$/, "");
const n8nKey = (process.env.N8N_API_KEY || fs.readFileSync(process.env.N8N_API_KEY_FILE, "utf8")).trim();
const api = client({ n8nUrl, n8nKey });
const loaded = require(process.env.MEASURE_INPUTS ? path.resolve(process.env.MEASURE_INPUTS) : "./applications.json");
const inputs = Array.isArray(loaded) ? loaded : loaded.requests; // status-requests.json keeps its inputs under "requests"

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { mean: Math.round(values.reduce((s, v) => s + v, 0) / values.length), median: at(0.5), min: sorted[0], p90: at(0.9), max: sorted[sorted.length - 1] };
};

(async () => {
  const workflow = (await api.n8n("GET", `/workflows?name=${encodeURIComponent(workflowName)}&limit=5`)).data.find((w) => w.name === workflowName);
  if (!workflow) throw new Error(`No workflow named "${workflowName}"`);
  const collectOnly = Boolean(process.env.MEASURE_COLLECT_SINCE);
  const queue = collectOnly ? [] : Array.from({ length: Number(rounds) }, () => inputs.map((input) => input.id)).flat();
  const startedAt = process.env.MEASURE_COLLECT_SINCE || new Date().toISOString();
  console.log(collectOnly ? `collecting the executions of "${workflowName}" since ${startedAt} …` : `${queue.length} runs of "${workflowName}" (${label}), ${parallel} at a time …`);

  // Each webhook call waits for its run to finish. One retry, because a model call can fail for a moment.
  const failed = [];
  const outputs = new Map();
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        const res = await fetch(`${n8nUrl}/webhook/${hookPath}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ application_id: id }) }).catch((err) => ({ ok: false, status: err.message }));
        if (res.ok) { outputs.set(id, await res.json().catch(() => null)); break; }
        if (attempt === 2) failed.push(`${id}: ${res.status}`);
        else await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  };
  await Promise.all(Array.from({ length: Number(parallel) }, worker));

  const executions = await api.executions(workflow.id, startedAt);
  const expected = new Map(inputs.map((input) => [input.id, input.expected]));
  const runs = executions.map((execution) => {
    const run = runFromExecution(execution);
    const trigger = Object.values(execution.data?.resultData?.runData || {}).flat().map((task) => task.data?.main?.[0]?.[0]?.json?.body?.application_id).find(Boolean);
    return run && { ...run, input: trigger, expected: expected.get(trigger) };
  }).filter(Boolean);
  if (!runs.length) throw new Error(`No finished executions found. Failed calls: ${failed.join("; ") || "none"}`);

  // Cost at list price, with the prices of srv/lib/config.js.
  const price = (run) => config.priceUsdPerMillionTokens[run.model];
  const usd = (run) => (price(run) ? (run.tokensIn * price(run).input + run.tokensOut * price(run).output) / 1e6 : 0);
  const paths = {};
  for (const run of runs) paths[run.steps.join(" > ") || "(no tool)"] = (paths[run.steps.join(" > ") || "(no tool)"] || 0) + 1;
  const result = {
    workflow: workflowName, label, measured_at: startedAt, n8n_version: "2.47.7", runs: runs.length, failed_calls: failed.length,
    model: runs[0].model,
    tokens_per_run: stats(runs.map((run) => run.tokensIn + run.tokensOut)),
    tokens_in_per_run: stats(runs.map((run) => run.tokensIn)),
    tokens_out_per_run: stats(runs.map((run) => run.tokensOut)),
    input_share: Math.round((runs.reduce((s, r) => s + r.tokensIn, 0) / runs.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0)) * 1000) / 1000,
    model_calls_per_run: stats(runs.map((run) => run.modelCalls)),
    seconds_per_run: stats(runs.map((run) => run.seconds)),
    usd_per_run: runs[0].model ? Math.round((runs.reduce((s, r) => s + usd(r), 0) / runs.length) * 1e5) / 1e5 : 0,
    usd_total: Math.round(runs.reduce((s, r) => s + usd(r), 0) * 100) / 100,
    paths: Object.fromEntries(Object.entries(paths).sort((a, b) => b[1] - a[1]).map(([steps, count]) => [steps, { runs: count, share: Math.round((count / runs.length) * 1000) / 1000 }])),
    per_run: runs.map(({ execution, input, expected: exp, steps, model, modelCalls, tokensIn, tokensOut, seconds }) => ({ execution, input, expected: exp, steps: steps.join(" > "), model, model_calls: modelCalls, tokens_in: tokensIn, tokens_out: tokensOut, seconds })),
  };
  const dir = path.join(__dirname, "measurements");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}.json`);
  fs.writeFileSync(file, `${JSON.stringify(result, null, 1)}\n`);

  const { per_run, ...summary } = result;
  console.log(JSON.stringify(summary, null, 1));
  if (failed.length) console.log("failed calls:", failed.join("; "));
  console.log(`saved to ${path.relative(process.cwd(), file)}`);
})().catch((err) => { console.error(err.message); process.exit(1); });
