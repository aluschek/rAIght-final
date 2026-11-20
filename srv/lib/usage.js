// rAIght – one row per agent for the AgentUsage entity: the numbers of metrics.js and impact.js as a flat
// snapshot, so list UIs (Fiori) can filter and sort them in the database.
const { computeAgents } = require("./metrics");
const { computeImpact } = require("./impact");

// Fiori criticality: 1 = negative (red), 2 = critical (orange), 3 = positive (green), 0 = neutral
const CRITICALITY = { uniform: 1, unused: 2, healthy: 3, converted: 3, retired: 0 };

/** Retired, converted and unused are the agent's status; an active agent is either uniform or healthy. */
const stateOf = (agent) => (agent.status !== "active" ? agent.status : agent.uniform_agent ? "uniform" : "healthy");

/** Rows for AgentUsage from the entity rows of Agents and Runs. */
function usageRows(agentRows, runRows) {
  const agents = computeAgents(agentRows, runRows);
  const impactById = new Map(computeImpact(agents, runRows).agents.map((impact) => [impact.id, impact]));
  const unitById = new Map(agentRows.map((row) => [row.ID, row.unit ?? null]));
  return agents.map((agent) => {
    const state = stateOf(agent);
    const impact = impactById.get(agent.id);
    return {
      ID: agent.id,
      name: agent.name,
      provider_ID: agent.provider,
      owner: agent.owner,
      unit: unitById.get(agent.id),
      state,
      stateCriticality: CRITICALITY[state],
      runs30d: agent.runs_30d,
      tokens30d: agent.tokens_30d,
      samePathPercent: agent.same_path_share === null ? null : Math.round(agent.same_path_share * 100),
      daysSinceLastRun: agent.days_since_last_run,
      cost30dEur: impact.cost_30d_eur,
      co2e30dKg: impact.co2e_30d_kg,
      suggestion: agent.suggestion,
    };
  });
}

module.exports = { usageRows };
