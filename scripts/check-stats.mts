import { getDataSource } from "../src/lib/data";
import { computeStats } from "../src/lib/stats";
const raw = await getDataSource().read();
const s = computeStats(raw);
console.log({ source: s.source, rowsRead: s.rowsRead, dupes: s.duplicatesMerged, test: s.testRowsRemoved, bad: s.unparsableDates, leads: s.leadsTotal, currentWeek: s.currentWeek });
console.table(s.weeks.map(w => ({ week: w.label, ...w.counts, spend: w.spend })));
console.log(s.kpis.map(k => `${k.label}: ${k.value} (prev ${k.previous})`).join("\n"));
