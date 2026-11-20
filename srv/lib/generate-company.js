// rAIght – a simulated company around Lena: more process owners with their own agents, in the shape of
// app/data/agents.json, so the same run generator and the same metrics work for a whole company.
// Seeded like the runs: every start gives exactly the same company. All ranges are in config.company.
const config = require("./config");
const { windows } = require("./metrics");
const { seededRandom, apportion } = require("./generate-runs");

const DAY = 86400000;
const LENA_UNIT = "HR · Recruiting";

// The other process owners, by the kind of work their unit does.
const OWNERS = [
  ["Aylin", "HR · Payroll", "hr"], ["Tomás", "HR · Learning", "hr"], ["Hannah", "HR · People Services", "hr"],
  ["Marco", "Finance · Operations", "finance"], ["Sofia", "Finance · Accounts Payable", "finance"],
  ["Daniel", "Finance · Controlling", "finance"], ["Mei", "Finance · Travel & Expenses", "finance"],
  ["Lukas", "Finance · Accounts Receivable", "finance"],
  ["Priya", "Customer Support", "support"], ["Omar", "Customer Support · Returns", "support"],
  ["Clara", "Customer Support · Billing", "support"], ["Noah", "Customer Support · Onboarding", "support"],
  ["Fatima", "Customer Support · Complaints", "support"],
  ["Jonas", "IT · Service Desk", "it"], ["Yuki", "IT · Access Management", "it"], ["Felix", "IT · Workplace", "it"],
  ["Amira", "IT · Applications", "it"],
  ["Elena", "Sales · Inside Sales", "sales"], ["David", "Sales · Operations", "sales"],
  ["Nina", "Sales · Partner Management", "sales"],
  ["Raj", "Procurement", "ops"], ["Carla", "Logistics · Dispatch", "ops"], ["Ben", "Procurement · Supplier Management", "ops"],
];

