// Access (Admin) – who can use rAIght and with which role. People and roles are client-side state (ADR 0006).

(function () {
  const { data, labels, h, showError, pageUrl } = window.rAIght;
  const ROLE_IDS = Object.keys(labels.role);
  const accessForm = { email: "", name: "", role: "process_owner", error: "" };
  let toastTimer;
  const $ = (id) => document.getElementById(id);

  function toast(text) {
    const el = $("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  async function renderAccess() {
    const users = await data.getUsers();
    $("access-sub").textContent = `${users.length} people · roles: ${ROLE_IDS.map((r) => labels.role[r]).join(", ")}`;
    const me = await data.getMe();
    if (!me.can("access")) { notice(me); return; }
    const roleSelect = (value, attrs) => h("select", { class: "role-select", ...attrs },
      ROLE_IDS.map((r) => h("option", { value: r, selected: r === value }, labels.role[r])));

    const rows = users.map((u) => h("tr", null,
      h("td", null,
        h("div", { class: "user-name" }, u.name, u.you && h("span", { class: "you" }, "you")),
        h("div", { class: "user-mail" }, u.email)),
      h("td", null, roleSelect(u.role, {
        "aria-label": `Role for ${u.name}`, disabled: u.you ? "" : null, title: u.you ? "You cannot change your own role" : null,
        onchange: async (e) => { await data.setUserRole(u.email, e.target.value); toast(`${u.name} is now ${labels.role[e.target.value]}.`); renderAccess(); },
      })),
      h("td", { class: "r" }, !u.you && h("button", {
        class: "btn btn-sm btn-danger", type: "button", "aria-label": `Remove ${u.name}`,
        onclick: async () => { await data.removeUser(u.email); toast(`${u.name} no longer has access.`); renderAccess(); },
      }, "Remove"))));

    const field = (id, label, control) => h("div", { class: "field" }, h("label", { for: id }, label), control);
    const add = async () => {
      const email = accessForm.email.trim().toLowerCase(), name = accessForm.name.trim();
      if (!name) accessForm.error = "Enter a name.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) accessForm.error = "Enter a valid e-mail address.";
      else if (users.some((u) => u.email.toLowerCase() === email)) accessForm.error = "This e-mail already has access.";
      else {
        await data.addUser({ email, name, role: accessForm.role });
        toast(`${name} was added as ${labels.role[accessForm.role]}.`);
        Object.assign(accessForm, { email: "", name: "", error: "" });
      }
      renderAccess();
    };

    $("access-body").replaceChildren(
      h("ul", { class: "role-legend" }, ROLE_IDS.map((r) => h("li", null, h("b", null, labels.role[r]), h("span", null, labels.role_note[r])))),
      h("div", { class: "tw" }, h("table", null,
        h("thead", null, h("tr", null, h("th", { scope: "col" }, "Person"), h("th", { scope: "col" }, "Role"), h("th", { scope: "col" }, h("span", { class: "visually-hidden" }, "Remove")))),
        h("tbody", null, rows))),
      h("div", { class: "access-form" },
        field("a-name", "Name", h("input", { id: "a-name", type: "text", value: accessForm.name, oninput: (e) => { accessForm.name = e.target.value; } })),
        field("a-email", "E-mail", h("input", { id: "a-email", type: "email", value: accessForm.email, oninput: (e) => { accessForm.email = e.target.value; }, onkeydown: (e) => { if (e.key === "Enter") add(); } })),
        field("a-role", "Role", roleSelect(accessForm.role, { id: "a-role", onchange: (e) => { accessForm.role = e.target.value; } })),
        h("button", { class: "btn btn-primary", type: "button", onclick: add }, "Add person")),
      accessForm.error && h("p", { class: "form-error", role: "alert" }, accessForm.error),
      h("p", { class: "access-note" }, "Demo: people and roles are kept for this tab only. Switch the person in the top right to see what each role can do. The data is the same for every role. In a customer setup people and roles follow the company's identity provider."));
  }


  function notice(me) {
    document.getElementById("content").replaceChildren(h("section", { class: "card role-notice" },
      h("h2", null, "Access is managed by an Admin"),
      h("p", null, `You are viewing the demo as ${me.name} (${labels.role[me.role]}). Switch to the Admin in the top right to change who has access.`),
      h("a", { class: "btn btn-primary", href: pageUrl("dashboard") }, "Back to the dashboard ›")));
  }

  renderAccess().catch(showError);
})();
