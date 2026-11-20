// rAIght demo – writes the test applications for the real n8n agent "Document check".
// Everything is invented. Each applicant has one profile, and every document is written from it, so the
// documents of one application agree with each other. Seeded: every run writes the same files.
//
// Usage: node demo/n8n/make-applications.js          → applications.json       (short documents)
//        node demo/n8n/make-applications.js --full   → applications-full.json  (the usual length of a complete
//                                                       application: two-page CV, one-page cover letter, two references)
const fs = require("node:fs");
const path = require("node:path");
const { seededRandom } = require("../../srv/lib/generate-runs");

const FULL = process.argv.includes("--full");
const random = seededRandom(20261116);
const pick = (list) => list[Math.floor(random() * list.length)];
const some = (list, count) => [...list].sort(() => random() - 0.5).slice(0, count);
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const pad = (number) => String(number).padStart(2, "0");
let phoneNo = FULL ? 24 : 0; // the phone numbers are clearly not real: +49 151 00000NN

// name, citizenship, native language, citizen of the EU?
const PEOPLE = [
  ["Hannah", "Becker", "Germany", "German", true], ["Lukas", "Hoffmann", "Germany", "German", true],
  ["Aarav", "Sharma", "India", "Hindi", false], ["Camille", "Laurent", "France", "French", true],
  ["Mateo", "Fernández", "Spain", "Spanish", true], ["Emily", "Carter", "Canada", "English", false],
  ["Giulia", "Romano", "Italy", "Italian", true], ["Jakub", "Kowalski", "Poland", "Polish", true],
  ["Rafael", "Oliveira", "Brazil", "Portuguese", false], ["Sanne", "de Vries", "Netherlands", "Dutch", true],
  ["Inês", "Carvalho", "Portugal", "Portuguese", true], ["Nour", "Hassan", "Egypt", "Arabic", false],
  ["Marie", "Schneider", "Austria", "German", true], ["Jonas", "Weber", "Germany", "German", true],
  ["Linh", "Nguyen", "Vietnam", "Vietnamese", false], ["Léa", "Moreau", "France", "French", true],
  ["Pablo", "Navarro", "Spain", "Spanish", true], ["Oksana", "Melnyk", "Ukraine", "Ukrainian", false],
  ["Anna", "Lewandowska", "Poland", "Polish", true], ["Sofia", "Ricci", "Italy", "Italian", true],
  ["Chidi", "Okafor", "Nigeria", "Igbo", false], ["Emma", "Janssen", "Netherlands", "Dutch", true],
  ["Tiago", "Mendes", "Portugal", "Portuguese", true], ["Ji-woo", "Park", "South Korea", "Korean", false],
];
// What is wrong with an application, by position in PEOPLE. Everyone else is complete.
const GAPS = { 5: "work_permit", 13: "degree_certificate", 19: "unreadable" };

const POSITIONS = [
  ["Junior Data Analyst", "Analytics"], ["Working Student Controlling", "Finance"], ["HR Business Partner", "People"],
  ["Software Engineer Backend", "Engineering"], ["Procurement Specialist", "Procurement"], ["Customer Success Manager", "Customer Service"],
  ["Financial Accountant", "Finance"], ["IT Support Specialist", "IT"],
];
const UNIVERSITIES = ["University of Neuhaven", "TU Westerfeld", "University of Altenbrück", "Rheinau Institute of Technology", "Lindtal University", "Hohenfels Technical University", "University of Seewald", "Nordheim University"]; // invented
const DEGREES = [["B.Sc.", "Bachelor of Science", "Business Informatics"], ["M.Sc.", "Master of Science", "Management"], ["B.Sc.", "Bachelor of Science", "Business Administration"],
  ["M.Sc.", "Master of Science", "Data Science"], ["B.A.", "Bachelor of Arts", "Economics"], ["M.Sc.", "Master of Science", "Information Systems"]];
