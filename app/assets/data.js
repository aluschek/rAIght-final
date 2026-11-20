// rAIght – the only place that reads data. Pages call these functions and never fetch JSON themselves.
// Agents and summary come from the backend API when it runs (`npm run watch`, docs/technical/backend.md);
// without it (e.g. on GitHub Pages) they come from the finished sample data in app/data/ (ADR 0006).
// Both have the same shape, so the function names and return shapes stay.
//
// State changes (retiring an agent, saving a new automation, handling an escalation) are kept in sessionStorage
// (ADR 0006), so they survive moving between pages and are gone when the tab closes. Retiring an agent is also
// saved in the backend when it runs: then it survives a reload, and a connected provider stops running the agent.

(function () {
  const ROOT = new URL("../", document.currentScript.src); // app/
  const cache = new Map();
  const store = {
    load(key, fallback) {
      try { const v = sessionStorage.getItem(`raight.${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    save(key, value) {
      try { sessionStorage.setItem(`raight.${key}`, JSON.stringify(value)); } catch { /* storage blocked: state lasts for this page only */ }
    },
  };
  const retired = new Set(store.load("retired", []));
  const converted = new Map(store.load("converted", [])); // agent id → the ladder step the owner chose
  const handled = new Set(store.load("handled", []));
  const created = store.load("created", []);
  let users = store.load("users", null); // null = still the sample users from data/users.json
  let meEmail = store.load("me", null);  // who the demo is shown as; null = the sample "you" (Lena)

  const paused = new Set(store.load("paused", [])); // providers switched off on the Providers page

  // What each role may do (ADR 0001: the process owner owns the lifecycle of the automations).
  // The CIO office only looks; the Admin runs the platform (providers, access) but builds nothing.
  const PERMISSIONS = {
    process_owner: ["plan", "retire", "handle", "decide"],
    cio_office: [],
    admin: ["providers", "access"],
  };

  // Backend endpoints that compute a sample file's content from the run log.
  const api = {
    "data/agents.json": "api/monitor/agents",
    "data/summary.json": "api/monitor/summary",
    "data/impact.json": "api/monitor/impact",
    "data/company.json": "api/monitor/company",
  };

  async function fetchJson(path) {
    const res = await fetch(new URL(path, ROOT));
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json();
  }

  async function loadJson(path) {
    if (!cache.has(path)) {
      const fromApi = api[path] && fetchJson(api[path]).catch((err) => {
        console.info(`rAIght: no backend (${err.message}), using ${path}`);
        return fetchJson(path);
      });
      cache.set(path, fromApi || fetchJson(path));
    }
    return cache.get(path);
  }

  /** Sends a decision to the backend. Without a backend nothing happens: the decision stays in this tab. */
  function postJson(path, body) {
    return fetch(new URL(path, ROOT), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true })
      .catch((err) => console.info(`rAIght: no backend (${err.message}), kept in this tab`));
  }

  /** The agent with this tab's decisions. A conversion the backend does not know yet shows as planned. */
  function withState(agent) {
    const planned = !agent.conversion && converted.has(agent.id) && { to: converted.get(agent.id), since: null, runs: 0, tokens: 0, done: false };
    const withPlan = planned ? { ...agent, conversion: planned } : agent;
    return retired.has(agent.id) ? { ...withPlan, status: "retired" } : withPlan;
  }

  const data = {
    root: ROOT,

    /** Totals for the dashboard header and key figures (data/summary.json). */
    getSummary: () => loadJson("data/summary.json"),

    /** Cost and CO₂e of Lena's agents in the last 30 days: per agent, in total and for the uniform agents (data/impact.json). */
    getImpact: () => loadJson("data/impact.json"),

    /** Company-wide totals per owner, for the CIO office (data/company.json). Aggregated: no single run or agent. */
    getCompany: () => loadJson("data/company.json"),

    /** The latest runs of one agent, newest first, each with its cost. Null without a backend: the sample data has no single runs. */
    getRuns: (id) => fetchJson(`api/monitor/runs?agent=${encodeURIComponent(id)}`).catch(() => null),

    /** Forgets what came from the backend, so the next read is fresh. */
    refresh() { for (const path of Object.keys(api)) cache.delete(path); },

    /**
     * Calls `callback` when something changed in the backend: a run arrived, or a decision was saved. It gets the
     * changed agents with their new runs and tokens. Asks every few seconds; without a backend nothing happens.
     */
    onChange(callback, seconds = 4) {
      let before = null;
      const tick = async () => {
        let agents;
        try { agents = await fetchJson(api["data/agents.json"]); } catch { return; }
        const seen = before;
        before = new Map(agents.map((agent) => [agent.id, agent]));
        if (!seen) return;
        const changed = agents
          .filter((agent) => {
            const old = seen.get(agent.id);
            return !old || old.runs_30d !== agent.runs_30d || old.tokens_30d !== agent.tokens_30d || old.status !== agent.status
              || JSON.stringify(old.conversion) !== JSON.stringify(agent.conversion);
          })
          .map((agent) => ({ agent, runs: agent.runs_30d - (seen.get(agent.id)?.runs_30d ?? agent.runs_30d), tokens: agent.tokens_30d - (seen.get(agent.id)?.tokens_30d ?? agent.tokens_30d) }));
        if (changed.length) { data.refresh(); callback(changed); }
      };
      tick();
      return setInterval(tick, seconds * 1000);
    },

    /** All of Lena's automations with finished metrics (data/agents.json). */
    async getAgents() {
      const agents = await loadJson("data/agents.json");
      return [...agents, ...created].map(withState);
    },

    /** One agent by id, or null. */
    async getAgent(id) {
      const agents = await data.getAgents();
      return agents.find((a) => a.id === id) || null;
    },

    /** Text content, e.g. getContent("ladder") → data/content/ladder.json. */
    getContent: (name) => loadJson(`data/content/${name}.json`),

    /** People with access to rAIght and their role (data/users.json, plus changes made in this session). */
    async getUsers() {
      if (!users) users = (await loadJson("data/users.json")).map((u) => ({ ...u }));
      const current = users.some((u) => u.email === meEmail) ? meEmail : (users.find((u) => u.you) || users[0]).email;
      return users.map((u) => ({ ...u, you: u.email === current }));
    },

    /** The person the demo is shown as, with `can(action)`: "plan", "retire", "handle", "decide" or "access". */
    async getMe() {
      const me = (await data.getUsers()).find((u) => u.you);
      const allowed = PERMISSIONS[me.role] || [];
      return { ...me, can: (action) => allowed.includes(action), readOnly: allowed.length === 0 };
    },

    /** Connected providers with a `connected` flag (summary.json plus switches made in this session). */
    async getProviders() {
      const summary = await data.getSummary();
      return summary.providers.map((p) => ({ ...p, connected: !paused.has(p.id) }));
    },

    /** Demo action: connect or disconnect a provider. Existing data stays; only the status changes. */
    setProviderConnected(id, connected) {
      if (connected) paused.delete(id); else paused.add(id);
      store.save("paused", [...paused]);
    },

    /** Demo action: show the demo as another person. Pages reload to apply it. */
    setMe(email) { meEmail = email; store.save("me", email); },

    /** Demo actions on the access list: client-side only (ADR 0006). */
    async addUser({ email, name, role }) {
      await data.getUsers();
      users.push({ email, name, role });
      store.save("users", users);
    },
    async setUserRole(email, role) {
      await data.getUsers();
      users = users.map((u) => (u.email === email ? { ...u, role } : u));
      store.save("users", users);
    },
    async removeUser(email) {
      const me = await data.getMe();
      if (email === me.email) return; // nobody removes the person they are shown as
      users = users.filter((u) => u.email !== email);
      store.save("users", users);
    },

    /** Cases routed to Lena, newest first, with a `handled` flag (data/escalations.json). */
    async getEscalations() {
      const items = await loadJson("data/escalations.json");
      return items.map((e) => ({ ...e, handled: handled.has(e.id) })).sort((a, b) => b.time.localeCompare(a.time));
    },

    /** Demo action: forget every change made in this session (retired agents, saved automations, handled cases). */
    resetDemo() {
      postJson("api/monitor/reset", {}); // the backend takes every retirement and conversion back
      retired.clear(); converted.clear(); handled.clear(); created.length = 0; users = null; meEmail = null; paused.clear();
      for (const key of ["retired", "converted", "handled", "created"]) store.save(key, []);
      store.save("users", null);
      store.save("me", null);
      store.save("paused", []);
    },

    /** Demo action: retire an agent. This tab remembers it, and the backend saves it when it runs. */
    retireAgent(id) {
      retired.add(id);
      store.save("retired", [...retired]);
      postJson("api/monitor/retire", { agent: id });
    },

    /**
     * Demo action: move an agent to the lower step rAIght suggests. This tab remembers it, and the backend saves it
     * when it runs. A connected provider then switches over, and the first run without a model confirms it.
     */
    async convertAgent(id, step) {
      converted.set(id, step);
      store.save("converted", [...converted]);
      await postJson("api/monitor/convert", { agent: id });
      data.refresh();
    },

    /** Demo action: mark an escalation as handled for this session. */
    markHandled(id) { handled.add(id); store.save("handled", [...handled]); },

    /** Demo action: remove an automation that was saved in this session. The sample agents stay. Returns whether it was removed. */
    removeAgent(id) {
      const i = created.findIndex((a) => a.id === id);
      if (i < 0) return false;
      created.splice(i, 1);
      store.save("created", created);
      return true;
    },

    /** Demo action: save a new automation from the triage (no runs yet, so no metrics). */
    addAgent({ name, provider, purpose, ladder_step, agent_reason }) {
      const agent = {
        id: `new_${Date.now().toString(36)}`, name, provider, owner: "Lena", purpose, ladder_step,
        agent_reason: agent_reason || "", status: "active", is_new: true,
        runs_30d: 0, tokens_30d: 0, same_path_share: null, uniform_agent: false, days_since_last_run: 0,
        top_paths: [], suggestion: "No action", suggestion_text: "New automation. rAIght starts measuring with the first runs.",
        tokens_by_month: [0, 0, 0, 0, 0, 0], runs_by_day: new Array(30).fill(0),
      };
      created.push(agent);
      store.save("created", created);
      return agent;
    },
  };

  // ---------- Formatting helpers shared by all pages ----------
  const fmt = {
    millions: (n) => `${(n / 1e6).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`,
    int: (n) => n.toLocaleString("en-GB"),
    eur: (n) => `€${Math.round(n).toLocaleString("en-GB")}`,
    /** An estimate, rounded to two leading digits: 2,311 becomes €2,300 and 53,257 becomes €53,000. */
    eurAbout: (n) => {
      const unit = 10 ** Math.max(Math.floor(Math.log10(Math.max(n, 1))) - 1, 0);
      return `€${(Math.round(n / unit) * unit).toLocaleString("en-GB")}`;
    },
    cents: (eur) => `${(eur * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })} cents`,
    time: (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    kg: (n) => `${n.toLocaleString("en-GB", { minimumFractionDigits: n < 10 ? 1 : 0, maximumFractionDigits: n < 10 ? 1 : 0 })} kg`,
    percent: (share) => (share == null ? "–" : `${Math.round(share * 100)} %`),
    delta: (now, before) => {
      const d = (now / before - 1) * 100;
      return `${d >= 0 ? "+" : ""}${d.toFixed(1)} %`;
    },
    month: (iso) => new Date(`${iso}-01T00:00:00`).toLocaleString("en-GB", { month: "short" }),
    dateTime: (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };

  // Display names for enum values (glossary terms).
  const labels = {
    ladder_step: { rule: "Rule", workflow: "Workflow", classic_ml: "Classic ML", genai_call: "GenAI call", agent: "Agent", multi_agent: "Multi-agent" },
    ladder_number: { rule: 1, workflow: 2, classic_ml: 3, genai_call: 4, agent: 5, multi_agent: 6 },
    role: { process_owner: "Process owner", cio_office: "CIO office", admin: "Admin" },
    role_note: {
      process_owner: "Builds and manages their own automations.",
      cio_office: "Sees usage and savings across all automations. Read-only.",
      admin: "Manages connected providers and who has access.",
    },
    provider: { copilot_studio: "Copilot Studio", power_automate: "Power Automate", openai: "OpenAI", n8n: "n8n" },
  };

  window.rAIght = Object.assign(window.rAIght || {}, { data, fmt, labels });
})();
