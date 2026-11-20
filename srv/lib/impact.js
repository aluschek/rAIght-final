// rAIght – what the runs of the last 30 days cost and emit. Cost: tokens × list price of the model, or credits per
// step where the provider bills that way (config.creditBilling). Footprint: output tokens × EcoLogits factor.
// A run that called no model costs and emits nothing here. Pure functions like metrics.js, plain arithmetic only
// (ADR 0002). Every price and factor is an assumption from config.js and is returned with the result, so a page
// can show where a number comes from.
const config = require("./config");
const { daysBeforePeriodEnd } = require("./metrics");

const MILLION = 1e6;
const middle = ([min, max]) => (min + max) / 2;
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
const nothing = () => ({ eur: 0, gCo2e: [0, 0], wh: [0, 0], modelRuns: 0, convertedRuns: 0 });

function ratesOf(model) {
  const price = config.priceUsdPerMillionTokens[model];
  const footprint = config.footprintPer1kOutputTokens[model];
  if (!price || !footprint) throw new Error(`No price or footprint for model "${model}" – add it to srv/lib/config.js`);
  return { price, footprint };
}

/** What one run costs in USD: credits per step where the agent's provider bills that way, else tokens × list price. */
function usdOf(run, provider, price) {
  const credits = config.creditBilling[provider];
  if (credits) return run.path.split(config.pathSeparator).length * credits.creditsPerStep * credits.usdPerCredit;
  return (run.tokensIn * price.input + run.tokensOut * price.output) / MILLION;
}

/** What one run costs in EUR. A run without a model (a rule or a plain workflow) costs nothing. */
function runCostEur(run, provider) {
  return run.model ? usdOf(run, provider, ratesOf(run.model).price) * config.usdToEur : 0;
}

function addRun(total, run, agent) {
  if (!run.model) {
    // Counted only after the owner's conversion: these are the runs the lower step took over.
    if (agent.conversion && run.startedAt >= agent.conversion.since) total.convertedRuns++;
    return;
  }
  const { footprint } = ratesOf(run.model);
  total.eur += runCostEur(run, agent.provider);
  total.modelRuns++;
  for (const bound of [0, 1]) {
    total.gCo2e[bound] += (run.tokensOut / 1000) * footprint.gCo2e[bound];
    total.wh[bound] += (run.tokensOut / 1000) * footprint.wh[bound];
  }
}

function addTotal(total, other) {
  total.eur += other.eur;
  for (const bound of [0, 1]) {
    total.gCo2e[bound] += other.gCo2e[bound];
    total.wh[bound] += other.wh[bound];
  }
  return total;
}

/** Rounded for display. A group is rounded from its exact sum, so it can differ from the sum of its rounded parts. */
const shown = (total) => ({
  cost_30d_eur: round(total.eur, 2),
  co2e_30d_kg: round(middle(total.gCo2e) / 1000, 3),
  co2e_30d_kg_range: total.gCo2e.map((grams) => round(grams / 1000, 3)),
  energy_30d_kwh: round(middle(total.wh) / 1000, 3),
});

/** What the runs since the conversion would have cost as agent runs: their number × the agent's average cost per run. */
const savedSinceConversion = (total) => (total.modelRuns ? round((total.convertedRuns * total.eur) / total.modelRuns, 2) : 0);

/**
 * The exact sums per agent over its runs of the last 30 days, by agent ID – unrounded, so that groups can be summed
 * from them. `agents` is the output of computeAgents, `runs` are the run rows with their model.
 */
function impactSums(agents, runs) {
  const byAgent = new Map(agents.map((agent) => [agent.id, nothing()]));
  const agentOf = new Map(agents.map((agent) => [agent.id, agent]));
  for (const run of runs) {
    const daysAgo = daysBeforePeriodEnd(run.startedAt);
    if (daysAgo < 0 || daysAgo >= config.windowDays || !byAgent.has(run.agent_ID)) continue;
    addRun(byAgent.get(run.agent_ID), run, agentOf.get(run.agent_ID));
  }
  return byAgent;
}

/**
 * Cost and footprint per agent, for all agents, and for the uniform agents – the part a workflow would no longer
 * spend on model calls. `byAgent` holds the agents' sums from impactSums.
 */
function impactFrom(agents, byAgent) {
  const totalOf = (list) => list.reduce((total, agent) => addTotal(total, byAgent.get(agent.id)), nothing());
  const uniform = totalOf(agents.filter((agent) => agent.uniform_agent));
  return {
    period: "last_30_days",
    period_end: config.periodEnd,
    agents: agents.map((agent) => ({
      id: agent.id,
      ...shown(byAgent.get(agent.id)),
      saved_since_conversion_eur: savedSinceConversion(byAgent.get(agent.id)),
    })),
    total: shown(totalOf(agents)),
    uniform_agents: shown(uniform),
    // What converting every uniform agent would save in 30 days, with the share from the assumptions.
    saving_potential_30d_eur: round(uniform.eur * config.savingShareIfConverted, 2),
    assumptions: {
      usd_to_eur: config.usdToEur,
      saving_share_if_converted: config.savingShareIfConverted,
      credit_billing: Object.entries(config.creditBilling).map(([provider, billing]) => ({
        provider,
        credits_per_step: billing.creditsPerStep,
        usd_per_credit: billing.usdPerCredit,
      })),
      prices: Object.entries(config.priceUsdPerMillionTokens).map(([model, price]) => ({
        model,
        usd_per_million_input_tokens: price.input,
        usd_per_million_output_tokens: price.output,
      })),
      footprints: Object.entries(config.footprintPer1kOutputTokens).map(([model, footprint]) => ({
        model,
        g_co2e_per_1k_output_tokens_range: footprint.gCo2e,
        wh_per_1k_output_tokens_range: footprint.wh,
      })),
    },
  };
}

/** The same in one step, from the agents and their runs. */
const computeImpact = (agents, runs) => impactFrom(agents, impactSums(agents, runs));

module.exports = { computeImpact, impactSums, impactFrom, runCostEur };
