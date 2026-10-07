import { settings, type StageKey } from "@/config/settings";
import type { RawData } from "@/lib/data";
import { cleanLeads, dayInZone, parseDate, type Lead } from "./clean";

export interface WeekRow {
  /** Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  label: string;
  counts: Record<StageKey, number>;
  spend: number | null;
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: "int" | "pct" | "usd";
  previous: number;
  /** Change vs the previous week, as a fraction, or null if undefined. */
  change: number | null;
  hint: string;
}

export interface FeedItem {
  name: string;
  stage: string;
  stageKey: StageKey;
  source: string;
  market: string;
  manager: string;
  at: number;
}

export interface Stats {
  generatedAt: string;
  source: string;
  sheetUrl: string;
  rowsRead: number;
  testRowsRemoved: number;
  duplicatesMerged: number;
  unparsableDates: number;
  leadsTotal: number;
  currentWeek: string;
  stages: { key: StageKey; label: string; countBy: "created" | "dispo" }[];
  weeks: WeekRow[];
  totals: Record<StageKey, number>;
  funnel: { key: StageKey; label: string; count: number; pctOfLeads: number }[];
  kpis: Kpi[];
  feed: FeedItem[];
}

const DAY = 86400000;

/** Monday (YYYY-MM-DD) of the week containing the given calendar day. */
export function weekStartOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const dow = (new Date(utc).getUTCDay() + 6) % 7; // Monday = 0
  return isoDay(utc - dow * DAY);
}

function isoDay(utcMidnight: number): string {
  return new Date(utcMidnight).toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return isoDay(Date.UTC(y, m - 1, d) + n * DAY);
}

