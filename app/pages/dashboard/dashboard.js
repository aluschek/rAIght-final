// P5 Dashboard – Lena's dashboard: cost, CO₂e, tokens and runs, the agents that need attention, all her agents.
// The numbers come from the backend through rAIght.data (assets/data.js).

(function () {
  const { data, fmt, labels, h, pageUrl, showError } = window.rAIght;

  let query = "";
  const filters = { provider: "all", status: "all", sort: "cost" };
  let toastTimer;
  let cache = null; // { summary, agents } of the last render, for chart redraws
  let me = null;    // who the demo is shown as; decides which actions are offered
  let costs = new Map(); // cost of the last 30 days in EUR per agent id; an automation without runs has none
  const costOf = (agent) => costs.get(agent.id) || 0;

  const $ = (id) => document.getElementById(id);
  const agentUrl = (a) => `${pageUrl("agent")}?id=${encodeURIComponent(a.id)}`;

  // ---------- Icons ----------
  const icon = (name) => window.rAIght.sapIcon(name, 18);

  // ---------- Helpers ----------
  const PROVIDER_TILE = {
    copilot_studio: { text: "CS", color: "var(--color-series-1)" },
    power_automate: { text: "PA", color: "var(--color-series-3)" },
    openai: { text: "AI", color: "var(--color-series-4)" },
    n8n: { text: "n8", color: "var(--color-series-2)" },
  };
  function tile(agent) {
    const t = PROVIDER_TILE[agent.provider] || { text: "?", color: "var(--color-text-muted)" };
    return h("span", { class: "tile", style: { color: t.color }, title: labels.provider[agent.provider] }, t.text);
  }

  function statusOf(agent) {
    if (agent.status === "retired") return { key: "retired", text: "Retired", tone: "grey" };
    if (agent.status === "converted") return { key: "converted", text: `Converted to ${labels.ladder_step[agent.conversion.to].toLowerCase()}`, tone: "green" };
    if (agent.status === "unused") return { key: "unused", text: `Unused · ${agent.days_since_last_run} d`, tone: "amber" };
    if (agent.uniform_agent) return { key: "uniform", text: "Uniform", tone: "red" };
    return { key: "healthy", text: "Healthy", tone: "green" };
  }
  const pill = (agent) => { const s = statusOf(agent); return h("span", { class: `pill ${s.tone}` }, s.text); };

  // A new run stays longer (30 s) than a confirmation (3.5 s), so in a live demo there is time to switch tabs and point at it.
  function toast(text, ms = 3500) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  function retire(agent) {
    data.retireAgent(agent.id);
    toast(`${agent.name} retired. It no longer consumes resources.`);
    render();
  }

  // ---------- Headline and KPI cards ----------
  function renderHeadline(summary, impact) {
    $("headline").replaceChildren(
      h("b", null, `${summary.agents_uniform} of ${summary.agents_active} active agents`),
      " behave like workflows and caused ",
      h("b", null, `${fmt.eur(impact.uniform_agents.cost_30d_eur)} of last month's ${fmt.eur(impact.total.cost_30d_eur)}`),
      ". Converting them would save about ",
      h("b", null, `${fmt.eurAbout(impact.saving_potential_30d_eur * 12)} a year`),
      ".");
  }

  function renderKpis(summary, agents, impact) {
    const unused = agents.filter((a) => a.status === "unused");
    const retired = agents.filter((a) => a.status === "retired");
    // `ico` is the name of an icon, or a short text where the icon set has no fitting one.
    const kpi = (label, ico, tone, value, extra, ctx) => h("div", { class: "card kpi" },
      h("div", { class: "top" }, h("span", { class: "lbl" }, label), h("span", { class: `ico ${tone}` }, typeof ico === "string" ? icon(ico) : ico)),
      h("div", { class: "kv" }, h("span", { class: "val num" }, value), extra),
      h("div", { class: "ctx" }, ctx));
    const delta = summary.tokens_30d >= summary.tokens_30d_previous ? "up" : "down";
    const [co2Min, co2Max] = impact.total.co2e_30d_kg_range;

    $("kpis").replaceChildren(
      kpi("Cost", h("b", null, "€"), "tone-brand", fmt.eur(impact.total.cost_30d_eur), null,
        "At the providers' list prices · last 30 days"),
      kpi("CO₂e", h("b", null, "CO₂"), "tone-green", fmt.kg(impact.total.co2e_30d_kg), null,
        `Estimate from the output tokens · between ${fmt.kg(co2Min)} and ${fmt.kg(co2Max)}`),
      kpi("Tokens", "tokens", "tone-brand", fmt.millions(summary.tokens_30d),
        h("span", { class: `dp ${delta} num` }, fmt.delta(summary.tokens_30d, summary.tokens_30d_previous)),
        `${fmt.millions(summary.tokens_30d_previous)} in the previous 30 days`),
      kpi("Runs", "runs", "tone-green", fmt.int(summary.runs_30d), null,
        `Across ${summary.agents_total} agents · last 30 days`),
      kpi("Uniform agents", "uniform", "tone-red", summary.agents_uniform, null,
        `Same path ≥ ${Math.round(summary.uniform_threshold * 100)} % · could be workflows · ${fmt.eur(impact.uniform_agents.cost_30d_eur)} in 30 days`),
      kpi("Unused agents", "unused", "tone-amber", unused.length, null,
        unused.length ? `${unused[0].name}: no run for ${unused[0].days_since_last_run} days`
          : retired.length ? "Retired, no longer consuming resources" : "Every agent has run recently"));
  }

  // ---------- Needs attention ----------
  function renderAttention(summary, agents, impact) {
    const flagged = agents
      .filter((a) => !["retired", "converted"].includes(a.status) && !["Keep agent", "No action"].includes(a.suggestion))
      .sort((a, b) => (a.status === "unused") - (b.status === "unused") || costOf(b) - costOf(a) || b.tokens_30d - a.tokens_30d);

    $("attention").replaceChildren(...(flagged.length ? flagged.map((a, index) => {
      const unused = a.status === "unused";
      return h("li", { class: "li" },
        tile(a),
        h("div", { class: "grow" },
          h("div", { class: "t" }, h("a", { href: agentUrl(a) }, a.name), pill(a)),
          h("div", { class: "s" }, a.suggestion_text)),
        h("div", { class: "r" },
          h("b", { class: "num" }, fmt.eur(costOf(a))),
          h("span", null, unused ? "no runs" : `${fmt.millions(a.tokens_30d)} tokens · ${fmt.percent(a.same_path_share)} same path`)),
        h("div", { class: "act" }, unused
          ? (me.can("retire")
            ? h("button", { class: "btn btn-sm btn-danger", type: "button", onclick: () => retire(a) }, "Retire agent")
            : h("a", { class: "btn btn-sm btn-secondary", href: agentUrl(a) }, "View"))
          : a.conversion
            ? h("a", { class: "btn btn-sm btn-secondary", href: agentUrl(a) }, "Change planned ✓")
            : h("a", { class: `btn btn-sm ${index === 0 ? "btn-primary" : "btn-secondary"}`, href: agentUrl(a) }, a.suggestion)));
    }) : [h("li", { class: "empty" }, "Nothing needs attention. Every active agent is on the right ladder step.")]));

    const share = Math.round(summary.tokens_uniform_30d / summary.tokens_30d * 100);
    const costShare = impact.total.cost_30d_eur ? Math.round(impact.uniform_agents.cost_30d_eur / impact.total.cost_30d_eur * 100) : 0;
    $("att-foot").replaceChildren(
      h("div", null, h("span", { class: "lab" }, "Cost of uniform agents"), h("b", { class: "num" }, fmt.eur(impact.uniform_agents.cost_30d_eur))),
      h("div", null, h("span", { class: "lab" }, "Share of all cost"), h("b", { class: "num", style: { color: "var(--color-data-uniform)" } }, `${costShare} %`)),
      h("div", null, h("span", { class: "lab" }, "Share of all tokens"), h("b", { class: "num" }, `${share} %`)),
      h("span", { class: "sp" }),
      h("a", { class: "btn btn-primary", href: pageUrl("inventory") }, "Open automations"));
  }

  // ---------- Token usage line chart ----------
  function renderUsage(summary) {
    const months = summary.tokens_by_month;
    const box = $("usage-chart");
    const W = Math.max(box.clientWidth, 320), H = 230;
    const m = { l: 30, r: 14, t: 12, b: 26 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const peak = Math.max(...months.map((x) => x.tokens_uniform + x.tokens_other));
    const step = [2e6, 5e6, 1e7, 2e7, 5e7].find((size) => peak / size <= 6) || 1e8; // at most seven gridlines
    const top = Math.ceil(peak / step) * step;
    const x = (i) => m.l + 14 + (i * (pw - 28)) / (months.length - 1);
    const y = (v) => m.t + ph - (v / top) * ph;
    const line = (key) => months.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
    $("usage-sub").textContent = `Millions of tokens per month · ${fmt.month(months[0].month)} to ${fmt.month(months.at(-1).month)} ${months.at(-1).month.slice(0, 4)}`;
    const guide = h("line", { class: "guide", y1: m.t, y2: m.t + ph, x1: 0, x2: 0, visibility: "hidden" });
    const tip = $("tip");

    const svg = h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Tokens per month, uniform agents versus other agents" },
      ticks.map((t) => h("g", null,
        h("line", { class: t ? "gridline" : "axisline", x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }),
        h("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end" }, t / 1e6))),
      h("polyline", { points: `${x(0)},${y(0)} ${line("tokens_uniform")} ${x(months.length - 1)},${y(0)}`, fill: "var(--color-danger-surface)", stroke: "none" }),
      h("polyline", { points: line("tokens_other"), fill: "none", stroke: "var(--color-series-1)", "stroke-width": 2.5, "stroke-linejoin": "round" }),
      h("polyline", { points: line("tokens_uniform"), fill: "none", stroke: "var(--color-data-uniform)", "stroke-width": 2.5, "stroke-linejoin": "round" }),
      months.map((p, i) => h("g", null,
        h("circle", { cx: x(i), cy: y(p.tokens_uniform), r: 3.5, fill: "var(--color-surface)", stroke: "var(--color-data-uniform)", "stroke-width": 2 }),
        h("circle", { cx: x(i), cy: y(p.tokens_other), r: 3.5, fill: "var(--color-surface)", stroke: "var(--color-series-1)", "stroke-width": 2 }),
        h("text", { x: x(i), y: H - 6, "text-anchor": "middle" }, fmt.month(p.month)))),
      guide,
      months.map((p, i) => h("rect", {
        class: "hit", x: x(i) - (pw - 28) / (months.length - 1) / 2, width: (pw - 28) / (months.length - 1), y: m.t, height: ph,
        onpointermove: (e) => {
          guide.setAttribute("x1", x(i)); guide.setAttribute("x2", x(i)); guide.setAttribute("visibility", "visible");
          tip.replaceChildren(h("b", null, fmt.month(p.month)), h("br"),
            `Uniform agents: ${fmt.millions(p.tokens_uniform)}`, h("br"), `Other agents: ${fmt.millions(p.tokens_other)}`);
          tip.hidden = false;
          tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
          tip.style.top = `${e.clientY + 14}px`;
        },
        onpointerleave: () => { guide.setAttribute("visibility", "hidden"); tip.hidden = true; },
      })));
    box.replaceChildren(svg);

    const item = (label, value, color) => h("div", null, h("span", null, label), h("b", { class: "num", style: color && { color } }, value));
    $("flowsum").replaceChildren(
      item("Last 30 days", fmt.millions(summary.tokens_30d)),
      item("Uniform agents", fmt.millions(summary.tokens_uniform_30d), "var(--color-data-uniform)"),
      item("vs previous 30 d", fmt.delta(summary.tokens_30d, summary.tokens_30d_previous)));
  }

  // ---------- Same-path share ----------
  function renderShare(summary, agents) {
    const thr = summary.uniform_threshold;
    $("share-chart").replaceChildren(...agents.filter((a) => a.same_path_share != null).map((a) => {
      const color = a.uniform_agent ? "var(--color-data-uniform)" : "var(--color-good)";
      return h("div", null,
        h("div", { class: "hbar-head" }, h("span", null, a.name), h("b", { style: { color } }, fmt.percent(a.same_path_share))),
        h("div", { class: "track", role: "img", "aria-label": `${a.name}: ${fmt.percent(a.same_path_share)} same path` },
          h("div", { class: "fill", style: { width: `${a.same_path_share * 100}%`, background: color } }),
          h("div", { class: "thr", style: { left: `${thr * 100}%` } })));
    }));
    $("threshold-note").textContent = `Black line = threshold ${Math.round(thr * 100)} %: above it, an agent is flagged uniform`;
  }

  // ---------- Agent table ----------
  function spark(values, color) {
    const w = 96, hgt = 26, max = Math.max(...values) || 1;
    const pts = values.map((v, i) => `${(i * w / (values.length - 1)).toFixed(1)},${(hgt - 3 - (v / max) * (hgt - 6)).toFixed(1)}`).join(" ");
    return h("svg", { class: "spark", width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, "aria-hidden": "true" },
      h("polyline", { points: pts, stroke: color }));
  }

  function actionCell(a) {
    if (a.status === "retired") return h("span", { class: "pill grey" }, "Retired");
    if (a.status === "converted") return h("a", { class: "btn btn-sm btn-secondary", href: agentUrl(a) }, "View");
    if (a.conversion) return h("a", { class: "btn btn-sm btn-secondary", href: agentUrl(a) }, "Change planned ✓");
    if (a.suggestion === "Retire" && me.can("retire")) return h("button", { class: "btn btn-sm btn-danger", type: "button", onclick: () => retire(a) }, "Retire agent");
    if (a.suggestion === "Retire") return h("a", { class: "btn btn-sm btn-secondary", href: agentUrl(a) }, "View");
    return h("a", { class: "btn btn-sm btn-secondary", href: agentUrl(a) }, a.suggestion);
  }

  function renderTable(agents) {
    const sorters = {
      cost: (a, b) => costOf(b) - costOf(a) || b.tokens_30d - a.tokens_30d,
      tokens: (a, b) => b.tokens_30d - a.tokens_30d,
      share: (a, b) => (b.same_path_share ?? -1) - (a.same_path_share ?? -1),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    const visible = agents
      .filter((a) => a.name.toLowerCase().includes(query))
      .filter((a) => filters.provider === "all" || a.provider === filters.provider)
      .filter((a) => filters.status === "all" || statusOf(a).key === filters.status)
      .sort(sorters[filters.sort]);
    const sortText = { cost: "cost", tokens: "tokens", share: "same path", name: "name" }[filters.sort];
    $("result-count").textContent = `${visible.length} of ${agents.length} agents · sorted by ${sortText}`;

    const maxTokens = Math.max(...agents.map((a) => a.tokens_30d)) || 1;
    $("agent-rows").replaceChildren(...(visible.length ? visible.map((a) => {
      const s = statusOf(a);
      const inactive = !["active", "converted"].includes(a.status);
      const color = inactive ? "var(--color-text-muted)" : a.uniform_agent ? "var(--color-data-uniform)" : "var(--color-good)";
      return h("tr", { class: a.status === "retired" ? "is-retired" : null },
        h("td", null, h("div", { class: "agentcell" }, tile(a),
          h("div", null,
            h("strong", null, h("a", { href: agentUrl(a) }, a.name)),
            h("small", null, `${labels.provider[a.provider]} · ${labels.ladder_step[a.ladder_step]}`),
            h("small", null, a.purpose)))),
        h("td", null, h("span", { class: `pill ${s.tone}` }, s.text)),
        h("td", { class: "r num" }, fmt.int(a.runs_30d)),
        h("td", null, h("div", { class: "tokcell" },
          h("div", { class: "track" }, h("div", { class: "fill", style: { width: `${(a.tokens_30d / maxTokens) * 100}%`, background: "var(--color-data-tokens)" } })),
          h("b", { class: "num" }, a.tokens_30d ? fmt.millions(a.tokens_30d) : "0"))),
        h("td", { class: "r num" }, h("b", null, fmt.eur(costOf(a)))),
        h("td", null, spark(a.tokens_by_month, color)),
        h("td", { class: "r" }, h("span", { class: "share-val", style: { color: inactive ? "var(--color-text-muted)" : color } }, fmt.percent(a.same_path_share))),
        h("td", null, actionCell(a)));
    }) : [h("tr", null, h("td", { colspan: 8, class: "empty" }, "No agent matches your filters."))]));
  }

  // ---------- Render ----------
  async function render() {
    try {
      const [summary, agents, impact, who] = await Promise.all([data.getSummary(), data.getAgents(), data.getImpact(), data.getMe()]);
      me = who;
      cache = { summary, agents };
      costs = new Map(impact.agents.map((agent) => [agent.id, agent.cost_30d_eur]));
      renderHeadline(summary, impact);
      renderKpis(summary, agents, impact);
      renderAttention(summary, agents, impact);
      renderUsage(summary);
      renderShare(summary, agents);
      renderTable(agents);
    } catch (err) {
      showError(err);
    }
  }

  // ---------- Filters, search, theme ----------
  function syncToolbar() {
    const active = query || filters.provider !== "all" || filters.status !== "all";
    $("f-clear").hidden = !active;
    $("w-provider").classList.toggle("is-set", filters.provider !== "all");
    $("w-status").classList.toggle("is-set", filters.status !== "all");
  }

  function fillSelect(id, options, key) {
    const el = $(id);
    el.replaceChildren(...options.map(([value, text]) => h("option", { value }, text)));
    el.addEventListener("change", () => { filters[key] = el.value; syncToolbar(); render(); });
  }

  fillSelect("f-provider", [["all", "All providers"], ...Object.entries(labels.provider)], "provider");
  fillSelect("f-status", [["all", "All statuses"], ["uniform", "Uniform"], ["healthy", "Healthy"], ["converted", "Converted"], ["unused", "Unused"], ["retired", "Retired"]], "status");
  fillSelect("f-sort", [["cost", "Sort: cost"], ["tokens", "Sort: tokens"], ["share", "Sort: same path"], ["name", "Sort: name"]], "sort");

  $("search").addEventListener("input", (e) => { query = e.target.value.trim().toLowerCase(); syncToolbar(); render(); });
  $("f-clear").addEventListener("click", () => {
    query = ""; filters.provider = "all"; filters.status = "all";
    $("search").value = ""; $("f-provider").value = "all"; $("f-status").value = "all";
    syncToolbar(); render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $("search").focus(); }
  });
  let resizeTimer;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (cache) renderUsage(cache.summary); }, 120);
  }).observe($("usage-chart"));

  render();
  // A run from a connected tool, or a decision, shows up without a reload.
  data.onChange((changed) => {
    render();
    const fresh = changed.find((change) => change.runs > 0);
    if (fresh) toast(`${fresh.agent.name}: new run, ${fresh.tokens > 0 ? `${fmt.int(fresh.tokens)} tokens` : "no model call and 0 tokens"}.`, 30000);
  });
})();
