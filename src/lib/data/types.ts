/**
 * Shape of the raw data every source must return.
 * Pages and stats code only ever see these types, so the source can be
 * swapped (Google Sheets today, GoHighLevel API later) without touching them.
 */
export type RawRow = Record<string, string>;

export interface RawData {
  leads: RawRow[];
  spend: RawRow[];
  /** Human-readable name of the source, shown in the UI. */
  sourceLabel: string;
  /** When the source was read. */
  fetchedAt: string;
}

export interface DataSource {
  read(): Promise<RawData>;
}
