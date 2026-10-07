"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Stats, Kpi, WeekRow } from "@/lib/stats";
import { fmtInt, fmtPct, fmtUsd, fmtValue, timeAgo } from "@/lib/format";

interface Props {
  brand: { name: string; tagline: string };
  refreshSeconds: number;
  weeksToShow: number;
}

type Status = "loading" | "live" | "error";

export function Dashboard({ brand, refreshSeconds, weeksToShow }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [tick, setTick] = useState(0);
  const [changed, setChanged] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setStats((prev) => {
        if (prev && JSON.stringify(prev.weeks) !== JSON.stringify(body.weeks)) {
          setChanged(true);
          setTimeout(() => setChanged(false), 1300);
        }
        return body as Stats;
      });
      setStatus("live");
      setError(null);
      setFetchedAt(Date.now());
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Poll the server. Pause while the tab is hidden, refetch when it returns.
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, refreshSeconds * 1000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [load, refreshSeconds]);

  // One-second clock for "updated Xs ago" and the countdown.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  void tick;

  const secondsSince = fetchedAt ? Math.floor((Date.now() - fetchedAt) / 1000) : 0;
  const nextIn = Math.max(0, refreshSeconds - (secondsSince % refreshSeconds));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Header
        brand={brand}
        status={status}
        secondsSince={secondsSince}
        nextIn={nextIn}
        onRefresh={load}
        sheetUrl={stats?.sheetUrl}
        source={stats?.source}
      />

      {status === "error" && (
        <div className="mt-6 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">
          Could not read the sheet: {error}. Retrying every {refreshSeconds}s.
        </div>
      )}

      {!stats ? (
        <Skeleton />
      ) : (
        <div className={changed ? "flash rounded-2xl" : ""}>
          <QualityStrip stats={stats} />
          <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
            {stats.kpis.map((k) => <KpiCard key={k.key} kpi={k} />)}
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <SectionTitle title="Leads per week" sub={`Last ${weeksToShow} weeks · counted by creation date`} />
              <BarChart weeks={stats.weeks} currentWeek={stats.currentWeek} />
            </div>
            <div className="card p-5">
              <SectionTitle title="Pipeline funnel" sub={`Last ${weeksToShow} weeks · % of leads`} />
              <Funnel stats={stats} />
            </div>
          </section>

          <section className="card mt-6 p-5">
            <SectionTitle
              title="Weekly breakdown by stage"
              sub="Leads, Abandoned and Disqualified count in the week the lead was created. Every later stage counts in the week it was dispoed."
            />
            <WeeklyTable stats={stats} />
          </section>

          <section className="card mt-6 p-5">
            <SectionTitle title="Live lead feed" sub="Newest activity across the pipeline" />
            <Feed stats={stats} />
          </section>

          <footer className="mt-8 pb-6 text-center text-xs text-muted">
            Server reads the Google Sheet on every request, cleans it and computes every number. No keys reach the browser.
            Weeks run Monday to Sunday, Pacific time.
          </footer>
        </div>
      )}
    </main>
  );
}

function Header({ brand, status, secondsSince, nextIn, onRefresh, sheetUrl, source }: {
  brand: Props["brand"]; status: Status; secondsSince: number; nextIn: number; onRefresh: () => void; sheetUrl?: string; source?: string;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">O</span>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{brand.name}</h1>
        </div>
        <p className="mt-1 text-sm text-muted">{brand.tagline}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
          {status === "live" ? <span className="live-dot" /> : <span className={`h-2 w-2 rounded-full ${status === "error" ? "bg-bad" : "bg-muted animate-pulse"}`} />}
          <span className="font-medium">{status === "live" ? "Live" : status === "error" ? "Offline" : "Connecting"}</span>
          {status === "live" && <span className="text-muted tabular">· updated {secondsSince}s ago · next in {nextIn}s</span>}
        </span>
        <button
          onClick={onRefresh}
          className="rounded-full border border-border bg-surface px-3 py-1.5 font-medium transition hover:border-accent hover:text-accent active:scale-95"
        >
          Refresh now
        </button>
        {sheetUrl && (
          <a
            href={sheetUrl}
            target="_blank"
            rel="noreferrer"
            title={source}
            className="rounded-full border border-border bg-surface px-3 py-1.5 font-medium transition hover:border-accent hover:text-accent"
          >
            Open source sheet ↗
          </a>
        )}
      </div>
    </header>
  );
}