const EMPLOYERS = ["Nordwind Logistik GmbH", "Hollerbach & Kraus AG", "Bergland Versicherung", "Solvia Energie SE", "Velstad Maschinenbau", "Rheintal Bank", "Lumen Retail Group", "Fennwick Systems"];
const ROLES = ["Junior Analyst", "Working Student", "Intern", "Project Assistant"]; // newest job first
const TASKS = [
  "Prepared the monthly reporting for the management team and checked the figures against the source systems",
  "Built and maintained dashboards for sales and operations in Power BI",
  "Supported the month-end closing, including accruals and intercompany reconciliation",
  "Analysed process data to find the causes of delays and presented the results to the department lead",
  "Maintained master data in SAP and corrected inconsistent records together with the business units",
  "Answered requests from internal customers and documented recurring questions in the knowledge base",
  "Coordinated suppliers, compared offers and prepared decision papers for purchasing",
  "Wrote test cases, ran regression tests and tracked defects until they were closed",
  "Organised onboarding sessions for new colleagues and kept the training material up to date",
  "Automated a weekly Excel report with Python, which reduced the manual effort from four hours to a few minutes",
  "Took part in a project to introduce a new ticket system and trained the key users",
  "Prepared customer meetings, wrote the minutes and followed up on open points",
];
const MODULES = [
  "Introduction to Business Administration", "Mathematics I", "Mathematics II", "Statistics I", "Statistics II", "Programming I", "Programming II",
  "Databases", "Accounting", "Cost Accounting", "Marketing", "Operations Management", "Microeconomics", "Macroeconomics", "Corporate Finance",
  "Business Law", "Software Engineering", "Data Warehousing", "Machine Learning", "Process Management", "Enterprise Systems", "Project Management",
  "Human Resource Management", "Organisational Behaviour", "Information Security", "Decision Analysis", "Econometrics", "Seminar",
];
const THESES = [
  ["Process mining in order-to-cash", "analysed two years of order data to find the causes of late deliveries"],
  ["Forecasting weekly demand with gradient boosting", "built a forecasting model for weekly demand and compared it with the planners' estimates"],
  ["Acceptance of self-service analytics", "surveyed 140 employees on the use of self-service reports and derived recommendations"],
  ["Automating invoice matching", "designed and tested rules that match incoming invoices to purchase orders"],
];
const SKILLS = ["Excel (pivot tables, Power Query)", "SQL", "Python (pandas)", "SAP S/4HANA (basics)", "Power BI", "Tableau", "Jira", "R", "MS Project", "Salesforce"];
const FILE_NAMES = ["scan_0001.pdf", "IMG_2291.jpg", "Dokument (3).pdf", "final_final_v2.pdf", "Unterlagen.pdf", "Zeugnis.pdf", "upload.pdf", "CamScanner 11-02.pdf", "file.pdf", "doc20261102.pdf", "Bewerbung_neu.pdf", "Scan.pdf"];

/** Everything that is true about one applicant. The documents only quote from here. */
function profile(index) {
  const [first, last, citizenship, nativeLanguage, euCitizen] = PEOPLE[index];
  const degree = pick(DEGREES);
  const master = degree[0] === "M.Sc.";
  const graduated = between(2023, 2026);
  // Study record: the credits add up to the degree, and the overall grade is the weighted mean of the rows.
  const level = 1.2 + random() * 1.4;
  const grade = () => Math.min(4, Math.max(1, Math.round((level + (random() - 0.5) * 1.4) * 10) / 10));
  const thesis = pick(THESES);
  const rows = some(MODULES, master ? 15 : 28).map((module) => ({ module, ects: 6, grade: grade() }));
  rows.push({ module: `${master ? "Master" : "Bachelor"} Thesis: ${thesis[0]}`, ects: master ? 30 : 12, grade: grade() });
  const ects = rows.reduce((sum, row) => sum + row.ects, 0);
  // Jobs during and after the studies, newest first; the reference letters come from these employers.
  const employers = some(EMPLOYERS, 4);
  const monthYear = (date) => `${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`;
  let end = new Date(Date.UTC(2026, between(5, 9), 1)); // the newest job ended between June and October 2026
  const jobs = Array.from({ length: FULL ? between(3, 4) : between(2, 3) }, (_, i) => {
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - between(6, 11), 1));
    const job = { role: ROLES[i], employer: employers[i], period: `${monthYear(start)} – ${monthYear(end)}`, tasks: some(TASKS, FULL ? between(4, 5) : between(3, 4)) };
    end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - between(1, 3), 1)); // one job after the other
    return job;
  });
  return {
    first, last, name: `${first} ${last}`, citizenship, nativeLanguage, euCitizen,
    born: `${pad(between(1, 28))}.${pad(between(1, 12))}.${between(1994, 1999)}`,
    address: `${pick(["Lindenstraße", "Schillerplatz", "Am Wasserturm", "Hafenstraße", "Bergweg"])} ${between(1, 120)}, ${pick(["68161 Mannheim", "69115 Heidelberg", "60311 Frankfurt", "70173 Stuttgart", "50667 Köln"])}`,
    position: POSITIONS[index % POSITIONS.length],
    degree, master, university: pick(UNIVERSITIES), graduated, thesis, rows, ects,
    grade: (rows.reduce((sum, row) => sum + row.ects * row.grade, 0) / ects).toFixed(1),
    matriculation: between(1400000, 1999999),
    jobs,
    start: `${between(1, 28)} ${pick(["January", "February", "March"])} 2027`,
  };
}

