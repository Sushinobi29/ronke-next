import postgres from "postgres";
import { questsForDay } from "@/lib/quests/daily";
import { poolOnDay } from "@/lib/quests/pool";
import { readMetric } from "@/lib/quests/metrics";

const DAY = 20774;
const W = ["0x3e6f8ca8fbae3ff7e3d1f68a50e3119ddb716d29", "0xc8b7aefc4a85bbec9c2e7db9850c56eddd2800b2"];
const url = `postgres://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD!)}@${process.env.RAILWAY_TCP_PROXY_DOMAIN}:${process.env.RAILWAY_TCP_PROXY_PORT}/${process.env.PGDATABASE}`;
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 2 });

const stored = await sql`select effective_from, pool from quest_pool order by effective_from desc`;
const snapshots = stored.map((r: any) => ({ from: r.effective_from, pool: r.pool }));
const pool = poolOnDay(DAY, snapshots);
console.log(`pool in force on day ${DAY}: ${pool.length} quests, race quests = ${pool.filter((q: any) => q.id.startsWith("race.")).length}`);

const [st] = await sql`select state from quest_state where day = ${DAY}`;
const racesToday = new Map<string, any>(((st.state as any).races ?? []).map(([k, v]: any) => [k.toLowerCase(), v]));

for (const w of W) {
  const board = questsForDay(DAY, w, pool);
  const r = racesToday.get(w) ?? { races: 0, wins: 0, markets: [] };
  const stats: any = { races: r.races, raceWins: r.wins, raceMarkets: (r.markets ?? []).length };
  console.log(`\n=== ${w} ===`);
  console.log(`   measured: races=${stats.races} wins=${stats.raceWins} markets=${stats.raceMarkets}`);
  for (const q of board) {
    const isRace = q.id.startsWith("race.");
    const measured = isRace ? readMetric(q.metric, stats) : null;
    const verdict = isRace ? (measured! >= (q.target ?? 1) ? "SHOULD BE DONE" : `short (${measured}/${q.target})`) : "";
    console.log(`   ${isRace ? "*" : " "} ${q.id.padEnd(16)} metric=${String(q.metric).padEnd(12)} target=${String(q.target ?? 1).padEnd(4)} ${verdict}`);
  }
}
await sql.end();
