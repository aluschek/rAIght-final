// rAIght demo – writes the test inputs for the light agent "Application status" (status-requests.json):
// short messages from candidates who ask where their application stands. Everything is invented.
// Seeded: every run writes the same file. Usage: node demo/n8n/make-status-requests.js
const fs = require("node:fs");
const path = require("node:path");
const { seededRandom } = require("../../srv/lib/generate-runs");
const applications = require("./applications.json");

const random = seededRandom(20261117);
const pick = (list) => list[Math.floor(random() * list.length)];

const QUESTIONS = [
  (a) => `Hello, I applied for the position of ${a.position} about two weeks ago and have not heard back yet. Could you tell me where my application stands? Thank you very much and kind regards, ${a.applicant.name}`,
  (a) => `Dear Recruiting Team, I am writing to ask about the status of my application as ${a.position} (${a.id}). I have another offer on the table and would like to know how long your process will take. Best regards, ${a.applicant.name}`,
  (a) => `Hi, quick question: is there any news on my application for ${a.position}? I sent everything on ${a.received}. Thanks! ${a.applicant.name.split(" ")[0]}`,
  (a) => `Good morning, I had my first interview for the ${a.position} role last week and was told I would hear back soon. May I ask what the next step is and when I can expect it? Many thanks, ${a.applicant.name}`,
  (a) => `Hello, could you please confirm that my application ${a.id} has arrived and is being reviewed? I did not receive a confirmation e-mail. Kind regards, ${a.applicant.name}`,
  (a) => `Dear Sir or Madam, I would like to follow up on my application for ${a.position} in your ${a.department} department. Has a decision been made already? I remain very interested. Sincerely, ${a.applicant.name}`,
];
const STAGES = [
  ["Application received", "The documents are being checked.", "You will hear from us within ten working days."],
  ["In review by the department", "The hiring manager is reading the applications.", "We expect feedback by the end of next week."],
  ["First interview completed", "The interviewers are comparing notes.", "We will contact you about a second interview within five working days."],
  ["Second interview scheduled", "Your interview is confirmed.", "You will receive the invitation with the time and the names of the interviewers by e-mail."],
  ["Offer in preparation", "The offer is with the works council.", "You will receive it by e-mail in about one week."],
];
const FAQ = [
  "Q: How long does the application process take? A: Usually four to six weeks from the application to a decision.",
  "Q: Can I add documents later? A: Yes, reply to your confirmation e-mail and attach the files; we add them to your application.",
  "Q: Do you reimburse travel costs for interviews? A: Yes, second-class train tickets or 0.30 EUR per kilometre by car, after the interview and with receipts.",
  "Q: Can I apply for more than one position? A: Yes. Each application is reviewed separately.",
  "Q: Who can I contact about accessibility needs for the interview? A: Tell your recruiter; we will arrange what you need.",
  "Q: Do you give feedback after a rejection? A: Short feedback by phone on request, within four weeks after the decision.",
].join("\n");

const requests = applications.map((a, index) => {
  const stage = pick(STAGES);
  const kind = index === 9 ? "faq" : index === 17 ? "other" : "status";
  const message =
    kind === "faq" ? `Hello, I applied as ${a.position} and have my second interview in Mannheim next week. Do you reimburse the travel costs, and what do I need to hand in? And is there any news on the schedule? Thank you, ${a.applicant.name}`
    : kind === "other" ? `Dear Recruiting Team, I would like to withdraw my application for ${a.position}, as I have accepted another offer. In addition, I ask you to delete my personal data and to confirm the deletion in writing. Kind regards, ${a.applicant.name}`
    : pick(QUESTIONS)(a);
  return {
    id: `REQ-2026-${String(900 + index * 3)}`,
    application_id: a.id,
    candidate: a.applicant.name,
    position: a.position,
    message,
    status: { stage: stage[0], detail: stage[1], next_step: stage[2], last_update: `2026-11-${String(5 + (index % 10)).padStart(2, "0")}` },
    expected: kind === "status" ? "reply with status" : kind === "faq" ? "reply with status and FAQ" : "hand over",
  };
});

const out = path.join(__dirname, "status-requests.json");
fs.writeFileSync(out, `${JSON.stringify({ faq: FAQ, requests }, null, 1)}\n`);
console.log(`${requests.length} requests written to ${path.relative(process.cwd(), out)}`);
console.log(`words per message: mean ${Math.round(requests.reduce((s, r) => s + r.message.split(/\s+/).length, 0) / requests.length)}`);