function QualityStrip({ stats }: { stats: Stats }) {
  const items = [
    { label: "Rows read", value: fmtInt(stats.rowsRead) },
    { label: "Duplicates merged", value: fmtInt(stats.duplicatesMerged) },
    { label: "Test rows removed", value: fmtInt(stats.testRowsRemoved) },
    { label: "Unique leads", value: fmtInt(stats.leadsTotal) },
  ];
  return (
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      <span className="font-medium text-text">{stats.source}</span>
      {items.map((i) => (
        <span key={i.label} className="transition hover:text-text">
          <span className="tabular font-semibold text-text">{i.value}</span> {i.label.toLowerCase()}
        </span>
      ))}
    </div>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const up = kpi.change !== null && kpi.change > 0;
  const down = kpi.change !== null && kpi.change < 0;
  // For cost per lead, going down is good.
  const goodDir = kpi.key === "cpl" ? down : up;
  const badDir = kpi.key === "cpl" ? up : down;
  return (
    <div className="card group relative p-4" title={kpi.hint}>
      <p className="text-xs font-medium text-muted">{kpi.label}</p>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{fmtValue(kpi.value, kpi.format)}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {kpi.change === null ? (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">no prior week</span>
        ) : (
          <span className={`tabular rounded-full px-2 py-0.5 font-medium ${goodDir ? "bg-good-soft text-good" : badDir ? "bg-bad-soft text-bad" : "bg-surface-2 text-muted"}`}>
            {up ? "▲" : down ? "▼" : "•"} {fmtPct(Math.abs(kpi.change))}
          </span>
        )}
        <span className="text-muted">vs {fmtValue(kpi.previous, kpi.format)}</span>
      </div>
      <p className="pointer-events-none absolute inset-x-3 -bottom-2 translate-y-full rounded-lg border border-border bg-surface px-2 py-1 text-[11px] text-muted opacity-0 shadow-lg transition group-hover:opacity-100 z-10">
        {kpi.hint}
      </p>
    </div>
  );
}

function BarChart({ weeks, currentWeek }: { weeks: WeekRow[]; currentWeek: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.counts.lead));
  const W = 640, H = 200, pad = 28, gap = 10;
  const bw = (W - pad * 2) / weeks.length - gap;
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H + 30}`} className="h-auto w-full" role="img" aria-label="Leads per week">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad} x2={W - pad} y1={H - f * (H - 20)} y2={H - f * (H - 20)} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={pad - 6} y={H - f * (H - 20) + 4} fontSize="10" textAnchor="end" fill="var(--muted)">{Math.round(max * f)}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const h = (w.counts.lead / max) * (H - 20);
          const x = pad + i * (bw + gap) + gap / 2;
          const isCur = w.weekStart === currentWeek;
          const isHover = hover === i;
          return (
            <g key={w.weekStart} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <rect x={x} y={0} width={bw} height={H} fill="transparent" />
              <rect
                x={x} y={H - h} width={bw} height={h} rx="6"
                fill={isCur ? "var(--accent)" : "var(--accent)"}
                opacity={isHover ? 1 : isCur ? 0.9 : 0.55}
                style={{ transition: "opacity 150ms, y 300ms, height 300ms" }}
              />
              <text x={x + bw / 2} y={H + 16} fontSize="10" textAnchor="middle" fill={isCur ? "var(--text)" : "var(--muted)"} fontWeight={isCur ? 600 : 400}>
                {w.label.split(" – ")[0]}
              </text>
              {isHover && (
                <g>
                  <rect x={x + bw / 2 - 48} y={Math.max(0, H - h - 42)} width="96" height="34" rx="6" fill="var(--text)" />
                  <text x={x + bw / 2} y={Math.max(0, H - h - 42) + 14} fontSize="10" textAnchor="middle" fill="var(--bg)">{w.label}</text>
                  <text x={x + bw / 2} y={Math.max(0, H - h - 42) + 28} fontSize="11" fontWeight="600" textAnchor="middle" fill="var(--bg)">
                    {w.counts.lead} leads · {w.counts.passed} passed · {w.counts.hired} hired
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Funnel({ stats }: { stats: Stats }) {
  const max = Math.max(1, stats.funnel[0]?.count ?? 1);
  return (
    <ul className="mt-4 space-y-2">
      {stats.funnel.map((f) => (
        <li key={f.key} className="group" title={`${f.count} of ${stats.totals.lead} leads`}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted transition group-hover:text-text">{f.label}</span>
            <span className="tabular font-medium">{fmtInt(f.count)} <span className="text-muted">· {fmtPct(f.pctOfLeads)}</span></span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent opacity-60 transition-all duration-500 group-hover:opacity-100"
              style={{ width: `${Math.max(2, (f.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function WeeklyTable({ stats }: { stats: Stats }) {
  const [hoverCol, setHoverCol] = useState<string | null>(null);
  return (
    <div className="scroll-x mt-4">
      <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="sticky left-0 z-10 bg-surface py-2 pr-3 font-medium">Week (Mon–Sun)</th>
            {stats.stages.map((s) => (
              <th
                key={s.key}
                onMouseEnter={() => setHoverCol(s.key)}
                onMouseLeave={() => setHoverCol(null)}
                title={`Counted by ${s.countBy === "created" ? "creation date" : "dispo date"}`}
                className={`cursor-default whitespace-nowrap px-2 py-2 text-right font-medium transition ${hoverCol === s.key ? "text-accent" : ""}`}
              >
                {s.label}
                <span className="ml-1 text-[10px] opacity-60">{s.countBy === "created" ? "C" : "D"}</span>
              </th>
            ))}
            <th className="px-2 py-2 text-right font-medium">Ad spend</th>
          </tr>
        </thead>
        <tbody>
          {stats.weeks.map((w) => {
            const cur = w.weekStart === stats.currentWeek;
            return (
              <tr key={w.weekStart} className={`group transition hover:bg-accent-soft/60 ${cur ? "bg-accent-soft/40" : ""}`}>
                <td className={`sticky left-0 z-10 whitespace-nowrap py-2 pr-3 font-medium transition group-hover:bg-accent-soft/60 ${cur ? "bg-accent-soft/40" : "bg-surface"}`}>
                  {w.label}
                  {cur && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">this week</span>}
                </td>
                {stats.stages.map((s) => (
                  <td
                    key={s.key}
                    className={`tabular px-2 py-2 text-right transition ${hoverCol === s.key ? "bg-accent-soft/80 font-semibold" : ""} ${w.counts[s.key] === 0 ? "text-muted/60" : ""}`}
                  >
                    {w.counts[s.key]}
                  </td>
                ))}
                <td className="tabular px-2 py-2 text-right text-muted">{w.spend === null ? "—" : fmtUsd(w.spend)}</td>
              </tr>
            );
          })}
          <tr className="border-t border-border font-semibold">
            <td className="sticky left-0 z-10 bg-surface py-2 pr-3">Total</td>
            {stats.stages.map((s) => (
              <td key={s.key} className={`tabular px-2 py-2 text-right ${hoverCol === s.key ? "text-accent" : ""}`}>{stats.totals[s.key]}</td>
            ))}
            <td className="tabular px-2 py-2 text-right text-muted">{fmtUsd(stats.weeks.reduce((a, w) => a + (w.spend ?? 0), 0))}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted">C = counted by creation date · D = counted by dispo date · hover a column header for details</p>
    </div>
  );
}

const stageTone: Record<string, string> = {
  hired: "bg-good-soft text-good",
  disqualified: "bg-bad-soft text-bad",
  noshow1: "bg-bad-soft text-bad",
  abandoned: "bg-surface-2 text-muted",
};

function Feed({ stats }: { stats: Stats }) {
  return (
    <ul className="mt-3 divide-y divide-border">
      {stats.feed.map((f, i) => (
        <li key={`${f.name}-${f.at}-${i}`} className="group flex items-center gap-3 py-2.5 transition hover:bg-surface-2/60 -mx-2 px-2 rounded-lg">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent transition group-hover:scale-105">
            {f.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{f.name}</p>
            <p className="truncate text-xs text-muted">{f.source} · {f.market}{f.manager ? ` · ${f.manager}` : ""}</p>
          </div>
          <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${stageTone[f.stageKey] ?? "bg-accent-soft text-accent"}`}>{f.stage}</span>
          <span className="tabular hidden w-16 text-right text-xs text-muted sm:block">{timeAgo(f.at)}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-surface-2" />)}
      </div>
      <div className="h-64 rounded-2xl bg-surface-2" />
      <div className="h-72 rounded-2xl bg-surface-2" />
    </div>
  );
}
