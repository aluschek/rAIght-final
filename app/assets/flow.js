// rAIght.flowDiagram(stepId) – a read-only sketch of what an automation on a ladder step looks like.
// rAIght does not build automations: they are built in the provider (n8n, Copilot Studio, ...).
// Used by Plan an automation and Guidelines. Load after shell.js.

(function () {
  const { h, labels } = window.rAIght;

  // Node kinds: trigger, step, ai (costs tokens), human, done. A group repeats; a branch runs side by side.
  const FLOWS = {
    rule: {
      tokens: "None",
      note: "One fixed check. No AI is involved, so a run costs no tokens.",
      nodes: [["trigger", "Something happens"], ["step", "Condition true?"], ["done", "Do one thing"]],
    },
    workflow: {
      tokens: "None",
      note: "Fixed steps in the same order every time. No AI, so a run costs no tokens.",
      nodes: [["trigger", "Something happens"], ["step", "Step 1"], ["step", "Step 2"], ["step", "Step 3"], ["done", "Done"]],
    },
    classic_ml: {
      tokens: "Very few",
      note: "A trained model predicts or sorts, then a fixed step follows. Little compute per run.",
      nodes: [["trigger", "Something happens"], ["step", "Prepare the data"], ["ai", "Model predicts"], ["done", "Act on the result"]],
    },
    genai_call: {
      tokens: "One call per run",
      note: "One question to an AI that reads or writes text. The steps around it stay fixed.",
      nodes: [["trigger", "Something happens"], ["step", "Build the prompt"], ["ai", "One AI call"], ["done", "Use the answer"]],
    },
    agent: {
      tokens: "Many calls per run",
      note: "The AI plans its own steps, uses tools and may retry. The path can differ from run to run, and this costs the most tokens of the single-agent options.",
      nodes: [["trigger", "Something happens"], { group: "Agent loop", repeat: true, nodes: [["ai", "Plan"], ["ai", "Use a tool"], ["ai", "Check the result"]] }, ["done", "Done"], ["human", "Unsure? Hand to a person"]],
    },
    multi_agent: {
      tokens: "Many calls, several agents",
      note: "Several agents hand work to each other. The most expensive and the hardest to follow.",
      nodes: [["trigger", "Something happens"], ["ai", "Manager agent"], { branch: [["ai", "Agent A"], ["ai", "Agent B"], ["ai", "Agent C"]] }, ["done", "Combine and finish"]],
    },
  };

  function flowDiagram(stepId, { bare = false } = {}) {
    const flow = FLOWS[stepId];
    if (!flow) return null;
    const node = ([kind, label]) => h("span", { class: `fnode fnode-${kind}` }, kind === "ai" && h("i", { class: "fnode-tag" }, "tokens"), label);
    const arrow = () => h("span", { class: "farrow", "aria-hidden": "true" }, "→");
    const labelOf = (n) => (Array.isArray(n) ? n[1] : n.group ? `${n.group} (${n.nodes.map((x) => x[1]).join(", ")})` : `in parallel: ${n.branch.map((x) => x[1]).join(", ")}`);
    const chain = flow.nodes.filter((n) => !(Array.isArray(n) && n[0] === "human"));
    const exits = flow.nodes.filter((n) => Array.isArray(n) && n[0] === "human");
    const items = chain.flatMap((n, i) => {
      let el;
      if (Array.isArray(n)) el = node(n);
      else if (n.group) el = h("span", { class: "fgroup" }, h("span", { class: "fgroup-label" }, `${n.group}${n.repeat ? " · may repeat" : ""}`), h("span", { class: "fgroup-nodes" }, n.nodes.flatMap((m, j) => (j ? [arrow(), node(m)] : [node(m)]))));
      else el = h("span", { class: "fbranch" }, n.branch.map(node));
      return i ? [arrow(), el] : [el];
    });
    return h("div", { class: `flow${bare ? " flow-bare" : ""}` },
      !bare && h("div", { class: "flow-head" },
        h("span", { class: "flow-title" }, `The ${labels.ladder_step[stepId]} at a glance`),
        h("span", { class: "flow-cost" }, `Tokens: ${flow.tokens}`)),
      h("div", { class: "flow-row", role: "img", "aria-label": `${chain.map(labelOf).join(", then ")}${exits.length ? `. Side exit: ${exits.map(labelOf).join(", ")}` : ""}` }, items),
      exits.length > 0 && h("div", { class: "flow-exit" }, h("span", { class: "farrow", "aria-hidden": "true" }, "↳"), exits.map(node)),
      !bare && h("p", { class: "flow-note" }, flow.note));
  }

  window.rAIght.flowDiagram = flowDiagram;
})();
