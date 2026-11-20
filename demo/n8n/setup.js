// rAIght demo – creates the real n8n workflows through n8n's public API:
//   1. "Document check"            – Lena's agent, built the way a process owner would: a model with five tools
//   2. "Document check (rule)"     – the same job on ladder step 1, without a model
//   3. "Reference check reminder"  – the agent nobody triggers any more; rAIght's Retire switches it off
//   4. "Application status (measurement)" – a light agent without documents, only to measure its tokens
//   5. "Document check (short documents, measurement)" – agent 1 with shorter documents, only to measure
// Run it again after a change: workflows are found by name and updated.
//
// Usage: node demo/n8n/setup.js ["workflow name" …]   (without names: all five)
// Needs a running n8n with an Anthropic credential, and an n8n API key in N8N_API_KEY or in the file
// N8N_API_KEY_FILE. Nothing secret is written to the repository.
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const N8N_URL = (process.env.N8N_URL || "http://localhost:5678").replace(/\/$/, "");
const MODEL = process.env.RAIGHT_N8N_MODEL || "claude-opus-5-5";
const apiKey = (process.env.N8N_API_KEY || fs.readFileSync(process.env.N8N_API_KEY_FILE, "utf8")).trim();

async function n8n(method, route, body) {
  const res = await fetch(`${N8N_URL}/api/v1${route}`, {
    method,
    headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route}: HTTP ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

// ---------- building blocks ----------
const node = (name, type, typeVersion, position, parameters, extra = {}) => ({ id: randomUUID(), name, type, typeVersion, position, parameters, ...extra });
const main = (to) => ({ main: [[{ node: to, type: "main", index: 0 }]] });

// Documents of the usual length of a complete application (about 1,500 words). The measurement also has a short set.
const applications = require("./applications-full.json");

const loadApplication = (applications) => `// Demo stand-in for the applicant tracking system: the uploaded files of ${applications.length} invented applications.
const applications = ${JSON.stringify(applications)};
const input = $input.first().json;
const id = (input.body && input.body.application_id) || input.application_id;
const application = applications.find((a) => a.id === id);
if (!application) throw new Error('Unknown application "' + id + '"');
return [{ json: application }];`;

const webhook = (name, hookPath, position) =>
  node(name, "n8n-nodes-base.webhook", 2.2, position, { httpMethod: "POST", path: hookPath, responseMode: "lastNode", options: {} }, { webhookId: randomUUID() });

const codeTool = (name, position, description, jsCode) =>
  node(name, "@n8n/n8n-nodes-langchain.toolCode", 1.3, position, { description, language: "javaScript", jsCode });

const chatModel = (credential, position) =>
  node("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.6, position,
    { model: { __rl: true, mode: "id", value: MODEL }, options: { thinkingMode: "adaptive", effort: "medium", maxTokensToSample: 16000 } },
    { credentials: { anthropicApi: { id: credential.id, name: credential.name } } });

const agent = (position, text, systemMessage) =>
  node("AI Agent", "@n8n/n8n-nodes-langchain.agent", 3.1, position, { promptType: "define", text, options: { systemMessage, maxIterations: 10, enableStreaming: false } });

/** Connections of an agent's model and tools. */
const agentParts = (tools) => ({
  "Anthropic Chat Model": { ai_languageModel: [[{ node: "AI Agent", type: "ai_languageModel", index: 0 }]] },
  ...Object.fromEntries(tools.map((tool) => [tool.name, { ai_tool: [[{ node: "AI Agent", type: "ai_tool", index: 0 }]] }])),
});

// ---------- 1. Document check – the agent ----------
function documentCheckAgent(credential, { name = "Document check", hookPath = "document-check", dataset = applications } = {}) {
  const tools = [
    codeTool("read_application", [520, 520], "Returns the application: applicant, citizenship, position and the names of the uploaded files. Input: the application ID.",
      `const a = $('Load application').first().json;
return JSON.stringify({ id: a.id, received: a.received, position: a.position, department: a.department, applicant: a.applicant, uploaded_files: a.attachments.map((f) => f.file_name) });`),
    codeTool("check_attachments", [700, 520], "Returns the text of every file the applicant uploaded. Input: the application ID.",
      `const a = $('Load application').first().json;
return a.attachments.map((f) => '=== ' + f.file_name + ' ===\\n' + f.text).join('\\n\\n');`),
    codeTool("update_status", [880, 520], "Sets the status of the application. Input: the new status, for example documents_complete.",
      `return 'Status of ' + $('Load application').first().json.id + ' set to: ' + query;`),
    codeTool("request_missing_document", [1060, 520], "Sends the applicant a message that asks for a missing document. Input: the document that is missing and the message.",
      `return 'Message sent to ' + $('Load application').first().json.applicant.name + '.';`),
    codeTool("escalate_to_recruiter", [1240, 520], "Hands the application over to a recruiter. Input: the reason.",
      `return 'Application ' + $('Load application').first().json.id + ' handed over to the recruiting team.';`),
  ];
  const system = [
    "You are the document check assistant of the recruiting team.",
    "For every new application, check whether the application documents are complete.",
    "Required are: a CV, the certificate of the highest degree, and a valid work permit if the applicant is not a citizen of an EU or EEA country or Switzerland.",
    "Applicants upload files with unclear names, so read the files to find out what they are.",
    "If everything required is there, set the status to documents_complete.",
    "If a required document is missing, ask the applicant for it.",
    "If a file cannot be read or you are not sure, hand the application over to a recruiter.",
    "Finish with one short sentence that says what you did.",
  ].join("\n");
  return {
    name,
    nodes: [
      webhook("New application (webhook)", hookPath, [0, 200]),
      node("Run one example", "n8n-nodes-base.manualTrigger", 1, [0, 400], {}),
      node("Example application", "n8n-nodes-base.set", 3.5, [220, 400],
        { assignments: { assignments: [{ id: randomUUID(), name: "application_id", type: "string", value: dataset[0].id }] }, options: {} }),
      node("Load application", "n8n-nodes-base.code", 2, [460, 300], { jsCode: loadApplication(dataset) }),
      agent([760, 300], "=New application received: {{ $json.id }}", system),
      chatModel(credential, [340, 520]),
      ...tools,
    ],
    connections: {
      "New application (webhook)": main("Load application"),
      "Run one example": main("Example application"),
      "Example application": main("Load application"),
      "Load application": main("AI Agent"),
      ...agentParts(tools),
    },
    settings: { executionOrder: "v1" },
  };
}

// ---------- 2. Document check – the rule ----------
function documentCheckRule() {
  const rule = `// The upload form has one field per document, so "is it there?" is a yes/no check.
const a = $input.first().json;
const missing = ['cv', 'degree_certificate'].filter((field) => !a.form[field]);
if (!a.applicant.eu_citizen && !a.form.work_permit) missing.push('work_permit');
const unreadable = Object.values(a.form).some((file) => file && !file.readable);
const result = unreadable ? 'escalate_to_recruiter' : missing.length ? 'request_missing_document' : 'update_status';
return [{ json: { id: a.id, result, missing } }];`;
  const outcome = (name, position, text) => node(name, "n8n-nodes-base.set", 3.5, position,
    { assignments: { assignments: [{ id: randomUUID(), name: "done", type: "string", value: text }] }, options: {} });
  return {
    name: "Document check (rule)",
    nodes: [
      webhook("New application (webhook)", "document-check-rule", [0, 200]),
      node("Run one example", "n8n-nodes-base.manualTrigger", 1, [0, 400], {}),
      node("Example application", "n8n-nodes-base.set", 3.5, [220, 400],
        { assignments: { assignments: [{ id: randomUUID(), name: "application_id", type: "string", value: applications[0].id }] }, options: {} }),
      node("read_application", "n8n-nodes-base.code", 2, [460, 300], { jsCode: loadApplication(applications) }),
      node("check_attachments", "n8n-nodes-base.code", 2, [680, 300], { jsCode: rule }),
      node("Which case?", "n8n-nodes-base.switch", 3.2, [900, 300], {
        rules: { values: ["update_status", "request_missing_document", "escalate_to_recruiter"].map((value) => ({
          conditions: { options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 }, combinator: "and",
            conditions: [{ id: randomUUID(), leftValue: "={{ $json.result }}", rightValue: value, operator: { type: "string", operation: "equals" } }] },
          renameOutput: true, outputKey: value })) },
        options: {},
      }),
      outcome("update_status", [1140, 140], "=Status of {{ $json.id }} set to: documents_complete"),
      outcome("request_missing_document", [1140, 300], "=Asked the applicant for: {{ $json.missing.join(', ') }}"),
      outcome("escalate_to_recruiter", [1140, 460], "=Application {{ $json.id }} handed over to the recruiting team."),
    ],
    connections: {
      "New application (webhook)": main("read_application"),
      "Run one example": main("Example application"),
      "Example application": main("read_application"),
      read_application: main("check_attachments"),
      check_attachments: main("Which case?"),
      "Which case?": { main: [[{ node: "update_status", type: "main", index: 0 }], [{ node: "request_missing_document", type: "main", index: 0 }], [{ node: "escalate_to_recruiter", type: "main", index: 0 }]] },
    },
    settings: { executionOrder: "v1" },
  };
}

// ---------- 3. Reference check reminder – the unused agent ----------
function referenceCheckReminder(credential) {
  const tools = [
    codeTool("read_open_checks", [520, 480], "Returns the reference checks that are still open for a candidate. Input: the candidate.",
      `return JSON.stringify([{ referee: 'Dr. M. Albrecht', asked_on: '2026-06-18', reminders_sent: 1 }]);`),
    codeTool("send_reminder", [700, 480], "Sends a referee a friendly reminder. Input: the referee and the message.",
      `return 'Reminder sent.';`),
  ];
  return {
    name: "Reference check reminder",
    nodes: [
      webhook("Reference still open (webhook)", "reference-check-reminder", [0, 300]),
      agent([420, 300], "=A reference for {{ $json.body.candidate }} is still open. Remind the referee.",
        "You remind referees who have not sent their reference yet. Look up the open reference checks, then send each referee one short, friendly reminder."),
      chatModel(credential, [340, 480]),
      ...tools,
    ],
    connections: { "Reference still open (webhook)": main("AI Agent"), ...agentParts(tools) },
    settings: { executionOrder: "v1" },
  };
}

// ---------- 4. Application status – a light agent, for the measurement only ----------
// Its name differs from the agent in rAIght on purpose, so the connector does not deliver these runs.
function applicationStatusAgent(credential) {
  const { faq, requests } = require("./status-requests.json");
  const load = `// Demo stand-in for the mailbox and the applicant tracking system: ${requests.length} invented requests.
const requests = ${JSON.stringify(requests)};
const input = $input.first().json;
const id = (input.body && input.body.application_id) || input.application_id;
const request = requests.find((r) => r.id === id);
if (!request) throw new Error('Unknown request "' + id + '"');
return [{ json: request }];`;
  const tools = [
    codeTool("read_request", [520, 520], "Returns the candidate's message. Input: the request ID.",
      `const r = $('Load request').first().json;
return JSON.stringify({ id: r.id, from: r.candidate, application_id: r.application_id, position: r.position, message: r.message });`),
    codeTool("lookup_status", [700, 520], "Returns where an application stands in the hiring process. Input: the application ID.",
      `return JSON.stringify($('Load request').first().json.status);`),
    codeTool("search_faq", [880, 520], "Searches the recruiting FAQ, for questions that are not about the status. Input: the question.",
      `return ${JSON.stringify(faq)};`),
    codeTool("send_reply", [1060, 520], "Sends the candidate a reply by e-mail. Input: the text of the reply.",
      `return 'Reply sent to ' + $('Load request').first().json.candidate + '.';`),
    codeTool("escalate_to_recruiter", [1240, 520], "Hands the request over to a recruiter. Input: the reason.",
      `return 'Request ' + $('Load request').first().json.id + ' handed over to the recruiting team.';`),
  ];
  const system = [
    "You are the assistant of the recruiting team that answers candidates who ask where their application stands.",
    "Read the request, look up the status of the application and send the candidate a short, friendly reply with the current stage and the next step.",
    "If the candidate also asks a general question, look it up in the FAQ.",
    "If the request is about something else, for example a withdrawal, a complaint or data protection, hand it over to a recruiter.",
    "Finish with one short sentence that says what you did.",
  ].join("\n");
  return {
    name: "Application status (measurement)",
    nodes: [
      webhook("New request (webhook)", "application-status", [0, 300]),
      node("Load request", "n8n-nodes-base.code", 2, [300, 300], { jsCode: load }),
      agent([620, 300], "=New request received: {{ $json.id }}", system),
      chatModel(credential, [340, 520]),
      ...tools,
    ],
    connections: { "New request (webhook)": main("Load request"), "Load request": main("AI Agent"), ...agentParts(tools) },
    settings: { executionOrder: "v1" },
  };
}

// ---------- create or update, then switch on ----------
async function save(workflow) {
  const found = (await n8n("GET", `/workflows?name=${encodeURIComponent(workflow.name)}&limit=5`)).data.find((w) => w.name === workflow.name);
  const saved = found ? await n8n("PUT", `/workflows/${found.id}`, workflow) : await n8n("POST", "/workflows", workflow);
  await n8n("POST", `/workflows/${saved.id}/activate`).catch(async (err) => {
    if (!/404|405/.test(err.message)) throw err;
    await n8n("POST", `/workflows/${saved.id}/publish`);
  });
  console.log(`${found ? "updated" : "created"} and switched on: ${workflow.name} (${saved.id})`);
  return saved;
}

(async () => {
  const credentials = (await n8n("GET", "/credentials?limit=100")).data;
  const credential = credentials.find((c) => c.type === "anthropicApi");
  if (!credential) throw new Error("No Anthropic credential found in n8n – create one first (Credentials → Anthropic)");
  console.log(`model ${MODEL}, credential "${credential.name}"`);
  const all = [
    documentCheckAgent(credential), documentCheckRule(), referenceCheckReminder(credential), applicationStatusAgent(credential),
    // The same agent with shorter documents (about 800 words) – only for the measurement.
    documentCheckAgent(credential, { name: "Document check (short documents, measurement)", hookPath: "document-check-short", dataset: require("./applications.json") }),
  ];
  const only = process.argv.slice(2);
  for (const workflow of all.filter((w) => !only.length || only.includes(w.name))) await save(workflow);
})().catch((err) => { console.error(err.message); process.exit(1); });
