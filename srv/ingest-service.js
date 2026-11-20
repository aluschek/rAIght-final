// rAIght – where a connected provider delivers its run log (IngestApi in ingest-service.cds).
const cds = require("@sap/cds");
const { timingSafeEqual } = require("node:crypto");
const { runRow } = require("./lib/ingest");
const runLog = require("./lib/run-log");
const { refreshUsage } = require("./usage-snapshot");

const LOG = cds.log("raight");

// The key a provider sends in the header x-raight-key. It comes from the environment (RAIGHT_INGEST_KEY) and is
// never in the repository. Without it, deliveries are refused in production; locally the key is "dev".
const expectedKey = () => process.env.RAIGHT_INGEST_KEY || (process.env.NODE_ENV === "production" ? null : "dev");

function sameKey(given, expected) {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

class IngestApi extends cds.ApplicationService {
  init() {
    const { Agents, Runs } = cds.entities("raight");

    this.on("record", async (req) => {
      const expected = expectedKey();
      if (!expected) return req.reject(503, "Deliveries are switched off: RAIGHT_INGEST_KEY is not set");
      if (!sameKey(req.headers?.["x-raight-key"], expected)) return req.reject(401, "Missing or wrong x-raight-key");

      const agent = typeof req.data.agent === "string" && (await SELECT.one.from(Agents).columns("ID").where({ ID: req.data.agent }));
      let row;
      try {
        row = runRow(req.data, { knownAgent: () => Boolean(agent) });
      } catch (err) {
        return req.reject(err.status || 500, err.message);
      }

      await INSERT.into(Runs).entries({ ID: cds.utils.uuid(), ...row });
      runLog.changed(row.agent_ID);
      const usage = await refreshUsage(row.agent_ID);
      LOG.info(`run received for ${row.agent_ID} from ${row.source}: ${row.model ? `${row.tokensIn + row.tokensOut} tokens` : "no model call"}`);
      return { accepted: true, agent: row.agent_ID, runs_30d: usage.runs30d, tokens_30d: usage.tokens30d };
    });

    this.on("state", async (req) => {
      const agent = await SELECT.one.from(Agents).columns("ID", "retired", "convertedTo", "convertedAt").where({ ID: req.data.agent });
      if (!agent) return req.reject(404, `Unknown agent "${req.data.agent}"`);
      return { agent: agent.ID, retired: Boolean(agent.retired), converted_to: agent.convertedTo || null, converted_at: agent.convertedAt || null };
    });

    return super.init();
  }
}

// Exported by name, so CAP uses it for IngestApi only.
module.exports = { IngestApi };
