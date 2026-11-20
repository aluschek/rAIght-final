// Providers (Admin) – the platforms rAIght reads run logs from. Connect or disconnect is client-side state (ADR 0006).

(function () {
  const { data, fmt, h, showError, pageUrl } = window.rAIght;
  const CODE = { copilot_studio: "CS", power_automate: "PA", openai: "AI", n8n: "n8" };
  let toastTimer;

  function toast(text) {
    const el = document.getElementById("toast");
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
  }

  function notice(me) {
    document.getElementById("content").replaceChildren(h("section", { class: "card role-notice" },
      h("h2", null, "Providers are managed by an Admin"),
      h("p", null, `You are viewing the demo as ${me.name} (${window.rAIght.labels.role[me.role]}). Switch to the Admin in the top right to connect or disconnect providers.`),
      h("a", { class: "btn btn-primary", href: pageUrl("dashboard") }, "Back to the dashboard ›")));
  }

  async function render() {
    try {
      const [me, summary, providers, agents] = await Promise.all([data.getMe(), data.getSummary(), data.getProviders(), data.getAgents()]);
      if (!me.can("providers")) { notice(me); return; }
      const live = agents.filter((a) => a.status !== "retired");
      const on = providers.filter((p) => p.connected).length;
      document.getElementById("providers-sub").textContent = `${on} of ${providers.length} connected`;
      document.getElementById("rows").replaceChildren(...providers.map((p) => h("tr", { class: p.connected ? null : "is-off" },
        h("td", null, h("div", { class: "cell-provider" }, h("span", { class: "code" }, CODE[p.id] || "?"), h("strong", null, p.name))),
        h("td", null, h("span", { class: `state ${p.connected ? "on" : "off"}` }, p.connected ? "Connected" : "Disconnected")),
        h("td", null, p.connected ? fmt.dateTime(summary.last_import) : h("span", { class: "muted" }, "Paused")),
        h("td", { class: "right num" }, live.filter((a) => a.provider === p.id).length),
        h("td", { class: "right" }, h("button", {
          class: `btn btn-sm ${p.connected ? "btn-danger" : "btn-primary"}`, type: "button",
          onclick: () => { data.setProviderConnected(p.id, !p.connected); toast(`${p.name} ${p.connected ? "disconnected" : "connected"}.`); render(); },
        }, p.connected ? "Disconnect" : "Connect")))));
    } catch (err) { showError(err); }
  }
  render();
})();
