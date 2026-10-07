import { settings, type StageKey } from "@/config/settings";
import type { RawRow } from "@/lib/data";

/** One person after cleaning. */
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Pacific calendar date (YYYY-MM-DD) the lead was created. */
  createdDay: string;
  createdAt: number;
  /** Pacific calendar date of the latest action, if any. */
  actionDay: string | null;
  actionAt: number | null;
  stage: StageKey;
  stageIndex: number;
  dispo: string;
  source: string;
  market: string;
  manager: string;
  quiz: "Pass" | "Fail" | "";
  abandonedAt: string;
}

export interface CleanReport {
  rowsRead: number;
  testRowsRemoved: number;
  duplicatesMerged: number;
  unparsableDates: number;
  leads: Lead[];
}

const stageIndex = Object.fromEntries(settings.stages.map((s, i) => [s.key, i])) as Record<StageKey, number>;

/** Clean raw sheet rows: drop test rows, normalize dates, merge duplicates. */
export function cleanLeads(rows: RawRow[]): CleanReport {
  const c = settings.sheet.columns;
  let testRowsRemoved = 0;
  let unparsableDates = 0;
  const byEmail = new Map<string, Lead>();
  const byPhone = new Map<string, Lead>();
  const leads: Lead[] = [];
  let duplicatesMerged = 0;

  for (const r of rows) {
    const name = r[c.name] ?? "";
    const email = normalizeEmail(r[c.email] ?? "");
    const phone = normalizePhone(r[c.phone] ?? "");
    if (isTestRow(name, email)) { testRowsRemoved++; continue; }

    const created = parseDate(r[c.created] ?? "");
    if (!created) { unparsableDates++; continue; }
    const action = parseDate(r[c.actionDate] ?? "");

    const stageKey = (settings.stageLabelsInSheet[r[c.stage] ?? ""] ?? "lead") as StageKey;
    const lead: Lead = {
      id: r[c.id] ?? "",
      name: titleCase(name),
      email,
      phone,
      createdDay: created.day,
      createdAt: created.ms,
      actionDay: action?.day ?? null,
      actionAt: action?.ms ?? null,
      stage: stageKey,
      stageIndex: stageIndex[stageKey],
      dispo: r[c.dispo] ?? "",
      source: r[c.source] ?? "",
      market: r[c.market] ?? "",
      manager: r[c.manager] ?? "",
      quiz: (r[c.quiz] as Lead["quiz"]) ?? "",
      abandonedAt: r[c.abandonedAt] ?? "",
    };

    // One record per person: match by email first, then phone.
    const existing = (email && byEmail.get(email)) || (phone && byPhone.get(phone)) || null;
    if (existing) {
      duplicatesMerged++;
      merge(existing, lead);
      if (email) byEmail.set(email, existing);
      if (phone) byPhone.set(phone, existing);
      continue;
    }
    leads.push(lead);
    if (email) byEmail.set(email, lead);
    if (phone) byPhone.set(phone, lead);
  }

  return { rowsRead: rows.length, testRowsRemoved, duplicatesMerged, unparsableDates, leads };
}

/** Keep the earliest creation and the furthest stage. */
function merge(into: Lead, from: Lead) {
  if (from.createdAt < into.createdAt) { into.createdAt = from.createdAt; into.createdDay = from.createdDay; }
  if (from.stageIndex > into.stageIndex || (from.stageIndex === into.stageIndex && (from.actionAt ?? 0) > (into.actionAt ?? 0))) {
    into.stage = from.stage; into.stageIndex = from.stageIndex;
    into.actionAt = from.actionAt; into.actionDay = from.actionDay;
    into.dispo = from.dispo; into.quiz = from.quiz || into.quiz;
  }
  if (!into.email && from.email) into.email = from.email;
  if (!into.phone && from.phone) into.phone = from.phone;
  if (!into.manager && from.manager) into.manager = from.manager;
}

function isTestRow(name: string, email: string): boolean {
  const t = settings.testPatterns;
  const hay = `${name} ${email}`.toLowerCase();
  return (t.emails as readonly string[]).includes(email) || t.nameOrEmailContains.some((p) => hay.includes(p));
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function normalizePhone(s: string): string {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function titleCase(s: string): string {
  return s.trim().toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/**
 * Parse the mixed formats the sheet contains and return the calendar day in
 * the configured time zone plus a millisecond timestamp.
 * Handles: 9/29/2026 14:03, 2026-09-29 14:03:00, Sep 29, 2026, ISO 8601 (UTC).
 * Strings without a zone are taken as wall-clock time in the configured zone.
 */
export function parseDate(input: string): { day: string; ms: number } | null {
  const s = input.trim();
  if (!s) return null;

  // ISO with zone, e.g. 2026-09-29T14:03:00.000Z
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const ms = Date.parse(s);
    if (Number.isNaN(ms)) return null;
    return { day: dayInZone(ms), ms };
  }

  let y = 0, mo = 0, d = 0, h = 0, mi = 0;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/))) {
    mo = +m[1]; d = +m[2]; y = +m[3]; h = +(m[4] ?? 0); mi = +(m[5] ?? 0);
  } else if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/))) {
    y = +m[1]; mo = +m[2]; d = +m[3]; h = +(m[4] ?? 0); mi = +(m[5] ?? 0);
  } else if ((m = s.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/))) {
    mo = MONTHS[m[1].toLowerCase()] ?? 0; d = +m[2]; y = +m[3];
  } else {
    const ms = Date.parse(s);
    if (Number.isNaN(ms)) return null;
    return { day: dayInZone(ms), ms };
  }
  if (!y || !mo || !d) return null;
  const day = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { day, ms: zonedToUtc(y, mo, d, h, mi) };
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timeZone, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD of a timestamp in the configured zone. */
export function dayInZone(ms: number): string {
  return dayFmt.format(new Date(ms));
}

/** Convert wall-clock time in the configured zone to a UTC timestamp. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: settings.timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? 0);
  const asZone = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return guess - (asZone - guess);
}
