// About – scope, goals and version history of the product. Texts from app/data/content/about.json (ADR 0006).

(function () {
  const { data, h, showError, logoMark } = window.rAIght;
  const icon = (name) => window.rAIght.sapIcon(name, 18);
  const bullets = (items) => h("ul", null, items.map((t) => h("li", null, t)));

  async function init() {
    try {
      const about = await data.getContent("about");
      document.getElementById("hero").replaceChildren(
        h("span", { class: "about-mark", "aria-hidden": "true" }, logoMark()),
        h("div", { class: "text" },
          h("h2", null, "r", h("span", { class: "logo-ai" }, "AI"), "ght"),
          h("p", { class: "tagline" }, about.tagline),
          h("p", null, about.description)),
        h("span", { class: "badge-version" }, `${about.version} · Latest`));
      document.getElementById("scope").replaceChildren(h("h2", null, icon("scope"), "Scope"), bullets(about.scope));
      document.getElementById("goals").replaceChildren(h("h2", null, icon("goal"), "Goal"), bullets(about.goals));
      document.getElementById("versions").replaceChildren(
        h("h2", null, icon("history"), "Version history"),
        ...about.versions.map((v) => h("div", { class: "version" },
          h("span", { class: "tag" }, v.version),
          h("div", null, h("div", { class: "date" }, v.date), bullets(v.changes)))));
      $("settings-title").replaceChildren(icon("settings"), "Settings");
      renderReset();
    } catch (err) { showError(err); }
  }

  // ---------- Settings: each section is a row that opens into its configuration ----------
  const $ = (id) => document.getElementById(id);

  function renderReset() {
    const note = h("span", { class: "reset-note", role: "status" });
    $("reset").replaceChildren(
      h("p", { class: "access-note", style: { margin: 0 } }, "Retired agents, saved automations, handled escalations and access changes are kept while this tab is open. Reset them to start the demo from the beginning."),
      h("div", { class: "reset-actions" },
        h("button", { class: "btn btn-outline", type: "button", onclick: () => { data.resetDemo(); note.textContent = "Reset. The demo starts from the beginning."; setTimeout(() => location.reload(), 700); } }, "Reset demo data"),
        note));
  }
  init();
})();
