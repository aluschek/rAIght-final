// rAIght – the JSON endpoints for the pages (MonitorApi in monitor-service.cds): reads the run log and
// computes the metrics with srv/lib/. MonitorService (OData, read-only) needs no code.
const cds = require("@sap/cds");
const config = require("./lib/config");
const { computeAgents, computeSummary } = require("./lib/metrics");
const { impactSums, impactFrom, runCostEur } = require("./lib/impact");
const { computeCompany } = require("./lib/company");
const runLog = require("./lib/run-log");
const { refreshUsage } = require("./usage-snapshot");

class MonitorApi extends cds.ApplicationService {
  init() {
    const { Agents, Runs, Providers } = cds.entities("raight");

    // Every agent's numbers are computed from its own runs and kept. When a run arrives or an owner decides on an
    // agent, only that agent is read again – the run log of the whole company is never loaded at once.
    const kept = new Map(); // agent ID → { agent, unit, sums }, in the order of the Agents table
    let allRead = false;
    const read = async (row) => {
      const runRows = await SELECT.from(Runs).columns("agent_ID", "startedAt", "path", "model", "tokensIn", "tokensOut").where({ agent_ID: row.ID });
      const [agent] = computeAgents([row], runRows);
      kept.set(row.ID, { agent, unit: row.unit, sums: impactSums([agent], runRows).get(agent.id) });
    };
    const compute = async () => {
      const changed = runLog.takeChanged();
      let rows = [];
      if (!allRead) rows = await SELECT.from(Agents);
      else if (changed.length) rows = await SELECT.from(Agents).where({ ID: { in: changed } });
      for (const row of rows) await read(row);
      allRead = true;
      const company = [...kept.values()].map((entry) => entry.agent);
      const mine = company.filter((agent) => agent.owner === config.demoOwner);
      const sums = new Map([...kept].map(([id, entry]) => [id, entry.sums]));
      const units = new Map([...kept].map(([id, entry]) => [id, entry.unit]));
      return {
        agents: mine,
        summary: computeSummary(mine, await SELECT.from(Providers)),
        impact: impactFrom(mine, sums),
        company: computeCompany(company, units, impactFrom(company, sums)),
      };
    };
    // One computation at a time, and a new one only after something changed. After an error everything is read again.
    let computed;
    let computedWith;
    const current = () => {
      if (!computed || computedWith !== runLog.version()) {
        computedWith = runLog.version();
        computed = (computed || Promise.resolve()).catch(() => {}).then(compute).catch((err) => {
          allRead = false;
          computedWith = undefined;
          throw err;
        });
      }
      return computed;
    };
    const serve = (part) => async () => structuredClone((await current())[part]);

    for (const part of ["agents", "summary", "impact", "company"]) this.on(part, serve(part));

    // The owner's decision is saved with the agent, so it survives a reload and a connected provider can ask for it
    // (IngestApi.state). The demo has one process owner, so only that owner's agents can be decided on.
    const ownAgent = async (req) => {
      const agent = await SELECT.one.from(Agents).columns("ID", "owner", "retired", "suggestion", "convertedTo").where({ ID: req.data.agent });
      if (!agent) return req.reject(404, `Unknown agent "${req.data.agent}"`);
      if (agent.owner !== config.demoOwner) return req.reject(403, `Only ${config.demoOwner}'s agents can be decided on in the demo`);
      return agent;
    };
    const save = async (agent, changes) => {
      await UPDATE(Agents, agent.ID).with(changes);
      runLog.changed(agent.ID);
      await refreshUsage(agent.ID);
      const saved = { ...agent, ...changes };
      return { agent: agent.ID, retired: Boolean(saved.retired), converted_to: saved.convertedTo || null };
    };
    const decide = (retired) => async (req) => {
      const agent = await ownAgent(req);
      return agent && save(agent, { retired });
    };
    this.on("retire", decide(true));
    this.on("restore", decide(false));
    // Converting follows rAIght's suggestion for the agent. The run log shows later whether it happened (metrics.js).
    this.on("convert", async (req) => {
      const agent = await ownAgent(req);
      if (!agent) return;
      const step = config.stepBySuggestion[agent.suggestion];
      if (!step) return req.reject(400, `rAIght suggests "${agent.suggestion}" for this agent, which is no conversion`);
      return save(agent, { convertedTo: step, convertedAt: new Date().toISOString() });
    });
    this.on("reset", async () => {
      const decided = await SELECT.from(Agents).columns("ID", "retired", "convertedTo").where({ owner: config.demoOwner });
      const changed = decided.filter((agent) => agent.retired || agent.convertedTo);
      for (const agent of changed) await save(agent, { retired: false, convertedTo: null, convertedAt: null });
      return { restored: changed.length };
    });

    // The latest runs of one agent up to now, each with its cost. The generated runs of today's later hours stay out.
    // A delivered run always counts: it carries the clock of the tool that ran it, which can be a second or two ahead
    // of the server's, and a run that has just ended has to show up at once.
    this.on("runs", async (req) => {
      const agent = await ownAgent(req);
      if (!agent) return;
      const { provider_ID } = await SELECT.one.from(Agents).columns("provider_ID").where({ ID: agent.ID });
      const now = new Date().toISOString();
      const rows = await SELECT.from(Runs).columns("startedAt", "path", "model", "tokensIn", "tokensOut", "source")
        .where`agent_ID = ${agent.ID} and (startedAt <= ${now} or source <> ${"generated"})`
        .orderBy("startedAt desc").limit(config.latestRuns);
      return rows.map((run) => ({
        started_at: run.startedAt,
        steps: run.path.split(config.pathSeparator),
        model: run.model || null,
        tokens: run.tokensIn + run.tokensOut,
        cost_eur: Math.round(runCostEur(run, provider_ID) * 10000) / 10000,
        source: run.source,
      }));
    });

    return super.init();
  }
}

// Exported by name, so CAP uses it for MonitorApi only and MonitorService keeps the generic handlers.
module.exports = { MonitorApi };
