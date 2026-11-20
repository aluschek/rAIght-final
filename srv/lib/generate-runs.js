// rAIght v1 – turns the finished sample data (app/data/agents.json) into single runs, so the metrics are
// computed for real. Seeded: every start makes exactly the same runs, and the metrics computed from them
// give back the sample data (test/metrics.test.js).
const config = require("./config");
const { windows } = require("./metrics");

const DAY = 86400000;

/** Pseudo-random numbers in [0, 1) from a seed (mulberry32): same seed, same sequence. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Splits `total` into whole numbers in proportion to `weights` that add up to `total` exactly (largest-remainder method). */
function apportion(total, weights) {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (total > 0 && !(weightSum > 0)) throw new Error(`apportion: cannot split ${total} without weights`);
  const quotas = weights.map((w) => (total ? (total * w) / weightSum : 0));
  const counts = quotas.map(Math.floor);
  const byRemainder = quotas.map((_, i) => i).sort((i, j) => quotas[j] - counts[j] - (quotas[i] - counts[i]) || i - j);
  for (let rest = total - counts.reduce((s, c) => s + c, 0), k = 0; rest > 0; rest--, k++) counts[byRemainder[k]]++;
  return counts;
}

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** A version-4 UUID from the seeded numbers, so run IDs are the same on every start. */
function uuid(random) {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = "89ab"[Math.floor(random() * 4)];
  const h = hex.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * The rows for db/schema.cds: providers, agents and all their runs.
 * @param {object[]} sampleAgents app/data/agents.json
 * @param {object[]} sampleProviders `providers` of app/data/summary.json
 */
function generateRuns(sampleAgents, sampleProviders) {
  const perAgent = [...runsByAgent(sampleAgents)];
  return {
    providers: providerRows(sampleProviders),
    agents: perAgent.map(({ agent }) => agent),
    runs: perAgent.flatMap(({ runs }) => runs),
  };
}

/** The same agents and runs, one agent at a time – so a whole company's run log need not be held in memory at once. */
function* runsByAgent(sampleAgents) {
  const random = seededRandom(config.seed);
  for (const sample of sampleAgents) yield { agent: agentRow(sample), runs: runsOf(sample, random) };
}

const providerRows = (sampleProviders) => sampleProviders.map(({ id, name }) => ({ ID: id, name }));

const agentRow = (sample) => ({
  ID: sample.id,
  name: sample.name,
  provider_ID: sample.provider,
  owner: sample.owner,
  unit: sample.unit || null,
  purpose: sample.purpose,
  ladderStep: sample.ladder_step,
  agentReason: sample.agent_reason,
  suggestion: sample.suggestion,
  suggestionText: sample.suggestion_text,
  retired: sample.status === "retired",
});

/**
 * One agent's runs in all windows. W0 (the last 30 days) takes its runs per day exactly from runs_by_day.
 * An older window gets as many runs as its tokens buy at the agent's W0 tokens per run, spread over the
 * days with the same weekly pattern, and none after the agent's last run day.
 */
function runsOf(sample, random) {
  const lastRunDay = windows()[0].lastDay - sample.days_since_last_run;
  const tokensPerRun = sample.runs_30d ? sample.tokens_30d / sample.runs_30d : config.tokensPerRunFallback;
  return windows().flatMap((window, k) => {
    const tokens = sample.tokens_by_month[config.windows - 1 - k];
    const runsPerDay = k === 0
      ? sample.runs_by_day
      : apportion(Math.round(tokens / tokensPerRun), dayWeights(sample.runs_by_day, window, lastRunDay));
    return runsInWindow(sample, window, runsPerDay, tokens, random);
  });
}

function dayWeights(pattern, window, lastRunDay) {
  const flat = pattern.every((count) => count === 0); // no recent runs, so no weekly pattern to copy
  return pattern.map((count, i) => (window.firstDay + i > lastRunDay ? 0 : flat ? 1 : count));
}

/** One window's runs: paths split by the top_paths shares, tokens adding up exactly to the window's tokens. */
function runsInWindow(sample, window, runsPerDay, tokens, random) {
  const days = runsPerDay.flatMap((count, i) => new Array(count).fill(window.firstDay + i));
  if (days.length === 0) return [];
  const paths = pathsOf(sample);
  const runsPerPath = apportion(days.length, paths.map((p) => p.share));
  const steps = shuffle(paths.flatMap((p, i) => new Array(runsPerPath[i]).fill(p.steps)), random);
  const runTokens = apportion(tokens, steps.map((s) => s.length * (0.75 + random() / 2))); // longer paths, more tokens
  const [from, to] = config.workingHoursUtc;
  return days.map((day, i) => {
    const tokensIn = Math.round(runTokens[i] * (config.tokensInShare + (random() - 0.5) * config.tokensInSpread));
    const second = Math.floor((from + random() * (to - from)) * 3600);
    return {
      ID: uuid(random),
      agent_ID: sample.id,
      startedAt: new Date(day * DAY + second * 1000).toISOString(),
      path: steps[i].join(config.pathSeparator),
      model: config.modelByProvider[sample.provider],
      tokensIn,
      tokensOut: runTokens[i] - tokensIn,
    };
  });
}

/** The agent's paths with their shares. An agent without top_paths (no recent runs) uses its fallback steps. */
function pathsOf(sample) {
  if (sample.top_paths.length) return sample.top_paths;
  const steps = sample.fallback_steps || config.fallbackSteps[sample.id];
  if (!steps) throw new Error(`${sample.id} has older runs but no top_paths – add its steps to fallbackSteps in srv/lib/config.js`);
  return [{ steps, share: 1 }];
}

module.exports = { generateRuns, runsByAgent, providerRows, seededRandom, apportion };