function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const s = new Date(Date.UTC(y, m - 1, d));
  const e = new Date(s.getTime() + 6 * DAY);
  const f = (x: Date) => x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(s)} – ${f(e)}`;
}

/** Which stage columns a lead at `stage` counts toward. */
function stagesReached(lead: Lead): StageKey[] {
  const out: StageKey[] = [];
  for (let i = 0; i <= lead.stageIndex; i++) {
    const s = settings.stages[i];
    if (s.key === lead.stage || s.implied) out.push(s.key);
  }
  return out;
}

function emptyCounts(): Record<StageKey, number> {
  return Object.fromEntries(settings.stages.map((s) => [s.key, 0])) as Record<StageKey, number>;
}

export function computeStats(raw: RawData, now = Date.now()): Stats {
  const report = cleanLeads(raw.leads);
  const leads = report.leads;
  const today = dayInZone(now);
  const currentWeek = weekStartOf(today);

  // Weekly spend from the Spend tab.
  const spendByWeek = new Map<string, number>();
  const c = settings.sheet.columns;
  for (const r of raw.spend) {
    const d = parseDate(r[c.spendWeek] ?? "");
    const amt = Number(String(r[c.spendAmount] ?? "").replace(/[^0-9.]/g, ""));
    if (d && Number.isFinite(amt)) spendByWeek.set(weekStartOf(d.day), (spendByWeek.get(weekStartOf(d.day)) ?? 0) + amt);
  }

  // Count every lead into the week each stage belongs to.
  const byWeek = new Map<string, Record<StageKey, number>>();
  const bump = (week: string, key: StageKey) => {
    if (!byWeek.has(week)) byWeek.set(week, emptyCounts());
    byWeek.get(week)![key]++;
  };
  for (const lead of leads) {
    for (const key of stagesReached(lead)) {
      const def = settings.stages.find((s) => s.key === key)!;
      const day = def.countBy === "created" ? lead.createdDay : lead.actionDay ?? lead.createdDay;
      bump(weekStartOf(day), key);
    }
  }

  // Last N weeks ending with the current week.
  const weeks: WeekRow[] = [];
  for (let i = settings.weeksToShow - 1; i >= 0; i--) {
    const ws = addDays(currentWeek, -7 * i);
    weeks.push({ weekStart: ws, label: weekLabel(ws), counts: byWeek.get(ws) ?? emptyCounts(), spend: spendByWeek.get(ws) ?? null });
  }
  const totals = emptyCounts();
  for (const w of weeks) for (const s of settings.stages) totals[s.key] += w.counts[s.key];

  const funnel = settings.stages.map((s) => ({
    key: s.key,
    label: s.label,
    count: totals[s.key],
    pctOfLeads: totals.lead ? totals[s.key] / totals.lead : 0,
  }));

  const thisW = weeks[weeks.length - 1].counts;
  const lastW = weeks[weeks.length - 2]?.counts ?? emptyCounts();
  const rate = (n: number, d: number) => (d ? n / d : 0);
  const change = (a: number, b: number) => (b ? (a - b) / b : null);
  const thisSpend = weeks[weeks.length - 1].spend ?? 0;
  const lastSpend = weeks[weeks.length - 2]?.spend ?? 0;
  const cpl = (spend: number, n: number) => (n ? spend / n : 0);

  const kpis: Kpi[] = [
    { key: "leads", label: "New leads", value: thisW.lead, previous: lastW.lead, change: change(thisW.lead, lastW.lead), format: "int", hint: "Leads created this week" },
    { key: "pass", label: "Quiz pass rate", value: rate(thisW.passed, thisW.passed + thisW.disqualified), previous: rate(lastW.passed, lastW.passed + lastW.disqualified), change: change(rate(thisW.passed, thisW.passed + thisW.disqualified), rate(lastW.passed, lastW.passed + lastW.disqualified)), format: "pct", hint: "Passed ÷ completed quizzes" },
    { key: "booked", label: "Interviews booked", value: thisW.booked1, previous: lastW.booked1, change: change(thisW.booked1, lastW.booked1), format: "int", hint: "1st interviews booked this week" },
    { key: "show", label: "Show rate", value: rate(thisW.showed1, thisW.showed1 + thisW.noshow1), previous: rate(lastW.showed1, lastW.showed1 + lastW.noshow1), change: change(rate(thisW.showed1, thisW.showed1 + thisW.noshow1), rate(lastW.showed1, lastW.showed1 + lastW.noshow1)), format: "pct", hint: "Showed ÷ (showed + no-show)" },
    { key: "hired", label: "Hires", value: thisW.hired, previous: lastW.hired, change: change(thisW.hired, lastW.hired), format: "int", hint: "Hired this week" },
    { key: "cpl", label: "Cost per lead", value: cpl(thisSpend, thisW.lead), previous: cpl(lastSpend, lastW.lead), change: change(cpl(thisSpend, thisW.lead), cpl(lastSpend, lastW.lead)), format: "usd", hint: `Ad spend $${thisSpend.toLocaleString()} ÷ leads` },
  ];

  const labelOf = Object.fromEntries(settings.stages.map((s) => [s.key, s.label])) as Record<StageKey, string>;
  const feed: FeedItem[] = [...leads]
    .sort((a, b) => (b.actionAt ?? b.createdAt) - (a.actionAt ?? a.createdAt))
    .slice(0, 12)
    .map((l) => ({ name: l.name, stage: labelOf[l.stage], stageKey: l.stage, source: l.source, market: l.market, manager: l.manager, at: l.actionAt ?? l.createdAt }));

  return {
    generatedAt: new Date(now).toISOString(),
    source: raw.sourceLabel,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${settings.sheet.id}`,
    rowsRead: report.rowsRead,
    testRowsRemoved: report.testRowsRemoved,
    duplicatesMerged: report.duplicatesMerged,
    unparsableDates: report.unparsableDates,
    leadsTotal: leads.length,
    currentWeek,
    stages: settings.stages.map((s) => ({ key: s.key, label: s.label, countBy: s.countBy })),
    weeks,
    totals,
    funnel,
    kpis,
    feed,
  };
}