function cv(p) {
  return [
    `CURRICULUM VITAE`,
    p.name,
    `Address: ${p.address}`,
    `Phone: +49 151 ${(between(1000000, 9999999), `00000${pad(++phoneNo)}`)} · E-mail: ${p.first.toLowerCase()}.${p.last.toLowerCase().replace(/[^a-z]/g, "")}@example.org`,
    `Date of birth: ${p.born} · Citizenship: ${p.citizenship}`,
    ``,
    `PROFILE`,
    `${p.degree[0]} graduate in ${p.degree[2]} with practical experience from internships and working-student jobs. I like working with data, structure my work carefully and enjoy explaining results to people who are not specialists. I am looking for a role in which I can take on responsibility early and keep learning.`,
    ``,
    `PROFESSIONAL EXPERIENCE`,
    p.jobs.map((job) => [`${job.role}, ${job.employer}`, job.period, ...job.tasks.map((task) => `- ${task}.`)].join("\n")).join("\n\n"),
    ``,
    `EDUCATION`,
    `${p.degree[0]} ${p.degree[2]}, ${p.university}, ${p.graduated - (p.master ? 2 : 3)} – ${p.graduated}`,
    `Thesis: "${p.thesis[0]}". Final grade: ${p.grade}.`,
    ``,
    ...(FULL ? [
      `PROJECTS`,
      `- Thesis project: ${p.thesis[1]}. Presented the results to the department and wrote the documentation for the hand-over.`,
      `- Student consulting project for a regional retailer: mapped the returns process, measured throughput times and proposed three changes, two of which were implemented within the semester.`,
      ``,
      `CERTIFICATES AND TRAINING`,
      `- ${pick(["Scrum Foundation", "ITIL 4 Foundation", "Data protection for employees (GDPR)"])}, ${p.graduated}`,
      `- ${pick(["Excel for controllers (three-day course)", "Presentation and facilitation training", "SQL for analysts (online course)"])}, ${p.graduated - 1}`,
      ``,
    ] : []),
    `SKILLS`,
    some(SKILLS, between(5, 7)).map((skill) => `- ${skill}`).join("\n"),
    ``,
    `LANGUAGES`,
    [...new Set([`${p.nativeLanguage}: native speaker`, `German: ${p.nativeLanguage === "German" ? "native speaker" : "fluent (C1)"}`, `English: fluent (C1)`])].map((line) => `- ${line}`).join("\n"),
    ``,
    `VOLUNTEERING AND INTERESTS`,
    `Tutor for first-year students (two semesters), member of the student consulting group, long-distance running and photography.`,
  ].join("\n");
}

