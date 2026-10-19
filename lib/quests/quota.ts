/**
 * The words an admin signs to change how often a season hands out the big
 * quest. Built the same way on both sides, and rebuilt server-side from what
 * is about to be written rather than taken from the request.
 */
export const quotaMessage = (season: number, quota: number, who: string, at: string) =>
  [
    `Ronke Quest — Season ${season} hands out ${quota} adoptions`,
    `by ${who.toLowerCase()}`,
    at,
  ].join("\n");
