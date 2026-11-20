// rAIght – writes the files in app/data/ that are computed from app/data/agents.json: summary.json, impact.json
// and company.json. The pages read them when no backend runs, and the tests keep them equal to the computed
// values. Run it after a change to agents.json or to the rules in srv/lib/:  node demo/write-sample-data.js
const fs = require("node:fs");
const path = require("node:path");
const { generateRuns } = require("../srv/lib/generate-runs");
const { companyScenario } = require("../srv/lib/generate-company");
const { computeAgents, computeSummary } = require("../srv/lib/metrics");
const { computeImpact } = require("../srv/lib/impact");
const { computeCompany } = require("../srv/lib/company");

const dataDir = path.join(__dirname, "../app/data");
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
const writeJson = (name, value) => fs.writeFileSync(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`);

const sampleAgents = readJson("agents.json");
const providers = readJson("summary.json").providers;

// Lena alone
const lena = generateRuns(sampleAgents, providers);
const lenaAgents = computeAgents(lena.agents, lena.runs);
writeJson("summary.json", computeSummary(lenaAgents, lena.providers));
writeJson("impact.json", computeImpact(lenaAgents, lena.runs));

// The simulated company around her
const company = generateRuns(companyScenario(sampleAgents), providers);
const companyAgents = computeAgents(company.agents, company.runs);
const units = new Map(company.agents.map((row) => [row.ID, row.unit]));
writeJson("company.json", computeCompany(companyAgents, units, computeImpact(companyAgents, company.runs)));

console.log("written: summary.json, impact.json, company.json");
