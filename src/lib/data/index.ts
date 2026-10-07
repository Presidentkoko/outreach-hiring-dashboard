import type { DataSource } from "./types";
import { GoogleSheetsSource } from "./sources/google-sheets";

/**
 * The only place that decides where data comes from.
 * Version 2 adds a GoHighLevelSource here and nothing else changes.
 */
export function getDataSource(): DataSource {
  switch (process.env.DATA_SOURCE ?? "sheets") {
    case "sheets":
    default:
      return new GoogleSheetsSource();
  }
}

export type { DataSource, RawData, RawRow } from "./types";
