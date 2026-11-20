// rAIght – the n8n connector. n8n keeps a log of every execution; this reads it through n8n's public API,
// turns each finished execution of a known agent into one run (steps, model, tokens) and delivers it to rAIght.
// It also carries the owner's decisions the other way: a retired agent's workflow is switched off in n8n, and a
// converted agent is switched over to its lower step. That step is the n8n workflow with the agent's name and the
// step in brackets, for example "Document check (rule)". The connector switches, it does not build that workflow.
// The workflows themselves need no extra nodes – rAIght only reads the log that already exists.
//
// Run it next to n8n:  node connectors/n8n.js            (delivers executions that finish from now on)
//                      node connectors/n8n.js --backfill (also delivers the executions n8n already has)
// Settings come from the environment:
//   N8N_URL (http://localhost:5678), N8N_API_KEY or N8N_API_KEY_FILE,
//   RAIGHT_URL (http://localhost:4004), RAIGHT_INGEST_KEY (locally "dev"), POLL_SECONDS (3)
const fs = require("node:fs");

const LOWER_STEP = / \((rule|workflow|classic_ml|genai_call)\)$/; // "Document check (rule)" is a lower step of "Document check"

/** One run from one n8n execution (with its data), or null if the execution did not finish successfully. */
function runFromExecution(execution) {
  const runData = execution.data?.resultData?.runData;
  if (execution.status !== "success" || !runData) return null;
  const tasks = Object.entries(runData).flatMap(([node, list]) => list.map((task) => ({ node, ...task })));
  const modelCalls = tasks.filter((task) => task.data?.ai_languageModel);
  const toolCalls = tasks.filter((task) => task.data?.ai_tool).sort((a, b) => a.startTime - b.startTime);
  // A workflow without a model has no tool calls: its steps are the nodes it ran, without triggers and branching.
  const typeOf = new Map((execution.workflowData?.nodes || []).map((node) => [node.name, node.type]));
  const isStep = (task) => !/trigger|webhook|\.switch$|\.if$/i.test(typeOf.get(task.node) || "") && !/^Example /.test(task.node);
  const nodeSteps = tasks.filter((task) => task.data?.main && isStep(task)).sort((a, b) => a.startTime - b.startTime || a.executionIndex - b.executionIndex);
  const usage = (task) => task.data.ai_languageModel[0]?.[0]?.json?.tokenUsage || {};
  const sum = (field) => modelCalls.reduce((total, task) => total + (usage(task)[field] || 0), 0);
  return {
    execution: String(execution.id),
    startedAt: execution.startedAt,
    seconds: Math.round((Date.parse(execution.stoppedAt) - Date.parse(execution.startedAt)) / 100) / 10,
    steps: (modelCalls.length ? toolCalls : nodeSteps).map((task) => task.node),
    model: modelCalls[0]?.metadata?.tracing?.["gen_ai.request.model"] ?? null,
    modelCalls: modelCalls.length,
    tokensIn: sum("promptTokens"),
    tokensOut: sum("completionTokens"),
  };
}

