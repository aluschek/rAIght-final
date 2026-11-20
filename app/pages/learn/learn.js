// P2 Guidelines – automation ladder with step details, and the triage cheat sheet.
// Texts come from app/data/content/ladder.json and triage.json (ADR 0006).

(function () {
  const { data, h, showError, pageUrl, flowDiagram } = window.rAIght;
  let ladder = null;
  let selected = null;
  let guide = null; // plain-language texts (data/content/guide.json)
  const plain = (id) => (guide && guide.steps[id]) || {};

  const badge = (step, extra = "") => h("span", { class: `step-badge ${step.number <= 2 ? "step-badge-low" : ""} ${extra}`, "aria-hidden": "true" }, step.number);
  const stepLabel = (id) => {
    const s = ladder.steps.find((x) => x.id === id);
    return s ? `${s.number} ${s.name}` : id;
  };

  function renderLadder() {
    document.getElementById("ladder").replaceChildren(...ladder.steps.map((step) => h("li", null,
      h("button", {
        class: "ladder-step", type: "button", "aria-pressed": String(step.id === selected),
        onclick: () => { selected = step.id; renderLadder(); renderDetail(); },
      },
        badge(step),
        h("span", { class: "ladder-text" }, h("span", { class: "ladder-name" }, step.name), h("span", { class: "ladder-what" }, plain(step.id).plain || step.what)),
        h("span", { class: "cost", role: "img", "aria-label": `Relative compute ${step.relative_cost} of 6` },
          [1, 2, 3, 4, 5, 6].map((i) => h("i", { class: i <= step.relative_cost ? "on" : null })))))));
  }

  function renderDetail() {
    const step = ladder.steps.find((s) => s.id === selected);
    const tag = step.number <= 2 ? ["chip-good", "Preferred"] : step.number >= 5 ? ["chip-danger", "Needs an agent reason"] : ["chip-neutral", "When needed"];
    const ex = step.example;
    document.getElementById("step-detail").replaceChildren(
      h("div", { class: "step-head" }, badge(step, "step-badge-lg"), h("h3", null, step.name), h("span", { class: `chip ${tag[0]}` }, tag[1])),
      h("dl", { class: "step-facts" },
        h("dt", null, "What it is"), h("dd", null, step.what),
        h("dt", null, "Use it when"), h("dd", null, step.use_when)),
      flowDiagram(step.id),
      ex && h("div", { class: "example" },
        h("span", { class: "overline" }, `Example · ${ex.title}`),
        h("p", null, h("strong", null, "How. "), ex.how),
        h("p", { class: "muted" }, h("strong", { style: { color: "var(--color-text)" } }, "Why this step. "), ex.why_this_step)));
  }

  function outcomeBox(result) {
    return h("div", { class: `outcome ${result.is_agent ? "outcome-agent" : ""}` },
      h("span", { class: "outcome-title" }, result.outcome),
      h("span", { class: "outcome-steps" }, result.ladder_steps.map(stepLabel).join(" · ")));
  }

  function renderTriage(triage) {
    document.getElementById("triage-intro").textContent = triage.intro;
    document.getElementById("triage-footer").textContent = triage.footer;
    document.getElementById("triage").replaceChildren(...triage.questions.map((q) => h("div", { class: "triage-col" },
      h("div", { class: "question" },
        h("div", { class: "question-head" }, h("span", { class: "marker", "aria-hidden": "true" }, q.number), h("span", { class: "question-text" }, q.text)),
        h("span", { class: "caption" }, q.hint)),
      h("span", { class: "answer-label" }, "Yes →"),
      outcomeBox(q.yes),
      q.no.next
        ? h("span", { class: "next" }, `No → question ${triage.questions.find((x) => x.id === q.no.next).number}`)
        : [h("span", { class: "answer-label" }, "No →"), outcomeBox(q.no)])));
  }

  // ---------- Plain-language sections ----------
  function renderIntro(me) {
    document.getElementById("hero").replaceChildren(
      h("h2", null, guide.headline),
      h("p", null, guide.intro));
    document.getElementById("how-title").textContent = guide.how_title;
    document.getElementById("how").replaceChildren(...guide.how.map((s, i) => h("li", { class: "card how-step" },
      h("span", { class: "how-no", "aria-hidden": "true" }, i + 1),
      h("h3", null, s.title),
      h("p", null, s.text),
      (!s.needs || me.can(s.needs)) && h("a", { class: "btn btn-sm btn-secondary", href: pageUrl(s.page) }, `${s.cta} ›`))));
    document.getElementById("ladder-title").textContent = guide.ladder_title;
    document.getElementById("ladder-intro").textContent = guide.ladder_intro;
    document.getElementById("terms-title").textContent = guide.terms_title;
    document.getElementById("terms").replaceChildren(...guide.terms.map((t) => h("div", { class: "term" },
      h("dt", null, t.term),
      h("dd", null, t.meaning))));
    if (!me.can("plan")) document.getElementById("try-btn").remove();
  }

  async function init() {
    try {
      const [ladderData, triage, guideData, me] = await Promise.all([data.getContent("ladder"), data.getContent("triage"), data.getContent("guide"), data.getMe()]);
      ladder = ladderData;
      guide = guideData;
      selected = ladder.steps[0].id;
      document.getElementById("ladder-note").textContent = ladder.note || "";
      renderIntro(me);
      renderLadder();
      renderDetail();
      renderTriage(triage);
    } catch (err) { showError(err); }
  }
  init();
})();
