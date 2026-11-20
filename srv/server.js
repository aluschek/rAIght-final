// rAIght – CAP's standard server, plus the run log on start. The local database lives in memory, so it is
// empty after every start: generate the runs from the sample data and the simulated company, and insert them.
// The server answers requests only after that, so no page ever sees half a company.

// The observed period ends today, so a run that a connected provider delivers now counts in the last 30 days.
// Set before the libraries load, because they read the period once (srv/lib/config.js).
process.env.RAIGHT_PERIOD_END ??= new Date().toISOString().slice(0, 10);

const cds = require("@sap/cds");
const { runsByAgent, providerRows } = require("./lib/generate-runs");
const { companyScenario } = require("./lib/generate-company");
const { usageRows } = require("./lib/usage");

const BATCH_SIZE = 10000;
const RUN_COLUMNS = ["ID", "agent_ID", "startedAt", "path", "model", "tokensIn", "tokensOut"];
const LOG = cds.log("raight");

cds.on("served", async () => {
  const { Providers, Agents, Runs, AgentUsage } = cds.entities("raight");
  if (await SELECT.one.from(Runs)) return;

  const scenario = companyScenario(require("../app/data/agents.json")); // Lena's agents and the simulated company around her
  await INSERT.into(Providers).entries(providerRows(require("../app/data/summary.json").providers));
  let count = 0;
  // One agent at a time, so the run log of the whole company is never held in memory at once.
  for (const { agent, runs } of runsByAgent(scenario)) {
    await INSERT.into(Agents).entries(agent);
    // As rows, not as objects: for a run log of this size that takes a third less time.
    for (let i = 0; i < runs.length; i += BATCH_SIZE) {
      const rows = runs.slice(i, i + BATCH_SIZE).map((run) => RUN_COLUMNS.map((column) => run[column]));
      await INSERT.into(Runs).columns(...RUN_COLUMNS).rows(rows);
    }
    await INSERT.into(AgentUsage).entries(usageRows([agent], runs));
    count += runs.length;
  }
  // The services read one agent's runs at a time (MonitorApi, IngestApi).
  await cds.run("CREATE INDEX raight_Runs_agent ON raight_Runs (agent_ID)");
  LOG.info(`generated ${count} runs for ${scenario.length} agents`);
  await cds.services.MonitorApi.send("company"); // computes every agent once, so the first page opens at once
});

module.exports = cds.server;
