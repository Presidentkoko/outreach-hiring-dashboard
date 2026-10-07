/**
 * One settings file. Sheet ID, tab and column names, stage names, branding
 * and refresh timing live here so they can change without code changes.
 * Secrets never live here: they come from environment variables only.
 */
export const settings = {
  brand: {
    name: "Outreach Hiring",
    tagline: "Recruiting pipeline, live from the Google Sheet",
  },

  // Google Sheet that feeds the dashboard.
  sheet: {
    id: process.env.SHEET_ID ?? "1-61MuRMv37x_dhEDhDwc2ZNuv49ZQoibVhBWyfmRUH0",
    tabs: {
      leads: "Leads",
      spend: "Spend",
    },
    // Tab gids, only needed by the public-export fallback (no service account).
    gids: {
      leads: "0",
      spend: "1632118994",
    },
    columns: {
      id: "Lead ID",
      name: "Full Name",
      email: "Email",
      phone: "Phone",
      created: "Date of creation",
      stage: "Stage",
      dispo: "Dispo",
      actionDate: "Date of action",
      source: "Source",
      market: "Market",
      manager: "Manager",
      quiz: "Quiz result",
      abandonedAt: "Abandoned at",
      spendWeek: "Week starting",
      spendAmount: "Amount",
    },
  },

  // Pipeline stages in order. `countBy` decides which date puts the lead in a week:
  // stages 1-3 count in the week the lead was created, later stages in the week
  // they were dispoed. This mirrors the client's Stats v2 tab.
  stages: [
    { key: "lead", label: "Leads", countBy: "created", implied: true },
    { key: "abandoned", label: "Abandoned quiz", countBy: "created", implied: false },
    { key: "disqualified", label: "Disqualified", countBy: "created", implied: false },
    { key: "passed", label: "Passed quiz", countBy: "dispo", implied: true },
    { key: "booked1", label: "1st interview booked", countBy: "dispo", implied: true },
    { key: "showed1", label: "1st interview showed", countBy: "dispo", implied: true },
    { key: "noshow1", label: "1st interview no-show", countBy: "dispo", implied: false },
    { key: "booked2", label: "2nd interview booked", countBy: "dispo", implied: true },
    { key: "showed2", label: "2nd interview showed", countBy: "dispo", implied: true },
    { key: "hired", label: "Hired", countBy: "dispo", implied: true },
  ] as const,

  // Sheet values that map to each stage key.
  stageLabelsInSheet: {
    "Lead": "lead",
    "Abandoned quiz": "abandoned",
    "Disqualified": "disqualified",
    "Passed quiz": "passed",
    "1st interview booked": "booked1",
    "1st interview showed": "showed1",
    "1st interview no-show": "noshow1",
    "2nd interview booked": "booked2",
    "2nd interview showed": "showed2",
    "Hired": "hired",
  } as Record<string, string>,

  // Rows matching these are test data and are dropped.
  testPatterns: {
    nameOrEmailContains: ["test"],
    emails: ["test@test.test"],
  },

  // Weeks run Monday to Sunday in this time zone.
  timeZone: "America/Los_Angeles",
  weeksToShow: 8,

  // How often the browser re-reads the sheet, in seconds.
  refreshSeconds: 30,
} as const;

export type StageKey = (typeof settings.stages)[number]["key"];