function coverLetter(p) {
  return [
    p.name,
    `Application as ${p.position[0]} (${p.position[1]})`,
    ``,
    `Dear Recruiting Team,`,
    ``,
    `I am writing to apply for the position of ${p.position[0]}, which I found on your careers page. The description fits both my studies and what I have done in practice so far, and I would like to explain briefly why I think I am a good match.`,
    ``,
    `During my studies in ${p.degree[2]} at ${p.university} I focused on the topics that matter in this role. At ${p.jobs[0].employer} I was responsible for recurring analyses and for keeping the underlying data clean, and I learned how important it is to understand the process behind a number before presenting it. I also worked closely with colleagues from other departments, which taught me to ask precise questions and to write things down so that others can follow them later.`,
    ``,
    ...(FULL ? [
      `A concrete example: in that role the monthly report took almost two working days, because the data came from three systems and had to be copied by hand. I documented the steps, agreed the definitions of the key figures with the two departments involved and then automated the preparation. Since then the report is ready on the first working day, and the time that was freed up goes into the questions behind the figures. I mention this because it shows how I like to work: first understand the process, then simplify it, and only then use a tool.`,
      ``,
      `I am aware that I still have a lot to learn in a new environment. What I can promise is that I ask early when something is unclear, that I finish what I start, and that I enjoy working in a team in which people say openly what works and what does not.`,
      ``,
    ] : []),
    `What attracts me to your company is the combination of an international environment and a team that is small enough to see the result of one's own work. I learn best when I am given real tasks from the first week.`,
    ``,
    `I can start on ${p.start}, and my salary expectation is in line with the collective agreement for this level. My documents are attached. I would be glad to introduce myself in person.`,
    ``,
    `Kind regards,`,
    p.name,
  ].join("\n");
}

function degreeCertificate(p) {
  return [
    p.university.toUpperCase(),
    `CERTIFICATE`,
    ``,
    `This is to certify that ${p.name}, born on ${p.born}, has passed the final examination in the degree programme ${p.degree[2]} and has been awarded the academic degree`,
    `${p.degree[1]} (${p.degree[0]})`,
    ``,
    `Overall grade: ${p.grade} (${Number(p.grade) <= 1.5 ? "very good" : Number(p.grade) <= 2.5 ? "good" : "satisfactory"})`,
    `Title of the thesis: "${p.thesis[0]}"`,
    `ECTS credits: ${p.ects}`,
    ``,
    `${pad(between(1, 28))}.${pick(["03", "07", "09"])}.${p.graduated}`,
    `The Chair of the Examination Board · The Dean`,
    `(Seal of the university)`,
  ].join("\n");
}

function transcript(p) {
  return [
    `${p.university} – Transcript of Records`,
    `Student: ${p.name} · Matriculation number: ${p.matriculation} · Programme: ${p.degree[2]} (${p.degree[0]})`,
    ``,
    ...p.rows.map((row) => `${row.module.padEnd(58)} ${String(row.ects).padStart(2)} ECTS   grade ${row.grade.toFixed(1)}`),
    ``,
    `Total: ${p.ects} ECTS · Overall grade (weighted by ECTS): ${p.grade}`,
    `Grading scale: 1.0–1.5 very good · 1.6–2.5 good · 2.6–3.5 satisfactory · 3.6–4.0 sufficient · 5.0 fail.`,
    `This transcript was generated electronically and is valid without a signature.`,
  ].join("\n");
}

// A permit that plainly allows any employment and is valid well beyond the start date.
function workPermit(p) {
  return [
    `SPECIMEN · RESIDENCE PERMIT (Aufenthaltstitel)`,
    `Surname: ${p.last.toUpperCase()} · Given names: ${p.first.toUpperCase()}`,
    `Date of birth: ${p.born} · Nationality: ${p.citizenship}`,
    `Type of permit: Settlement permit (Niederlassungserlaubnis) under § 9 AufenthG`,
    `Remarks: EMPLOYMENT PERMITTED (Erwerbstätigkeit erlaubt)`,
    `Card valid until: ${pad(between(1, 28))}.${pad(between(1, 12))}.${between(2029, 2032)}`,
    `Card number: ${String.fromCharCode(65 + between(0, 25))}${between(10000000, 99999999)}`,
    `Issuing authority: Ausländerbehörde ${pick(["Musterstadt", "Beispielstadt", "Musterhausen", "Probstadt"])}`,
  ].join("\n");
}

