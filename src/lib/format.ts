export const fmtInt = (n: number) => n.toLocaleString("en-US");
export const fmtPct = (n: number) => `${(n * 100).toFixed(n >= 1 ? 0 : 1).replace(/\.0$/, "")}%`;
export const fmtUsd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function fmtValue(n: number, format: "int" | "pct" | "usd"): string {
  return format === "pct" ? fmtPct(n) : format === "usd" ? fmtUsd(n) : fmtInt(n);
}

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
