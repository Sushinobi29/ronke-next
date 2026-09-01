/**
 * Season persistence.
 *
 * Everything else on the board is derived live from Ronin, which works
 * because a day's quests are answerable from a day's chain state. A season is
 * not: once the day rolls the quests are gone, and no amount of reading the
 * chain will tell you what yesterday's five were or who finished them. So the
 * day's result has to be written down.
 *
 * One row per wallet per day; a season total is a sum over its days. The
 * board runs without this — it simply cannot show anything but today until a
 * DATABASE_URL exists.
 */

import type { Sql } from "postgres";

let client: Sql | null = null;
let ready: Promise<Sql | null> | null = null;

export const hasStore = () => Boolean(process.env.DATABASE_URL);

async function connect(): Promise<Sql | null> {
  if (!hasStore()) return null;
  if (client) return client;

  const { default: postgres } = await import("postgres");
  // Serverless: many short-lived instances, so keep each one's footprint tiny
  // and let the pooled connection string do the pooling.
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 20, prepare: false });

  await sql`
    create table if not exists quest_days (
      day        integer not null,
      address    text    not null,
      points     integer not null,
      done       integer not null,
      bonus      integer not null,
      updated_at timestamptz not null default now(),
      primary key (day, address)
    )
  `;
  await sql`create index if not exists quest_days_day_idx on quest_days (day)`;

  // One verified post per wallet per day. The url is kept so a disputed
  // clean sweep can be checked by a human later.
  await sql`
    create table if not exists quest_social (
      day         integer not null,
      address     text    not null,
      url         text    not null,
      handle      text,
      verified_at timestamptz not null default now(),
      primary key (day, address)
    )
  `;

  client = sql;
  return sql;
}

/** Resolves to null rather than throwing when no store is configured. */
function db(): Promise<Sql | null> {
  ready = ready ?? connect().catch(() => null);
  return ready;
}

export interface DayResult {
  address: string;
  points: number;
  done: number;
  bonus: number;
}

/**
 * Writes a wallet's standing for a day. Called whenever a wallet is scored,
 * so a day's row converges on its final value as the day goes on and settles
 * once the day rolls.
 */
export async function recordDay(day: number, result: DayResult): Promise<void> {
  const sql = await db();
  if (!sql) return;

  try {
    await sql`
      insert into quest_days (day, address, points, done, bonus, updated_at)
      values (${day}, ${result.address.toLowerCase()}, ${result.points}, ${result.done}, ${result.bonus}, now())
      on conflict (day, address) do update
        set points = excluded.points,
            done = excluded.done,
            bonus = excluded.bonus,
            updated_at = now()
    `;
  } catch {
    // A board that cannot write is still a board that works today.
  }
}

export async function recordMany(day: number, results: DayResult[]): Promise<void> {
  await Promise.all(results.map((result) => recordDay(day, result)));
}

export interface SeasonRow {
  address: string;
  points: number;
  days: number;
  sweeps: number;
}

/** Season standings, highest total first. */
export async function seasonStandings(
  fromDay: number,
  toDay: number,
  limit = 50
): Promise<SeasonRow[]> {
  const sql = await db();
  if (!sql) return [];

  try {
    const rows = await sql<
      { address: string; points: string; days: string; sweeps: string }[]
    >`
      select address,
             sum(points)::text                        as points,
             count(*)::text                           as days,
             count(*) filter (where bonus > 0)::text  as sweeps
        from quest_days
       where day between ${fromDay} and ${toDay}
       group by address
       having sum(points) > 0
       order by sum(points) desc
       limit ${limit}
    `;
    return rows.map((row) => ({
      address: row.address,
      points: Number(row.points),
      days: Number(row.days),
      sweeps: Number(row.sweeps),
    }));
  } catch {
    return [];
  }
}

/** One wallet's season total, for pinning their own row. */
export async function walletSeason(
  address: string,
  fromDay: number,
  toDay: number
): Promise<SeasonRow | null> {
  const sql = await db();
  if (!sql) return null;

  try {
    const [row] = await sql<{ points: string; days: string; sweeps: string }[]>`
      select sum(points)::text                       as points,
             count(*)::text                          as days,
             count(*) filter (where bonus > 0)::text as sweeps
        from quest_days
       where address = ${address.toLowerCase()}
         and day between ${fromDay} and ${toDay}
    `;
    if (!row?.points) return null;
    return {
      address: address.toLowerCase(),
      points: Number(row.points),
      days: Number(row.days),
      sweeps: Number(row.sweeps),
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ social */

export async function recordSocial(
  day: number,
  address: string,
  url: string,
  handle?: string
): Promise<void> {
  const sql = await db();
  if (!sql) return;
  try {
    await sql`
      insert into quest_social (day, address, url, handle)
      values (${day}, ${address.toLowerCase()}, ${url}, ${handle ?? null})
      on conflict (day, address) do update
        set url = excluded.url, handle = excluded.handle, verified_at = now()
    `;
  } catch {
    // Verified but unrecorded is better than refusing the player outright.
  }
}

/** Everyone who has had a post verified today, in one read. */
export async function socialVerifiedOn(day: number): Promise<Set<string>> {
  const sql = await db();
  if (!sql) return new Set();
  try {
    const rows = await sql<{ address: string }[]>`
      select address from quest_social where day = ${day}
    `;
    return new Set(rows.map((row) => row.address));
  } catch {
    return new Set();
  }
}

/* ------------------------------------------------------------------ streak */

/**
 * Consecutive clean sweeps ending the day before `day`.
 *
 * Read backwards from yesterday and stop at the first gap, so a missed day
 * resets it — which is the whole point of a streak. Bounded to a season's
 * worth of rows; nobody needs a thousand-day lookback.
 */
export async function priorSweepStreak(address: string, day: number, limit = 60): Promise<number> {
  const sql = await db();
  if (!sql) return 0;

  try {
    const rows = await sql<{ day: number }[]>`
      select day from quest_days
       where address = ${address.toLowerCase()}
         and bonus > 0
         and day < ${day}
         and day >= ${day - limit}
       order by day desc
    `;

    let streak = 0;
    let expected = day - 1;
    for (const row of rows) {
      if (row.day !== expected) break;
      streak += 1;
      expected -= 1;
    }
    return streak;
  } catch {
    return 0;
  }
}