function reference(p, job) {
  return [
    `${job.employer} – Letter of Reference`,
    ``,
    `${p.name}, born on ${p.born}, worked in our company as ${job.role} from ${job.period.replace(" – ", " to ")}. The tasks included recurring reports, ad-hoc analyses for the department lead and the maintenance of master data. ${p.first} familiarised themselves with new topics quickly and worked independently and carefully at all times. Results were always delivered on time and in very good quality.`,
    ``,
    ...(FULL ? [
      `Among the tasks we would like to highlight the preparation of the quarterly review for the management, for which ${p.first} collected the figures from several departments, checked them for plausibility and summarised them in a clear presentation. ${p.first} also took over the induction of two new working students and wrote a short guide to the most important reports, which is still in use. Even under time pressure the work remained accurate, and questions from other departments were answered promptly and in a friendly way.`,
      ``,
    ] : []),
    `${p.first} was valued by supervisors and colleagues alike for a friendly and reliable manner. Behaviour towards customers was always exemplary. We thank ${p.first} for the very good work and wish all the best for the future.`,
    ``,
    pick(["Head of Department", "Team Lead", "HR Manager"]),
  ].join("\n");
}

/** One application. `gap` is null, "work_permit" or "degree_certificate" (missing), or "unreadable" (a scan without text). */
function application(index, gap) {
  const p = profile(index);
  const names = some(FILE_NAMES, 8);
  const attachment = (kind, text) => ({ file_name: names.pop(), kind, text });

  const attachments = [attachment("cv", cv(p)), attachment("cover_letter", coverLetter(p))];
  if (gap !== "degree_certificate") {
    attachments.push(attachment("degree_certificate", gap === "unreadable" ? "" : degreeCertificate(p)));
    attachments.push(attachment("transcript", transcript(p)));
  }
  if (!p.euCitizen && gap !== "work_permit") attachments.push(attachment("work_permit", workPermit(p)));
  const withReferences = FULL ? 2 : random() < 0.5 ? 1 : 0;
  for (const job of p.jobs.slice(1, 1 + withReferences)) attachments.push(attachment("reference", reference(p, job)));

  return {
    id: `APP-2026-${4100 + index * 7}`,
    received: `2026-11-${pad(2 + (index % 12))}`,
    position: p.position[0],
    department: p.position[1],
    applicant: { name: p.name, citizenship: p.citizenship, eu_citizen: p.euCitizen },
    // What the applicant uploaded, as the agent sees it: unclear file names and the extracted text.
    attachments: attachments.map(({ file_name, text }) => ({ file_name, text: text || "[The scan could not be read: no text found in the file]" })),
    // The same upload through a form with one field per document – what a rule would look at.
    form: Object.fromEntries(["cv", "degree_certificate", "work_permit"].map((kind) => {
      const found = attachments.find((a) => a.kind === kind);
      return [kind, found ? { file_name: found.file_name, readable: Boolean(found.text) } : null];
    })),
    expected: gap === null ? "complete" : gap === "unreadable" ? "unclear" : `missing ${gap}`,
  };
}

const applications = PEOPLE.map((_, index) => application(index, GAPS[index] ?? null));

const out = path.join(__dirname, FULL ? "applications-full.json" : "applications.json");
fs.writeFileSync(out, `${JSON.stringify(applications, null, 1)}\n`);
const words = (a) => a.attachments.reduce((sum, file) => sum + file.text.split(/\s+/).length, 0);
console.log(`${applications.length} applications written to ${path.relative(process.cwd(), out)}`);
console.log(`expected: ${Object.entries(applications.reduce((c, a) => ({ ...c, [a.expected]: (c[a.expected] || 0) + 1 }), {})).map(([k, v]) => `${v} × ${k}`).join(", ")}`);
console.log(`words in the attachments per application: min ${Math.min(...applications.map(words))}, mean ${Math.round(applications.reduce((s, a) => s + words(a), 0) / applications.length)}, max ${Math.max(...applications.map(words))}`);
