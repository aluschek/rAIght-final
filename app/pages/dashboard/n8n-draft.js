// rAIght.n8nDraft(stepId, { name, task }) – builds a skeleton workflow that n8n can import (Workflows > Import from file).
// Demo only: nothing is sent to n8n. Every step is a placeholder node the process owner configures in n8n,
// and the workflow is exported as inactive. Only core nodes are used, so the file imports without extra packages.

(function () {
  const { labels } = window.rAIght;

  // Placeholder steps per ladder step. Agents are not drafted: they need a reason and a person's decision.
  const STEPS = {
    rule: ["Check the condition (configure)", "Do one thing (configure)"],
    workflow: ["Step 1 (configure)", "Step 2 (configure)", "Step 3 (configure)"],
    classic_ml: ["Prepare the data (configure)", "Call your model (configure)", "Act on the result (configure)"],
    genai_call: ["Build the prompt (configure)", "One AI call (configure)", "Use the answer (configure)"],
  };
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "automation";

  function n8nDraft(stepId, { name, task }) {
    const steps = STEPS[stepId];
    if (!steps) return null;
    const title = `Draft: ${name}`;
    const trigger = { id: uid(), name: "When you start it", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [0, 300], parameters: {} };
    const nodes = [trigger, ...steps.map((label, i) => ({ id: uid(), name: label, type: "n8n-nodes-base.noOp", typeVersion: 1, position: [240 * (i + 1), 300], parameters: {} }))];
    const note = {
      id: uid(), name: "About this draft", type: "n8n-nodes-base.stickyNote", typeVersion: 1, position: [0, 80],
      parameters: {
        height: 150, width: 560,
        content: `**Draft created by rAIght (demo)**\n\nLadder step: ${labels.ladder_number[stepId]} ${labels.ladder_step[stepId]}\nTask: ${task}\n\nEvery step is a placeholder. Configure it in n8n before you switch this workflow on.`,
      },
    };
    const connections = {};
    nodes.slice(0, -1).forEach((n, i) => { connections[n.name] = { main: [[{ node: nodes[i + 1].name, type: "main", index: 0 }]] }; });
    return {
      filename: `raight-draft-${slug(name)}.json`,
      json: { name: title, nodes: [...nodes, note], connections, active: false, settings: { executionOrder: "v1" } },
    };
  }

  window.rAIght.n8nDraft = n8nDraft;
})();
