// P4 Inventory – every automation with provider, ladder step and the reason it is an agent.
// Data from app/data/agents.json (ADR 0006). The ladder summary only counts the rows.

(function () {
  const { data, labels, h, pageUrl, showError, confirmButton, refreshSidebar } = window.rAIght;
  const STEPS = Object.keys(labels.ladder_step);
  const filters = { provider: "all", step: "all" };
  let query = "";
  let agents = [];
  let canPlan = false; // only process owners can remove what they saved
  let toastTimer;

  function toast(text) {
    const el = document.getElementById("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  const agentUrl = (a) => `${pageUrl("agent")}?id=${encodeURIComponent(a.id)}`;

  function statusChip(a) {
    if (a.status === "retired") return h("span", { class: "chip chip-neutral" }, "Retired");
    if (a.status === "unused") return h("span", { class: "chip chip-warn" }, `Unused · ${a.days_since_last_run} d`);
    if (a.is_new) return h("span", { class: "chip chip-step" }, "New");
    return a.uniform_agent ? h("span", { class: "chip chip-danger" }, "Uniform") : h("span", { class: "chip chip-good" }, "Healthy");
  }

  function renderMix() {
    const live = agents.filter((a) => a.status !== "retired");
    document.getElementById("mix-sub").textContent = `${live.length} automations · lower steps use fewer tokens`;
    document.getElementById("mix").replaceChildren(...STEPS.map((id) => {
      const n = live.filter((a) => a.ladder_step === id).length;
      return h("div", { class: `mix-cell ${n ? "has" : ""} ${n && labels.ladder_number[id] >= 5 ? "is-agent" : ""}` },
        h("b", { class: "num" }, n), h("span", null, `${labels.ladder_number[id]} · ${labels.ladder_step[id]}`));
    }));
  }

  function renderRows() {
    const rows = agents
      .filter((a) => a.name.toLowerCase().includes(query))
      .filter((a) => filters.provider === "all" || a.provider === filters.provider)
      .filter((a) => filters.step === "all" || a.ladder_step === filters.step);
    document.getElementById("count").textContent = `${rows.length} of ${agents.length} automations`;
    document.getElementById("rows").replaceChildren(...(rows.length ? rows.map((a) => h("tr", { class: a.status === "retired" ? "is-retired" : null },
      h("td", null, h("div", { class: "cell-main" },
        h("div", null, h("strong", null, h("a", { href: agentUrl(a) }, a.name)), h("small", null, a.purpose)))),
      h("td", null, labels.provider[a.provider]),
      h("td", null, h("span", { class: `chip ${labels.ladder_number[a.ladder_step] >= 5 ? "chip-agent" : "chip-step"}` }, `${labels.ladder_number[a.ladder_step]} · ${labels.ladder_step[a.ladder_step]}`)),
      h("td", null, a.agent_reason ? h("p", { class: "why", style: { margin: 0 } }, `“${a.agent_reason}”`) : h("span", { class: "why none" }, "–")),
      h("td", null, statusChip(a)),
      h("td", { class: "right" }, a.is_new && canPlan && confirmButton({
        label: "Remove", ariaLabel: `Remove ${a.name}`,
        action: async () => { data.removeAgent(a.id); toast(`${a.name} removed.`); agents = await data.getAgents(); renderMix(); renderRows(); },
      })))) : [h("tr", null, h("td", { colspan: 6, class: "muted" }, "No automation matches your filters."))]));
  }

  function syncToolbar() {
    document.getElementById("f-clear").hidden = !(query || filters.provider !== "all" || filters.step !== "all");
    document.getElementById("f-provider").classList.toggle("is-set", filters.provider !== "all");
    document.getElementById("f-step").classList.toggle("is-set", filters.step !== "all");
  }

  function fillSelect(id, options, key) {
    const el = document.getElementById(id);
    el.replaceChildren(...options.map(([value, text]) => h("option", { value }, text)));
    el.addEventListener("change", () => { filters[key] = el.value; syncToolbar(); renderRows(); });
  }

  async function init() {
    try {
      const me = await data.getMe();
      canPlan = me.can("plan");
      if (!canPlan) document.getElementById("plan-btn").remove();
      agents = await data.getAgents();
      fillSelect("f-provider", [["all", "All providers"], ...Object.entries(labels.provider)], "provider");
      fillSelect("f-step", [["all", "All ladder steps"], ...STEPS.map((id) => [id, `${labels.ladder_number[id]} · ${labels.ladder_step[id]}`])], "step");
      document.getElementById("search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); syncToolbar(); renderRows(); });
      document.getElementById("f-clear").addEventListener("click", () => {
        query = ""; filters.provider = "all"; filters.step = "all";
        document.getElementById("search").value = ""; document.getElementById("f-provider").value = "all"; document.getElementById("f-step").value = "all";
        syncToolbar(); renderRows();
      });
      renderMix();
      renderRows();
    } catch (err) { showError(err); }
  }
  init();
})();