// What people automate: name, purpose, the usual three steps, an extra step some runs need, and the hand-over.
const TASKS = {
  hr: [
    ["Payslip questions", "Answers employees who ask about their payslip.", ["read_request", "lookup_payroll_record", "send_reply"], "search_policy", "escalate_to_payroll"],
    ["Leave requests", "Checks leave requests against the remaining days.", ["read_request", "check_leave_balance", "update_calendar"], "request_manager_approval", "escalate_to_hr"],
    ["Onboarding checklist", "Prepares the first-week checklist for new hires.", ["read_hire_data", "build_checklist", "send_to_manager"], "add_role_specific_items", "escalate_to_hr"],
    ["Training enrolment", "Enrols employees in mandatory trainings.", ["read_request", "check_requirements", "enrol_participant"], "propose_alternative_date", "escalate_to_trainer"],
    ["Certificate reminders", "Reminds employees of certificates that expire soon.", ["read_expiry_list", "draft_reminder", "send_reminder"], "notify_manager", "escalate_to_hr"],
    ["Reference letters", "Drafts reference letters from the personnel file.", ["read_personnel_file", "draft_letter", "send_for_approval"], "revise_letter", "escalate_to_hr"],
    ["Sick note intake", "Files sick notes and informs the team lead.", ["read_document", "update_absence_record", "notify_team_lead"], "request_missing_document", "escalate_to_hr"],
    ["Policy questions", "Answers questions about HR policies.", ["read_request", "search_policy", "send_reply"], "ask_clarifying_question", "escalate_to_hr"],
    ["Exit interviews", "Summarises exit interviews for HR.", ["read_transcript", "summarise_feedback", "file_summary"], "flag_critical_topic", "escalate_to_hr"],
  ],
  finance: [
    ["Invoice matching", "Matches incoming invoices with purchase orders.", ["read_invoice", "match_purchase_order", "post_booking"], "request_clarification", "escalate_to_accountant"],
    ["Expense check", "Checks expense claims against the travel policy.", ["read_claim", "check_policy", "approve_claim"], "request_receipt", "escalate_to_controller"],
    ["Payment reminders", "Sends reminders for overdue invoices.", ["read_open_items", "draft_reminder", "send_reminder"], "offer_payment_plan", "escalate_to_accountant"],
    ["Account reconciliation", "Matches bank statements with the ledger.", ["read_statements", "match_entries", "post_differences"], "investigate_mismatch", "escalate_to_accountant"],
    ["Vendor master data", "Checks changes to vendor bank details.", ["read_change_request", "verify_bank_details", "update_vendor"], "call_back_vendor", "escalate_to_accountant"],
    ["Budget questions", "Answers cost centre owners about their budget.", ["read_request", "lookup_budget", "send_reply"], "explain_deviation", "escalate_to_controller"],
    ["Month-end report", "Compiles the month-end figures per cost centre.", ["read_ledger", "compile_figures", "send_report"], "comment_outliers", "escalate_to_controller"],
    ["Travel booking", "Books business trips within the travel policy.", ["read_request", "search_connections", "book_trip"], "propose_alternatives", "escalate_to_travel_desk"],
    ["Credit notes", "Prepares credit notes for approved complaints.", ["read_complaint", "calculate_credit", "issue_credit_note"], "request_approval", "escalate_to_accountant"],
  ],
  support: [
    ["Order status", "Answers customers who ask where their order is.", ["read_request", "lookup_order", "send_reply"], "check_carrier_tracking", "escalate_to_agent"],
    ["Return labels", "Creates return labels for eligible orders.", ["read_request", "check_return_policy", "send_label"], "request_photos", "escalate_to_agent"],
    ["Password resets", "Helps customers who are locked out of their account.", ["read_request", "verify_identity", "send_reset_link"], "ask_security_question", "escalate_to_agent"],
    ["Ticket routing", "Sorts incoming tickets to the right team.", ["read_ticket", "classify_topic", "assign_team"], "ask_clarifying_question", "escalate_to_team_lead"],
    ["Refund requests", "Checks refund requests and pays out eligible ones.", ["read_request", "check_eligibility", "issue_refund"], "request_approval", "escalate_to_agent"],
    ["Product questions", "Answers questions about product features.", ["read_request", "search_knowledge_base", "send_reply"], "ask_clarifying_question", "escalate_to_agent"],
    ["Complaint replies", "Drafts replies to written complaints.", ["read_complaint", "draft_reply", "send_for_approval"], "offer_compensation", "escalate_to_team_lead"],
    ["Invoice copies", "Sends invoice copies on request.", ["read_request", "lookup_invoice", "send_copy"], "verify_identity", "escalate_to_agent"],
    ["Appointment booking", "Books service appointments with customers.", ["read_request", "check_slots", "confirm_appointment"], "propose_alternatives", "escalate_to_agent"],
  ],
  it: [
    ["Access requests", "Grants standard access rights after approval.", ["read_request", "check_approval", "grant_access"], "request_manager_approval", "escalate_to_admin"],
    ["Software installs", "Starts software installations for licensed users.", ["read_request", "check_licence", "start_installation"], "order_licence", "escalate_to_admin"],
    ["Incident triage", "Classifies incidents and sets their priority.", ["read_incident", "classify_priority", "assign_team"], "ask_clarifying_question", "escalate_to_on_call"],
    ["VPN problems", "Helps employees who cannot connect to the VPN.", ["read_request", "run_diagnostics", "send_instructions"], "reset_profile", "escalate_to_network_team"],
    ["Hardware orders", "Orders standard hardware for entitled employees.", ["read_request", "check_entitlement", "place_order"], "propose_alternative", "escalate_to_admin"],
    ["Account unlocks", "Unlocks user accounts after an identity check.", ["read_request", "verify_identity", "unlock_account"], "reset_password", "escalate_to_admin"],
    ["Change summaries", "Summarises planned changes for the weekly review.", ["read_change_list", "summarise_changes", "send_summary"], "flag_risk", "escalate_to_change_manager"],
    ["Mailbox requests", "Creates shared mailboxes by the naming rules.", ["read_request", "check_naming_rules", "create_mailbox"], "request_owner", "escalate_to_admin"],
    ["Knowledge answers", "Answers how-to questions from the knowledge base.", ["read_request", "search_knowledge_base", "send_reply"], "ask_clarifying_question", "escalate_to_service_desk"],
  ],
  sales: [
    ["Lead qualification", "Scores new leads from the web form.", ["read_lead", "score_lead", "assign_owner"], "enrich_company_data", "escalate_to_sales_rep"],
    ["Quote drafts", "Drafts quotes from the price list.", ["read_request", "lookup_price_list", "draft_quote"], "apply_discount_rule", "escalate_to_sales_rep"],
    ["Meeting follow-ups", "Writes the follow-up mail after a customer call.", ["read_call_notes", "draft_follow_up", "send_for_approval"], "add_next_steps", "escalate_to_sales_rep"],
    ["CRM updates", "Moves details from mails into the CRM.", ["read_mail", "extract_details", "update_crm"], "create_contact", "escalate_to_sales_rep"],
    ["Contract renewals", "Reminds customers of contracts that end soon.", ["read_renewal_list", "draft_reminder", "send_reminder"], "propose_upgrade", "escalate_to_account_manager"],
    ["Price questions", "Answers price questions from customers.", ["read_request", "lookup_price_list", "send_reply"], "check_special_terms", "escalate_to_sales_rep"],
    ["Partner onboarding", "Checks partner applications and sets up accounts.", ["read_application", "check_documents", "create_partner_account"], "request_missing_document", "escalate_to_partner_manager"],
    ["Demo scheduling", "Schedules product demos with prospects.", ["read_request", "check_calendars", "send_invite"], "propose_slots", "escalate_to_sales_rep"],
    ["Win-loss notes", "Summarises why deals were won or lost.", ["read_deal_history", "summarise_reasons", "file_summary"], "ask_account_owner", "escalate_to_sales_lead"],
  ],
  ops: [
    ["Purchase requests", "Checks purchase requests against the catalogue.", ["read_request", "check_catalogue", "create_order"], "request_quote", "escalate_to_buyer"],
    ["Supplier questions", "Answers suppliers who ask about their orders.", ["read_request", "lookup_order", "send_reply"], "check_delivery_date", "escalate_to_buyer"],
    ["Delivery notes", "Matches delivery notes with orders.", ["read_delivery_note", "match_order", "book_goods_receipt"], "report_difference", "escalate_to_warehouse"],
    ["Shipment tracking", "Answers where a shipment is.", ["read_request", "lookup_shipment", "send_reply"], "contact_carrier", "escalate_to_dispatcher"],
    ["Route planning", "Plans the delivery tours for the next day.", ["read_orders", "plan_route", "send_tour_plan"], "replan_for_delay", "escalate_to_dispatcher"],
    ["Supplier onboarding", "Checks supplier applications and creates the master data.", ["read_application", "check_documents", "create_supplier"], "request_missing_document", "escalate_to_buyer"],
    ["Stock alerts", "Proposes orders when stock falls below the reorder point.", ["read_stock_levels", "check_reorder_point", "create_order_proposal"], "check_open_orders", "escalate_to_planner"],
    ["Customs documents", "Fills in customs forms for shipments abroad.", ["read_shipment", "fill_customs_form", "send_to_broker"], "request_missing_data", "escalate_to_customs_team"],
    ["Quote comparison", "Compares supplier quotes for a request.", ["read_quotes", "compare_terms", "send_recommendation"], "ask_supplier", "escalate_to_buyer"],
  ],
};

