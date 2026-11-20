// P3 Plan an automation – describe it, answer the triage one question at a time, decide the ladder step.
// Triage texts come from app/data/content/triage.json; saving only changes client-side state (ADR 0006).

(function () {
  const { data, labels, h, pageUrl, showError, flowDiagram } = window.rAIght;
  const NAMES = ["Describe", "Triage", "Decide"];
  let triage = null;
  let ladder = null; // data/content/ladder.json: step names, costs and the examples from different teams
  const state = { step: 1, form: { name: "", provider: "copilot_studio", purpose: "" }, qId: null, trail: [], result: null, ladderStep: null, reason: "", saved: null };

  const stepLabel = (id) => `${labels.ladder_number[id]} · ${labels.ladder_step[id]}`;
  const question = (id) => triage.questions.find((q) => q.id === id);

  // Progress as three rising steps, the same shape as the logo: the step you are on is solid, finished ones are ticked.
  function renderStepper() {
    document.getElementById("stepper").replaceChildren(...NAMES.map((name, i) => {
      const n = i + 1;
      const done = state.saved || n < state.step;
      const cls = done ? "is-done" : n === state.step ? "is-current" : null;
      return h("li", { class: cls, "aria-current": n === state.step && !state.saved ? "step" : null },
        h("span", { class: "stair-n" }, done ? "✓" : n), h("span", { class: "stair-name" }, name));
    }));
  }

  // ---------- Step 1: describe ----------
  function viewDescribe() {
    const next = h("button", { class: "btn btn-primary", type: "button", onclick: () => start() }, "Continue to triage ›");
    const sync = () => { next.disabled = !(state.form.name.trim() && state.form.purpose.trim()); };
    const field = (id, label, control, hint) => h("div", { class: "field" }, h("label", { for: id }, label), control, hint && h("span", { class: "hint" }, hint));
    const view = h("div", { class: "card-body" },
      h("div", null, h("h2", null, "What do you want to automate?"), h("p", { class: "lead" }, "Two details, then three questions tell you which step fits.")),
      h("div", { class: "examples" },
        h("span", { class: "examples-label" }, "Start from an example"),
        h("div", { class: "options" }, ladder.steps.filter((x) => x.example).map((x) => h("button", {
          class: "option", type: "button", title: x.example.situation,
          onclick: () => { state.form.name = x.example.title; state.form.purpose = x.example.situation; render(); },
        }, x.example.title)))),
      field("f-name", "Name", h("input", { id: "f-name", type: "text", value: state.form.name, placeholder: "Name your automation", oninput: (e) => { state.form.name = e.target.value; sync(); } })),
      field("f-provider", "Where will you build it?",
        h("select", { id: "f-provider", onchange: (e) => { state.form.provider = e.target.value; } },
          Object.entries(labels.provider).map(([value, text]) => h("option", { value, selected: value === state.form.provider }, text)))),
      field("f-purpose", "What should it do?",
        h("textarea", { id: "f-purpose", placeholder: "Describe what it should do", oninput: (e) => { state.form.purpose = e.target.value; sync(); } }, state.form.purpose),
        "One or two sentences are enough."),
      h("div", { class: "actions" }, h("span"), h("div", { class: "right" }, next)));
    sync();
    return view;
  }

  // ---------- Step 2: triage ----------
  function start() { state.step = 2; state.qId = triage.questions[0].id; state.trail = []; state.result = null; render(); }

  function answer(q, yes) {
    const branch = yes ? q.yes : q.no;
    state.trail.push({ q, yes });
    if (branch.next) { state.qId = branch.next; }
    else { state.result = branch; state.ladderStep = branch.ladder_steps[0]; state.reason = ""; state.step = 3; }
    render();
  }

  function back() {
    if (state.step === 3) { state.step = 2; const last = state.trail.pop(); state.qId = last.q.id; state.result = null; }
    else if (state.trail.length) { state.qId = state.trail.pop().q.id; }
    else { state.step = 1; }
    render();
  }

  function viewQuestion() {
    const q = question(state.qId);
    return h("div", { class: "card-body" },
      h("div", null,
        h("span", { class: "progress" }, `Question ${q.number} of ${triage.questions.length}`),
        h("h2", { class: "question-big" }, q.text),
        h("p", { class: "lead" }, q.hint)),
      h("div", { class: "answers" },
        h("button", { class: "answer", type: "button", onclick: () => answer(q, true) }, "Yes"),
        h("button", { class: "answer", type: "button", onclick: () => answer(q, false) }, "No")),
      state.trail.length > 0 && h("ul", { class: "trail" }, state.trail.map((t) => h("li", null, `${t.q.text} `, h("b", null, t.yes ? "Yes" : "No")))),
      h("div", { class: "actions" }, h("button", { class: "btn btn-outline", type: "button", onclick: back }, "‹ Back")));
  }

  // ---------- Step 3: decide ----------
  function viewDecision() {
    const r = state.result;
    const save = h("button", { class: "btn btn-primary", type: "button", onclick: saveAutomation }, "Save automation");
    const sync = () => { save.disabled = r.is_agent && state.reason.trim().length < 5; };
    const view = h("div", { class: "card-body" },
      h("div", { class: `result ${r.is_agent ? "is-agent" : ""}` }, h("span", { class: "progress", style: { color: "inherit" } }, "Triage result"), h("strong", null, r.outcome)),
      r.ladder_steps.length > 1 && h("div", { class: "field" },
        h("span", { style: { fontSize: "13px", fontWeight: 600 } }, "Pick the step you will build"),
        h("div", { class: "options" }, r.ladder_steps.map((id) => h("button", {
          class: "option", type: "button", "aria-pressed": String(id === state.ladderStep),
          onclick: () => { state.ladderStep = id; render(); },
        }, stepLabel(id))))),
      flowDiagram(state.ladderStep),
      r.is_agent
        ? h("div", { class: "field" },
            h("label", { for: "f-reason" }, "Why does this need an agent?"),
            h("textarea", { id: "f-reason", placeholder: "One line on why a simpler step does not do the job", oninput: (e) => { state.reason = e.target.value; sync(); } }, state.reason),
            h("span", { class: "hint" }, "You will see this reason next to the agent later, when its usage is reviewed."))
        : h("p", { class: "lead" }, "No agent needed. A lower step does the job and uses fewer tokens, so you do not have to give a reason."),
      h("dl", { class: "summary" },
        h("dt", null, "Name"), h("dd", null, state.form.name),
        h("dt", null, "Built with"), h("dd", null, labels.provider[state.form.provider]),
        h("dt", null, "Ladder step"), h("dd", null, stepLabel(state.ladderStep))),
      h("div", { class: "actions" }, h("button", { class: "btn btn-outline", type: "button", onclick: back }, "‹ Back"), h("div", { class: "right" }, save)));
    sync();
    return view;
  }

  function saveAutomation() {
    state.saved = data.addAgent({ ...state.form, name: state.form.name.trim(), purpose: state.form.purpose.trim(), ladder_step: state.ladderStep, agent_reason: state.result.is_agent ? state.reason.trim() : "" });
    render();
  }

  function viewSaved() {
    const a = state.saved;
    return h("div", { class: "card-body" },
      h("div", { class: "result" }, h("span", { class: "progress", style: { color: "inherit" } }, "Saved"), h("strong", null, `${a.name} is now in your automations`)),
      h("dl", { class: "summary" },
        h("dt", null, "Built with"), h("dd", null, labels.provider[a.provider]),
        h("dt", null, "Ladder step"), h("dd", null, stepLabel(a.ladder_step)),
        a.agent_reason && [h("dt", null, "Agent reason"), h("dd", null, a.agent_reason)]),
      h("p", { class: "lead" }, "rAIght starts measuring tokens and repeated paths as soon as it has run logs for this automation."),
      h("div", { class: "actions" },
        h("button", { class: "btn btn-outline", type: "button", onclick: reset }, "Add another"),
        h("div", { class: "right" }, h("a", { class: "btn btn-primary", href: pageUrl("inventory") }, "View in Automations ›"))));
  }

  function reset() {
    Object.assign(state, { step: 1, form: { name: "", provider: "copilot_studio", purpose: "" }, qId: null, trail: [], result: null, ladderStep: null, reason: "", saved: null });
    render();
  }

  // The ladder stays visible next to the wizard; at the last step it marks the steps the triage ended on.
  function renderSide() {
    const marked = state.step === 3 && state.result ? state.result.ladder_steps : [];
    const hint = state.saved ? "Saved. You can plan another one."
      : state.step === 3 ? "The marked steps fit your answers. Pick the lowest one that does the job."
      : state.step === 2 ? `Question ${question(state.qId).number} of ${triage.questions.length}. Your answers narrow the six steps down.`
      : "Six ways to automate a task. Three questions will tell you which one fits.";
    document.getElementById("side").replaceChildren(h("div", { class: "card plan-ladder" },
      h("h2", { class: "card-title" }, "Six ways to automate"),
      h("p", { class: "caption" }, hint),
      h("ol", { class: "mini-ladder" }, ladder.steps.map((x) => h("li", { class: marked.includes(x.id) ? "is-marked" : null, "aria-current": state.step === 3 && x.id === state.ladderStep ? "true" : null },
        h("span", { class: "mini-no" }, x.number),
        h("span", { class: "mini-name" }, x.name),
        h("span", { class: "cost", role: "img", "aria-label": `Relative compute ${x.relative_cost} of 6` }, [1, 2, 3, 4, 5, 6].map((i) => h("i", { class: i <= x.relative_cost ? "on" : null })))))),
      h("a", { class: "btn btn-sm btn-secondary", href: pageUrl("learn") }, "Compare the steps in the guidelines ›")));
  }

  function render() {
    renderStepper();
    const view = state.saved ? viewSaved() : state.step === 1 ? viewDescribe() : state.step === 2 ? viewQuestion() : viewDecision();
    document.getElementById("wizard").replaceChildren(view);
    renderSide();
  }

  async function init() {
    try {
      [triage, ladder] = await Promise.all([data.getContent("triage"), data.getContent("ladder")]);
      // From the dashboard assistant: the task is already described, so go straight to the three questions.
      const from = new URLSearchParams(location.search);
      if (from.get("from") === "assistant" && from.get("purpose")) {
        state.form.name = from.get("name") || "New automation";
        state.form.purpose = from.get("purpose");
        start();
        return;
      }
      render();
    } catch (err) { showError(err); }
  }
  init();
})();
