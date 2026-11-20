// Dashboard assistant – a floating question-and-answer helper.
// It calls no model: answers are put together from app/data/ with simple keyword rules (ADR 0002, ADR 0006),
// so it can only say what the page already shows. It can also work out which ladder step a task fits,
// following the same three questions as Plan an automation, and draft an n8n workflow file. Nothing is sent to n8n.
// The MCP servers panel shows how a customer would plug in company systems. It is a simulation: the switches
// change which prepared answers are available, nothing is really connected (the production version does not build this).

(function () {
  const { data, fmt, labels, h, pageUrl, flowDiagram, confirmButton, n8nDraft } = window.rAIght;
  const SUGGESTIONS = ["I want to automate a task", "Which agents repeat themselves?", "What uses the most tokens?", "Is any agent unused?", "How many cases are waiting?", "What can you connect to?"];
  const agentUrl = (a) => `${pageUrl("agent")}?id=${encodeURIComponent(a.id)}`;
  const messages = [{ me: false, text: "Hi Lena. I can answer questions about your agents, their token use and the cases waiting for you. Tell me about a task you want to automate and I will suggest the simplest step that does the job.", links: [] }];
  let panel, fab, list, chips, input, connPanel, connBtn;

  // ---------- MCP servers (simulated) ----------
  // Three example servers plus any the user "connects". The on and off choice lasts for this tab only.
  const SERVERS = [
    { id: "jira", name: "Jira MCP server", note: "Tickets and sprints, read-only" },
    { id: "kb", name: "Internal Knowledge Hub", note: "Company policies and process descriptions" },
    { id: "n8n", name: "n8n", note: "Workflows and their run history" },
  ];
  // Ready-made abilities the assistant already has; switching one off really removes it.
  const SKILLS = [
    { id: "triage", name: "Ladder triage", note: "Suggests the lowest step that does the job" },
    { id: "draft", name: "n8n draft", note: "Creates a workflow file you can import" },
    { id: "tokens", name: "Token report", note: "Biggest token users, from the run logs" },
  ];
  const stored = (key, fallback) => { try { return JSON.parse(sessionStorage.getItem(`raight.assistant.${key}`)) ?? fallback; } catch { return fallback; } };
  const keep = (key, value) => { try { sessionStorage.setItem(`raight.assistant.${key}`, JSON.stringify(value)); } catch { /* storage blocked: lasts for this page only */ } };
  let off = new Set(stored("off", []));
  let custom = stored("custom", []);                 // [{ id, name, note }] added through "Connect another MCP server"
  let adding = false;                                // the address form is open
  let addError = "";
  const allServers = () => [...SERVERS, ...custom];
  const isOn = (id) => !off.has(id);
  const itemById = (id) => [...allServers(), ...SKILLS].find((s) => s.id === id);
  const isSkill = (id) => SKILLS.some((s) => s.id === id);
  function setServer(id, on) { if (on) off.delete(id); else off.add(id); keep("off", [...off]); drawConnections(); }
  function addServer(address) {
    let url;
    try { url = new URL(/^https?:\/\//i.test(address.trim()) ? address.trim() : `https://${address.trim()}`); if (!url.hostname.includes(".")) throw new Error("no host"); } catch { addError = "Enter a server address, for example https://mcp.example.com"; drawConnections(); return; }
    custom = [...custom, { id: `custom-${custom.length + 1}`, name: url.hostname, note: "Added by you · simulated, answers nothing in the demo" }];
    keep("custom", custom); adding = false; addError = ""; drawConnections();
  }
  /** Which MCP server a typed question needs (none for the built-in questions about agents, tokens and cases). */
  function needFor(q) {
    if (/\bautomate\b|\b(plan|build|create|set up) (an? )?(new )?(automation|workflow)\b|\bwhich (ladder )?step\b/.test(q) && !/how many|count|number of/.test(q)) return "triage";
    if (/\bjira\b|ticket|sprint|backlog|issue tracker/.test(q)) return "jira";
    if (/policy|policies|handbook|knowledge|process description|guideline/.test(q)) return "kb";
    if (/\bn8n\b/.test(q)) return "n8n";
    if (/token|usage|cost|expens|biggest|co2|carbon|emission/.test(q)) return "tokens";
    return null;
  }

  // ---------- Which ladder step does a task fit? ----------
  // The same three questions as Plan an automation (data/content/triage.json). Keywords in the description answer
  // what they can; the rest is asked with Yes and No buttons.
  let planning = null;      // { text, triage, answers, source, asking }
  let awaitingTask = false; // the next message is the task description

  const has = (q, words) => words.filter((w) => q.includes(w));
  const CUES = {
    fixed: ["every time", "always", "same steps", "whenever", "each time", "when a ", "when an ", "notify", "remind", "approve", "approval", "check that", "validate", "forward", "sync", "on a schedule", "daily", "weekly", "status update"],
    varies: ["depends", "different", "varies", "unknown", "unpredictable", "figure out", "decide which", "investigate", "negotiate", "case by case", "exceptions", "several systems", "multiple teams"],
    text: ["email", "e-mail", "message", "reply", "respond", "draft", "write", "summar", "letter", "comment", "complaint", "translate", "free text", "chat", "transcript", "document"],
    plan: ["investigate", "figure out", "coordinate", "across tools", "across systems", "unknown cases", "depends on what", "replan", "re-plan", "several systems", "negotiate", "diagnose", "root cause"],
  };

  function infer(text) {
    const q = text.toLowerCase();
    const long = q.split(/\s+/).filter(Boolean).length >= 6;
    const varies = has(q, CUES.varies), fixed = has(q, CUES.fixed), txt = has(q, CUES.text), plan = has(q, CUES.plan);
    return {
      q1: varies.length ? { value: false, why: varies[0] } : fixed.length ? { value: true, why: fixed[0] } : { value: null },
      q2: txt.length ? { value: true, why: txt[0] } : long ? { value: false } : { value: null },
      q3: plan.length ? { value: true, why: plan[0] } : long ? { value: false } : { value: null },
    };
  }

  // Follow the triage tree: either the next question that is still open, or the result.
  function walk(triage, answers) {
    let q = triage.questions[0];
    while (q) {
      const a = answers[q.id];
      if (a === undefined || a === null) return { ask: q };
      const branch = a ? q.yes : q.no;
      if (!branch.next) return { result: branch };
      q = triage.questions.find((x) => x.id === branch.next);
    }
    return {};
  }

  // The questions the answers actually led through, in order (an inferred answer that was never reached does not count).
  function visited(triage, answers) {
    const ids = [];
    let q = triage.questions[0];
    while (q) {
      const a = answers[q.id];
      if (a === undefined || a === null) break;
      ids.push(q.id);
      const branch = a ? q.yes : q.no;
      if (!branch.next) break;
      q = triage.questions.find((x) => x.id === branch.next);
    }
    return ids;
  }

  function pickStep(result, text) {
    const q = text.toLowerCase();
    const steps = result.ladder_steps;
    if (steps.includes("rule")) return /\b(check|validate|block|reject)\b/.test(q) && !/\b(then|after|next|notify|send|update)\b/.test(q) ? "rule" : "workflow";
    if (steps.includes("classic_ml")) return /\b(predict|classif|rank|recommend|score|sort|route)/.test(q) ? "classic_ml" : "workflow";
    if (steps.includes("agent")) return /\b(several teams|departments|multiple agents|across teams)\b/.test(q) ? "multi_agent" : "agent";
    return steps[0];
  }

  const titleFrom = (text) => { const t = text.replace(/[^\w\s-]/g, " ").trim().split(/\s+/).slice(0, 5).join(" "); return t.charAt(0).toUpperCase() + t.slice(1); };
  const planUrl = (text) => `${pageUrl("plan")}?from=assistant&name=${encodeURIComponent(titleFrom(text))}&purpose=${encodeURIComponent(text)}`;
  const ANSWER_TEXT = {
    q1: [["The steps change from case to case."], ["The steps are the same every time."]],
    q2: [["It does not need to read or write everyday text."], ["It reads or writes everyday text."]],
    q3: [["The steps do not depend on what happens along the way."], ["It has to plan across tools or handle cases nobody can list in advance."]],
  };

  async function startPlanning(text) {
    const triage = await data.getContent("triage");
    const found = infer(text);
    planning = { text, triage, answers: {}, source: {}, asking: null };
    for (const id of ["q1", "q2", "q3"]) if (found[id].value !== null) { planning.answers[id] = found[id].value; planning.source[id] = "your description"; }
    return continuePlanning();
  }

  async function continuePlanning() {
    const step = walk(planning.triage, planning.answers);
    if (step.ask) {
      planning.asking = step.ask.id;
      const yes = () => ask("Yes"), no = () => ask("No");
      return {
        text: `I cannot tell from your description. ${step.ask.text} ${step.ask.hint}`,
        choices: true,
        extra: [h("div", { class: "msg-links" }, h("button", { class: "btn btn-sm btn-secondary", type: "button", onclick: yes }, "Yes"), h("button", { class: "btn btn-sm btn-secondary", type: "button", onclick: no }, "No"))],
      };
    }
    planning.asking = null;
    const { text, answers, source, triage } = planning;
    const stepId = pickStep(step.result, text);
    const guide = await data.getContent("guide");
    const reasons = visited(triage, answers).map((id) => `${ANSWER_TEXT[id][answers[id] ? 1 : 0][0]} (${source[id] === "you" ? "you told me" : "from your description"})`);
    const name = titleFrom(text);
    const actions = [h("a", { class: "btn btn-sm btn-primary", href: planUrl(text) }, "Plan this automation ›")];
    let note = null;
    if (n8nDraft(stepId, { name, task: text })) {
      if (isOn("draft")) actions.push(h("button", { class: "btn btn-sm btn-secondary", type: "button", onclick: () => showDraft(stepId, name, text) }, "Make an n8n draft"));
      else note = h("p", { class: "msg-note" }, "The n8n draft skill is switched off. Turn it on under MCP servers and skills to get a draft file.");
    } else {
      note = h("p", { class: "msg-note" }, "An agent needs a one-line reason and a person's decision, so I do not draft it. Plan it first.");
    }
    return {
      text: `Best fit: step ${labels.ladder_number[stepId]}, ${labels.ladder_step[stepId]}. ${(guide.steps[stepId] || {}).plain || ""}`,
      extra: [h("ul", { class: "msg-reasons" }, reasons.map((x) => h("li", null, x))), flowDiagram(stepId), note, h("div", { class: "msg-links" }, actions)],
    };
  }

  // Demo of "create in n8n": the file can be downloaded, and the create step shows the approval gate without sending anything.
  function showDraft(stepId, name, task) {
    const draft = n8nDraft(stepId, { name, task });
    const body = JSON.stringify(draft.json, null, 2);
    const download = () => {
      const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
      const a = h("a", { href: url, download: draft.filename });
      document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };
    const copy = h("button", { class: "btn btn-sm btn-secondary", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(body); copy.textContent = "Copied"; } catch { copy.textContent = "Copy not allowed here"; } } }, "Copy JSON");
    const create = confirmButton({
      label: "Create in n8n (simulated)", confirmLabel: "Confirm: create the draft", className: "btn btn-sm btn-outline",
      action: () => {
        messages.push({ me: false, text: `Simulated: "${draft.json.name}" would now be created in n8n as an inactive draft, tagged "created by rAIght". No request was sent. In a real setup this click is the approval: nothing is created without it, and nothing is switched on.` });
        draw();
      },
    });
    messages.push({ me: false, text: "Here is a draft for n8n. It is a skeleton: every step is a placeholder you configure in n8n, and the workflow is exported as inactive. Nothing was sent to n8n.", extra: [h("div", { class: "msg-links" }, h("button", { class: "btn btn-sm btn-primary", type: "button", onclick: download }, "Download .json"), copy, create)] });
    draw();
  }

  function answerQuestion(value) {
    planning.answers[planning.asking] = value;
    planning.source[planning.asking] = "you";
    return continuePlanning();
  }

  // ---------- Answers ----------
  async function answer(question) {
    const q = question.toLowerCase();
    const [summary, agents, cases] = await Promise.all([data.getSummary(), data.getAgents(), data.getEscalations()]);
    const live = agents.filter((a) => a.status !== "retired");
    const uniform = live.filter((a) => a.uniform_agent && a.status === "active");
    const unused = live.filter((a) => a.status === "unused");
    const open = cases.filter((c) => !c.handled);
    const link = (a, text) => ({ label: text || `Open ${a.name}`, href: agentUrl(a) });

    if (!awaitingTask && !(planning && planning.asking)) {
      if (/\bconnect|\bmcp\b|integrations?\b|what (data|sources|servers)/.test(q) && !needFor(q)) {
        const all = [...allServers(), ...SKILLS];
        return { text: `You can plug in MCP servers and skills here, so answers can use company data a general chatbot never sees. ${all.filter((s) => isOn(s.id)).length} of ${all.length} are on. The servers are only simulated: nothing is really connected.`, links: [], openConnections: true };
      }
      if (needFor(q) === "jira") return { text: "Example answer from Jira: 4 open tickets are tagged automation, 1 of them is overdue. Sample figures. A real connection reads your own Jira.", links: [] };
      if (needFor(q) === "kb") return { text: "Example answer from the Internal Knowledge Hub: the offer process asks for a second approval above the salary band. Sample text. A real connection searches your own documents.", links: [] };
      if (needFor(q) === "n8n") {
        const onN8n = live.filter((a) => a.provider === "n8n");
        return { text: onN8n.length ? `n8n runs ${onN8n.length} of your automations: ${onN8n.map((a) => `${a.name} (${a.same_path_share == null ? "no runs" : fmt.percent(a.same_path_share) + " same path"})`).join(", ")}.` : "No automation of yours runs in n8n.", links: onN8n.slice(0, 1).map((a) => link(a)) };
      }
    }
    // A task to automate: work out the ladder step (before the agent names, which a task may mention).
    if (awaitingTask) { awaitingTask = false; return startPlanning(question); }
    if (planning && planning.asking && /^(yes|no)$/i.test(question.trim())) return answerQuestion(/^yes$/i.test(question.trim()));
    if (/\bautomate\b|\b(plan|build|create|set up) (an? )?(new )?(automation|workflow)\b|\bwhich (ladder )?step\b/.test(q) && !/how many|count|number of/.test(q)) {
      if (q.split(/\s+/).filter(Boolean).length >= 7) return startPlanning(question);
      awaitingTask = true;
      return { text: "What do you want to automate? Describe it in one or two sentences, like what starts it and what should happen.", links: [] };
    }

    const named = agents.find((a) => q.includes(a.name.toLowerCase()));
    if (named) {
      const same = named.same_path_share == null ? "no runs to compare" : `${fmt.percent(named.same_path_share)} of runs follow the same path`;
      return { text: `${named.name} runs on ${labels.provider[named.provider]} at step ${labels.ladder_number[named.ladder_step]} (${labels.ladder_step[named.ladder_step]}). Last 30 days: ${fmt.int(named.runs_30d)} runs, ${fmt.millions(named.tokens_30d)} tokens, ${same}. ${named.suggestion_text}`, links: [link(named)] };
    }
    if (/^(hi|hello|hey)\b/.test(q)) return { text: "Hello! Ask me about uniform agents, token use, unused agents or open cases.", links: [] };
    if (/escalat|case|inbox|waiting/.test(q)) {
      const high = open.filter((c) => c.priority === "high").length;
      return { text: open.length ? `${open.length} case${open.length === 1 ? " is" : "s are"} waiting for you, ${high} of them high priority.` : "No cases are waiting for you.", links: [{ label: "Open escalations", href: pageUrl("escalations") }] };
    }
    if (/unused|idle|retire|not run|dormant/.test(q)) {
      return unused.length
        ? { text: `${unused.map((a) => `${a.name} has not run for ${a.days_since_last_run} days`).join(". ")}. Retiring it stops it from showing up in your automations.`, links: unused.map((a) => link(a)) }
        : { text: "Every active agent has run recently, so nothing to retire.", links: [] };
    }
    if (/uniform|workflow|convert|repeat|same[- ]path|same path/.test(q)) {
      return uniform.length
        ? { text: `${uniform.length} agents behave like workflows: ${uniform.map((a) => `${a.name} (${fmt.percent(a.same_path_share)})`).join(", ")}. Above ${Math.round(summary.uniform_threshold * 100)} % same path, an agent is flagged as uniform and a cheaper step would do the job.`, links: uniform.map((a) => link(a, `${a.suggestion}: ${a.name}`)) }
        : { text: "No agent is above the same-path threshold right now.", links: [] };
    }
    if (/token|usage|cost|expens|biggest|most|co2|carbon|emission/.test(q)) {
      const top = [...live].sort((a, b) => b.tokens_30d - a.tokens_30d).slice(0, 3);
      const base = `Your automations used ${fmt.millions(summary.tokens_30d)} tokens in the last 30 days (${fmt.delta(summary.tokens_30d, summary.tokens_30d_previous)} vs the 30 days before). ${Math.round(summary.tokens_uniform_30d / summary.tokens_30d * 100)} % of that went to uniform agents.`;
      const carbon = /co2|carbon|emission/.test(q) ? " The dashboard shows CO₂e next to the cost. It is an estimate from the output tokens, made with EcoLogits." : "";
      return { text: `${base} Biggest users: ${top.map((a) => `${a.name} ${fmt.millions(a.tokens_30d)}`).join(", ")}.${carbon}`, links: top.slice(0, 1).map((a) => link(a)) };
    }
    if (/how many|count|number of|agents/.test(q)) {
      return { text: `You have ${live.length} automations: ${uniform.length} uniform, ${live.filter((a) => a.status === "active" && !a.uniform_agent).length} healthy and ${unused.length} unused.`, links: [{ label: "Open automations", href: pageUrl("inventory") }] };
    }
    if (/access|user|role|permission/.test(q)) {
      const users = await data.getUsers();
      return { text: `${users.length} people have access: ${users.map((u) => `${u.name} (${labels.role[u.role]})`).join(", ")}. Admins change this on the Access page.`, links: [] };
    }
    return { text: "I can answer questions about uniform agents, token use, unused agents, open cases, or a single agent by name. Say \"I want to automate\" and a task to get a suggestion for the ladder step.", links: [] };
  }

  // ---------- UI ----------
  function draw() {
    list.replaceChildren(...messages.map((m) => h("div", { class: `msg ${m.me ? "me" : ""}${m.pending ? " pending" : ""}${m.extra ? " has-extra" : ""}` },
      m.pending ? h("span", { class: "typing", "aria-label": "Assistant is typing" }, h("i"), h("i"), h("i")) : m.text,
      m.extra,
      m.used && h("small", { class: "msg-used" }, `Used: ${m.used}`),
      m.openConnections && h("div", { class: "msg-links" }, h("button", { class: "btn btn-sm btn-secondary", type: "button", onclick: () => toggleConnections(true) }, "Open MCP servers and skills ›")),
      m.links && m.links.length > 0 && h("div", { class: "msg-links" }, m.links.map((l) => h("a", { class: "btn btn-sm btn-secondary", href: l.href }, `${l.label} ›`))))));
    list.scrollTop = list.scrollHeight;
  }

  async function ask(text) {
    const question = text.trim();
    if (!question) return;
    messages.forEach((m) => { if (m.choices) m.extra = null; });
    messages.push({ me: true, text: question }, { me: false, pending: true });
    draw();
    const midFlow = awaitingTask || (planning && planning.asking);
    const need = midFlow ? null : needFor(question.toLowerCase());
    let reply;
    if (need && !isOn(need)) {
      reply = { text: `${itemById(need).name} is switched off, so I cannot use it for this. Turn it on under MCP servers and skills, then ask again.`, links: [], openConnections: true };
    } else {
      reply = await answer(question);
      reply.used = need ? `${itemById(need).name}${isSkill(need) ? " (skill)" : ""}` : (midFlow ? "Ladder triage (skill)" : "Run logs");
    }
    await new Promise((r) => setTimeout(r, 450));
    messages.pop();
    messages.push({ me: false, ...reply });
    draw();
  }

  function setOpen(open) {
    panel.hidden = !open;
    fab.setAttribute("aria-expanded", String(open));
    if (open) { draw(); input.focus(); } else fab.focus();
  }

  function build() {
    list = h("div", { class: "msgs", role: "log", "aria-live": "polite" });
    connBtn = h("button", { class: "chat-close chat-conn", type: "button", "aria-label": "MCP servers and skills", "aria-expanded": "false", title: "MCP servers and skills", onclick: () => toggleConnections() }, window.rAIght.sapIcon("plug", 16));
    connPanel = h("section", { class: "conn", id: "assistant-conn", hidden: true, "aria-label": "MCP servers and skills" });
    drawConnections();
    chips = h("div", { class: "chips" }, SUGGESTIONS.map((s) => h("button", { type: "button", onclick: () => ask(s) }, s)));
    input = h("input", { type: "text", placeholder: "Ask a question or describe a task…", autocomplete: "off", "aria-label": "Message" });
    panel = h("section", { class: "chat", id: "assistant", hidden: true, "aria-label": "rAIght Assistant" },
      h("header", null,
        h("span", { class: "chat-ico", "aria-hidden": "true" }, sparkle(18)),
        h("div", null, h("b", null, "rAIght Assistant")),
        connBtn,
        h("button", { class: "chat-close", type: "button", "aria-label": "Close the rAIght Assistant", onclick: () => setOpen(false) }, "✕")),
      connPanel, list, chips,
      h("form", { onsubmit: (e) => { e.preventDefault(); const v = input.value; input.value = ""; ask(v); } }, input, h("button", { class: "btn btn-primary", type: "submit" }, "Send")));
    fab = h("button", { class: "fab", type: "button", "aria-label": "Open the rAIght Assistant", "aria-expanded": "false", "aria-controls": "assistant", onclick: () => setOpen(panel.hidden) }, sparkle(24));
    panel.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    document.body.append(fab, panel);
  }

  function toggleConnections(open) {
    const next = open === undefined ? connPanel.hidden : open;
    connPanel.hidden = !next;
    panel.classList.toggle("show-conn", next);
    connBtn.setAttribute("aria-expanded", String(next));
  }

  function drawConnections() {
    if (!connPanel) return;
    const row = (c) => h("div", { class: "conn-row" },
      h("span", { class: "conn-text" }, h("b", null, c.name), h("small", null, c.note)),
      h("button", { class: "switch", type: "button", role: "switch", "aria-checked": String(isOn(c.id)), "aria-label": c.name, onclick: () => setServer(c.id, !isOn(c.id)) }, h("span", { class: "switch-knob" })));
    const address = h("input", { type: "text", placeholder: "https://mcp.example.com", autocomplete: "off", "aria-label": "MCP server address" });
    connPanel.replaceChildren(
      h("p", { class: "conn-intro" }, "MCP servers give the assistant access to company systems, and skills are abilities it can use. ", h("b", null, "The servers are simulated in the demo: nothing is really connected.")),
      h("div", { class: "conn-group" },
        h("span", { class: "conn-label" }, "MCP servers"),
        ...allServers().map(row),
        adding
          ? h("form", { class: "conn-form", onsubmit: (e) => { e.preventDefault(); addServer(address.value); } },
              h("label", { class: "visually-hidden" }, "MCP server address"), address,
              h("button", { class: "btn btn-sm btn-primary", type: "submit" }, "Connect"),
              h("button", { class: "btn btn-sm btn-outline", type: "button", onclick: () => { adding = false; addError = ""; drawConnections(); } }, "Cancel"),
              addError && h("p", { class: "conn-error", role: "alert" }, addError))
          : h("button", { class: "btn btn-sm btn-outline conn-add", type: "button", onclick: () => { adding = true; drawConnections(); } }, "+ Connect another MCP server")),
      h("div", { class: "conn-group" }, h("span", { class: "conn-label" }, "Skills"), ...SKILLS.map(row)));
    if (adding) requestAnimationFrame(() => { const i = connPanel.querySelector("input"); if (i) i.focus(); });
  }

  /** The assistant icon: the two sparkles. */
  function sparkle(size) {
    return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" },
      h("path", { d: "M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" }), h("path", { d: "M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" }));
  }

  build();
})();
