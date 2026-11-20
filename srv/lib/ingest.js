// rAIght – checks a run that a connected provider delivers (IngestApi) and turns it into a row for Runs.
// Pure function, so the rules can be tested without a server.
const config = require("./config");
const { daysBeforePeriodEnd } = require("./metrics");

const MAX_TOKENS_PER_RUN = 5_000_000; // far above any real run – catches a wrong unit
const MAX_PATH_LENGTH = 1000; // length of Runs.path

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const isCount = (value) => Number.isInteger(value) && value >= 0 && value <= MAX_TOKENS_PER_RUN;

/**
 * The row for Runs from one delivered run.
 * @param {object} input { agent, steps | path, model?, tokensIn, tokensOut, startedAt?, source? } – a rule or a
 *   plain workflow calls no model: then model is left out and both token counts are 0
 * @param {object} options knownAgent(id) says whether the agent exists; now is the time of delivery
 */
function runRow(input, { knownAgent, now = new Date() }) {
  const { agent, tokensIn, tokensOut } = input;
  const model = input.model || null;
  if (typeof agent !== "string" || !knownAgent(agent)) throw badRequest(`Unknown agent "${agent}"`);

  const steps = (Array.isArray(input.steps) && input.steps.length ? input.steps : String(input.path ?? "").split(config.pathSeparator.trim()))
    .map((step) => String(step).trim())
    .filter(Boolean);
  const path = steps.join(config.pathSeparator);
  if (!steps.length) throw badRequest("A run needs its steps: steps as a list, or path as text joined with \" > \"");
  if (path.length > MAX_PATH_LENGTH) throw badRequest(`The path is longer than ${MAX_PATH_LENGTH} characters`);

  if (model && (!config.priceUsdPerMillionTokens[model] || !config.footprintPer1kOutputTokens[model])) {
    throw badRequest(`No price or footprint for model "${model}" – known models: ${Object.keys(config.priceUsdPerMillionTokens).join(", ")}`);
  }
  if (!isCount(tokensIn) || !isCount(tokensOut)) throw badRequest("tokensIn and tokensOut must be whole numbers from 0 up");
  if (!model && tokensIn + tokensOut > 0) throw badRequest("A run with tokens needs its model");

  const started = input.startedAt ? new Date(input.startedAt) : now;
  if (Number.isNaN(started.getTime())) throw badRequest(`startedAt "${input.startedAt}" is not a date`);
  // A run after the observed period would not count anywhere, so it is booked on the period's last day.
  const startedAt = daysBeforePeriodEnd(started.toISOString()) < 0 ? `${config.periodEnd}T23:59:59.000Z` : started.toISOString();

  return { agent_ID: agent, startedAt, path, model, tokensIn, tokensOut, source: String(input.source || "n8n").slice(0, 20) };
}

module.exports = { runRow };