function client({ n8nUrl, n8nKey, raightUrl, ingestKey }) {
  const json = async (res, what) => {
    const text = await res.text();
    if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };
  const n8n = async (method, route) => json(await fetch(`${n8nUrl}/api/v1${route}`, { method, headers: { "X-N8N-API-KEY": n8nKey } }), `n8n ${method} ${route}`);
  return {
    n8n,
    /** Every execution of a workflow that started after `since` (ISO time, optional), oldest first, with its data. */
    async executions(workflowId, since) {
      const found = [];
      let cursor;
      do {
        const page = await n8n("GET", `/executions?workflowId=${workflowId}&includeData=true&limit=50${since ? `&startedAfter=${encodeURIComponent(since)}` : ""}${cursor ? `&cursor=${cursor}` : ""}`);
        found.push(...page.data);
        cursor = page.nextCursor;
      } while (cursor);
      return found.sort((a, b) => Number(a.id) - Number(b.id));
    },
    raightAgents: async () => json(await fetch(`${raightUrl}/api/monitor/agents`), "rAIght agents"),
    raightState: async (agent) => json(await fetch(`${raightUrl}/api/ingest/state?agent=${encodeURIComponent(agent)}`), "rAIght state"),
    deliver: async (agent, run) => json(await fetch(`${raightUrl}/api/ingest/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-raight-key": ingestKey },
      body: JSON.stringify({ agent, steps: run.steps, model: run.model, tokensIn: run.tokensIn, tokensOut: run.tokensOut, startedAt: run.startedAt, source: "n8n" }),
    }), "rAIght record"),
  };
}

async function main() {
  const settings = {
    n8nUrl: (process.env.N8N_URL || "http://localhost:5678").replace(/\/$/, ""),
    n8nKey: (process.env.N8N_API_KEY || fs.readFileSync(process.env.N8N_API_KEY_FILE, "utf8")).trim(),
    raightUrl: (process.env.RAIGHT_URL || "http://localhost:4004").replace(/\/$/, ""),
    ingestKey: process.env.RAIGHT_INGEST_KEY || "dev",
  };
  const pollMs = Number(process.env.POLL_SECONDS || 3) * 1000;
  const api = client(settings);
  const log = (text) => console.log(`${new Date().toLocaleTimeString("en-GB")}  ${text}`);

  // An n8n workflow belongs to the rAIght agent with the same name. Its lower steps carry the step in brackets.
  const agents = new Map((await api.raightAgents()).map((agent) => [agent.name, agent.id]));
  const all = (await api.n8n("GET", "/workflows?limit=250")).data;
  const workflows = all.filter((workflow) => agents.has(workflow.name));
  if (!workflows.length) throw new Error(`No n8n workflow is named like one of rAIght's agents (${[...agents.keys()].join(", ")})`);
  const lowerSteps = (workflow) => all.filter((other) => LOWER_STEP.test(other.name) && other.name.replace(LOWER_STEP, "") === workflow.name);
  log(`connected: ${workflows.map((workflow) => `"${workflow.name}" → ${agents.get(workflow.name)}`).join(", ")}`);

  const delivered = new Set();
  let since = process.argv.includes("--backfill") ? undefined : new Date().toISOString();
  /** Switches a workflow on or off if it is not in that state yet. Returns whether it had to. */
  const setActive = async (workflow, wanted) => {
    const { active } = await api.n8n("GET", `/workflows/${workflow.id}`);
    if (active === wanted) return false;
    await api.n8n("POST", `/workflows/${workflow.id}/${wanted ? "activate" : "deactivate"}`);
    return true;
  };
  /** New executions of a workflow become runs of the agent in rAIght. */
  const deliverRuns = async (workflow, agent, { withoutModel = false, from } = {}) => {
    for (const execution of await api.executions(workflow.id, since)) {
      if (delivered.has(execution.id) || !execution.stoppedAt) continue;
      delivered.add(execution.id);
      const run = runFromExecution(execution);
      if (!run || (from && run.startedAt < from)) continue; // failed, or from before the conversion
      if (!run.modelCalls && !withoutModel) continue; // an agent's run always calls its model
      const receipt = await api.deliver(agent, run);
      const used = run.modelCalls ? `${run.tokensIn + run.tokensOut} tokens (${run.model})` : "no model call, 0 tokens";
      log(`${workflow.name}: run delivered – ${run.steps.join(" > ")} – ${used} → ${receipt.runs_30d} runs in 30 days`);
    }
  };
  for (;;) {
    for (const workflow of workflows) {
      const agent = agents.get(workflow.name);
      try {
        // 1. New executions of the agent become runs in rAIght.
        await deliverRuns(workflow, agent);

        // 2. The owner's decisions reach n8n: retired means switched off, converted means the lower step runs instead.
        const state = await api.raightState(agent);
        const steps = lowerSteps(workflow);
        const target = state.converted_to && steps.find((other) => other.name === `${workflow.name} (${state.converted_to})`);
        const agentOn = !state.retired && !target;
        if (await setActive(workflow, agentOn)) {
          const why = state.retired ? "retired in rAIght → switched off in n8n" : target ? `converted in rAIght → switched off in n8n, "${target.name}" takes over` : "switched on again in n8n";
          log(`${workflow.name}: ${why}`);
        }
        for (const step of steps) {
          const on = step === target && !state.retired;
          if (await setActive(step, on)) log(`${step.name}: switched ${on ? "on" : "off"} in n8n`);
        }

        // 3. After a conversion the runs of the lower step are the agent's runs. They call no model.
        if (target) await deliverRuns(target, agent, { withoutModel: true, from: state.converted_at });
      } catch (err) {
        log(`${workflow.name}: ${err.message}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

if (require.main === module) main().catch((err) => { console.error(err.message); process.exit(1); });

module.exports = { runFromExecution, client };
