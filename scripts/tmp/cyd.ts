import fs from "node:fs";
for (const f of [".env.local", ".env"]) {
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)="?([^"]*)"?$/.exec(line.trim());
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const WALLET = "0xc7ce068c62aac2268c4de9540493bd32ac76e82e";

async function main() {
  const { dayIndex, questsForDay } = await import("@/lib/quests/daily");
  const { poolOnDay } = await import("@/lib/quests/pool");
  const { readPools } = await import("@/lib/quests/store");
  const { blockAtSecond } = await import("@/lib/quests/read");
  const { multicall, callData, padAddress, words, toNumber, toBigInt, blockNumber } =
    await import("@/lib/quests/chain");
  const { COLLECTIONS, SELECTORS } = await import("@/lib/quests/contracts");

  const day = dayIndex();
  const pool = poolOnDay(day, await readPools());
  const five = questsForDay(day, WALLET, pool);
  console.log(`day ${day}, their board: ${five.map((q) => q.id).join(", ")}`);
  console.log(`barracks.take on it: ${five.some((q) => q.id === "barracks.take") ? "YES" : "NO — the quest is not on their board"}\n`);

  // What the chain says: barracks held at midnight vs now.
  const startBlock = await blockAtSecond(day * 86400);
  const head = Number(toBigInt((await blockNumber()).replace(/^0x/, "")));
  const call = [{ target: COLLECTIONS.barracks, data: callData(SELECTORS.balanceOf, padAddress(WALLET)) }];
  const [nowRes] = await multicall(call);
  const [thenRes] = await multicall(call, 200, "0x" + startBlock.toString(16));
  const held = toNumber(words(nowRes ?? "0x")[0]);
  const opened = thenRes ? toNumber(words(thenRes)[0]) : null;
  console.log(`barracks held now        : ${held}`);
  console.log(`barracks held at midnight: ${opened === null ? "HISTORICAL READ FAILED" : opened}  (block ${startBlock}, head ${head})`);
  console.log(`gained today             : ${opened === null ? "unknowable -> scores as 0" : Math.max(0, held - opened)}\n`);

  // Same for trophies, the other Age of Ronke quest.
  const tcall = [{ target: COLLECTIONS.trophies, data: callData(SELECTORS.balanceOf, padAddress(WALLET)) }];
  const [tNow] = await multicall(tcall);
  const [tThen] = await multicall(tcall, 200, "0x" + startBlock.toString(16));
  console.log(`trophies now ${toNumber(words(tNow ?? "0x")[0])}, at midnight ${tThen ? toNumber(words(tThen)[0]) : "read failed"}`);

  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const rows = await sql`
    select quest_id, done, points, progress, target from quest_results
     where day = ${day} and address = ${WALLET} order by quest_id`;
  console.log(`\nrecorded today (${rows.length} rows):`);
  for (const r of rows) console.log(`   ${r.quest_id.padEnd(16)} done=${String(r.done).padEnd(5)} ${r.progress}/${r.target}`);
  const [d] = await sql`select points, done, bonus, updated_at from quest_days where day = ${day} and address = ${WALLET}`;
  console.log(`day row: ${d ? `${d.points} pts, ${d.done} done, written ${new Date(d.updated_at).toISOString()}` : "none"}`);
  await sql.end();
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
