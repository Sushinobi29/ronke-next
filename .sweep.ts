import postgres from "postgres";
import { questsForDay } from "@/lib/quests/daily";
import { poolOnDay } from "@/lib/quests/pool";
import { readMetric } from "@/lib/quests/metrics";

const DAY = 20774;
const url = `postgres://${process.env.PGUSER}:${encodeURIComponent(process.env.PGPASSWORD!)}@${process.env.RAILWAY_TCP_PROXY_DOMAIN}:${process.env.RAILWAY_TCP_PROXY_PORT}/${process.env.PGDATABASE}`;
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 2 });
const stored = await sql`select effective_from, pool from quest_pool order by effective_from desc`;
const pool = poolOnDay(DAY, stored.map((r: any) => ({ from: r.effective_from, pool: r.pool })));
const [st] = await sql`select state from quest_state where day = ${DAY}`;
const races = new Map<string, any>(((st.state as any).races ?? []).map(([k, v]: any) => [k.toLowerCase(), v]));
const results = await sql`select lower(address) as address, quest_id, done, progress, target from quest_results where day = ${DAY} and quest_id like 'race.%'`;
const scored = new Map(results.map((r: any) => [`${r.address}|${r.quest_id}`, r]));

// Every wallet that raced today, plus every wallet with a race quest that has a scoring row.
const played = await sql`select distinct lower(address) as address from quest_days where day = ${DAY}`;
let stuck: string[] = [], ok = 0, noRaceCard = 0;
for (const { address } of played as any[]) {
  const board = questsForDay(DAY, address, pool).filter((q: any) => q.id.startsWith("race."));
  if (!board.length) { noRaceCard++; continue; }
  const r = races.get(address) ?? { races: 0, wins: 0, markets: [] };
  const stats: any = { races: r.races, raceWins: r.wins, raceMarkets: (r.markets ?? []).length };
  for (const q of board) {
    const measured = readMetric(q.metric, stats);
    const shouldBeDone = measured >= (q.target ?? 1);
    const row = scored.get(`${address}|${q.id}`);
    if (shouldBeDone && !row?.done) stuck.push(`${address} ${q.id} measured=${measured}/${q.target} row=${row ? JSON.stringify({done:row.done,progress:row.progress}) : "MISSING"}`);
    else if (shouldBeDone) ok++;
  }
}
console.log(`wallets with a scoring row today: ${(played as any[]).length}`);
console.log(`  of those, no race card on board: ${noRaceCard}`);
console.log(`  race quests correctly marked done: ${ok}`);
console.log(`  race quests that SHOULD be done but are not: ${stuck.length}`);
for (const s of stuck) console.log(`     ${s}`);
await sql.end();
