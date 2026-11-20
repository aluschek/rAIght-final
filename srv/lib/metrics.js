// rAIght – the monitor metrics, computed from run logs with plain statistics only (ADR 0002: no AI to check AI).
// Pure functions: entity rows of db/schema.cds in, exactly the shapes of app/data/agents.json and summary.json
// out – so the pages read the same JSON from the API as from the sample files.
const config = require("./config");

const DAY = 86400000;
const dayNumber = (timestamp) => Math.floor(Date.parse(timestamp) / DAY);
const endDay = dayNumber(`${config.periodEnd}T00:00:00Z`);
/** Days between a run and the end of the observed period: 0 = its last day, negative = after it. */
const daysBeforePeriodEnd = (timestamp) => endDay - dayNumber(timestamp);
const round2 = (share) => Math.round(share * 100) / 100;
const sum = (items, value) => items.reduce((total, item) => total + value(item), 0);

/** The 30-day windows as day numbers, newest first: W0 ends at periodEnd, W1 covers the 30 days before it, … */
function windows() {
  return Array.from({ length: config.windows }, (_, k) => {
    const lastDay = endDay - k * config.windowDays;
    return { firstDay: lastDay - config.windowDays + 1, lastDay, month: new Date(lastDay * DAY).toISOString().slice(0, 7) };
  });
}

/** Metrics per agent row, in the order of the rows. */
function computeAgents(agents, runs) {
  const runsByAgent = new Map(agents.map((agent) => [agent.ID, []]));
  for (const run of runs) runsByAgent.get(run.agent_ID)?.push(run);
  return agents.map((agent) => agentMetrics(agent, runsByAgent.get(agent.ID)));
}

function agentMetrics(agent, runs) {
  const tokensByWindow = new Array(config.windows).fill(0); // newest first
  const runsByDay = new Array(config.windowDays).fill(0); // oldest first
  const pathCounts = new Map();
  let daysSinceLastRun = null;
  for (const run of runs) {
    const daysAgo = daysBeforePeriodEnd(run.startedAt);
    if (daysAgo < 0) continue; // after the observed period
    if (daysSinceLastRun === null || daysAgo < daysSinceLastRun) daysSinceLastRun = daysAgo;
    const window = Math.floor(daysAgo / config.windowDays);
    if (window < config.windows) tokensByWindow[window] += run.tokensIn + run.tokensOut;
    if (window === 0) {
      runsByDay[config.windowDays - 1 - daysAgo]++;
      pathCounts.set(run.path, (pathCounts.get(run.path) || 0) + 1);
    }
  }
  const runs30d = sum(runsByDay, (count) => count);
  const paths = [...pathCounts].sort(([pathA, countA], [pathB, countB]) => countB - countA || pathA.localeCompare(pathB));
  const samePathShare = runs30d ? paths[0][1] / runs30d : null;
  const conversion = conversionOf(agent, runs);
  return {
    id: agent.ID,
    name: agent.name,
    provider: agent.provider_ID,
    owner: agent.owner,
    purpose: agent.purpose,
    ladder_step: conversion?.done ? conversion.to : agent.ladderStep,
    agent_reason: agent.agentReason,
    status: statusOf(agent, daysSinceLastRun, conversion),
    runs_30d: runs30d,
    tokens_30d: tokensByWindow[0],
    same_path_share: samePathShare === null ? null : round2(samePathShare),
    // The exact share, not the rounded one shown: 159 of 200 runs (79.5 %) shows as 0.8 but is not uniform.
    // A converted automation is no agent any more, so it is not a uniform agent either.
    uniform_agent: !conversion?.done && runs30d >= config.uniformMinRuns && samePathShare >= config.uniformThreshold,
    conversion,
    days_since_last_run: daysSinceLastRun,
    top_paths: paths.slice(0, 3).map(([path, count]) => ({ steps: path.split(config.pathSeparator), share: round2(count / runs30d) })),
    suggestion: agent.suggestion,
    suggestion_text: agent.suggestionText,
    tokens_by_month: tokensByWindow.reverse(),
    runs_by_day: runsByDay,
  };
}

/**
 * The owner's decision to move an agent to a lower step, and what the run log shows since then. The conversion
 * counts as done once a run arrived after the decision that called no model: the log confirms it, nobody has to
 * say so. Until then it is only planned. Null without a decision.
 */
function conversionOf(agent, runs) {
  if (!agent.convertedTo) return null;
  const since = runs.filter((run) => !run.model && run.startedAt >= agent.convertedAt);
  return {
    to: agent.convertedTo,
    since: agent.convertedAt,
    runs: since.length,
    tokens: sum(since, (run) => run.tokensIn + run.tokensOut),
    done: since.length > 0,
  };
}

/** Retired (the owner's decision) wins over converted (confirmed by the log), unused (no run for unusedAfterDays) and active. */
function statusOf(agent, daysSinceLastRun, conversion) {
  if (agent.retired) return "retired";
  if (conversion?.done) return "converted";
  if (daysSinceLastRun === null || daysSinceLastRun >= config.unusedAfterDays) return "unused";
  return "active";
}

/** Totals over the computed agents (output of computeAgents), plus the provider rows. */
function computeSummary(agents, providers) {
  const uniform = agents.filter((a) => a.uniform_agent);
  const other = agents.filter((a) => !a.uniform_agent);
  const tokensOfMonth = (list, month) => sum(list, (a) => a.tokens_by_month[month]);
  return {
    period: "last_30_days",
    period_end: config.periodEnd,
    last_import: config.lastImport,
    runs_30d: sum(agents, (a) => a.runs_30d),
    tokens_30d: sum(agents, (a) => a.tokens_30d),
    tokens_30d_previous: tokensOfMonth(agents, config.windows - 2),
    agents_total: agents.length,
    agents_active: agents.filter((a) => a.status === "active").length,
    agents_unused: agents.filter((a) => a.status === "unused").length,
    agents_converted: agents.filter((a) => a.status === "converted").length,
    agents_uniform: uniform.length,
    tokens_uniform_30d: sum(uniform, (a) => a.tokens_30d),
    uniform_threshold: config.uniformThreshold,
    providers: providers.map(({ ID, name }) => ({ id: ID, name })),
    tokens_by_month: windows().reverse().map(({ month }, i) => ({
      month,
      tokens_uniform: tokensOfMonth(uniform, i),
      tokens_other: tokensOfMonth(other, i),
    })),
  };
}

module.exports = { windows, daysBeforePeriodEnd, computeAgents, computeSummary };