const REASONS = [
  "Requests come in free text, so I expected many different cases.",
  "The tool suggested an agent, and it worked on the first try.",
  "I wasn't sure how many exceptions there would be.",
  "A colleague built theirs as an agent, so I did the same.",
];

const round2 = (value) => Math.round(value * 100) / 100;
const between = (random, [min, max]) => min + random() * (max - min);
const slug = (text) => text.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function pick(random, weighted) {
  let roll = random() * Object.values(weighted).reduce((sum, weight) => sum + weight, 0);
  for (const [value, weight] of Object.entries(weighted)) if ((roll -= weight) < 0) return value;
  return Object.keys(weighted)[0];
}

/**
 * Lena's agents from the sample data plus the generated agents of the other owners, Lena's first.
 * Each agent has the fields of app/data/agents.json, plus `unit` and, without recent runs, `fallback_steps`.
 */
function companyScenario(lenaAgents) {
  const random = seededRandom(config.company.seed);
  const others = config.company.agents - lenaAgents.length;
  const perOwner = apportion(others, OWNERS.map(() => 1)); // as even as whole numbers allow
  const generated = OWNERS.flatMap(([owner, unit, kind], i) => {
    const tasks = TASKS[kind].map((task) => [random(), task]).sort(([a], [b]) => a - b).slice(0, perOwner[i]);
    return tasks.map(([, task]) => agentOf(owner, unit, task, random));
  });
  return [...lenaAgents.map((agent) => ({ ...agent, unit: LENA_UNIT })), ...generated];
}

