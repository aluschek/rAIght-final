// P7 Escalations – cases an agent could not handle, routed to Lena.
// Data from app/data/escalations.json (ADR 0006). The page only counts and filters the rows;
// "Mark handled" is client-side state.

(function () {
  const { data, fmt, labels, h, pageUrl, showError, refreshSidebar } = window.rAIght;
  const PRIORITIES = [["high", "High", "Needs you today"], ["medium", "Medium", "This week"], ["low", "Low", "When time allows"]];
  const PROVIDER_CODE = { copilot_studio: "CS", power_automate: "PA", openai: "AI", n8n: "n8" };
  const defaults = () => ({ agent: "all", category: "all", priority: "all", status: "open" });
  let filters = defaults();
  let view = "overview";
  let cases = [];
  let agents = [];
  let me = null; // who the demo is shown as; only some roles handle cases

  const agentOf = (id) => agents.find((a) => a.id === id) || { id, name: id };
  const agentUrl = (id) => `${pageUrl("agent")}?id=${encodeURIComponent(id)}`;
  const count = (list, fn) => list.filter(fn).length;

  function filtered(skip = []) {
    return cases.filter((c) =>
      (skip.includes("agent") || filters.agent === "all" || c.agent_id === filters.agent) &&
      (skip.includes("category") || filters.category === "all" || c.category === filters.category) &&
      (skip.includes("priority") || filters.priority === "all" || c.priority === filters.priority) &&
      (filters.status === "all" || (filters.status === "open" ? !c.handled : c.handled)));
  }

  // ---------- Summary tiles ----------
  function renderTiles() {
    const list = filtered(["priority"]);
    const agentCount = new Set(list.map((c) => c.agent_id)).size;
    const tile = (cls, big, title, sub, key) => h(key ? "button" : "div", {
      class: `tile ${cls}`, type: key ? "button" : null, "aria-pressed": key ? String(filters.priority === key) : null,
      onclick: key ? () => { filters.priority = filters.priority === key ? "all" : key; syncControls(); render(); } : null,
    }, h("b", null, big), h("strong", null, title), h("span", null, sub));
    document.getElementById("tiles").replaceChildren(
      tile("open", list.length, "Cases", `Across ${agentCount} agent${agentCount === 1 ? "" : "s"}`),
      ...PRIORITIES.map(([key, title, sub]) => tile(key, count(list, (c) => c.priority === key), title, sub, key)));
  }

  // ---------- Agent × category matrix ----------
  function renderMatrix() {
    const list = filtered(["agent", "category"]);
    const cats = [...new Set(cases.map((c) => c.category))].sort();
    const ids = [...new Set(cases.map((c) => c.agent_id))].sort((a, b) => agentOf(a).name.localeCompare(agentOf(b).name));
    const cell = (agentId, cat, n) => h("td", null, n
      ? h("button", { class: "num-btn", type: "button", "aria-label": `${n} cases, ${agentOf(agentId).name}, ${cat}`, onclick: () => {
          if (agentId) filters.agent = agentId;
          filters.category = cat; view = "cases"; syncControls(); render();
        } }, n)
      : h("span", { class: "zero", "aria-label": "none" }, "×"));
    const table = h("table", { class: "matrix" },
      h("thead", null, h("tr", null, h("th", { scope: "col" }, "Category"), ids.map((id) => h("th", { scope: "col" }, agentOf(id).name)), h("th", { scope: "col" }, "Total"))),
      h("tbody", null, cats.map((cat) => {
        const row = list.filter((c) => c.category === cat);
        return h("tr", null, h("td", null, cat),
          ids.map((id) => cell(id, cat, count(row, (c) => c.agent_id === id))),
          h("td", { class: "total" }, row.length));
      })));
    document.getElementById("matrix").replaceChildren(table);
  }

  // ---------- Case list ----------
  function renderCases() {
    const list = filtered();
    document.getElementById("cases-sub").textContent = `${list.length} of ${cases.length} cases · highest priority first`;
    const order = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => order[a.priority] - order[b.priority] || b.time.localeCompare(a.time));
    const body = document.getElementById("cases");
    if (!list.length) {
      body.replaceChildren(h("tr", null, h("td", { colspan: 6 }, h("div", { class: "empty-state" },
        h("strong", null, filters.status === "open" && !cases.some((c) => !c.handled) ? "Nothing waits for you" : "No cases match your filters"),
        "Cases an agent cannot handle will show up here."))));
      return;
    }
    body.replaceChildren(...list.map((c) => {
      const a = agentOf(c.agent_id);
      return h("tr", { class: c.handled ? "is-done" : null },
        h("td", null, h("div", { class: "cell-agent" },
          h("span", { class: "tile-code" }, PROVIDER_CODE[a.provider] || "?"),
          h("a", { href: agentUrl(c.agent_id) }, a.name))),
        h("td", null, h("div", { class: "case-text" }, c.text)),
        h("td", null, c.category),
        h("td", null, h("span", { class: `prio ${c.priority}` }, c.priority[0].toUpperCase() + c.priority.slice(1))),
        h("td", { class: "when" }, fmt.dateTime(c.time)),
        h("td", { class: "right" }, c.handled
          ? h("span", { class: "chip chip-neutral" }, "Handled")
          : !me.can("handle") ? null : h("button", { class: "btn btn-sm btn-secondary", type: "button", onclick: () => { data.markHandled(c.id); load(); refreshSidebar(); } }, "Mark handled")));
    }));
  }

  // ---------- Controls ----------
  function fillSelect(id, key, options) {
    const el = document.getElementById(id);
    el.replaceChildren(...options.map(([value, text]) => h("option", { value }, text)));
    el.value = filters[key];
    el.onchange = () => { filters[key] = el.value; syncControls(); render(); };
  }

  function setupControls() {
    const cats = [...new Set(cases.map((c) => c.category))].sort();
    const ids = [...new Set(cases.map((c) => c.agent_id))].sort((a, b) => agentOf(a).name.localeCompare(agentOf(b).name));
    fillSelect("f-agent", "agent", [["all", "All agents"], ...ids.map((id) => [id, agentOf(id).name])]);
    fillSelect("f-category", "category", [["all", "All categories"], ...cats.map((c) => [c, c])]);
    fillSelect("f-priority", "priority", [["all", "All priorities"], ...PRIORITIES.map(([k, t]) => [k, t])]);
    fillSelect("f-status", "status", [["open", "Open"], ["handled", "Handled"], ["all", "All"]]);
    document.getElementById("v-overview").onclick = () => { view = "overview"; syncControls(); render(); };
    document.getElementById("v-cases").onclick = () => { view = "cases"; syncControls(); render(); };
    document.getElementById("f-reset").onclick = () => { filters = defaults(); view = "overview"; syncControls(); render(); };
  }

  function syncControls() {
    for (const key of ["agent", "category", "priority", "status"]) {
      const el = document.getElementById(`f-${key}`);
      el.value = filters[key];
      document.getElementById(`w-${key}`).classList.toggle("is-set", filters[key] !== defaults()[key]);
    }
    document.getElementById("v-overview").setAttribute("aria-pressed", String(view === "overview"));
    document.getElementById("v-cases").setAttribute("aria-pressed", String(view === "cases"));
  }

  function render() {
    document.getElementById("matrix-card").hidden = view !== "overview";
    renderTiles();
    renderMatrix();
    renderCases();
  }

  async function load() {
    try {
      [cases, agents, me] = await Promise.all([data.getEscalations(), data.getAgents(), data.getMe()]);
      if (!document.getElementById("f-agent").options.length) setupControls();
      syncControls();
      render();
    } catch (err) { showError(err); }
  }
  load();
})();
