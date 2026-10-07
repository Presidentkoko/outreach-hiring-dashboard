// Generates fake recruiting data for the demo Google Sheet.
// Output: data/Leads.tsv and data/Spend.tsv (tab-separated, paste straight into Sheets).
// Deliberately messy: duplicate rows, test rows, mixed date formats.
import { mkdirSync, writeFileSync } from "node:fs";

let seed = 20261008;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (a) => a[Math.floor(rand() * a.length)];

const first = ["Liam","Olivia","Noah","Emma","Mateo","Ava","Ethan","Sofia","Lucas","Mia","James","Isabella","Daniel","Camila","Aiden","Zoe","Caleb","Nora","Elijah","Luna","Jayden","Aria","Owen","Chloe","Levi","Layla","Isaac","Ellie","Carter","Hazel","Julian","Violet","Wyatt","Aurora","Leo","Stella","Ezra","Lily","Hudson","Ivy"];
const last = ["Garcia","Smith","Nguyen","Johnson","Martinez","Brown","Lee","Davis","Lopez","Wilson","Reyes","Anderson","Taylor","Hernandez","Moore","Clark","Ramirez","Lewis","Walker","Torres","Flores","Young","Allen","King","Scott","Rivera","Hill","Green","Adams","Baker"];
const sources = ["Facebook","Instagram","Indeed","Referral","TikTok"];
const markets = ["Phoenix","Dallas","Las Vegas","Tampa","Denver"];
const managers = ["", "", "", "Carlos M.", "Jenna R.", "Tyrell B."];

// Pipeline in order. Each lead gets a furthest stage; stages before it are implied.
const stages = [
  "Lead", "Abandoned quiz", "Disqualified", "Passed quiz", "1st interview booked",
  "1st interview showed", "1st interview no-show", "2nd interview booked",
  "2nd interview showed", "Hired",
];
// Probabilities of final stage.
const weights = [0.18, 0.17, 0.13, 0.10, 0.09, 0.09, 0.07, 0.06, 0.06, 0.05];
const dispoFor = {
  "1st interview showed": "Held 1st interview",
  "1st interview no-show": "No show",
  "2nd interview booked": "Held 1st interview",
  "2nd interview showed": "Held 2nd interview - undetermined outcome",
  "Hired": "Hired",
};
const quizFor = (s) => (s === "Lead" || s === "Abandoned quiz" ? "" : s === "Disqualified" ? "Fail" : "Pass");

// Mixed date formats on purpose.
const pad = (n) => String(n).padStart(2, "0");
function fmt(d, style) {
  const M = d.getUTCMonth() + 1, D = d.getUTCDate(), Y = d.getUTCFullYear(), h = d.getUTCHours(), m = d.getUTCMinutes();
  switch (style) {
    case 0: return `${M}/${D}/${Y} ${h}:${pad(m)}`;                 // 9/29/2026 14:03
    case 1: return d.toISOString();                                   // ISO
    case 2: return `${Y}-${pad(M)}-${pad(D)} ${pad(h)}:${pad(m)}:00`;  // 2026-09-29 14:03:00
    default: return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][M-1]} ${D}, ${Y}`; // Sep 29, 2026
  }
}

const start = Date.UTC(2026, 7, 10); // Mon Aug 10 2026, 8+ weeks before Oct 8
const end = Date.UTC(2026, 9, 8, 12);
const rows = [];
let id = 1;
for (let i = 0; i < 420; i++) {
  const fn = pick(first), ln = pick(last);
  const email = `${fn}.${ln}${Math.floor(rand() * 90 + 10)}@example.com`.toLowerCase();
  const phone = `(${Math.floor(rand() * 800 + 200)}) 555-${pad(Math.floor(rand() * 10000)).padStart(4, "0")}`;
  const created = new Date(start + rand() * (end - start));
  let r = rand(), si = 0; for (let k = 0; k < weights.length; k++) { r -= weights[k]; if (r <= 0) { si = k; break; } }
  const stage = stages[si];
  const lag = si <= 2 ? 0 : (1 + rand() * 12) * 86400000;
  let dispoDate = new Date(Math.min(created.getTime() + lag, end));
  const style = Math.floor(rand() * 4);
  rows.push({
    id: id++, name: `${fn} ${ln}`, email, phone,
    created: fmt(created, style), stage,
    dispo: dispoFor[stage] || "",
    dispoDate: si <= 2 ? "" : fmt(dispoDate, Math.floor(rand() * 4)),
    source: pick(sources), market: pick(markets),
    manager: si >= 5 && stage !== "1st interview no-show" ? pick(managers) : "",
    quiz: quizFor(stage),
    abandonedAt: stage === "Abandoned quiz" ? `Q${Math.floor(rand() * 6 + 1)}` : "",
  });
}
// Duplicates: same person, re-submitted (same email or same phone).
for (let i = 0; i < 25; i++) {
  const src = rows[Math.floor(rand() * rows.length)];
  const dup = { ...src, id: id++, name: rand() < 0.5 ? src.name.toUpperCase() : src.name };
  if (rand() < 0.4) dup.email = ""; // phone-only match
  rows.push(dup);
}
// Test rows.
const tests = [
  ["Test Lead", "test@test.test"], ["Sam Test", "sam+test@example.com"], ["TEST TEST", "qa.test@example.com"], ["Zapier Test", "zap@test.test"],
];
for (const [n, e] of tests) rows.push({ id: id++, name: n, email: e, phone: "(000) 555-0000", created: fmt(new Date(end - 86400000 * 3), 0), stage: "Passed quiz", dispo: "", dispoDate: fmt(new Date(end - 86400000 * 2), 1), source: "Facebook", market: "Phoenix", manager: "", quiz: "Pass", abandonedAt: "" });

// Shuffle.
for (let i = rows.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rows[i], rows[j]] = [rows[j], rows[i]]; }

const header = ["Lead ID","Full Name","Email","Phone","Date of creation","Stage","Dispo","Date of action","Source","Market","Manager","Quiz result","Abandoned at"];
const tsv = [header.join("\t"), ...rows.map(r => [r.id, r.name, r.email, r.phone, r.created, r.stage, r.dispo, r.dispoDate, r.source, r.market, r.manager, r.quiz, r.abandonedAt].join("\t"))].join("\n");

const spend = ["Week starting\tAmount"];
for (let w = 0; w < 9; w++) {
  const d = new Date(start + w * 7 * 86400000);
  spend.push(`${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}\t${Math.round(1800 + rand() * 1400)}`);
}
mkdirSync("data", { recursive: true });
writeFileSync("data/Leads.tsv", tsv + "\n");
writeFileSync("data/Spend.tsv", spend.join("\n") + "\n");
console.log(`rows: ${rows.length}`);
