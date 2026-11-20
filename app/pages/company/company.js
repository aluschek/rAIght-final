// Company dashboard (CIO office) – token use across the company, aggregated per owner.
// All figures come from rAIght.data.getCompany() – the backend's company totals, or app/data/company.json
// without a backend. No single run or agent is shown.

(function () {
  const { data, fmt, h, showError } = window.rAIght;
  const $ = (id) => document.getElementById(id);
  const pct = (a, b) => Math.round((a / b) * 100);
  const TOP_OWNERS = 8; // bars in "By owner"
  let company = null;

  const icon = (name) => window.rAIght.sapIcon(name, 18);

  function renderKpis(c) {
    // `ico` is the name of an icon, or a short text where the icon set has no fitting one.
    const kpi = (label, ico, tone, value, extra, ctx) => h("div", { class: "card kpi" },
      h("div", { class: "top" }, h("span", { class: "lbl" }, label), h("span", { class: `ico ${tone}` }, typeof ico === "string" ? icon(ico) : ico)),
      h("div", { class: "kv" }, h("span", { class: "val num" }, value), extra),
      h("div", { class: "ctx" }, ctx));
    const perYear = Math.round((c.cost_30d_eur * 12) / 1000) * 1000; // twelve times the last 30 days, to the nearest thousand
    $("headline").replaceChildren(
      h("b", null, `${c.agents_uniform} of ${c.agents_total} automations`), " behave like workflows and caused ",
      h("b", null, `${fmt.eur(c.cost_uniform_30d_eur)} of last month's ${fmt.eur(c.cost_30d_eur)}`), ". Converting them would save about ",
      h("b", null, `${fmt.eurAbout(c.saving_potential_30d_eur * 12)} a year`), ".");
    $("kpis").replaceChildren(
      kpi("Cost", h("b", null, "€"), "tone-brand", fmt.eur(c.cost_30d_eur), null,
        `At the providers' list prices · about ${fmt.eur(perYear)} a year`),
      kpi("CO₂e", h("b", null, "CO₂"), "tone-green", fmt.kg(c.co2e_30d_kg), null,
        `Estimate from the output tokens · ${fmt.kg(c.co2e_uniform_30d_kg)} of it in uniform agents`),
      kpi("Tokens", "tokens", "tone-brand", fmt.millions(c.tokens_30d),
        h("span", { class: `dp ${c.tokens_30d >= c.tokens_30d_previous ? "up" : "down"} num` }, fmt.delta(c.tokens_30d, c.tokens_30d_previous)),
        `${fmt.millions(c.tokens_30d_previous)} in the previous 30 days`),
      kpi("Automations", "owners", "tone-green", c.agents_total, null, `Across ${c.owners_total} process owners`),
      kpi("Uniform agents", "uniform", "tone-red", c.agents_uniform, null,
        `Same path ≥ ${Math.round(c.uniform_threshold * 100)} % · could be workflows · ${fmt.eur(c.cost_uniform_30d_eur)} in 30 days`),
      kpi("Unused agents", "unused", "tone-amber", c.agents_unused, null, "Their owners can retire them"));
  }

  function renderUsage(c) {
    const months = c.tokens_by_month;
    $("usage-sub").textContent = `Millions of tokens per month, all owners · ${fmt.month(months[0].month)} to ${fmt.month(months.at(-1).month)} ${months.at(-1).month.slice(0, 4)}`;
    const box = $("usage-chart");
    const W = Math.max(box.clientWidth, 320), H = 230;
    const m = { l: 34, r: 14, t: 12, b: 26 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const peak = Math.max(...months.map((x) => x.tokens_uniform + x.tokens_other));
    const step = [4e6, 1e7, 2e7, 4e7, 1e8, 2e8, 4e8].find((size) => peak / size <= 6) || 1e9; // at most six gridlines
    const top = Math.ceil(peak / step) * step;
    const x = (i) => m.l + 14 + (i * (pw - 28)) / (months.length - 1);
    const y = (v) => m.t + ph - (v / top) * ph;
    const line = (key) => months.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
    const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
    const guide = h("line", { class: "guide", y1: m.t, y2: m.t + ph, x1: 0, x2: 0, visibility: "hidden" });
    const tip = $("tip");
    const colw = (pw - 28) / (months.length - 1);

    box.replaceChildren(h("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Tokens per month across the company, uniform agents versus other agents" },
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
        class: "hit", x: x(i) - colw / 2, width: colw, y: m.t, height: ph,
        onpointermove: (e) => {
          guide.setAttribute("x1", x(i)); guide.setAttribute("x2", x(i)); guide.setAttribute("visibility", "visible");
          tip.replaceChildren(h("b", null, fmt.month(p.month)), h("br"), `Uniform agents: ${fmt.millions(p.tokens_uniform)}`, h("br"), `Other agents: ${fmt.millions(p.tokens_other)}`);
          tip.hidden = false;
          tip.style.left = `${Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8)}px`;
          tip.style.top = `${e.clientY + 14}px`;
        },
        onpointerleave: () => { guide.setAttribute("visibility", "hidden"); tip.hidden = true; },
      }))));

    const item = (label, value, color) => h("div", null, h("span", null, label), h("b", { class: "num", style: color && { color } }, value));
    $("flowsum").replaceChildren(
      item("Last 30 days", fmt.millions(c.tokens_30d)),
      item("Uniform agents", fmt.millions(c.tokens_uniform_30d), "var(--color-data-uniform)"),
      item("vs previous 30 d", fmt.delta(c.tokens_30d, c.tokens_30d_previous)));
  }

  function renderOwners(c) {
    const all = [...c.owners].sort((a, b) => b.tokens_30d - a.tokens_30d);
    const owners = all.slice(0, TOP_OWNERS); // the chart sits next to the usage chart; the ranking below lists every owner
    const max = owners[0].tokens_30d;
    if (all.length > owners.length) $("owners-sub").textContent = `The ${owners.length} of ${all.length} owners with the most tokens · last 30 days, split into uniform and other agents`;
    $("owners-chart").replaceChildren(...owners.map((o) => h("div", null,
      h("div", { class: "hbar-head" },
        h("span", null, o.owner, h("small", null, o.unit)),
        h("span", { class: "tok" }, fmt.millions(o.tokens_30d))),
      h("div", { class: "track", role: "img", "aria-label": `${o.owner}: ${fmt.millions(o.tokens_30d)} tokens, ${pct(o.tokens_uniform_30d, o.tokens_30d)} % in uniform agents` },
        h("div", { class: "owner-bar", style: { width: `${(o.tokens_30d / max) * 100}%` } },
          h("span", { style: { width: `${(o.tokens_uniform_30d / o.tokens_30d) * 100}%`, background: "var(--color-data-uniform)" } }),
          h("span", { style: { flex: "1", background: "var(--color-series-1)" } }))))));
  }

  function renderRanking(c) {
    const owners = [...c.owners].sort((a, b) => b.tokens_uniform_30d - a.tokens_uniform_30d);
    $("ranking").replaceChildren(...owners.map((o, i) => h("li", { class: `li${i >= 2 ? " low" : ""}` },
      h("span", { class: "rank-no", "aria-hidden": "true" }, i + 1),
      h("div", { class: "grow" },
        h("div", { class: "t" }, o.owner, h("span", { class: `pill ${pct(o.tokens_uniform_30d, o.tokens_30d) >= 65 ? "red" : "amber"}` }, `${pct(o.tokens_uniform_30d, o.tokens_30d)} % in uniform agents`)),
        h("div", { class: "s" }, `${o.unit} · ${o.uniform_agents} of ${o.agents} automations behave like workflows${o.unused_agents ? `, ${o.unused_agents} unused` : ""} · ${fmt.eur(o.cost_30d_eur)} in 30 days`)),
      h("div", { class: "r" },
        h("b", { class: "num" }, `${fmt.millions(o.tokens_uniform_30d)} tokens`),
        h("span", null, `of ${fmt.millions(o.tokens_30d)}`)))));
  }

  let resizeTimer;
  async function init() {
    try {
      company = await data.getCompany();
      renderKpis(company);
      renderUsage(company);
      renderOwners(company);
      renderRanking(company);
      new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderUsage(company), 120); }).observe($("usage-chart"));
    } catch (err) { showError(err); }
  }
  init();
})();
