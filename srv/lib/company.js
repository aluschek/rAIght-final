// rAIght – the company view for the CIO office: totals over all agents and one row per process owner, in the
// shape of app/data/company.json, plus cost and footprint. Aggregated only: no single run or agent is shown.
const config = require("./config");
const { computeSummary } = require("./metrics");

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * @param {object[]} agents output of computeAgents for all agents of the company
 * @param {Map<string, string>} units the owner's unit per agent ID
 * @param {object} impact output of computeImpact for the same agents
 */
function computeCompany(agents, units, impact) {
  const totals = computeSummary(agents, []);
  const impactOf = new Map(impact.agents.map((agent) => [agent.id, agent]));
  const owners = new Map();
  for (const agent of agents) {
    if (!owners.has(agent.owner)) {
      owners.set(agent.owner, {
        owner: agent.owner,
        unit: units.get(agent.id) || null,
        agents: 0,
        uniform_agents: 0,
        unused_agents: 0,
        tokens_30d: 0,
        tokens_uniform_30d: 0,
        tokens_30d_previous: 0,
        cost_30d_eur: 0,
        co2e_30d_kg: 0,
      });
    }
    const row = owners.get(agent.owner);
    row.agents++;
    if (agent.uniform_agent) row.uniform_agents++;
    if (agent.status === "unused") row.unused_agents++;
    row.tokens_30d += agent.tokens_30d;
    if (agent.uniform_agent) row.tokens_uniform_30d += agent.tokens_30d;
    row.tokens_30d_previous += agent.tokens_by_month[config.windows - 2];
    row.cost_30d_eur += impactOf.get(agent.id).cost_30d_eur;
    row.co2e_30d_kg += impactOf.get(agent.id).co2e_30d_kg;
  }
  return {
    period: totals.period,
    period_end: totals.period_end,
    owners_total: owners.size,
    agents_total: totals.agents_total,
    agents_uniform: totals.agents_uniform,
    agents_unused: totals.agents_unused,
    tokens_30d: totals.tokens_30d,
    tokens_30d_previous: totals.tokens_30d_previous,
    tokens_uniform_30d: totals.tokens_uniform_30d,
    uniform_threshold: totals.uniform_threshold,
    cost_30d_eur: impact.total.cost_30d_eur,
    cost_uniform_30d_eur: impact.uniform_agents.cost_30d_eur,
    saving_potential_30d_eur: impact.saving_potential_30d_eur,
    co2e_30d_kg: impact.total.co2e_30d_kg,
    co2e_uniform_30d_kg: impact.uniform_agents.co2e_30d_kg,
    tokens_by_month: totals.tokens_by_month,
    // An owner's cost and CO2e are the sums of the rounded values per agent.
    owners: [...owners.values()].map((row) => ({ ...row, cost_30d_eur: round(row.cost_30d_eur, 2), co2e_30d_kg: round(row.co2e_30d_kg, 3) })),
  };
}

module.exports = { computeCompany };
