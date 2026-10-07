import { JWT } from "google-auth-library";
import { settings } from "@/config/settings";
import type { DataSource, RawData, RawRow } from "../types";

/**
 * Google Sheets source.
 *
 * Two modes, picked automatically:
 *  1. Service account (production): set GOOGLE_SERVICE_ACCOUNT_KEY to the
 *     base64-encoded service-account JSON and share the sheet with its
 *     client_email. Reads go through the Sheets API v4 with a read-only scope.
 *  2. Public export (demo fallback): if no key is set, the sheet must be
 *     shared "anyone with the link" and is read through the CSV export URL.
 *
 * Both run on the server only. Nothing here is ever bundled for the browser.
 */
export class GoogleSheetsSource implements DataSource {
  private jwt: JWT | null;

  constructor() {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (raw) {
      const json = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
      this.jwt = new JWT({
        email: json.client_email,
        key: json.private_key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });
    } else {
      this.jwt = null;
    }
  }

  async read(): Promise<RawData> {
    const { leads, spend } = settings.sheet.tabs;
    const [leadRows, spendRows] = await Promise.all([this.readTab(leads), this.readTab(spend)]);
    return {
      leads: leadRows,
      spend: spendRows,
      sourceLabel: this.jwt ? "Google Sheets (service account)" : "Google Sheets (public export)",
      fetchedAt: new Date().toISOString(),
    };
  }

  private async readTab(tab: string): Promise<RawRow[]> {
    const id = settings.sheet.id;
    if (this.jwt) {
      const token = await this.jwt.getAccessToken();
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(tab)}?valueRenderOption=FORMATTED_VALUE`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token.token}` }, cache: "no-store" });
      if (!res.ok) throw new Error(`Sheets API ${res.status} reading "${tab}"`);
      const body = (await res.json()) as { values?: string[][] };
      return toObjects(body.values ?? []);
    }
    const gid = tab === settings.sheet.tabs.spend ? settings.sheet.gids.spend : settings.sheet.gids.leads;
    const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet export ${res.status} reading "${tab}"`);
    return toObjects(parseCsv(await res.text()));
  }
}

/** First row is the header; every other row becomes {header: value}. */
function toObjects(rows: string[][]): RawRow[] {
  const [header = [], ...body] = rows;
  return body
    .filter((r) => r.some((c) => (c ?? "").trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** Small RFC 4180 CSV parser (quotes, escaped quotes, newlines in cells). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
