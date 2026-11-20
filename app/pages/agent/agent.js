// P6 Agent detail – one agent: key figures, runs per day, path breakdown, its latest runs,
// rAIght's suggestion and the agent reason. Usage: pages/agent/?id=app_status
// Retire and convert are saved in the backend when it runs (data.js). "Keep as agent" stays in this page.

(function () {
  const { data, fmt, labels, h, showError, pageUrl, confirmButton } = window.rAIght;
  const id = new URLSearchParams(location.search).get("id") || "app_status";
  const STEPS = ["rule", "workflow", "classic_ml", "genai_call", "agent", "multi_agent"];
  const SHORT = { rule: "Rule", workflow: "Workflow", classic_ml: "ML", genai_call: "GenAI", agent: "Agent", multi_agent: "Multi" };
  // Which ladder step each suggestion points to (null = leave the ladder).
  const TARGET = { "Convert to workflow": "workflow", "Replace with rule": "rule", "Use template": "genai_call", "Keep agent": "agent", "Retire": null };
  let kept = false; // "Keep as agent" was chosen on this page
  let me = null;    // who the demo is shown as; decides which actions are offered

  /** A conversion the owner decided on, as long as the run log has not confirmed it. */
  const planned = (agent) => agent.conversion && !agent.conversion.done;
  const stepName = (step) => labels.ladder_step[step].toLowerCase();

  function statusChip(agent) {
    if (agent.status === "retired") return h("span", { class: "chip chip-neutral" }, "Retired");
    if (agent.status === "converted") return h("span", { class: "chip chip-good" }, `Converted to ${stepName(agent.conversion.to)}`);
    if (agent.status === "unused") return h("span", { class: "chip chip-neutral" }, `Unused · ${agent.days_since_last_run} d`);
    if (planned(agent)) return h("span", { class: "chip chip-good" }, "Change planned");
    if (kept) return h("span", { class: "chip chip-neutral" }, "Kept as agent");
    return agent.uniform_agent ? h("span", { class: "chip chip-danger" }, "Uniform") : h("span", { class: "chip chip-good" }, "Healthy");
  }

  function renderHeader(agent, refresh) {
    document.title = `${agent.name} · rAIght`;
    document.getElementById("agent-name").textContent = agent.name;
    document.getElementById("agent-sub").textContent = agent.purpose;
    document.getElementById("title-chips").replaceChildren(
      h("span", { class: "chip chip-step" }, `Step ${labels.ladder_number[agent.ladder_step]} · ${labels.ladder_step[agent.ladder_step]}`),
      " ", statusChip(agent));

    const actions = [];
    if (agent.is_new && me.can("plan")) {
      actions.push(confirmButton({ label: "Remove automation", className: "btn btn-danger", action: () => { data.removeAgent(agent.id); location.href = pageUrl("inventory"); } }));
    } else if (agent.status === "unused" && me.can("retire")) {
      actions.push(h("button", { class: "btn btn-danger", type: "button", onclick: () => { data.retireAgent(agent.id); refresh(); } }, "Retire agent ›"));
    } else if (planned(agent)) {
      actions.push(h("button", { class: "btn btn-primary", type: "button", disabled: true }, "Change planned ✓"));
    } else if (agent.uniform_agent && agent.status === "active" && me.can("decide")) {
      actions.push(
        h("button", { class: "btn btn-secondary", type: "button", "aria-pressed": String(kept), onclick: () => { kept = true; refresh(); } }, "Keep as agent"),
        h("button", { class: "btn btn-primary", type: "button", onclick: async () => { await data.convertAgent(agent.id, TARGET[agent.suggestion]); refresh(); } }, `${agent.suggestion} ›`));
    }
    document.getElementById("actions").replaceChildren(...actions);
  }

  function renderKpis(agent, cost) {
    const tile = (label, value, sub, cls = "") => h("div", { class: "card kpi" },
      h("span", { class: "kpi-label" }, label),
      h("span", { class: `kpi-value kpi-value-sm ${cls}` }, value),
      h("span", { class: "kpi-sub" }, sub));
    const perRun = agent.runs_30d ? Math.round(agent.tokens_30d / agent.runs_30d) : null;
    const centsPerRun = agent.runs_30d && cost ? (cost / agent.runs_30d) * 100 : null;
    document.getElementById("kpis").replaceChildren(
      tile("Runs · 30 d", fmt.int(agent.runs_30d), agent.runs_30d ? `avg ${Math.round(agent.runs_30d / 30)} per day` : "no runs"),
      tile("Cost · 30 d", fmt.eur(cost), centsPerRun ? `${centsPerRun.toFixed(1)} cents per run at list price` : "no runs"),
      tile("Tokens · 30 d", agent.tokens_30d ? fmt.millions(agent.tokens_30d) : "0", perRun ? `${fmt.int(perRun)} per run on average` : "in + out"),
      tile("Same path", fmt.percent(agent.same_path_share), "threshold 80 %", agent.uniform_agent ? "text-danger" : agent.same_path_share != null ? "text-good" : ""),
      tile("Last run", agent.days_since_last_run === 0 ? "Today" : `${agent.days_since_last_run} d ago`, labels.provider[agent.provider]));
  }

  function renderDayChart(agent, periodEnd) {
    const days = agent.runs_by_day;
    const plotHeight = 180;
    const max = Math.max(...days, 1);
    const top = Math.ceil(max / 20) * 20; // multiple of 20 → round middle tick
    const share = agent.same_path_share || 0;
    document.getElementById("legend-main").className = `swatch ${agent.uniform_agent ? "fill-uniform" : "fill-healthy"}`;
    const end = new Date(`${periodEnd}T00:00:00`); // the last day of the observed period
    const label = (offset) => { const d = new Date(end); d.setDate(d.getDate() - offset); return d.toLocaleString("en-GB", { day: "numeric", month: "short" }); };

    document.getElementById("day-chart").replaceChildren(
      h("div", { class: "vchart" },
        h("div", { class: "vchart-axis num", style: { height: `${plotHeight}px` }, "aria-hidden": "true" }, h("span", null, top), h("span", null, top / 2), h("span", null, 0)),
        h("div", { class: "vchart-plot-wrap" },
          h("div", { class: "vchart-plot", style: { height: `${plotHeight}px` } },
            h("div", { class: "vchart-grid", style: { top: "0" } }),
            h("div", { class: "vchart-grid", style: { top: `${plotHeight / 2}px` } }),
            agent.runs_30d === 0 && h("p", { class: "caption", style: { position: "absolute", inset: "auto 0 45% 0", textAlign: "center" } }, `No runs in the last 30 days (last run ${agent.days_since_last_run} days ago)`),
            h("div", { class: "vchart-bars", style: { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gap: "4px" } },
              days.map((n, i) => {
                const main = Math.round(n * share);
                return h("div", { class: "vchart-col", role: "img", "aria-label": `${label(days.length - 1 - i)}: ${n} runs` },
                  h("span", { class: "fill-other", style: { height: `${((n - main) / top) * plotHeight}px`, borderRadius: "2px 2px 0 0" } }),
                  h("span", { class: agent.uniform_agent ? "fill-uniform" : "fill-healthy", style: { height: `${(main / top) * plotHeight}px` } }));
              }))),
          h("div", { class: "legend", style: { justifyContent: "space-between" } },
            h("span", null, label(29)), h("span", null, label(20)), h("span", null, label(10)), h("span", null, label(0))))));
  }

  /** After the owner's decision the box says what happened since: planned, or converted with what the log shows. */
  function renderConversion(agent, saved) {
    const { to, since, runs, done } = agent.conversion;
    const facts = [h("div", null, h("dt", null, "Ladder step"), h("dd", null, `${labels.ladder_number.agent} ${labels.ladder_step.agent} → ${labels.ladder_number[to]} ${labels.ladder_step[to]}`))];
    if (since) facts.push(h("div", null, h("dt", null, "Decided"), h("dd", null, fmt.time(since))));
    if (done) {
      facts.push(h("div", null, h("dt", null, "Runs since then, without a model call"), h("dd", { class: "accent num" }, fmt.int(runs))));
      facts.push(h("div", null, h("dt", null, "Saved, compared with agent runs"), h("dd", { class: "accent num" }, saved >= 10 ? fmt.eur(saved) : fmt.cents(saved))));
    }
    document.getElementById("suggestion").replaceChildren(h("div", { class: "suggestion-body" },
      h("span", { class: "overline" }, done ? "Confirmed by the run log" : "Your decision"),
      h("h2", { class: "suggestion-title" }, done ? `Converted to ${stepName(to)}` : "Change planned"),
      h("p", { class: "suggestion-text" }, done
        ? `The ${stepName(to)} runs in place of the agent. Its runs call no model, so they use no tokens.`
        : `rAIght counts this as converted with the first run that calls no model. Until then the agent keeps running.`),
      h("dl", { class: "suggestion-facts", style: { margin: 0 } }, facts),
      h("div", { "aria-label": `Ladder: was step ${labels.ladder_number.agent}, now step ${labels.ladder_number[to]}` },
        h("div", { class: "ladder-mini", "aria-hidden": "true" },
          STEPS.map((s, i) => h("span", { class: s === to ? "is-target" : s === "agent" ? "is-current" : null, style: { height: `${14 + i * 8}px` } }))),
        h("div", { class: "ladder-mini-labels", "aria-hidden": "true", style: { marginTop: "6px" } },
          STEPS.map((s) => h("span", { class: s === to ? "is-target" : s === "agent" ? "is-current" : null }, SHORT[s]))))));
  }

  /** The latest runs with their cost: here a run from a connected tool shows up seconds after it ended. */
  function renderRuns(runs) {
    const section = document.getElementById("latest-runs");
    section.hidden = !runs || !runs.length;
    if (section.hidden) return;
    document.getElementById("runs").replaceChildren(...runs.map((run) => h("div", { class: "path-row" },
      h("div", { style: { flex: "0 0 150px" } },
        h("strong", { class: "num" }, fmt.time(run.started_at)),
        h("p", { class: "caption" }, run.source === "generated" ? "simulated run log" : `live from ${labels.provider[run.source] || run.source}`)),
      h("div", { class: "path" }, run.steps.flatMap((s, j) => [h("code", null, s), j < run.steps.length - 1 && h("span", { class: "path-arrow", "aria-hidden": "true" }, "→")])),
      h("div", { class: "path-share" },
        h("span", { class: "caption num", style: { width: "150px", textAlign: "right" } }, run.model ? `${fmt.int(run.tokens)} tokens` : "no model call, 0 tokens"),
        h("span", { class: "share-value num", style: { width: "90px", textAlign: "right" } }, fmt.cents(run.cost_eur))))));
  }

  function renderSuggestion(agent) {
    const target = TARGET[agent.suggestion];
    const current = agent.ladder_step;
    const changes = target && target !== current;
    const facts = [];
    if (agent.uniform_agent) {
      facts.push(h("div", null, h("dt", null, "Runs on the most frequent path"), h("dd", { class: "accent num" }, fmt.percent(agent.same_path_share))));
      facts.push(h("div", null, h("dt", null, "Tokens of those runs · 30 d"), h("dd", { class: "accent num" }, `≈ ${fmt.millions(agent.tokens_30d * agent.same_path_share)}`)));
    }
    if (changes) facts.push(h("div", null, h("dt", null, "Ladder step"), h("dd", null, `${labels.ladder_number[current]} ${labels.ladder_step[current]} → ${labels.ladder_number[target]} ${labels.ladder_step[target]}`)));
    if (agent.status === "unused") facts.push(h("div", null, h("dt", null, "Last run"), h("dd", null, `${agent.days_since_last_run} days ago`)));

    document.getElementById("suggestion").replaceChildren(h("div", { class: "suggestion-body" },
      h("span", { class: "overline" }, "rAIght suggests"),
      h("h2", { class: "suggestion-title" }, agent.status === "retired" ? "Retired" : agent.suggestion),
      h("p", { class: "suggestion-text" }, agent.suggestion_text),
      facts.length > 0 && h("dl", { class: "suggestion-facts", style: { margin: 0 } }, facts),
      target && h("div", { "aria-label": `Ladder: now step ${labels.ladder_number[current]}, suggested step ${labels.ladder_number[target]}` },
        h("div", { class: "ladder-mini", "aria-hidden": "true" },
          STEPS.map((s, i) => h("span", { class: [s === target && "is-target", s === current && changes && "is-current"].filter(Boolean).join(" ") || null, style: { height: `${14 + i * 8}px` } }))),
        h("div", { class: "ladder-mini-labels", "aria-hidden": "true", style: { marginTop: "6px" } },
          STEPS.map((s) => h("span", { class: s === target ? "is-target" : s === current ? "is-current" : null }, SHORT[s]))))));
  }

  function renderPaths(agent) {
    const el = document.getElementById("paths");
    if (!agent.top_paths.length) {
      el.replaceChildren(h("p", { class: "caption", style: { padding: "16px 20px" } }, agent.is_new ? "No runs yet. Paths show up once the automation has run." : "No runs, so no paths to compare."));
      return;
    }
    el.replaceChildren(...agent.top_paths.map((p, i) => {
      const main = i === 0;
      return h("div", { class: "path-row" },
        h("div", { class: "path" }, p.steps.flatMap((s, j) => [h("code", null, s), j < p.steps.length - 1 && h("span", { class: "path-arrow", "aria-hidden": "true" }, "→")])),
        h("div", { class: "path-share" },
          h("div", { class: "bar-track" }, h("div", { class: `bar-fill ${main ? (agent.uniform_agent ? "fill-uniform" : "fill-healthy") : "fill-inactive"}`, style: { width: `${p.share * 100}%` } })),
          h("span", { class: `share-value ${main && agent.uniform_agent ? "text-danger" : ""}` }, fmt.percent(p.share)),
          h("span", { class: "caption num", style: { width: "76px", textAlign: "right" } }, `≈ ${fmt.int(Math.round(agent.runs_30d * p.share))} runs`)));
    }));
  }

  function renderReason(agent) {
    document.getElementById("reason").replaceChildren(
      h("h2", { class: "card-title" }, agent.agent_reason ? "Why it was built as an agent" : "About this automation"),
      agent.agent_reason && h("blockquote", { class: "reason-quote" }, `“${agent.agent_reason}”`),
      agent.agent_reason && h("p", { class: "caption" }, `Agent reason given by ${agent.owner} when building it`),
      agent.agent_reason && h("hr", { class: "divider" }),
      h("dl", { class: "facts" },
        h("dt", null, "Purpose"), h("dd", null, agent.purpose),
        h("dt", null, "Ladder step"), h("dd", null, `${labels.ladder_number[agent.ladder_step]} · ${labels.ladder_step[agent.ladder_step]}`),
        h("dt", null, "Built with"), h("dd", null, labels.provider[agent.provider]),
        h("dt", null, "Owner"), h("dd", null, agent.owner)));
  }

  async function render() {
    try {
      me = await data.getMe();
      const agent = await data.getAgent(id);
      if (!agent) {
        document.querySelector(".content").replaceChildren(h("p", { class: "load-error" }, `No agent with id “${id}”. `, h("a", { href: pageUrl("dashboard") }, "Back to the dashboard")));
        return;
      }
      const [impact, summary, runs] = await Promise.all([data.getImpact(), data.getSummary(), data.getRuns(agent.id)]);
      const money = impact.agents.find((row) => row.id === agent.id); // a new automation has no runs and no cost yet
      renderHeader(agent, render);
      renderKpis(agent, money?.cost_30d_eur || 0);
      renderDayChart(agent, summary.period_end);
      if (agent.conversion && agent.status !== "retired") renderConversion(agent, money?.saved_since_conversion_eur || 0);
      else renderSuggestion(agent);
      renderPaths(agent);
      renderRuns(runs);
      renderReason(agent);
    } catch (err) { showError(err); }
  }
  render();
  data.onChange(render); // a new run or a decision shows up without a reload
})();