function agentOf(owner, unit, [name, purpose, steps, extraStep, handOver], random) {
  const base = {
    id: `${slug(owner)}_${slug(name)}`,
    name,
    provider: pick(random, config.company.providerWeights),
    owner,
    unit,
    purpose,
    ladder_step: "agent",
    agent_reason: REASONS[Math.floor(random() * REASONS.length)],
  };
  return random() < config.company.unusedShare ? unusedAgent(base, steps, random) : activeAgent(base, steps, extraStep, handOver, random);
}

function activeAgent(base, steps, extraStep, handOver, random) {
  const { runsRange, tokensPerRunRange, growthRange, uniformShare, uniformPathRange, variedPathRange, weekendWeight } = config.company;
  const uniform = random() < uniformShare;
  const main = round2(between(random, uniform ? uniformPathRange : variedPathRange));
  const second = round2((1 - main) * between(random, [0.55, 0.8]));
  const third = round2(1 - main - second);
  const paths = [
    { steps, share: main },
    { steps: [...steps.slice(0, 2), extraStep, steps[2]], share: second },
    { steps: [steps[0], handOver], share: third },
  ].filter((path) => path.share > 0);

  // Few agents run a lot, most run little: the cube keeps the bulk near the lower end of the range.
  const runs = Math.round(runsRange[0] + random() ** 3 * (runsRange[1] - runsRange[0]));
  const tokensPerRun = between(random, tokensPerRunRange);
  const tokens = Math.round((runs * tokensPerRun) / 1000) * 1000;
  const growth = between(random, growthRange);
  const { firstDay } = windows()[0];
  const weights = Array.from({ length: config.windowDays }, (_, i) => {
    const weekday = new Date((firstDay + i) * DAY).getUTCDay();
    return (weekday === 0 || weekday === 6 ? weekendWeight : 1) * (0.85 + random() * 0.3);
  });
  const runsByDay = apportion(runs, weights);
  const percent = Math.round(main * 100);
  return {
    ...base,
    status: "active",
    runs_30d: runs,
    tokens_30d: tokens,
    days_since_last_run: config.windowDays - 1 - runsByDay.findLastIndex((count) => count > 0),
    top_paths: paths,
    suggestion: uniform ? "Convert to workflow" : "Keep agent",
    suggestion_text: uniform
      ? `${percent} % of runs take the same ${steps.length} steps. A workflow does this without a model call, and only the rest needs judgement.`
      : `Only ${percent} % of runs take the most frequent path. The runs differ, so this works like an agent.`,
    tokens_by_month: Array.from({ length: config.windows }, (_, i) => {
      const monthsBack = config.windows - 1 - i;
      return monthsBack ? Math.round(tokens / (1 + growth) ** monthsBack / 1000) * 1000 : tokens;
    }),
    runs_by_day: runsByDay,
  };
}

/** An agent nobody uses any more: its last run is more than a window ago, and it only has tokens before that day. */
function unusedAgent(base, steps, random) {
  const { unusedDaysRange, unusedWindowTokensRange } = config.company;
  const daysSince = Math.round(between(random, unusedDaysRange));
  const lastWindow = Math.floor(daysSince / config.windowDays); // 0 = the last 30 days
  return {
    ...base,
    status: "unused",
    runs_30d: 0,
    tokens_30d: 0,
    days_since_last_run: daysSince,
    top_paths: [],
    fallback_steps: steps,
    suggestion: "Retire",
    suggestion_text: `No runs for ${daysSince} days. Retire it so it no longer shows up in your automations.`,
    tokens_by_month: Array.from({ length: config.windows }, (_, i) => {
      const window = config.windows - 1 - i;
      if (window < lastWindow) return 0;
      // In its last window, enough tokens for a run on every day it was still used.
      const daysUsed = window === lastWindow ? config.windowDays * (window + 1) - daysSince : 0;
      const perRun = config.tokensPerRunFallback;
      return Math.max(Math.round(between(random, unusedWindowTokensRange) / perRun), daysUsed) * perRun;
    }),
    runs_by_day: new Array(config.windowDays).fill(0),
  };
}

module.exports = { companyScenario };
