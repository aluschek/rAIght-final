// rAIght – keeps one agent's row in AgentUsage (the snapshot behind the Fiori list) in step with the run log
// after a run arrived or the owner decided on the agent.
const cds = require("@sap/cds");
const { usageRows } = require("./lib/usage");

/** Recomputes the agent's AgentUsage row from its runs, saves it and returns it. */
async function refreshUsage(agentId) {
  const { Agents, Runs, AgentUsage } = cds.entities("raight");
  const agentRows = await SELECT.from(Agents).where({ ID: agentId });
  const runRows = await SELECT.from(Runs).columns("agent_ID", "startedAt", "path", "model", "tokensIn", "tokensOut").where({ agent_ID: agentId });
  const [{ ID, ...usage }] = usageRows(agentRows, runRows);
  await UPDATE(AgentUsage, ID).with(usage);
  return usage;
}

module.exports = { refreshUsage };
